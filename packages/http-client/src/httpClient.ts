import dispatchRequest from "./dispatchRequest.js"
import HttpClientError from "./httpClientError.js"
import InterceptorManager from "./interceptorManager.js"
import {
  RAWRequestConfig,
  RAWResponseConfig,
  RequestConfig,
  RequestConfigForceSignal,
  ResolvedRAWRequestConfig,
  ResolvedRequestConfig,
  ResponseConfig,
} from "./types.js"
import { isRAWRequestConfig, isRAWResponseConfig } from "./utils.js"

type RequestConfigArgs<
  ForceSignal extends boolean,
  D = unknown,
> = ForceSignal extends true
  ? [config: RequestConfigForceSignal<D>]
  : [config?: RequestConfig<D>]

/**
 * The HttpClient class is used to send HTTP requests.
 *
 * @template ForceSignal - Whether to force the signal to be true or false
 * @param baseConfig - The base config to use for the request
 * @returns The HttpClient instance
 *
 * @example With force signal
 * ```typescript
 * const httpClient = new HttpClient({
 *   baseURL: "https://api.example.com/v2",
 *   timeout: 10000,
 * })
 *
 * const usersResponse = await httpClient.get("/users", {
 *   signal: new AbortSignal(),
 * })
 * console.log(usersResponse.data)
 *
 * try {
 *   const loginResponse = await httpClient.post("/login", {
 *     email: "john.doe@example.com",
 *     password: "password",
 *   }, {
 *     baseURL: "https://api.example.com/v1",
 *     timeout: 3000,
 *     signal: new AbortSignal(),
 *   })
 *   console.log(loginResponse.data)
 * } catch (error) {
 *   console.error(error)
 * }
 * ```
 *
 * @example Without force signal
 * ```typescript
 * const httpClient = new HttpClient({
 *   baseURL: "https://api.example.com/v2",
 *   timeout: 10000,
 * })
 *
 * const usersResponse = await httpClient.get("/users")
 * console.log(usersResponse.data)
 * ```
 */
export default class HttpClient<ForceSignal extends boolean = true> {
  public interceptors: {
    request: InterceptorManager<ResolvedRAWRequestConfig<ForceSignal>>
    response: InterceptorManager<RAWResponseConfig>
  }

  private baseConfig: RAWRequestConfig

  constructor(baseConfig?: RequestConfig) {
    this.baseConfig = {
      isRequestConfig: true,
      ...baseConfig,
    } as RAWRequestConfig

    this.interceptors = {
      request: new InterceptorManager<ResolvedRAWRequestConfig<ForceSignal>>(),
      response: new InterceptorManager<RAWResponseConfig>(),
    }
  }

  /**
   * Merge the base config with the provided config.
   *
   * @param config - The RequestConfig to merge with the base config
   *
   * @example
   * const httpClient = new HttpClient()
   * httpClient.mergeBaseConfig({
   *   baseURL: "https://api.example.com",
   *   timeout: 10000,
   * })
   */
  mergeBaseConfig(config: RequestConfig) {
    this.baseConfig = { ...this.baseConfig, ...config }
  }

  /**
   * Get the base config.
   *
   * @returns The base config
   */
  public getBaseConfig(): ResolvedRequestConfig<ForceSignal> {
    const { isRequestConfig: _, ...config } = this.baseConfig
    return config as ResolvedRequestConfig<ForceSignal>
  }

