import { describe, expect, it } from "vitest";
import type { AccountSummary, Position } from "../types/portfolio";
import { getLivePosition, getLiveSummary } from "./portfolioMath";

const basePosition: Position = {
  coin: "BTC",
  size: 2,
  entryPrice: 100,
  markPrice: 110,
  marginUsed: 1000,
  notionalValue: 220,
  unrealizedPnl: 20,
  maxLeverage: 10,
  leverageType: "cross",
  leverageValue: 5,
  liquidationPrice: 70,
};

describe("getLivePosition", () => {
  it("updates mark price and pnl from live mids", () => {
    const live = getLivePosition(basePosition, { BTC: 125 });

    expect(live.markPrice).toBe(125);
    expect(live.unrealizedPnl).toBe(50);
  });

  it("falls back to the stored mark price when no mid is available", () => {
    const live = getLivePosition(basePosition, {});

    expect(live.markPrice).toBe(110);
    expect(live.unrealizedPnl).toBe(20);
  });
});

describe("getLiveSummary", () => {
  it("adjusts net equity by the delta between stored and live pnl", () => {
    const summary: AccountSummary = {
      netEquity: 10_000,
      withdrawable: 8_000,
      marginUsed: 2_000,
      notionalPosition: 20_000,
      maintenanceMargin: 600,
      leverage: 2,
    };

    const positions: Position[] = [
      basePosition,
      {
        ...basePosition,
        coin: "ETH",
        size: -1,
        entryPrice: 200,
        markPrice: 190,
        unrealizedPnl: 10,
      },
    ];
    const livePositions: Position[] = [
      { ...positions[0], unrealizedPnl: 50 },
      { ...positions[1], unrealizedPnl: -10 },
    ];

    const liveSummary = getLiveSummary(summary, positions, livePositions);

    expect(liveSummary?.netEquity).toBe(10_010);
    expect(liveSummary?.withdrawable).toBe(8_000);
  });

  it("returns null when summary is missing", () => {
    expect(getLiveSummary(null, [], [])).toBeNull();
  });
});
