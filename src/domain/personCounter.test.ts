import { describe, expect, it } from 'vitest';
import {
  applyCounters,
  createInitialCounterState,
  resetCounter,
  type CounterState,
} from './personCounter';

describe('person counter business logic', () => {
  it('uses the first response only to establish a baseline', () => {
    const state = createInitialCounterState();

    expect(applyCounters(state, { totalIn: 100, totalOut: 20 })).toEqual({
      currentPeopleCount: 0,
      previousTotalIn: 100,
      previousTotalOut: 20,
      hasBaseline: true,
    });
  });

  it('does not change currentPeopleCount for a repeated identical response', () => {
    const state: CounterState = {
      currentPeopleCount: 55,
      previousTotalIn: 110,
      previousTotalOut: 25,
      hasBaseline: true,
    };

    expect(applyCounters(state, { totalIn: 110, totalOut: 25 })).toEqual({
      currentPeopleCount: 55,
      previousTotalIn: 110,
      previousTotalOut: 25,
      hasBaseline: true,
    });
  });

  it('increases the counter when IN increases', () => {
    const state: CounterState = {
      currentPeopleCount: 10,
      previousTotalIn: 100,
      previousTotalOut: 20,
      hasBaseline: true,
    };

    expect(applyCounters(state, { totalIn: 107, totalOut: 20 }).currentPeopleCount).toBe(17);
  });

  it('decreases the counter when OUT increases', () => {
    const state: CounterState = {
      currentPeopleCount: 10,
      previousTotalIn: 100,
      previousTotalOut: 20,
      hasBaseline: true,
    };

    expect(applyCounters(state, { totalIn: 100, totalOut: 23 }).currentPeopleCount).toBe(7);
  });

  it('handles simultaneous IN and OUT increases correctly', () => {
    const state: CounterState = {
      currentPeopleCount: 50,
      previousTotalIn: 100,
      previousTotalOut: 20,
      hasBaseline: true,
    };

    expect(applyCounters(state, { totalIn: 110, totalOut: 25 })).toEqual({
      currentPeopleCount: 55,
      previousTotalIn: 110,
      previousTotalOut: 25,
      hasBaseline: true,
    });
  });

  it('sets the requested value on resetCounter', () => {
    const state: CounterState = {
      currentPeopleCount: 50,
      previousTotalIn: 120,
      previousTotalOut: 35,
      hasBaseline: true,
    };

    expect(resetCounter(state, 20)).toEqual({
      currentPeopleCount: 20,
      previousTotalIn: 120,
      previousTotalOut: 35,
      hasBaseline: true,
    });
  });

  it('calculates future deltas from the reset value and latest baseline', () => {
    const state: CounterState = {
      currentPeopleCount: 50,
      previousTotalIn: 100,
      previousTotalOut: 20,
      hasBaseline: true,
    };
    const resetState = resetCounter(state, 20, { totalIn: 120, totalOut: 35 });

    expect(applyCounters(resetState, { totalIn: 125, totalOut: 37 })).toEqual({
      currentPeopleCount: 23,
      previousTotalIn: 125,
      previousTotalOut: 37,
      hasBaseline: true,
    });
  });

  it('does not decrease the counter when the external IN counter resets', () => {
    const state: CounterState = {
      currentPeopleCount: 55,
      previousTotalIn: 110,
      previousTotalOut: 25,
      hasBaseline: true,
    };

    expect(applyCounters(state, { totalIn: 3, totalOut: 25 })).toEqual({
      currentPeopleCount: 55,
      previousTotalIn: 3,
      previousTotalOut: 25,
      hasBaseline: true,
    });
  });

  it('does not increase the counter when the external OUT counter resets', () => {
    const state: CounterState = {
      currentPeopleCount: 55,
      previousTotalIn: 110,
      previousTotalOut: 25,
      hasBaseline: true,
    };

    expect(applyCounters(state, { totalIn: 110, totalOut: 2 })).toEqual({
      currentPeopleCount: 55,
      previousTotalIn: 110,
      previousTotalOut: 2,
      hasBaseline: true,
    });
  });

  it('handles missing baseline values by creating a new baseline', () => {
    const state: CounterState = {
      currentPeopleCount: 12,
      previousTotalIn: null,
      previousTotalOut: null,
      hasBaseline: false,
    };

    expect(applyCounters(state, { totalIn: 10, totalOut: 4 })).toEqual({
      currentPeopleCount: 12,
      previousTotalIn: 10,
      previousTotalOut: 4,
      hasBaseline: true,
    });
  });
});
