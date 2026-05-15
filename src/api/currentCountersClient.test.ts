import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildCurrentCountersUrl,
  createBasicAuthHeader,
  fetchCurrentCounters,
} from './currentCountersClient';

describe('current counters client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('creates URL from host and port', () => {
    expect(buildCurrentCountersUrl('192.168.0.197:8080')).toBe(
      'http://192.168.0.197:8080/api/objects_counting/current_counters',
    );
  });

  it('creates URL from address that already includes http protocol', () => {
    expect(buildCurrentCountersUrl('http://192.168.0.197:8080')).toBe(
      'http://192.168.0.197:8080/api/objects_counting/current_counters',
    );
  });

  it('creates URL from address with https protocol', () => {
    expect(buildCurrentCountersUrl('https://192.168.0.197:8080')).toBe(
      'http://192.168.0.197:8080/api/objects_counting/current_counters',
    );
  });

  it('trims spaces around the server address', () => {
    expect(buildCurrentCountersUrl(' 192.168.0.197:8080 ')).toBe(
      'http://192.168.0.197:8080/api/objects_counting/current_counters',
    );
  });

  it('throws a readable error for empty server address', () => {
    expect(() => buildCurrentCountersUrl('   ')).toThrow('Server address is required.');
  });

  it('throws a readable error when server address contains internal spaces', () => {
    expect(() => buildCurrentCountersUrl('192.168.0.197: 8080')).toThrow(
      'Server address must not contain spaces.',
    );
  });

  it('throws a readable error when server address contains a path', () => {
    expect(() => buildCurrentCountersUrl('192.168.0.197:8080/api')).toThrow(
      'Server address must not contain a path.',
    );
  });

  it('creates Basic Auth header for root and empty password', () => {
    expect(createBasicAuthHeader('root', '')).toBe('Basic cm9vdDo=');
  });

  it('sends Basic Auth header with lowercase root username', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockResolvedValue({ Channels: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchCurrentCounters('192.168.0.197:8080');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://192.168.0.197:8080/api/objects_counting/current_counters',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Basic cm9vdDo=',
        }),
      }),
    );
  });

  it('turns HTTP 500 into a readable error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    await expect(fetchCurrentCounters('192.168.0.197:8080')).rejects.toThrow(
      'Camera API returned HTTP 500 Internal Server Error.',
    );
  });

  it('turns network errors into a readable error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(fetchCurrentCounters('192.168.0.197:8080')).rejects.toThrow(
      'Network error while requesting camera API: Failed to fetch',
    );
  });

  it('turns timeout into a readable error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }),
      ),
    );

    const request = expect(fetchCurrentCounters('192.168.0.197:8080', 1000)).rejects.toThrow(
      'Camera API request timed out after 1000 ms.',
    );
    await vi.advanceTimersByTimeAsync(1000);

    await request;
  });

  it('turns invalid JSON into a readable error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      }),
    );

    await expect(fetchCurrentCounters('192.168.0.197:8080')).rejects.toThrow(
      'Camera API returned invalid JSON.',
    );
  });
});
