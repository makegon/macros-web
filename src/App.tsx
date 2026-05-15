import { useCallback, useEffect, useState } from 'react';
import { aggregateInOut, validateCountersResponse } from './domain/aggregation';
import {
  applyCounters,
  createInitialCounterState,
  resetCounter,
  type AggregatedCounters,
} from './domain/personCounter';
import { loadAppState, saveAppState, type AppPersistedState } from './storage/appStorage';
import { useCurrentCountersPolling } from './hooks/useCurrentCountersPolling';
import type { CurrentCountersResponse } from './api/types';

const DEFAULT_SERVER = '192.168.0.197:8080';
const POLLING_INTERVAL_MS = 5000;

function formatDateTime(value: Date | null): string {
  if (!value) {
    return '-';
  }

  return value.toLocaleString();
}

function parseResetCount(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function formatNullableNumber(value: number | null): string {
  return value === null ? '-' : String(value);
}

function normalizeServerInput(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function App() {
  const [storedState] = useState<AppPersistedState | null>(() => loadAppState());
  const [server, setServer] = useState(storedState?.server ?? DEFAULT_SERVER);
  const [resetCount, setResetCount] = useState(String(storedState?.resetCount ?? 0));
  const [counterState, setCounterState] = useState(
    storedState?.counterState ?? createInitialCounterState(0),
  );
  const [latestCounters, setLatestCounters] = useState<AggregatedCounters | null>(
    storedState?.latestCounters ?? null,
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [pollingServer, setPollingServer] = useState<string | null>(null);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [reconnectSuffix, setReconnectSuffix] = useState('');

  useEffect(() => {
    saveAppState({
      server,
      resetCount: parseResetCount(resetCount) ?? 0,
      counterState,
      latestCounters,
    });
  }, [counterState, latestCounters, resetCount, server]);

  const handlePollingSuccess = useCallback((response: CurrentCountersResponse) => {
    const validationErrors = validateCountersResponse(response);

    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(' '));
    }

    const counters = aggregateInOut(response);

    setLatestCounters(counters);
    setCounterState((currentState) => applyCounters(currentState, counters));
    setLocalError(null);
  }, []);

  const handlePollingError = useCallback(() => {
    setLocalError(null);
  }, []);

  const pollingState = useCurrentCountersPolling({
    server: pollingServer ? `${pollingServer}${reconnectSuffix}` : server,
    enabled: pollingEnabled && pollingServer !== null,
    intervalMs: POLLING_INTERVAL_MS,
    onSuccess: handlePollingSuccess,
    onError: handlePollingError,
  });

  const handleConnect = () => {
    const normalizedServer = normalizeServerInput(server);

    if (!normalizedServer) {
      setLocalError('Server address is required.');
      setPollingServer(null);
      setPollingEnabled(false);
      return;
    }

    setServer(normalizedServer);
    setLocalError(null);
    setPollingServer(normalizedServer);
    setReconnectSuffix((currentSuffix) => (currentSuffix === '' ? '/' : ''));
    setPollingEnabled(true);
  };

  const handleReset = () => {
    const parsedResetCount = parseResetCount(resetCount);

    if (parsedResetCount === null) {
      setLocalError('Reset count must be a valid number.');
      return;
    }

    setCounterState((currentState) =>
      resetCounter(currentState, parsedResetCount, latestCounters ?? undefined),
    );
    setLocalError(null);
  };

  const displayedStatus = localError ? 'error' : pollingState.status;
  const displayedError = localError ?? pollingState.error;

  return (
    <main className="app-shell">
      <section className="counter-panel" aria-labelledby="app-title">
        <h1 id="app-title">Building People Counter</h1>

        <div className="panel-section connection-section">
          <label className="section-label" htmlFor="server-input">
            Server
          </label>
          <div className="server-controls">
            <input
              id="server-input"
              type="text"
              value={server}
              onChange={(event) => setServer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleConnect();
                }
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" onClick={handleConnect}>
              OK
            </button>
          </div>
        </div>

        <div className="panel-section count-section">
          <span className="section-label">Person Counts</span>
          <output className="person-count" aria-label="Current person count">
            {counterState.currentPeopleCount}
          </output>
        </div>

        <div className="panel-section reset-section">
          <label className="section-label" htmlFor="reset-input">
            Reset Counts
          </label>
          <div className="reset-controls">
            <input
              id="reset-input"
              type="number"
              value={resetCount}
              onChange={(event) => setResetCount(event.target.value)}
            />
            <button type="button" onClick={handleReset}>
              reset
            </button>
          </div>
        </div>

        <div className="status-grid" aria-label="Connection status">
          <span>Connection status</span>
          <strong className={`status-pill status-${displayedStatus}`}>{displayedStatus}</strong>

          <span>Last update time</span>
          <strong>{formatDateTime(pollingState.lastUpdateAt)}</strong>

          <span>Error message</span>
          <strong className={displayedError ? 'error-message' : ''}>{displayedError || '-'}</strong>
        </div>

        <div className="diagnostics" aria-label="Diagnostics">
          <div>
            <span>Total IN</span>
            <strong>{formatNullableNumber(latestCounters?.totalIn ?? null)}</strong>
          </div>
          <div>
            <span>Total OUT</span>
            <strong>{formatNullableNumber(latestCounters?.totalOut ?? null)}</strong>
          </div>
          <div>
            <span>Previous Total IN</span>
            <strong>{formatNullableNumber(counterState.previousTotalIn)}</strong>
          </div>
          <div>
            <span>Previous Total OUT</span>
            <strong>{formatNullableNumber(counterState.previousTotalOut)}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
