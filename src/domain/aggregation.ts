import type { CurrentCountersResponse } from '../api/types';

export interface AggregatedCounters {
  totalIn: number;
  totalOut: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getPersonCount(value: unknown): number {
  if (
    isRecord(value) &&
    'Person' in value &&
    typeof value.Person === 'number'
  ) {
    return value.Person;
  }

  return 0;
}

export function validateCountersResponse(response: unknown): string[] {
  const errors: string[] = [];

  if (!isRecord(response)) {
    return ['Camera API response must be an object.'];
  }

  if (!('Channels' in response)) {
    return ['Camera API response is missing Channels.'];
  }

  if (!Array.isArray(response.Channels)) {
    return ['Camera API response Channels must be an array.'];
  }

  if (response.Channels.length === 0) {
    return ['Camera API response Channels is empty.'];
  }

  response.Channels.forEach((channel, channelIndex) => {
    const channelLabel = `Channel ${channelIndex + 1}`;

    if (!isRecord(channel)) {
      errors.push(`${channelLabel} must be an object.`);
      return;
    }

    if (!('Zones' in channel)) {
      errors.push(`${channelLabel} is missing Zones.`);
      return;
    }

    if (!Array.isArray(channel.Zones)) {
      errors.push(`${channelLabel} Zones must be an array.`);
      return;
    }

    if (channel.Zones.length === 0) {
      errors.push(`${channelLabel} Zones is empty.`);
      return;
    }

    channel.Zones.forEach((zone, zoneIndex) => {
      const zoneLabel = `${channelLabel} Zone ${zoneIndex + 1}`;

      if (!isRecord(zone)) {
        errors.push(`${zoneLabel} must be an object.`);
        return;
      }

      if (zone.Name !== 'IN' && zone.Name !== 'OUT') {
        return;
      }

      if (!('CurrentCounts' in zone)) {
        errors.push(`${zoneLabel} (${String(zone.Name)}) is missing CurrentCounts.`);
        return;
      }

      if (!isRecord(zone.CurrentCounts)) {
        errors.push(`${zoneLabel} (${String(zone.Name)}) CurrentCounts must be an object.`);
        return;
      }

      if (!('Person' in zone.CurrentCounts)) {
        errors.push(`${zoneLabel} (${String(zone.Name)}) is missing Person.`);
        return;
      }

      if (typeof zone.CurrentCounts.Person !== 'number') {
        errors.push(`${zoneLabel} (${String(zone.Name)}) Person must be a number.`);
      }
    });
  });

  return errors;
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
