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

const DEFAULT_SERVER = '192.168.0.197';
const DEFAULT_PORT = '8080';
const DEFAULT_USERNAME = 'root';
const DEFAULT_PASSWORD = '';
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

function parseServerAndPort(serverValue: string, portValue: string): { server: string; port: string } {
  const normalizedServer = normalizeServerInput(serverValue).replace(/^https?:\/\//i, '');
  const normalizedPort = portValue.trim();
  const lastColonIndex = normalizedServer.lastIndexOf(':');

  if (lastColonIndex > -1) {
    const host = normalizedServer.slice(0, lastColonIndex);
    const port = normalizedServer.slice(lastColonIndex + 1);

    if (host && /^\d+$/.test(port)) {
      return { server: host, port };
    }
  }

  return { server: normalizedServer, port: normalizedPort };
}

function isValidPort(value: string): boolean {
  if (!/^\d+$/.test(value)) {
    return false;
  }

  const port = Number(value);

  return port >= 1 && port <= 65535;
}

function App() {
  const [storedState] = useState<AppPersistedState | null>(() => loadAppState());
  const [server, setServer] = useState(storedState?.server ?? DEFAULT_SERVER);
  const [port, setPort] = useState(storedState?.port ?? DEFAULT_PORT);
  const [username, setUsername] = useState(storedState?.username ?? DEFAULT_USERNAME);
  const [password, setPassword] = useState(storedState?.password ?? DEFAULT_PASSWORD);
  const [resetCount, setResetCount] = useState(String(storedState?.resetCount ?? 0));
  const [counterState, setCounterState] = useState(
    storedState?.counterState ?? createInitialCounterState(0),
  );
  const [latestCounters, setLatestCounters] = useState<AggregatedCounters | null>(
    storedState?.latestCounters ?? null,
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [pollingServer, setPollingServer] = useState<string | null>(null);
  const [pollingPort, setPollingPort] = useState(DEFAULT_PORT);
  const [pollingUsername, setPollingUsername] = useState(DEFAULT_USERNAME);
  const [pollingPassword, setPollingPassword] = useState(DEFAULT_PASSWORD);
  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [reconnectSuffix, setReconnectSuffix] = useState('');

  useEffect(() => {
    saveAppState({
      server,
      port,
      username,
      password,
      resetCount: parseResetCount(resetCount) ?? 0,
      counterState,
      latestCounters,
    });
  }, [counterState, latestCounters, password, port, resetCount, server, username]);

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
    port: pollingPort,
    username: pollingUsername,
    password: pollingPassword,
    onSuccess: handlePollingSuccess,
    onError: handlePollingError,
  });

  const handleConnect = () => {
    const nextConnection = parseServerAndPort(server, port);
    const normalizedUsername = username.trim();

    if (!nextConnection.server) {
      setLocalError('Server address is required.');
      setPollingServer(null);
      setPollingEnabled(false);
      return;
    }

    if (nextConnection.server.includes('/')) {
      setLocalError('Server address must not contain a path.');
      setPollingServer(null);
      setPollingEnabled(false);
      return;
    }

    if (!isValidPort(nextConnection.port)) {
      setLocalError('Port must be a number from 1 to 65535.');
      setPollingServer(null);
      setPollingEnabled(false);
      return;
    }

    if (!normalizedUsername) {
      setLocalError('User is required.');
      setPollingServer(null);
      setPollingEnabled(false);
      return;
    }

    setServer(nextConnection.server);
    setPort(nextConnection.port);
    setUsername(normalizedUsername);
    setLocalError(null);
    setPollingServer(nextConnection.server);
    setPollingPort(nextConnection.port);
    setPollingUsername(normalizedUsername);
    setPollingPassword(password);
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

        <div className="connection-settings" aria-label="Connection settings">
          <label htmlFor="port-input">
            Port
            <input
              id="port-input"
              type="number"
              min="1"
              max="65535"
              value={port}
              onChange={(event) => setPort(event.target.value)}
            />
          </label>
          <label htmlFor="username-input">
            User
            <input
              id="username-input"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              spellCheck={false}
            />
          </label>
          <label htmlFor="password-input">
            Password
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
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
