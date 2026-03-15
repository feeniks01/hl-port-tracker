export interface AssetRow {
  assetIndex: number;
  symbol: string;
  price: number;
  midPrice: number | null;
  change24hPct: number;
  prevDayPrice: number;
  sizeDecimals: number;
  fundingRate: number | null;
  openInterest: number | null;
  volume24h: number | null;
  maxLeverage: number;
  isDelisted: boolean;
  onlyIsolated: boolean;
}

export type MidsMap = Record<string, number>;
export interface TickPoint {
  timestamp: number;
  price: number;
}
export type TickSeriesMap = Record<string, TickPoint[]>;

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";
