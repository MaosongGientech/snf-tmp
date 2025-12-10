// Default response parsers

import { ParseError } from '../errors.js';

/**
 * Default JSON parser.
 * Extracts JSON data from response.
 */
export async function parseJson<T = unknown>(response: Response): Promise<T> {
  try {
    const text = await response.text();
    if (!text) {
      return null as T;
    }
    return JSON.parse(text) as T;
  } catch (error) {
    throw new ParseError(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : String(error)}`,
      error,
      response
    );
  }
}

/**
 * Default text parser.
 */
export async function parseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    throw new ParseError(
      `Failed to parse text response: ${error instanceof Error ? error.message : String(error)}`,
      error,
      response
    );
  }
}

/**
 * Default blob parser.
 */
export async function parseBlob(response: Response): Promise<Blob> {
  try {
    return await response.blob();
  } catch (error) {
    throw new ParseError(
      `Failed to parse blob response: ${error instanceof Error ? error.message : String(error)}`,
      error,
      response
    );
  }
}

/**
 * Default arrayBuffer parser.
 */
export async function parseArrayBuffer(response: Response): Promise<ArrayBuffer> {
  try {
    return await response.arrayBuffer();
  } catch (error) {
    throw new ParseError(
      `Failed to parse arrayBuffer response: ${error instanceof Error ? error.message : String(error)}`,
      error,
      response
    );
  }
}

/**
 * Standard REST API response parser.
 * Assumes response format: { data: T, message?: string, code?: number }
 */
export async function parseRestResponse<T = unknown>(
  response: Response
): Promise<T> {
  const json = await parseJson<{ data?: T; message?: string; code?: number }>(
    response
  );
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

