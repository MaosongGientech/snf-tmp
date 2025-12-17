import { RAWResponseConfig, ResolvedRAWRequestConfig } from "./types.js"

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
