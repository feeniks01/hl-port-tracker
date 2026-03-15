export type ChartRangeKey = "24h" | "7d" | "30d";

export const CHART_RANGE_CONFIG: Record<
  ChartRangeKey,
  { interval: string; lookbackMs: number }
> = {
  "24h": { interval: "15m", lookbackMs: 24 * 60 * 60 * 1000 },
  "7d": { interval: "4h", lookbackMs: 7 * 24 * 60 * 60 * 1000 },
  "30d": { interval: "1d", lookbackMs: 30 * 24 * 60 * 60 * 1000 },
};

export interface PriceCandle {
  startTime: number;
  endTime: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  trades: number;
}

export interface PriceEvent {
  id: string;
  timestamp: number;
  title: string;
  source: string;
  asset?: string;
  url?: string;
  sentiment?: "positive" | "negative" | "neutral";
}
