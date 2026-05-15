import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearAppState,
  exportStateToJson,
  importStateFromJson,
  loadAppState,
  saveAppState,
  type AppPersistedState,
} from './appStorage';

function createMemoryStorage(): Storage {
  const items = new Map<string, string>();

  return {
    get length() {
      return items.size;
    },
    clear: vi.fn(() => {
      items.clear();
    }),
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(items.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      items.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      items.set(key, value);
    }),
  };
}

const persistedState: AppPersistedState = {
  server: '192.168.0.197:8080',
  resetCount: 12,
  counterState: {
    currentPeopleCount: 12,
    previousTotalIn: 100,
    previousTotalOut: 20,
    hasBaseline: true,
  },
  latestCounters: {
    totalIn: 105,
    totalOut: 22,
  },
};

describe('appStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('saves and loads state from localStorage', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());

    saveAppState(persistedState);

    expect(loadAppState()).toEqual(persistedState);
  });

  it('returns null for corrupted JSON', () => {
    const storage = createMemoryStorage();
    storage.setItem('building-person-counter-state-v1', '{bad json');
    vi.stubGlobal('localStorage', storage);

    expect(loadAppState()).toBeNull();
  });

  it('exports and imports state as JSON', () => {
    const json = exportStateToJson(persistedState);

    expect(importStateFromJson(json)).toEqual(persistedState);
  });

  it('does not break when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);

    expect(loadAppState()).toBeNull();
    expect(() => saveAppState(persistedState)).not.toThrow();
    expect(() => clearAppState()).not.toThrow();
  });

  it('throws a readable error for invalid imported structure', () => {
    expect(() => importStateFromJson('{"server":"192.168.0.197:8080"}')).toThrow(
      'Imported state has invalid structure.',
    );
  });
});
