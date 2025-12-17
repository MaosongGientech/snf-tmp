import {
  RAWRequestConfig,
  RAWRequestConfigForceSignal,
  RAWResponseConfig,
} from "./types.js"

/**
 * The HttpClientError class is used to create HTTP client errors.
 */
export default class HttpClientError extends Error {
  static readonly ERR_BAD_CONFIG_VALUE = "HTTPCLIENT_ERR_BAD_CONFIG_VALUE"
  static readonly ERR_BAD_CONFIG = "HTTPCLIENT_ERR_BAD_CONFIG"
  static readonly ERR_TIMEDOUT = "HTTPCLIENT_ERR_TIMEDOUT"
  static readonly ERR_NETWORK = "HTTPCLIENT_ERR_NETWORK"
  static readonly ERR_BAD_RESPONSE = "HTTPCLIENT_ERR_BAD_RESPONSE"
  static readonly ERR_BAD_REQUEST = "HTTPCLIENT_ERR_BAD_REQUEST"
  static readonly ERR_CANCELED = "HTTPCLIENT_ERR_CANCELED"
  static readonly ERR_INVALID_URL = "HTTPCLIENT_ERR_INVALID_URL"

  public readonly isHttpClientError: boolean = true
  public readonly code?: unknown
  public readonly requestConfig?: RAWRequestConfig | RAWRequestConfigForceSignal
  public readonly responseConfig?: RAWResponseConfig
  public readonly status: number

  constructor(
    message: string,
    code?: string,
    requestConfig?: RAWRequestConfig | RAWRequestConfigForceSignal,
    responseConfig?: RAWResponseConfig
  ) {
    super(message)
    this.name = "HttpClientError"
    this.code = code
    this.requestConfig = requestConfig
    this.responseConfig = responseConfig
    if (this.responseConfig) {
      this.status = this.responseConfig.status
    } else {
      this.status = 0
    }

    Object.setPrototypeOf(this, HttpClientError.prototype)
  }
}
