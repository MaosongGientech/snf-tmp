// Core types for API client

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type FormType = 'form-data' | 'urlencoded';

export interface RetryConfig {
  attempts?: number;
  delay?: number | ((attempt: number) => number);
  backoff?: boolean;
  backoffMultiplier?: number;
  maxDelay?: number;
  retryCondition?: (error: unknown) => boolean;
  retryableStatusCodes?: number[];
}

export interface RequestConfig {
  baseURL?: string;
  url?: string;
  method?: HttpMethod;
  headers?: HeadersInit | Record<string, string>;
  body?: BodyInit | Record<string, unknown> | null;
  timeout?: number;
  retry?: RetryConfig;
  formType?: FormType;
  fileFieldName?: string;
  onUploadProgress?: (progress: { loaded: number; total: number; percentage: number }) => void;
  // Next.js 16 fetch extensions
  cache?: RequestCache;
  revalidate?: number | false;
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
  // Custom parsers
  responseParser?: <T = unknown>(response: Response) => Promise<T>;
  errorParser?: (error: unknown) => Error;
}

export interface ApiClientConfig extends Omit<RequestConfig, 'url' | 'method'> {
  baseURL: string;
}

export type RequestInterceptor = (
  config: RequestConfig
) => RequestConfig | Promise<RequestConfig>;

export type ResponseInterceptor = (
  response: Response
) => Response | Promise<Response>;

export type ErrorInterceptor = (error: unknown) => unknown | Promise<unknown>;

export interface Interceptors {
  request: {
    use: (interceptor: RequestInterceptor) => () => void;
    eject: (id: number) => void;
    clear: () => void;
  };
  response: {
    use: (
      onFulfilled?: ResponseInterceptor,
      onRejected?: ErrorInterceptor
    ) => () => void;
    eject: (id: number) => void;
    clear: () => void;
  };
}

export type RequestBody =
  | BodyInit
  | Record<string, unknown>
  | URLSearchParams
  | FormData
  | File
  | Blob
  | File[]
  | FileList
  | null;

