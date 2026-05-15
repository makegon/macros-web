export interface CounterState {
  currentPeopleCount: number;
  previousTotalIn: number | null;
  previousTotalOut: number | null;
  hasBaseline: boolean;
}

export interface AggregatedCounters {
  totalIn: number;
  totalOut: number;
}

export function createInitialCounterState(initialCount = 0): CounterState {
  return {
    currentPeopleCount: initialCount,
    previousTotalIn: null,
    previousTotalOut: null,
    hasBaseline: false,
  };
}

export function applyCounters(
  state: CounterState,
  counters: AggregatedCounters,
): CounterState {
  if (!state.hasBaseline || state.previousTotalIn === null || state.previousTotalOut === null) {
    return {
      ...state,
      previousTotalIn: counters.totalIn,
      previousTotalOut: counters.totalOut,
      hasBaseline: true,
    };
  }

  const deltaIn =
    counters.totalIn >= state.previousTotalIn ? counters.totalIn - state.previousTotalIn : 0;
  const deltaOut =
    counters.totalOut >= state.previousTotalOut ? counters.totalOut - state.previousTotalOut : 0;

  return {
    currentPeopleCount: state.currentPeopleCount + deltaIn - deltaOut,
    previousTotalIn: counters.totalIn,
    previousTotalOut: counters.totalOut,
    hasBaseline: true,
  };
}

export function resetCounter(
  state: CounterState,
  resetCount: number,
  latestCounters?: AggregatedCounters,
): CounterState {
  if (!latestCounters) {
    return {
      ...state,
      currentPeopleCount: resetCount,
    };
  }

  return {
    currentPeopleCount: resetCount,
    previousTotalIn: latestCounters.totalIn,
    previousTotalOut: latestCounters.totalOut,
    hasBaseline: true,
  };
}
