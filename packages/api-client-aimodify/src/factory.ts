// Factory function for creating API client instances

import { ApiClient } from './client.js';
import type { ApiClientConfig } from './types.js';

/**
 * Create a new API client instance.
 * Each instance has its own configuration, interceptors, and lock state.
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

