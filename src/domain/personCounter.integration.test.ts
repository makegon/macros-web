import { describe, expect, it } from 'vitest';
import { applyCounters, createInitialCounterState, resetCounter } from './personCounter';

describe('person counter integration flow', () => {
  it('handles baseline, deltas, user reset, repeated totals, and external IN reset', () => {
    let state = createInitialCounterState(0);

    state = applyCounters(state, { totalIn: 100, totalOut: 40 });
    expect(state).toEqual({
      currentPeopleCount: 0,
      previousTotalIn: 100,
      previousTotalOut: 40,
      hasBaseline: true,
    });

    state = applyCounters(state, { totalIn: 105, totalOut: 42 });
    expect(state).toEqual({
      currentPeopleCount: 3,
      previousTotalIn: 105,
      previousTotalOut: 42,
      hasBaseline: true,
    });

    state = resetCounter(state, 20, { totalIn: 105, totalOut: 42 });
    expect(state).toEqual({
      currentPeopleCount: 20,
      previousTotalIn: 105,
      previousTotalOut: 42,
      hasBaseline: true,
    });

    state = applyCounters(state, { totalIn: 108, totalOut: 43 });
    expect(state).toEqual({
      currentPeopleCount: 22,
      previousTotalIn: 108,
      previousTotalOut: 43,
      hasBaseline: true,
    });

    state = applyCounters(state, { totalIn: 108, totalOut: 43 });
    expect(state).toEqual({
      currentPeopleCount: 22,
      previousTotalIn: 108,
      previousTotalOut: 43,
      hasBaseline: true,
    });

    state = applyCounters(state, { totalIn: 1, totalOut: 43 });
    expect(state).toEqual({
      currentPeopleCount: 22,
      previousTotalIn: 1,
      previousTotalOut: 43,
      hasBaseline: true,
    });

    state = applyCounters(state, { totalIn: 3, totalOut: 44 });
    expect(state).toEqual({
      currentPeopleCount: 23,
      previousTotalIn: 3,
      previousTotalOut: 44,
      hasBaseline: true,
    });
  });
});