  /**
   * Send an HTTP request.
   *
   * @template T - The type of the response data
   * @template D - The type of the request data
   * @param configOrUrl - The URL or RequestConfig to use for the request
   * @param config - The RequestConfig to use for the request
   * @returns The ResponseConfig for the request
   */
  request<T = unknown, D = unknown>(
    ...args: RequestConfigArgs<ForceSignal, D>
  ): Promise<ResponseConfig<T, D>> {
    // Process final config
    const finalConfig: ResolvedRAWRequestConfig<ForceSignal, D> = {
      ...this.baseConfig,
      ...args[0],
    } as ResolvedRAWRequestConfig<ForceSignal, D>

    // Execute request interceptors, dispatchRequest, and response interceptors via promise chain
    let promise: Promise<
      | ResolvedRAWRequestConfig<ForceSignal, D>
      | RAWResponseConfig<T, D>
      | ResponseConfig<T, D>
    > = Promise.resolve(finalConfig)

    // Run request interceptors
    this.interceptors.request.forEach((interceptor) => {
      if (!interceptor) {
        return
      }

      const { onFulfilled, onRejected, runWhen } = interceptor

      // check if onFulfilled is defined
      if (!onFulfilled) {
        return
      }

      // run onFulfilled
      promise = promise.then(
        (requestConfig) => {
          // check if requestConfig is a RequestConfig
          if (!isRAWRequestConfig<ForceSignal>(requestConfig)) {
            throw new HttpClientError(
              "Unexpected RequestConfig in request interceptor",
              HttpClientError.ERR_BAD_CONFIG,
              finalConfig
            )
          }

          // check if runWhen is not defined or returns true
          if (!runWhen || !runWhen(requestConfig)) {
            return requestConfig
          }

          return onFulfilled(requestConfig) as ResolvedRAWRequestConfig<
            ForceSignal,
            D
          >
        },
        (error) => {
          throw onRejected ? onRejected(error) : error
        }
      )
    })

    // Execute dispatchRequest
    promise = promise.then((requestConfig) => {
      if (!isRAWRequestConfig<ForceSignal>(requestConfig)) {
        throw new HttpClientError(
          "Unexpected RequestConfig before dispatchRequest",
          HttpClientError.ERR_BAD_CONFIG,
          finalConfig
        )
      }

      // dispatchRequest
      return dispatchRequest<ForceSignal, T, D>(requestConfig)
    })

    // Run response interceptors
    this.interceptors.response.forEach((interceptor) => {
      if (!interceptor) {
        return
      }

      const { onFulfilled, onRejected } = interceptor

      // check if onFulfilled is defined
      if (!onFulfilled) {
        return
      }

      // run onFulfilled
      promise = promise.then(
        (responseConfig) => {
          // check if responseConfig is a ResponseConfig
          if (!isRAWResponseConfig(responseConfig)) {
            throw new HttpClientError(
              "Unexpected ResponseConfig in response interceptor",
              HttpClientError.ERR_BAD_CONFIG,
              finalConfig
            )
          }

          return onFulfilled(responseConfig)
        },
        (error) => {
          throw onRejected ? onRejected(error) : error
        }
      ) as Promise<RAWResponseConfig<T, D>>
    })

    promise = promise.then((responseConfig) => {
      if (!isRAWResponseConfig(responseConfig)) {
        throw new HttpClientError(
          "Unexpected ResponseConfig before dispatchRequest",
          HttpClientError.ERR_BAD_CONFIG,
          finalConfig
        )
      }

      const { isResponseConfig: _, ...config } = responseConfig
      return config as ResponseConfig<T, D>
    })

    return promise as Promise<ResponseConfig<T, D>>
  }

