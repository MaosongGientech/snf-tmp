// Generic interceptor types
export type InterceptorFulfilled<T> = (config: T) => T | Promise<T>
export type InterceptorRejected = (error: unknown) => Error
export type InterceptorRunWhen<T> = (config: T) => boolean

// Generic interceptor interface
export interface Interceptor<T> {
  onFulfilled?: InterceptorFulfilled<T>
  onRejected?: InterceptorRejected
  runWhen?: InterceptorRunWhen<T>
}

/**
 * Generic interceptor manager for handling request and response interceptors.
 *
 * @template T - The configuration type (RAWRequestConfig or RAWResponseConfig)
 */
export default class InterceptorManager<T> {
  interceptors: (Interceptor<T> | null)[] = []

  /**
   * Add an interceptor to the chain.
   *
   * @param onFulfilled - Function to call when the interceptor is fulfilled
   * @param onRejected - Function to call when the interceptor is rejected
   * @param runWhen - Optional condition function to determine if the interceptor should run
   * @returns The ID of the added interceptor
   */
  use(
    onFulfilled?: InterceptorFulfilled<T>,
    onRejected?: InterceptorRejected,
    runWhen?: InterceptorRunWhen<T>
  ): number {
    this.interceptors.push({ onFulfilled, onRejected, runWhen })
    return this.interceptors.length - 1
  }

  /**
   * Remove an interceptor from the chain by ID.
   *
   * @param id - The ID of the interceptor to remove
   */
  eject(id: number): void {
    if (this.interceptors[id]) {
      this.interceptors[id] = null
    }
  }

  /**
   * Clear all interceptors.
   */
  clear(): void {
    if (this.interceptors) {
      this.interceptors = []
    }
  }

  /**
   * Iterate over all interceptors.
   *
   * @param fn - Function to call for each interceptor
   */
  forEach(fn: (interceptor: Interceptor<T> | null) => void) {
    this.interceptors.forEach((h) => fn(h))
  }
}
