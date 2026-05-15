import { useEffect, useRef, useState } from 'react';
import { fetchCurrentCounters } from '../api/currentCountersClient';
import type { CurrentCountersResponse } from '../api/types';

const DEFAULT_INTERVAL_MS = 5000;

export type PollingStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseCurrentCountersPollingOptions {
  server: string;
  enabled: boolean;
  intervalMs?: number;
  port?: string;
  username?: string;
  password?: string;
  onSuccess: (response: CurrentCountersResponse) => void;
  onError?: (error: Error) => void;
}

export interface CurrentCountersPollingState {
  status: PollingStatus;
  lastUpdateAt: Date | null;
  error: string | null;
}

export function useCurrentCountersPolling({
  server,
  enabled,
  intervalMs = DEFAULT_INTERVAL_MS,
  port,
  username,
  password,
  onSuccess,
  onError,
}: UseCurrentCountersPollingOptions): CurrentCountersPollingState {
  const [state, setState] = useState<CurrentCountersPollingState>({
    status: 'disconnected',
    lastUpdateAt: null,
    error: null,
  });
  const requestInFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const callbacksRef = useRef({ onSuccess, onError });

  useEffect(() => {
    callbacksRef.current = { onSuccess, onError };
  }, [onError, onSuccess]);

  useEffect(() => {
    if (!enabled) {
      abortControllerRef.current?.abort();
      requestInFlightRef.current = false;
      setState((currentState) => ({
        ...currentState,
        status: 'disconnected',
        error: null,
      }));
      return;
    }

    let isStopped = false;

    const poll = async () => {
      if (requestInFlightRef.current) {
        return;
      }

      const controller = new AbortController();
      requestInFlightRef.current = true;
      abortControllerRef.current = controller;
      setState((currentState) => ({
        ...currentState,
        status: currentState.status === 'connected' ? 'connected' : 'connecting',
      }));

      try {
        const response = await fetchCurrentCounters(server, undefined, controller.signal, {
          port,
          username,
          password,
        });

        if (isStopped) {
          return;
        }

        const lastUpdateAt = new Date();

        callbacksRef.current.onSuccess(response);
        setState({
          status: 'connected',
          lastUpdateAt,
          error: null,
        });
      } catch (error) {
        if (isStopped || controller.signal.aborted) {
          return;
        }

        const normalizedError =
          error instanceof Error ? error : new Error('Unknown connection error.');

        callbacksRef.current.onError?.(normalizedError);
        setState((currentState) => ({
          status: 'error',
          lastUpdateAt: currentState.lastUpdateAt,
          error: normalizedError.message,
        }));
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }

        requestInFlightRef.current = false;
      }
    };

    void poll();
    const intervalId = globalThis.setInterval(() => {
      void poll();
    }, intervalMs);

    return () => {
      isStopped = true;
      globalThis.clearInterval(intervalId);
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      requestInFlightRef.current = false;
    };
  }, [enabled, intervalMs, password, port, server, username]);

  return state;
}
