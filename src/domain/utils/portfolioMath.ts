import type { AccountSummary, Position } from "../types/portfolio";

export function getLivePosition(position: Position, mids: Record<string, number>) {
  const liveMark = mids[position.coin] ?? position.markPrice;
  const pnl = (liveMark - position.entryPrice) * position.size;

  return {
    ...position,
    markPrice: liveMark,
    unrealizedPnl: pnl,
  };
}

export function getLiveSummary(
  summary: AccountSummary | null,
  positions: Position[],
  livePositions: Position[],
) {
  if (!summary) {
    return null;
  }

  const basePnlByCoin = new Map(
    positions.map((position) => [position.coin, position.unrealizedPnl]),
  );
  const livePnlDelta = livePositions.reduce((sum, position) => {
    return sum + (position.unrealizedPnl - (basePnlByCoin.get(position.coin) ?? 0));
  }, 0);

  return {
    ...summary,
    netEquity: summary.netEquity + livePnlDelta,
  };
}
