// Core API client implementation

import type {
  ApiClientConfig,
  RequestConfig,
  RequestBody,
  Interceptors,
} from './types.js';
import { LockManager } from './lock.js';
import { InterceptorManager } from './interceptors.js';
import {
  ApiError,
  NetworkError,
  TimeoutError,
  AbortError,
} from './errors.js';
import { parseJson } from './parsers/default.js';
import {
  getFetch,
  deepMerge,
  normalizeBody,
  getContentType,
  createTimeoutPromise,
  calculateRetryDelay,
  shouldRetry,
  isFormData,
  executeWithXHR,
} from './utils.js';

export class ApiClient {
  private config: ApiClientConfig;
  private lockManager: LockManager;
  private interceptorManager: InterceptorManager;
  public interceptors: Interceptors;

  constructor(config: ApiClientConfig) {
    this.config = { ...config };
    this.lockManager = new LockManager();
    this.interceptorManager = new InterceptorManager();
    this.interceptors = this.interceptorManager.createInterceptorsAPI();
  }

  /**
   * Lock the client instance.
   */
  lock(): void {
    this.lockManager.lock();
  }

  /**
   * Unlock the client instance.
   */
  unlock(): void {
    this.lockManager.unlock();
  }

  /**
   * Check if the client is locked.
   */
  get isLocked(): boolean {
    return this.lockManager.locked;
  }

