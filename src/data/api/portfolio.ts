import { postInfo } from "./client";
import type { HyperliquidClearinghouseStateResponse } from "../types/api";

export async function fetchClearinghouseState(address: string) {
  return postInfo<
    HyperliquidClearinghouseStateResponse,
    { type: "clearinghouseState"; user: string; dex?: string }
  >({
    type: "clearinghouseState",
    user: address,
  });
}
