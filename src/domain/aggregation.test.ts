import { describe, expect, it } from 'vitest';
import type { CurrentCountersResponse } from '../api/types';
import { aggregateInOut } from './aggregation';

describe('aggregateInOut', () => {
  it('sums IN and OUT counters across two cameras', () => {
    const response: CurrentCountersResponse = {
      Channels: [
        {
          Id: 'camera-1',
          ChannelName: 'Entrance 1',
          Zones: [
            { Id: 'zone-1', Name: 'IN', Type: 'line', CurrentCounts: { Person: 10 } },
            { Id: 'zone-2', Name: 'OUT', Type: 'line', CurrentCounts: { Person: 3 } },
          ],
        },
        {
          Id: 'camera-2',
          ChannelName: 'Entrance 2',
          Zones: [
            { Id: 'zone-3', Name: 'IN', Type: 'line', CurrentCounts: { Person: 5 } },
            { Id: 'zone-4', Name: 'OUT', Type: 'line', CurrentCounts: { Person: 2 } },
          ],
        },
      ],
    };

    expect(aggregateInOut(response)).toEqual({ totalIn: 15, totalOut: 5 });
  });

  it('ignores unknown zone names', () => {
    const response: CurrentCountersResponse = {
      Channels: [
        {
          Id: 'camera-1',
          ChannelName: 'Entrance 1',
          Zones: [
            { Id: 'zone-1', Name: 'IN', Type: 'line', CurrentCounts: { Person: 4 } },
            { Id: 'zone-2', Name: 'LOBBY', Type: 'area', CurrentCounts: { Person: 999 } },
            { Id: 'zone-3', Name: 'OUT', Type: 'line', CurrentCounts: { Person: 1 } },
          ],
        },
      ],
    };

    expect(aggregateInOut(response)).toEqual({ totalIn: 4, totalOut: 1 });
  });

  it('returns zero totals for empty Channels', () => {
    expect(aggregateInOut({ Channels: [] })).toEqual({ totalIn: 0, totalOut: 0 });
  });

  it('skips channels with empty Zones', () => {
    const response: CurrentCountersResponse = {
      Channels: [
        { Id: 'camera-1', ChannelName: 'Entrance 1', Zones: [] },
        {
          Id: 'camera-2',
          ChannelName: 'Entrance 2',
          Zones: [{ Id: 'zone-1', Name: 'IN', Type: 'line', CurrentCounts: { Person: 7 } }],
        },
      ],
    };

    expect(aggregateInOut(response)).toEqual({ totalIn: 7, totalOut: 0 });
  });

  it('treats missing Person as zero', () => {
    const response = {
      Channels: [
        {
          Id: 'camera-1',
          ChannelName: 'Entrance 1',
          Zones: [
            { Id: 'zone-1', Name: 'IN', Type: 'line', CurrentCounts: {} },
            { Id: 'zone-2', Name: 'OUT', Type: 'line' },
          ],
        },
      ],
    } as unknown as CurrentCountersResponse;

    expect(aggregateInOut(response)).toEqual({ totalIn: 0, totalOut: 0 });
  });

  it('does not throw on malformed response shapes', () => {
    const malformedResponses = [
      null,
      undefined,
      {},
      { Channels: 'not-an-array' },
      { Channels: [{ Zones: 'not-an-array' }] },
      { Channels: [{ Zones: [null, { Name: 'IN', CurrentCounts: { Person: '5' } }] }] },
    ] as unknown as CurrentCountersResponse[];

    for (const response of malformedResponses) {
      expect(() => aggregateInOut(response)).not.toThrow();
    }

    expect(aggregateInOut(malformedResponses[5])).toEqual({ totalIn: 0, totalOut: 0 });
  });
});
