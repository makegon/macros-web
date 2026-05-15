export interface CurrentCountersResponse {
  Channels: ChannelDto[];
}

export interface ChannelDto {
  Id: string;
  ChannelName: string;
  Zones: ZoneDto[];
}

export interface ZoneDto {
  Id: string;
  Name: string;
  Type: string;
  CurrentCounts: CurrentCountsDto;
}

export interface CurrentCountsDto {
  Person: number;
}
