// Unified error classes for API client

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string,
    public response?: Response,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export class NetworkError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

export class TimeoutError extends Error {
  constructor(message: string = 'Request timeout', public timeout?: number) {
    super(message);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

export class ParseError extends Error {
  constructor(
    message: string,
    public originalError?: unknown,
    public response?: Response
  ) {
    super(message);
    this.name = 'ParseError';
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

export class AbortError extends Error {
  constructor(message: string = 'Request aborted') {
    super(message);
    this.name = 'AbortError';
    Object.setPrototypeOf(this, AbortError.prototype);
  }
}

