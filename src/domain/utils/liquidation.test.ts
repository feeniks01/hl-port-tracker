import { describe, expect, it } from "vitest";
import type { Position } from "../types/portfolio";
import {
  formatEstimatedTime,
  getEstimatedHoursToLiq,
  getLiquidationDistancePct,
  getLiquidationRisk,
} from "./liquidation";

const longPosition: Position = {
  coin: "BTC",
  size: 1,
  entryPrice: 100,
  markPrice: 100,
  marginUsed: 100,
  notionalValue: 100,
  unrealizedPnl: 0,
  maxLeverage: 5,
  leverageType: "cross",
  leverageValue: 2,
  liquidationPrice: 85,
};

describe("getLiquidationDistancePct", () => {
  it("calculates long liquidation distance correctly", () => {
    expect(getLiquidationDistancePct(longPosition)).toBe(15);
  });

  it("calculates short liquidation distance correctly", () => {
    const shortPosition = {
      ...longPosition,
      size: -1,
      liquidationPrice: 120,
    };

    expect(getLiquidationDistancePct(shortPosition)).toBe(20);
  });

  it("returns null when liquidation data is unavailable", () => {
    expect(getLiquidationDistancePct({ ...longPosition, liquidationPrice: null })).toBeNull();
  });
});

describe("getLiquidationRisk", () => {
  it("returns danger for very tight liquidation distance", () => {
    expect(getLiquidationRisk(4)?.label).toBe("Danger");
  });

  it("returns caution for mid-range liquidation distance", () => {
    expect(getLiquidationRisk(10)?.label).toBe("Caution");
  });

  it("returns safe for wide liquidation distance", () => {
    expect(getLiquidationRisk(25)?.label).toBe("Safe");
  });
});

describe("getEstimatedHoursToLiq", () => {
  it("estimates time to liquidation from distance and volatility", () => {
    expect(getEstimatedHoursToLiq(longPosition, 0.05)).toBeCloseTo(9, 5);
  });

  it("returns null for invalid volatility", () => {
    expect(getEstimatedHoursToLiq(longPosition, 0)).toBeNull();
  });
});

describe("formatEstimatedTime", () => {
  it("formats sub-hour estimates", () => {
    expect(formatEstimatedTime(0.5)).toBe("<1h");
  });

  it("formats hour estimates", () => {
    expect(formatEstimatedTime(6.2)).toBe("~6h");
  });

  it("formats day estimates", () => {
    expect(formatEstimatedTime(36)).toBe("~1.5d");
  });
});
