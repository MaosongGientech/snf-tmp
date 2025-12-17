/**
 * The HTTP methods supported by the HttpClient.
 */
export type HttpClientMethod =
  | "get"
  | "GET"
  | "delete"
  | "DELETE"
  | "head"
  | "HEAD"
  | "options"
  | "OPTIONS"
  | "post"
  | "POST"
  | "put"
  | "PUT"
  | "patch"
  | "PATCH"
  | "purge"
  | "PURGE"
  | "link"
  | "LINK"
  | "unlink"
  | "UNLINK"

/**
 * The response types supported by the HttpClient.
 */
export type ResponseType =
  | "arraybuffer"
  | "blob"
  | "document"
  | "json"
  | "text"
  | "stream"
  | "formdata"

/**
 * The search params supported by the HttpClient.
 */
export type SearchParams =
  | URLSearchParams
  | Record<string, unknown | readonly unknown[]>

/**
 * The HttpClient adapter interface.
 */
export interface HttpClientAdapter<ForceSignal extends boolean> {
  (config: ResolvedRAWRequestConfig<ForceSignal>): Promise<RAWResponseConfig>
}

/**
 * The HttpClient adapter name.
 */
export type HttpClientAdapterName = "fetch"

/**
 * The RAW request config.
 */
export type RAWRequestConfig<D = unknown> = Omit<
  RequestInit,
  "body" | "method"
> & {
  readonly isRequestConfig: true

  adapter?: HttpClientAdapter<false> | HttpClientAdapterName

  // Base URL to use for the request, defaults to undefined
  baseURL?: string | URL

  // URL to request, defaults to undefined
  url?: string | URL

  // HTTP method to use, defaults to 'GET'
  method?: HttpClientMethod

  // Query parameters to send with the request, defaults to undefined
  searchParams?: SearchParams

  // Body to send with the request, defaults to undefined
  data?: RequestInit["body"] | Record<string, unknown> | D

  // Timeout for the request, defaults to 30 seconds, set to 0 for no timeout
  timeout?: number

  // Response type to use for the request, defaults to 'json'
  responseType?: ResponseType

  // Next.js 16 fetch extensions, defaults to undefined
  revalidate?: number | false
  next?: {
    // Whether to revalidate the request, defaults to undefined
    revalidate?: number | false
    // Tags to add to the request, defaults to undefined
    tags?: string[]
  }
}

/**
 * The RAW request config with force signal.
 */
export type RAWRequestConfigForceSignal<D = unknown> = Omit<
  RAWRequestConfig<D>,
  "adapter" | "signal"
> & {
  adapter: HttpClientAdapter<true> | HttpClientAdapterName
  signal: AbortSignal | false
}

/**
 * The resolved RAW request config.
 */
export type ResolvedRAWRequestConfig<
  ForceSignal extends boolean,
  D = unknown,
> = ForceSignal extends true
  ? RAWRequestConfigForceSignal<D>
  : RAWRequestConfig<D>

/**
 * The request config.
 */
export type RequestConfig<D = unknown> = Omit<
  RAWRequestConfig<D>,
  "isRequestConfig"
>

/**
 * The request config with force signal.
 */
export type RequestConfigForceSignal<D = unknown> = Omit<
  RequestConfig<D>,
  "adapter" | "signal"
> & {
  adapter: HttpClientAdapter<true> | HttpClientAdapterName
  signal: AbortSignal | false
}

/**
 * The resolved request config.
 */
export type ResolvedRequestConfig<
  ForceSignal extends boolean,
  D = unknown,
> = ForceSignal extends true ? RequestConfigForceSignal<D> : RequestConfig<D>

/**
 * The RAW response config.
 */
export type RAWResponseConfig<T = unknown, D = unknown> = Response & {
  readonly isResponseConfig: true

  // Request configuration
  requestConfig: RAWRequestConfig<D> | RAWRequestConfigForceSignal<D>

  // Response data
  data?: T
}

/**
 * The response config.
 */
export type ResponseConfig<T = unknown, D = unknown> = Omit<
  RAWResponseConfig<T, D>,
  "isResponseConfig"
>
