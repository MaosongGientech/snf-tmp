// Interceptor system for request and response handling

import type {
  ErrorInterceptor,
  Interceptors,
  RequestConfig,
  RequestInterceptor,
  ResponseInterceptor,
} from "./types.js"

interface RequestInterceptorEntry {
  id: number
  interceptor: RequestInterceptor
}

interface ResponseInterceptorEntry {
  id: number
  onFulfilled?: ResponseInterceptor
  onRejected?: ErrorInterceptor
}

export class InterceptorManager {
  private requestInterceptors: RequestInterceptorEntry[] = []
  private responseInterceptors: ResponseInterceptorEntry[] = []
  private requestIdCounter = 0
  private responseIdCounter = 0

  /**
   * Add a request interceptor.
   * Returns a function to remove the interceptor.
   */
  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    const id = this.requestIdCounter++
    this.requestInterceptors.push({ id, interceptor })
    return () => this.removeRequestInterceptor(id)
  }

  /**
   * Remove a request interceptor by ID.
   */
  removeRequestInterceptor(id: number): void {
    const index = this.requestInterceptors.findIndex((entry) => entry.id === id)
    if (index !== -1) {
      this.requestInterceptors.splice(index, 1)
    }
  }

  /**
   * Clear all request interceptors.
   */
  clearRequestInterceptors(): void {
    this.requestInterceptors = []
  }

  /**
   * Execute all request interceptors in order.
   */
  async executeRequestInterceptors(
    config: RequestConfig
  ): Promise<RequestConfig> {
    let result = config
    for (const { interceptor } of this.requestInterceptors) {
      result = await interceptor(result)
    }
    return result
  }

  /**
   * Add response interceptors (both success and error handlers).
   * Returns a function to remove the interceptors.
   */
  addResponseInterceptor(
    onFulfilled?: ResponseInterceptor,
    onRejected?: ErrorInterceptor
  ): () => void {
    const id = this.responseIdCounter++
    this.responseInterceptors.push({ id, onFulfilled, onRejected })
    return () => this.removeResponseInterceptor(id)
  }

  /**
   * Remove a response interceptor by ID.
   */
  removeResponseInterceptor(id: number): void {
    const index = this.responseInterceptors.findIndex(
      (entry) => entry.id === id
    )
    if (index !== -1) {
      this.responseInterceptors.splice(index, 1)
    }
  }

  /**
   * Clear all response interceptors.
   */
  clearResponseInterceptors(): void {
    this.responseInterceptors = []
  }

  /**
   * Execute all response interceptors in order.
   */
  async executeResponseInterceptors(response: Response): Promise<Response> {
    let result = response
    for (const { onFulfilled } of this.responseInterceptors) {
      if (onFulfilled) {
        result = await onFulfilled(result)
      }
    }
    return result
  }

  /**
   * Execute error interceptors in reverse order.
   */
  async executeErrorInterceptors(error: unknown): Promise<unknown> {
    let result = error
    // Execute in reverse order
    for (let i = this.responseInterceptors.length - 1; i >= 0; i--) {
      const entry = this.responseInterceptors[i]
      if (entry && entry.onRejected) {
        result = await entry.onRejected(result)
      }
    }
    return result
  }

  /**
   * Create the interceptors API object.
   */
  createInterceptorsAPI(): Interceptors {
    return {
      request: {
        use: (interceptor: RequestInterceptor) =>
          this.addRequestInterceptor(interceptor),
        eject: (id: number) => this.removeRequestInterceptor(id),
        clear: () => this.clearRequestInterceptors(),
      },
      response: {
        use: (
          onFulfilled?: ResponseInterceptor,
          onRejected?: ErrorInterceptor
        ) => this.addResponseInterceptor(onFulfilled, onRejected),
        eject: (id: number) => this.removeResponseInterceptor(id),
        clear: () => this.clearResponseInterceptors(),
      },
    }
  }
}
