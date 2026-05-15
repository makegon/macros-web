import type { CurrentCountersResponse } from '../api/types';

export interface AggregatedCounters {
  totalIn: number;
  totalOut: number;
}

function getPersonCount(value: unknown): number {
  if (
    typeof value === 'object' &&
    value !== null &&
    'Person' in value &&
    typeof value.Person === 'number'
  ) {
    return value.Person;
  }

  return 0;
}

export function aggregateInOut(response: CurrentCountersResponse): AggregatedCounters {
  const channels = (response as { Channels?: unknown } | null | undefined)?.Channels;

  if (!Array.isArray(channels) || channels.length === 0) {
    return { totalIn: 0, totalOut: 0 };
  }

  return channels.reduce<AggregatedCounters>(
    (totals, channel) => {
      const zones = (channel as { Zones?: unknown } | null | undefined)?.Zones;

      if (!Array.isArray(zones) || zones.length === 0) {
        return totals;
      }

      for (const zone of zones) {
        const zoneRecord = zone as
          | { Name?: unknown; CurrentCounts?: unknown }
          | null
          | undefined;
        const count = getPersonCount(zoneRecord?.CurrentCounts);

        if (zoneRecord?.Name === 'IN') {
          totals.totalIn += count;
        }

        if (zoneRecord?.Name === 'OUT') {
          totals.totalOut += count;
        }
      }

      return totals;
    },
    { totalIn: 0, totalOut: 0 },
  );
}