  /**
   * Make an HTTP request.
   */
  private async request<T = unknown>(
    method: string,
    url: string,
    body?: RequestBody,
    config?: Partial<RequestConfig>
  ): Promise<T> {
    // Wait if locked
    await this.lockManager.waitIfLocked();

    // Merge configurations
    const mergedConfig = deepMerge(
      this.config as unknown as Record<string, unknown>,
      {
        ...config,
        method: method as RequestConfig['method'],
        url,
      }
    ) as RequestConfig;

    // Normalize body
    const bodyToNormalize: RequestBody | null = body ?? (mergedConfig.body as RequestBody | null) ?? null;
    const normalizedBody = normalizeBody(
      bodyToNormalize,
      mergedConfig.formType,
      mergedConfig.fileFieldName
    );

    // Build request config
    let requestConfig: RequestConfig = {
      ...mergedConfig,
      body: normalizedBody,
    };

    // Execute request interceptors
    requestConfig = await this.interceptorManager.executeRequestInterceptors(
      requestConfig
    );

    // Build headers
    const headers = new Headers(requestConfig.headers);
    const contentType = getContentType(normalizedBody);
    if (contentType && !headers.has('Content-Type')) {
      headers.set('Content-Type', contentType);
    }

    // Build URL
    const baseURL = requestConfig.baseURL || '';
    const requestURL = url.startsWith('http')
      ? url
      : `${baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;

    // Execute request with retry logic
    return this.executeWithRetry<T>(requestConfig, requestURL, headers);
  }

  /**
   * Execute request with retry logic.
   */
  private async executeWithRetry<T>(
    config: RequestConfig,
    url: string,
    headers: Headers
  ): Promise<T> {
    const retryConfig = config.retry || { attempts: 0 };
    const maxAttempts = (retryConfig.attempts || 0) + 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await this.executeRequest<T>(config, url, headers);
      } catch (error) {
        lastError = error;

        // Check if should retry
        if (attempt < maxAttempts - 1) {
          const shouldRetryRequest =
            retryConfig.retryCondition
              ? retryConfig.retryCondition(error)
              : shouldRetry(error, retryConfig.retryableStatusCodes);

          if (!shouldRetryRequest) {
            throw error;
          }

          // Calculate delay
          const baseDelay =
            typeof retryConfig.delay === 'function'
              ? retryConfig.delay(attempt)
              : retryConfig.delay || 1000;

          const delay = calculateRetryDelay(
            attempt,
            baseDelay,
            retryConfig.backoff || false,
            retryConfig.backoffMultiplier || 2,
            retryConfig.maxDelay
          );

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute a single request.
   */
  private async executeRequest<T>(
    config: RequestConfig,
    url: string,
    headers: Headers
  ): Promise<T> {
    const fetchFn = getFetch();
    const abortController = new AbortController();
    let timeoutCleanup: (() => void) | undefined;

    // Check if we should use XHR for upload progress
    const useXHR =
      this.isBrowser() &&
      config.onUploadProgress &&
      isFormData(config.body as BodyInit | null);

    try {
      // Setup timeout (only for fetch, XHR handles timeout internally)
      if (config.timeout && !useXHR) {
        const { promise: timeoutPromise, cleanup } = createTimeoutPromise(
          config.timeout
        );
        timeoutCleanup = cleanup;

        timeoutPromise.catch(() => {
          abortController.abort();
        });

        // Race between timeout and request
        Promise.race([timeoutPromise]).catch(() => {
          // Timeout will abort the request
        });
      }

      // Build fetch options
      const fetchOptions: RequestInit = {
        method: config.method || 'GET',
        headers,
        body: config.body as BodyInit | null,
        signal: abortController.signal,
      };

      // Add Next.js specific options if in server environment
      if (!this.isBrowser() && config.cache !== undefined) {
        (fetchOptions as Record<string, unknown>).cache = config.cache;
      }
      if (!this.isBrowser() && config.revalidate !== undefined) {
        (fetchOptions as Record<string, unknown>).revalidate = config.revalidate;
      }
      if (!this.isBrowser() && config.next) {
        (fetchOptions as Record<string, unknown>).next = config.next;
      }

      // Execute fetch (use XHR for upload progress in browser)
      let response: Response;
      if (useXHR) {
        // Use XHR for upload progress tracking
        // Note: XHR handles timeout internally, so we don't need abortController for XHR
        try {
          response = await executeWithXHR(
            url,
            config.method || 'GET',
            headers,
            config.body as BodyInit | null,
            config.onUploadProgress,
            config.timeout
          );
        } catch (error) {
          // Handle XHR timeout errors
          if (
            error instanceof Error &&
            error.message.includes('timeout')
          ) {
            throw new TimeoutError(
              error.message,
              config.timeout
            );
          }
          throw error;
        }
      } else {
        // Use standard fetch
        response = await fetchFn(url, fetchOptions);
      }

      // Clear timeout (only if we set it up)
      if (timeoutCleanup) {
        timeoutCleanup();
      }

      // Execute response interceptors
      const processedResponse = await this.interceptorManager.executeResponseInterceptors(
        response
      );

      // Handle error responses
      if (!processedResponse.ok) {
        const error = await this.parseError(processedResponse, config);
        const processedError = await this.interceptorManager.executeErrorInterceptors(
          error
        );
        throw processedError;
      }

      // Parse response
      const parser = config.responseParser || parseJson;
      return await parser<T>(processedResponse);
    } catch (error) {
      // Clear timeout
      if (timeoutCleanup) {
        timeoutCleanup();
      }

      // Handle abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        if (abortController.signal.aborted) {
          throw new TimeoutError(
            `Request timeout after ${config.timeout}ms`,
            config.timeout
          );
        }
        throw new AbortError('Request was aborted');
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError = new NetworkError(
          `Network error: ${error.message}`,
          error
        );
        const processedError = await this.interceptorManager.executeErrorInterceptors(
          networkError
        );
        throw processedError;
      }

      // Re-throw other errors
      const processedError = await this.interceptorManager.executeErrorInterceptors(
        error
      );
      throw processedError;
    }
  }

  /**
   * Parse error from response.
   */
  private async parseError(
    response: Response,
    config: RequestConfig
  ): Promise<Error> {
    try {
      const text = await response.text();
      let errorData: unknown;
      try {
        errorData = JSON.parse(text);
      } catch {
        errorData = text;
      }

      if (config.errorParser) {
        return config.errorParser({
          status: response.status,
          statusText: response.statusText,
          data: errorData,
          response,
        });
      }

      return new ApiError(
        `Request failed with status ${response.status}`,
        response.status,
        response.statusText,
        response,
        errorData
      );
    } catch {
      return new ApiError(
        `Request failed with status ${response.status}`,
        response.status,
        response.statusText,
        response
      );
    }
  }

  /**
   * Check if running in browser.
   */
  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  /**
   * GET request.
   */
  async get<T = unknown>(
    url: string,
    config?: Partial<RequestConfig>
  ): Promise<T> {
    return this.request<T>('GET', url, undefined, config);
  }

  /**
   * POST request.
   */
  async post<T = unknown>(
    url: string,
    body?: RequestBody,
    config?: Partial<RequestConfig>
  ): Promise<T> {
    return this.request<T>('POST', url, body, config);
  }

  /**
   * PUT request.
   */
  async put<T = unknown>(
    url: string,
    body?: RequestBody,
    config?: Partial<RequestConfig>
  ): Promise<T> {
    return this.request<T>('PUT', url, body, config);
  }

  /**
   * PATCH request.
   */
  async patch<T = unknown>(
    url: string,
    body?: RequestBody,
    config?: Partial<RequestConfig>
  ): Promise<T> {
    return this.request<T>('PATCH', url, body, config);
  }

  /**
   * DELETE request.
   */
  async delete<T = unknown>(
    url: string,
    config?: Partial<RequestConfig>
  ): Promise<T> {
    return this.request<T>('DELETE', url, undefined, config);
  }
}

