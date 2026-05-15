import { useEffect, useRef, useState } from 'react';
import { aggregateInOut } from './domain/aggregation';
import {
  applyCounters,
  createInitialCounterState,
  resetCounter,
  type AggregatedCounters,
} from './domain/personCounter';
import { fetchCurrentCounters } from './api/currentCountersClient';
import { loadAppState, saveAppState, type AppPersistedState } from './storage/appStorage';

const DEFAULT_SERVER = '192.168.0.197:8080';
const POLLING_INTERVAL_MS = 5000;

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [pollingServer, setPollingServer] = useState<string | null>(null);
  const [pollingRun, setPollingRun] = useState(0);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    saveAppState({
      server,
      resetCount: parseResetCount(resetCount) ?? 0,
      counterState,
      latestCounters,
    });
  }, [counterState, latestCounters, resetCount, server]);

  useEffect(() => {
    if (!pollingServer) {
      return;
    }

    let isStopped = false;

    const poll = async () => {
      if (requestInFlightRef.current) {
        return;
      }

      requestInFlightRef.current = true;
      setConnectionStatus((currentStatus) =>
        currentStatus === 'connected' ? 'connected' : 'connecting',
      );

      try {
        const response = await fetchCurrentCounters(pollingServer);

        if (isStopped) {
          return;
        }

        const counters = aggregateInOut(response);

        setLatestCounters(counters);
        setCounterState((currentState) => applyCounters(currentState, counters));
        setLastUpdateTime(new Date());
        setErrorMessage('');
        setConnectionStatus('connected');
      } catch (error) {
        if (isStopped) {
          return;
        }

        setConnectionStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unknown connection error.');
      } finally {
        requestInFlightRef.current = false;
      }
    };

    void poll();
    const intervalId = globalThis.setInterval(() => {
      void poll();
    }, POLLING_INTERVAL_MS);

    return () => {
      isStopped = true;
      requestInFlightRef.current = false;
      globalThis.clearInterval(intervalId);
    };
  }, [pollingRun, pollingServer]);

  const handleConnect = () => {
    const normalizedServer = server.trim();

    if (!normalizedServer) {
      setConnectionStatus('error');
      setErrorMessage('Server address is required.');
      setPollingServer(null);
      return;
    }

    setServer(normalizedServer);
    setErrorMessage('');
    setConnectionStatus('connecting');
    setPollingServer(normalizedServer);
    setPollingRun((currentRun) => currentRun + 1);
  };

  const handleReset = () => {
    const parsedResetCount = parseResetCount(resetCount);

    if (parsedResetCount === null) {
      setErrorMessage('Reset count must be a valid number.');
      return;
    }

    setCounterState((currentState) =>
      resetCounter(currentState, parsedResetCount, latestCounters ?? undefined),
    );
  };

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
          <strong className={`status-pill status-${connectionStatus}`}>{connectionStatus}</strong>

          <span>Last update time</span>
          <strong>{formatDateTime(lastUpdateTime)}</strong>

          <span>Error message</span>
          <strong className={errorMessage ? 'error-message' : ''}>{errorMessage || '-'}</strong>
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