  /**
   * Get a resource.
   *
   * @template T - The type of the response data
   * @template D - The type of the request data
   * @param url - The URL to get the resource from
   * @param config - The RequestConfig to use for the request
   * @returns The ResponseConfig for the request
   */
  get<T = unknown, D = unknown>(
    url: string | URL,
    ...args: RequestConfigArgs<ForceSignal, D>
  ): Promise<ResponseConfig<T, D>> {
    return this.request<T, D>({
      method: "GET",
      url,
      ...(args[0] || {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  /**
   * Send a POST request.
   *
   * @template T - The type of the response data
   * @template D - The type of the request data
   * @param url - The URL to send the request to
   * @param data - The data to send with the request
   * @param config - The RequestConfig to use for the request
   * @returns The ResponseConfig for the request
   */
  post<T = unknown, D = unknown>(
    url: string | URL,
    data: RequestConfig<D>["data"] | undefined,
    ...args: RequestConfigArgs<ForceSignal, D>
  ): Promise<ResponseConfig<T, D>> {
    return this.request<T, D>({
      method: "POST",
      url,
      data,
      ...(args[0] || {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  /**
   * Send a PUT request.
   *
   * @template T - The type of the response data
   * @template D - The type of the request data
   * @param url - The URL to send the request to
   * @param data - The data to send with the request
   * @param config - The RequestConfig to use for the request
   * @returns The ResponseConfig for the request
   */
  put<T = unknown, D = unknown>(
    url: string | URL,
    data: RequestConfig<D>["data"] | undefined,
    ...args: RequestConfigArgs<ForceSignal, D>
  ): Promise<ResponseConfig<T, D>> {
    return this.request<T, D>({
      method: "PUT",
      url,
      data,
      ...(args[0] || {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  /**
   * Send a PATCH request.
   *
   * @template T - The type of the response data
   * @template D - The type of the request data
   * @param url - The URL to send the request to
   * @param data - The data to send with the request
   * @param config - The RequestConfig to use for the request
   * @returns The ResponseConfig for the request
   */
  patch<T = unknown, D = unknown>(
    url: string | URL,
    data: RequestConfig<D>["data"] | undefined,
    ...args: RequestConfigArgs<ForceSignal, D>
  ): Promise<ResponseConfig<T, D>> {
    return this.request<T, D>({
      method: "PATCH",
      url,
      data,
      ...(args[0] || {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  /**
   * Send a DELETE request.
   *
   * @template T - The type of the response data
   * @template D - The type of the request data
   * @param url - The URL to send the request to
   * @param config - The RequestConfig to use for the request
   * @returns The ResponseConfig for the request
   */
  delete<T = unknown, D = unknown>(
    url: string | URL,
    ...args: RequestConfigArgs<ForceSignal, D>
  ): Promise<ResponseConfig<T, D>> {
    return this.request<T, D>({
      method: "DELETE",
      url,
      ...(args[0] || {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  /**
   * Send a HEAD request.
   *
   * @template T - The type of the response data
   * @template D - The type of the request data
   * @param url - The URL to send the request to
   * @param config - The RequestConfig to use for the request
   * @returns The ResponseConfig for the request
   */
  head<T = unknown, D = unknown>(
    url: string | URL,
    ...args: RequestConfigArgs<ForceSignal, D>
  ): Promise<ResponseConfig<T, D>> {
    return this.request<T, D>({
      method: "HEAD",
      url,
      ...(args[0] || {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  /**
   * Send a OPTIONS request.
   *
   * @template T - The type of the response data
   * @template D - The type of the request data
   * @param url - The URL to send the request to
   * @param config - The RequestConfig to use for the request
   * @returns The ResponseConfig for the request
   */
  options<T = unknown, D = unknown>(
    url: string | URL,
    ...args: RequestConfigArgs<ForceSignal, D>
  ): Promise<ResponseConfig<T, D>> {
    return this.request<T, D>({
      method: "OPTIONS",
      url,
      ...(args[0] || {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  /**
   * Send a PURGE request.
   *
   * @template T - The type of the response data
   * @template D - The type of the request data
   * @param url - The URL to send the request to
   * @param config - The RequestConfig to use for the request
   * @returns The ResponseConfig for the request
   */
  purge<T = unknown, D = unknown>(
    url: string | URL,
    ...args: RequestConfigArgs<ForceSignal, D>
  ): Promise<ResponseConfig<T, D>> {
    return this.request<T, D>({
      method: "PURGE",
      url,
      ...(args[0] || {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  /**
   * Send a LINK request.
   *
   * @template T - The type of the response data
   * @template D - The type of the request data
   * @param url - The URL to send the request to
   * @param config - The RequestConfig to use for the request
   * @returns The ResponseConfig for the request
   */
  link<T = unknown, D = unknown>(
    url: string | URL,
    ...args: RequestConfigArgs<ForceSignal, D>
  ): Promise<ResponseConfig<T, D>> {
    return this.request<T, D>({
      method: "LINK",
      url,
      ...(args[0] || {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  /**
   * Send a UNLINK request.
   *
   * @template T - The type of the response data
   * @template D - The type of the request data
   * @param url - The URL to send the request to
   * @param config - The RequestConfig to use for the request
   * @returns The ResponseConfig for the request
   */
  unlink<T = unknown, D = unknown>(
    url: string | URL,
    ...args: RequestConfigArgs<ForceSignal, D>
  ): Promise<ResponseConfig<T, D>> {
    return this.request<T, D>({
      method: "UNLINK",
      url,
      ...(args[0] || {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }
}
