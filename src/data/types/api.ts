export interface HyperliquidUniverseAsset {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
  isDelisted?: boolean;
  marginMode?: string;
}

export interface HyperliquidMarginTier {
  lowerBound: string;
  maxLeverage: number;
}

export interface HyperliquidMarginTable {
  description: string;
  marginTiers: HyperliquidMarginTier[];
}

export interface HyperliquidPerpMeta {
  universe: HyperliquidUniverseAsset[];
  marginTables: Array<[number, HyperliquidMarginTable]>;
  collateralToken?: number;
}

export interface HyperliquidAssetContext {
  dayNtlVlm?: string;
  funding?: string;
  impactPxs?: [string, string] | null;
  markPx: string;
  midPx?: string | null;
  openInterest?: string;
  oraclePx?: string;
  premium?: string | null;
  prevDayPx: string;
}

export type HyperliquidMetaAndAssetCtxsResponse = [
  HyperliquidPerpMeta,
  HyperliquidAssetContext[],
];

export interface HyperliquidLeverage {
  type: string;
  value: number;
  rawUsd?: string;
}

export interface HyperliquidPosition {
  coin: string;
  entryPx: string;
  leverage: HyperliquidLeverage;
  liquidationPx?: string;
  marginUsed: string;
  maxLeverage: number;
  positionValue: string;
  returnOnEquity?: string;
  szi: string;
  unrealizedPnl: string;
}

export interface HyperliquidAssetPosition {
  position: HyperliquidPosition;
  type: string;
}

export interface HyperliquidMarginSummary {
  accountValue: string;
  totalMarginUsed: string;
  totalNtlPos: string;
  totalRawUsd: string;
}

export interface HyperliquidClearinghouseStateResponse {
  assetPositions: HyperliquidAssetPosition[];
  crossMaintenanceMarginUsed: string;
  crossMarginSummary?: HyperliquidMarginSummary;
  marginSummary: HyperliquidMarginSummary;
  time: number;
  withdrawable: string;
}

export interface HyperliquidAllMidsMessage {
  channel: "allMids";
  data: {
    mids: Record<string, string>;
  };
}

export interface HyperliquidSubscriptionResponseMessage {
  channel: "subscriptionResponse";
  data: unknown;
}

export interface HyperliquidCandleSnapshot {
  t: number;
  T: number;
  s: string;
  i: string;
  o: string;
  c: string;
  h: string;
  l: string;
  v: string;
  n: number;
}
