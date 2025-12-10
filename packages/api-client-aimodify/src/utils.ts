// Utility functions for API client

import type { RequestConfig, RequestBody, FormType } from './types.js';

/**
 * Detect if running in browser environment.
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get the appropriate fetch function based on environment.
 */
export function getFetch(): typeof fetch {
  if (isBrowser()) {
    return window.fetch.bind(window);
  }
  // In Node.js, use global fetch (available in Node.js 18+)
  return globalThis.fetch;
}

/**
 * Deep merge two objects.
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }
  return result;
}

/**
 * Normalize request body based on type.
 */
export function normalizeBody(
  body: RequestBody,
  formType?: FormType,
  fileFieldName: string = 'file'
): BodyInit | null {
  if (body === null || body === undefined) {
    return null;
  }

  // If already a BodyInit type, return as is
  if (
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    typeof body === 'string'
  ) {
    return body;
  }

  // Handle File or Blob
  if (body instanceof File || body instanceof Blob) {
    const formData = new FormData();
    formData.append(fileFieldName, body);
    return formData;
  }

  // Handle File array
  if (Array.isArray(body) && body.length > 0 && body[0] instanceof File) {
    const formData = new FormData();
    body.forEach((file, index) => {
      formData.append(
        body.length === 1 ? fileFieldName : `${fileFieldName}[]`,
        file
      );
    });
    return formData;
  }

  // Handle FileList
  if (
    typeof FileList !== 'undefined' &&
    body instanceof FileList &&
    body.length > 0
  ) {
    const formData = new FormData();
    Array.from(body).forEach((file, index) => {
      formData.append(
        body.length === 1 ? fileFieldName : `${fileFieldName}[]`,
        file
      );
    });
    return formData;
  }

  // Handle plain objects
  if (typeof body === 'object') {
    if (formType === 'urlencoded') {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        if (value !== null && value !== undefined) {
          params.append(key, String(value));
        }
      }
      return params;
    } else {
      // Default to JSON
      return JSON.stringify(body);
    }
  }

  return String(body);
}

/**
 * Get content type header based on body type.
 */
export function getContentType(body: BodyInit | null): string | undefined {
  if (body === null) {
    return undefined;
  }

  if (body instanceof FormData) {
    // Browser will set boundary automatically
    return undefined;
  }

  if (body instanceof URLSearchParams) {
    return 'application/x-www-form-urlencoded';
  }

  if (body instanceof Blob) {
    return body.type || 'application/octet-stream';
  }

  if (typeof body === 'string') {
    // Try to detect if it's JSON
    try {
      JSON.parse(body);
      return 'application/json';
    } catch {
      return 'text/plain';
    }
  }

  return 'application/json';
}

/**
 * Create timeout promise.
 */
export function createTimeoutPromise(timeout: number): {
  promise: Promise<never>;
  cleanup: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, timeout);
  });

  return {
    promise,
    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    },
  };
}

/**
 * Calculate retry delay with exponential backoff.
 */
export function calculateRetryDelay(
  attempt: number,
  baseDelay: number,
  backoff: boolean,
  backoffMultiplier: number,
  maxDelay?: number
): number {
  if (!backoff) {
    return baseDelay;
  }

  const delay = baseDelay * Math.pow(backoffMultiplier, attempt);
  return maxDelay ? Math.min(delay, maxDelay) : delay;
}

/**
 * Check if error should be retried.
 */
export function shouldRetry(
  error: unknown,
  retryableStatusCodes?: number[]
): boolean {
  // Network errors should be retried
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Check if it's an ApiError with retryable status code
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    if (retryableStatusCodes && retryableStatusCodes.includes(error.status)) {
      return true;
    }
    // Default: retry on 5xx errors
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
  }

  // Timeout errors should be retried
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'TimeoutError'
  ) {
    return true;
  }

  return false;
}

/**
 * Check if body is FormData (for upload progress tracking).
 */
export function isFormData(body: BodyInit | null): boolean {
  return body instanceof FormData;
}

/**
 * Execute request with XMLHttpRequest for upload progress (browser only).
 */
export async function executeWithXHR(
  url: string,
  method: string,
  headers: Headers,
  body: BodyInit | null,
  onUploadProgress?: (progress: {
    loaded: number;
    total: number;
    percentage: number;
  }) => void,
  timeout?: number
): Promise<Response> {
  return new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest === 'undefined') {
      reject(new Error('XMLHttpRequest is not available'));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open(method, url);

    // Set headers
    headers.forEach((value, key) => {
      xhr.setRequestHeader(key, value);
    });

    // Handle timeout
    if (timeout) {
      xhr.timeout = timeout;
      xhr.ontimeout = () => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      };
    }

    // Handle upload progress
    if (onUploadProgress && xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onUploadProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          });
        }
      };
    }

    // Handle response
    xhr.onload = () => {
      // Parse response headers
      const headerMap: Record<string, string> = {};
      const headerString = xhr.getAllResponseHeaders();
      if (headerString) {
        headerString.split('\r\n').forEach((line) => {
          const colonIndex = line.indexOf(': ');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 2).trim();
            if (key && value) {
              headerMap[key] = value;
            }
          }
        });
      }

      // Create a Response object
      const response = new Response(
        xhr.responseType === 'blob' ? xhr.response : xhr.responseText,
        {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: new Headers(headerMap),
        }
      );
      resolve(response);
    };

    xhr.onerror = () => {
      reject(
        new TypeError(
          `Network request failed: ${xhr.statusText || 'Unknown error'}`
        )
      );
    };

    // XHR only accepts specific body types
    if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer || typeof body === 'string' || body instanceof URLSearchParams) {
      xhr.send(body as XMLHttpRequestBodyInit);
    } else if (body === null) {
      xhr.send();
    } else {
      // Convert other types to string
      xhr.send(String(body));
    }
  });
}

