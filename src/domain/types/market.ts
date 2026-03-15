export interface AssetRow {
  symbol: string;
  price: number;
  midPrice: number | null;
  change24hPct: number;
  prevDayPrice: number;
  fundingRate: number | null;
  openInterest: number | null;
  volume24h: number | null;
  maxLeverage: number;
  isDelisted: boolean;
  onlyIsolated: boolean;
}

export type MidsMap = Record<string, number>;

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";
