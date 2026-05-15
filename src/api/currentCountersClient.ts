import type { CurrentCountersResponse } from './types';

const CURRENT_COUNTERS_PATH = '/api/objects_counting/current_counters';
const DEFAULT_TIMEOUT_MS = 5000;

export function buildCurrentCountersUrl(server: string): string {
  const normalizedServer = server.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');

  if (!normalizedServer) {
    throw new Error('Server address is required.');
  }

  return `http://${normalizedServer}${CURRENT_COUNTERS_PATH}`;
}

export function createBasicAuthHeader(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

export async function fetchCurrentCounters(
  server: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<CurrentCountersResponse> {
  const url = buildCurrentCountersUrl(server);
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: createBasicAuthHeader('Root', ''),
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : '';
      throw new Error(`Camera API returned HTTP ${response.status}${statusText}.`);
    }

    try {
      return (await response.json()) as CurrentCountersResponse;
    } catch {
      throw new Error('Camera API returned invalid JSON.');
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Camera API request timed out after ${timeoutMs} ms.`);
      }

      if (
        error.message.startsWith('Camera API returned HTTP') ||
        error.message === 'Camera API returned invalid JSON.'
      ) {
        throw error;
      }

      throw new Error(`Network error while requesting camera API: ${error.message}`);
    }

    throw new Error('Network error while requesting camera API.');
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
