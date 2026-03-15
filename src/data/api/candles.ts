import { postInfo } from "./client";
import type { HyperliquidCandleSnapshot } from "../types/api";

export interface CandleRequest {
  coin: string;
  interval: string;
  startTime: number;
  endTime: number;
}

// Official docs:
// - https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
// - `type: "candleSnapshot"` on the info endpoint for historical OHLCV.
export async function fetchCandleSnapshot(request: CandleRequest) {
  return postInfo<
    HyperliquidCandleSnapshot[],
    { type: "candleSnapshot"; req: CandleRequest }
  >({
    type: "candleSnapshot",
    req: request,
  });
}
