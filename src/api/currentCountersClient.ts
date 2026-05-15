import type { CurrentCountersResponse } from './types';

const CURRENT_COUNTERS_PATH = '/api/objects_counting/current_counters';
const DEFAULT_TIMEOUT_MS = 15000;

export function buildCurrentCountersUrl(server: string): string {
  const normalizedServer = server.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');

  if (!normalizedServer) {
    throw new Error('Server address is required.');
  }

  if (/\s/.test(normalizedServer)) {
    throw new Error('Server address must not contain spaces.');
  }

  if (normalizedServer.includes('/')) {
    throw new Error('Server address must not contain a path.');
  }

  return `http://${normalizedServer}${CURRENT_COUNTERS_PATH}`;
}

export function createBasicAuthHeader(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

export async function fetchCurrentCounters(
  server: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  externalSignal?: AbortSignal,
): Promise<CurrentCountersResponse> {
  const url = buildCurrentCountersUrl(server);
  const controller = new AbortController();
  let didTimeout = false;
  const abortRequest = () => controller.abort();
  const timeoutId = globalThis.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener('abort', abortRequest, { once: true });
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: createBasicAuthHeader('root', ''),
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
        if (!didTimeout && externalSignal?.aborted) {
          throw new Error('Camera API request was cancelled.');
        }

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
    externalSignal?.removeEventListener('abort', abortRequest);
  }
}
