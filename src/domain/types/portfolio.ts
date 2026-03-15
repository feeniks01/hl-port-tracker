export interface AccountSummary {
  netEquity: number;
  withdrawable: number;
  marginUsed: number;
  notionalPosition: number;
  maintenanceMargin: number;
  leverage: number | null;
}

export interface Position {
  coin: string;
  size: number;
  entryPrice: number;
  markPrice: number;
  marginUsed: number;
  notionalValue: number;
  unrealizedPnl: number;
  maxLeverage: number;
  leverageType: string;
  leverageValue: number;
  liquidationPrice: number | null;
}
