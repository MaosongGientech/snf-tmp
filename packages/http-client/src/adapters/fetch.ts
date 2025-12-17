import HttpClientError, {
  isHttpClientError,
} from "../errors/httpClientError.js"
import {
  RAWResponseConfig,
  ResolvedRAWRequestConfig,
  ResponseType,
} from "../types.js"

export default async function adapter<ForceSignal extends boolean>(
  config: ResolvedRAWRequestConfig<ForceSignal>
): Promise<RAWResponseConfig> {
  // Check if request is already canceled
  if (config.signal && config.signal.aborted) {
    throw new HttpClientError(
      "Request canceled",
      HttpClientError.ERR_CANCELED,
      config
    )
  }

  // Build URL
  let requestUrl: URL
  try {
    if (config.url instanceof URL) {
      requestUrl = new URL(config.url.href)
    } else if (config.baseURL instanceof URL) {
      requestUrl = new URL(config.url || "", config.baseURL)
    } else if (config.baseURL) {
      requestUrl = new URL(config.url || "", config.baseURL)
    } else if (config.url) {
      requestUrl = new URL(config.url)
    } else {
      throw new HttpClientError(
        "URL is required",
        HttpClientError.ERR_BAD_CONFIG_VALUE,
        config
      )
    }
  } catch (error) {
    if (isHttpClientError(error)) {
      throw error
    }
    throw new HttpClientError(
      `Invalid URL: ${error instanceof Error ? error.message : String(error)}`,
      HttpClientError.ERR_INVALID_URL,
      config
    )
  }

  // Add search params
  if (config.searchParams) {
    if (config.searchParams instanceof URLSearchParams) {
      config.searchParams.forEach((value, key) => {
        requestUrl.searchParams.append(key, value)
      })
    } else {
      // Record<string, unknown | readonly unknown[]>
      for (const [key, value] of Object.entries(config.searchParams)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            requestUrl.searchParams.append(key, String(item))
          }
        } else if (value !== null && value !== undefined) {
          requestUrl.searchParams.append(key, String(value))
        }
      }
    }
  }

  // Prepare request body
  let requestBody: RequestInit["body"] | undefined
  if (config.data !== undefined && config.data !== null) {
    // If data is already a valid RequestInit body type, use it directly
    if (
      typeof config.data === "string" ||
      config.data instanceof FormData ||
      config.data instanceof Blob ||
      config.data instanceof ArrayBuffer ||
      config.data instanceof ReadableStream
    ) {
      requestBody = config.data as RequestInit["body"]
    } else if (ArrayBuffer.isView(config.data)) {
      // ArrayBufferView needs to be cast to BodyInit
      requestBody = config.data as BodyInit
    } else {
      // Otherwise, serialize as JSON
      try {
        requestBody = JSON.stringify(config.data)
      } catch (error) {
        throw new HttpClientError(
          `Failed to serialize request data: ${error instanceof Error ? error.message : String(error)}`,
          HttpClientError.ERR_BAD_REQUEST,
          config
        )
      }
    }
  }

  // Setup timeout with AbortController
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let timeoutController: AbortController | undefined
  const timeout = config.timeout ?? 30000

  // Flag to track if timeout triggered the abort
  let isTimeoutAborted = false

  // Event listeners for cleanup
  let timeoutAbortHandler: (() => void) | undefined
  let userAbortHandler: (() => void) | undefined

  // Helper function to handle AbortError consistently
  const handleAbortError = (): never => {
    if (isTimeoutAborted) {
      throw new HttpClientError(
        "Request timed out",
        HttpClientError.ERR_TIMEDOUT,
        config
      )
    }

    throw new HttpClientError(
      "Request canceled",
      HttpClientError.ERR_CANCELED,
      config
    )
  }

  // Combine signals: existing signal + timeout signal
  let finalSignal: AbortSignal | undefined
  if (timeout > 0) {
    timeoutController = new AbortController()
    timeoutId = setTimeout(() => {
      isTimeoutAborted = true
      timeoutController!.abort()
    }, timeout)

    if (config.signal) {
      // Combine both signals
      const combinedController = new AbortController()

      // Listen to timeout signal abort
      timeoutAbortHandler = () => {
        isTimeoutAborted = true

        // Remove user abort handler to prevent it from firing
        if (userAbortHandler && config.signal) {
          config.signal.removeEventListener("abort", userAbortHandler)
          userAbortHandler = undefined
        }

        // Abort the request
        combinedController.abort()
      }
      timeoutController.signal.addEventListener("abort", timeoutAbortHandler)

      // Listen to user signal abort
      userAbortHandler = () => {
        // Clear timeout if it's still running
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = undefined
        }
        // Remove timeout abort handler to prevent it from firing
        if (timeoutAbortHandler && timeoutController) {
          timeoutController.signal.removeEventListener(
            "abort",
            timeoutAbortHandler
          )
          timeoutAbortHandler = undefined
        }

        // Abort the request
        combinedController.abort()
      }
      config.signal.addEventListener("abort", userAbortHandler)

      finalSignal = combinedController.signal
    } else {
      finalSignal = timeoutController.signal
    }
  } else if (config.signal) {
    // Only user signal, no timeout
    // No handler needed, signal will be passed directly to fetch
    finalSignal = config.signal
  }

  // Prepare fetch options
  const fetchOptions: RequestInit = {
    method: config.method || "GET",
    headers: config.headers,
    body: requestBody,
    signal: finalSignal,
    cache: config.cache,
    credentials: config.credentials,
    integrity: config.integrity,
    keepalive: config.keepalive,
    mode: config.mode,
    redirect: config.redirect,
    referrer: config.referrer,
    referrerPolicy: config.referrerPolicy,
    window: config.window,
  }

  // Add Next.js extensions
  // Next.js fetch extensions are not in the standard RequestInit type
  type NextFetchOptions = RequestInit & {
    revalidate?: number | false
    next?: {
      revalidate?: number | false
      tags?: string[]
    }
  }
  const nextFetchOptions = fetchOptions as NextFetchOptions

  if (config.revalidate !== undefined) {
    nextFetchOptions.revalidate = config.revalidate
  }
  if (config.next) {
    nextFetchOptions.next = {}
    if (config.next.revalidate !== undefined) {
      nextFetchOptions.next.revalidate = config.next.revalidate
    }
    if (config.next.tags) {
      nextFetchOptions.next.tags = config.next.tags
    }
  }

  // Set Content-Type header for JSON body
  if (
    requestBody &&
    typeof requestBody === "string" &&
    !(fetchOptions.headers instanceof Headers
      ? fetchOptions.headers.has("Content-Type")
      : fetchOptions.headers && "Content-Type" in fetchOptions.headers)
  ) {
    if (!fetchOptions.headers) {
      fetchOptions.headers = {}
    }
    if (fetchOptions.headers instanceof Headers) {
      fetchOptions.headers.set("Content-Type", "application/json")
    } else if (Array.isArray(fetchOptions.headers)) {
      fetchOptions.headers.push(["Content-Type", "application/json"])
    } else {
      ;(fetchOptions.headers as Record<string, string>)["Content-Type"] =
        "application/json"
    }
  }

  try {
    let response: Response
    try {
      response = await fetch(requestUrl, nextFetchOptions)
    } catch (error) {
      // Handle abort/cancel errors - distinguish between timeout and user cancellation
      if (error instanceof Error && error.name === "AbortError") {
        handleAbortError()
      }

      // Handle network errors
      throw new HttpClientError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
        HttpClientError.ERR_NETWORK,
        config
      )
    }

    // Parse response based on responseType
    const responseType: ResponseType = config.responseType || "json"
    let responseData: unknown

    try {
      switch (responseType) {
        case "json":
          try {
            const text = await response.text()
            responseData = text ? JSON.parse(text) : null
          } catch (parseError) {
            throw new HttpClientError(
              `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
              HttpClientError.ERR_BAD_RESPONSE,
              config,
              {
                isResponseConfig: true,
                requestConfig: config,
                ...response,
              } as RAWResponseConfig
            )
          }
          break

        case "text":
          responseData = await response.text()
          break

        case "blob":
          responseData = await response.blob()
          break

        case "arraybuffer":
          responseData = await response.arrayBuffer()
          break

        case "stream":
          responseData = response.body
          break

        case "formdata":
          responseData = await response.formData()
          break

        case "document":
          // document type is typically for XML/HTML, treat as text
          responseData = await response.text()
          break

        default:
          // Default to json
          try {
            const text = await response.text()
            responseData = text ? JSON.parse(text) : null
          } catch (parseError) {
            throw new HttpClientError(
              `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
              HttpClientError.ERR_BAD_RESPONSE,
              config,
              {
                isResponseConfig: true,
                requestConfig: config,
                ...response,
              } as RAWResponseConfig
            )
          }
      }
    } catch (error) {
      if (isHttpClientError(error)) {
        throw error
      }

      // Handle abort/cancel errors during body reading
      if (error instanceof Error && error.name === "AbortError") {
        handleAbortError()
      }

      // Handle parsing errors
      throw new HttpClientError(
        `Failed to parse response: ${error instanceof Error ? error.message : String(error)}`,
        HttpClientError.ERR_BAD_RESPONSE,
        config,
        {
          isResponseConfig: true,
          requestConfig: config,
          ...response,
        } as RAWResponseConfig
      )
    }

    // Create response config
    const responseConfig: RAWResponseConfig = {
      isResponseConfig: true,
      requestConfig: config,
      data: responseData,
      ...response,
    }

    // Check for HTTP error status codes
    if (!response.ok) {
      const status = response.status
      const isClientError = status >= 400 && status < 500
      const errorCode = isClientError
        ? HttpClientError.ERR_BAD_REQUEST
        : HttpClientError.ERR_BAD_RESPONSE

      throw new HttpClientError(
        `Request failed with status ${status}`,
        errorCode,
        config,
        responseConfig
      )
    }

    return responseConfig
  } finally {
    // Clean up timeout and event listeners after all operations complete
    // This ensures cleanup happens whether the request succeeds or fails
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    if (timeoutAbortHandler && timeoutController) {
      timeoutController.signal.removeEventListener("abort", timeoutAbortHandler)
    }
    if (userAbortHandler && config.signal) {
      config.signal.removeEventListener("abort", userAbortHandler)
    }
  }
}
