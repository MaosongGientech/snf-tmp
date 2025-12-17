import fetchAdapter from "./adapters/fetch.js"
import HttpClientError from "./errors/httpClientError.js"
import {
  HttpClientAdapter,
  RAWResponseConfig,
  ResolvedRAWRequestConfig,
} from "./types.js"

const dispatchRequest = async <
  ForceSignal extends boolean,
  T = unknown,
  D = unknown,
>(
  config: ResolvedRAWRequestConfig<ForceSignal, D>
): Promise<RAWResponseConfig<T, D>> => {
  if (config.signal && config.signal.aborted) {
    throw new HttpClientError(
      "Request canceled",
      HttpClientError.ERR_CANCELED,
      config
    )
  }

  let adapter: HttpClientAdapter<ForceSignal>

  if (!config.adapter) {
    config.adapter = "fetch"
  }

  if (typeof config.adapter === "string") {
    switch (config.adapter) {
      case "fetch":
        adapter = fetchAdapter
        break
      default:
        throw new HttpClientError(
          "Invalid adapter name",
          HttpClientError.ERR_BAD_CONFIG_VALUE,
          config
        )
    }
  } else if (typeof config.adapter === "function") {
    adapter = config.adapter as HttpClientAdapter<ForceSignal>
  } else {
    throw new HttpClientError(
      "Invalid adapter function",
      HttpClientError.ERR_BAD_CONFIG_VALUE,
      config
    )
  }

  return adapter(config) as Promise<RAWResponseConfig<T, D>>
}

export default dispatchRequest
