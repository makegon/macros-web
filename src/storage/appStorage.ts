import type { CounterState } from '../domain/personCounter';

const STORAGE_KEY = 'building-person-counter-state-v1';

export interface AppPersistedState {
  server: string;
  resetCount: number;
  counterState: CounterState;
  latestCounters: {
    totalIn: number;
    totalOut: number;
  } | null;
}

function getLocalStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isCounterState(value: unknown): value is CounterState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as CounterState;

  return (
    isFiniteNumber(candidate.currentPeopleCount) &&
    isNullableFiniteNumber(candidate.previousTotalIn) &&
    isNullableFiniteNumber(candidate.previousTotalOut) &&
    typeof candidate.hasBaseline === 'boolean'
  );
}

function isLatestCounters(value: unknown): value is AppPersistedState['latestCounters'] {
  if (value === null) {
    return true;
  }

  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { totalIn?: unknown; totalOut?: unknown };

  return isFiniteNumber(candidate.totalIn) && isFiniteNumber(candidate.totalOut);
}

function isAppPersistedState(value: unknown): value is AppPersistedState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as AppPersistedState;

  return (
    typeof candidate.server === 'string' &&
    isFiniteNumber(candidate.resetCount) &&
    isCounterState(candidate.counterState) &&
    isLatestCounters(candidate.latestCounters)
  );
}

export function loadAppState(): AppPersistedState | null {
  const storage = getLocalStorage();

  if (!storage) {
    return null;
  }

  try {
    const rawState = storage.getItem(STORAGE_KEY);

    if (!rawState) {
      return null;
    }

    const parsedState = JSON.parse(rawState) as unknown;

    return isAppPersistedState(parsedState) ? parsedState : null;
  } catch {
    return null;
  }
}

export function saveAppState(state: AppPersistedState): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEY, exportStateToJson(state));
  } catch {
    // Persistence is best-effort because browsers can block or fill localStorage.
  }
}

export function clearAppState(): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Clearing cached state is best-effort for the same storage availability reasons.
  }
}

export function exportStateToJson(state: AppPersistedState): string {
  return JSON.stringify(state, null, 2);
}

export function importStateFromJson(json: string): AppPersistedState {
  let parsedState: unknown;

  try {
    parsedState = JSON.parse(json) as unknown;
  } catch {
    throw new Error('Imported state JSON is invalid.');
  }

  if (!isAppPersistedState(parsedState)) {
    throw new Error('Imported state has invalid structure.');
  }

  return parsedState;
}
