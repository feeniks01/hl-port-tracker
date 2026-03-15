import { postInfo } from "./client";
import type { HyperliquidMetaAndAssetCtxsResponse } from "../types/api";

export async function fetchMetaAndAssetCtxs() {
  return postInfo<
    HyperliquidMetaAndAssetCtxsResponse,
    { type: "metaAndAssetCtxs"; dex?: string }
  >({
    type: "metaAndAssetCtxs",
  });
}
