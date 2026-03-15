import { describe, expect, it } from "vitest";
import {
  buildAliasMap,
  getAssetMentionScore,
  matchAssetFromPost,
} from "./matchers.mjs";

describe("event matchers", () => {
  it("matches assets directly from instruments when available", () => {
    const aliasMap = buildAliasMap(["BTC", "ETH"]);
    const matched = matchAssetFromPost(
      {
        title: "ETF demand rises",
        description: "Fresh inflows",
        instruments: [{ code: "eth" }],
      },
      ["BTC", "ETH"],
      aliasMap,
    );

    expect(matched).toBe("ETH");
  });

  it("matches assets from aliases in the title and description", () => {
    const aliasMap = buildAliasMap(["HYPE", "XMR"]);
    const matched = matchAssetFromPost(
      {
        title: "Hyperliquid upgrade sparks attention",
        description: "Traders rotate into the protocol after the rollout.",
      },
      ["HYPE", "XMR"],
      aliasMap,
    );

    expect(matched).toBe("HYPE");
  });

  it("scores title mentions above body-only mentions", () => {
    const aliasMap = buildAliasMap(["BTC"]);
    const score = getAssetMentionScore(
      {
        title: "Bitcoin ETF headlines intensify",
        description: "Analysts say BTC demand is climbing.",
      },
      "BTC",
      aliasMap,
    );

    expect(score).toBeGreaterThanOrEqual(6);
  });
});
