import HttpClientError from "./httpClientError.js"
import { RAWResponseConfig, ResolvedRAWRequestConfig } from "./types.js"

/**
 * Check if a config is a RAW request config.
 *
 * @param config - The config to check.
 * @returns True if the config is a RAW request config, false otherwise.
 */
export function isRAWRequestConfig<ForceSignal extends boolean>(
  config: unknown
): config is ResolvedRAWRequestConfig<ForceSignal> {
  return (
    typeof config === "object" &&
    config !== null &&
    "isRequestConfig" in config &&
    config.isRequestConfig === true
  )
}

/**
 * Check if a config is a RAW response config.
 *
 * @param config - The config to check.
 * @returns True if the config is a RAW response config, false otherwise.
 */
export function isRAWResponseConfig(
  config: unknown
): config is RAWResponseConfig {
  return (
    typeof config === "object" &&
    config !== null &&
    "isResponseConfig" in config &&
    config.isResponseConfig === true
  )
}

/**
 * Check if an error is an HttpClientError.
 *
 * @param error - The error to check.
 * @returns True if the error is an HttpClientError, false otherwise.
 */
export function isHttpClientError(error: unknown): error is HttpClientError {
  return (
    error !== null &&
    typeof error === "object" &&
    "isHttpClientError" in error &&
    error.isHttpClientError === true
  )
}
