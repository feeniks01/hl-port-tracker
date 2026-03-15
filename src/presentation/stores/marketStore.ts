import { fetchMetaAndAssetCtxs } from "../../data/api/market";
import type { HyperliquidAssetContext, HyperliquidUniverseAsset } from "../../data/types/api";
import type { AssetRow, ConnectionStatus, MidsMap } from "../../domain/types/market";
import { createStore } from "./createStore";

interface MarketState {
  assets: AssetRow[];
  mids: MidsMap;
  loading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  initialize: () => Promise<void>;
  applyMids: (mids: Record<string, string>) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setError: (message: string | null) => void;
}

function toNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildAssetRow(
  asset: HyperliquidUniverseAsset,
  context: HyperliquidAssetContext,
): AssetRow {
  const markPrice = Number(context.markPx);
  const midPrice = toNumber(context.midPx);
  const prevDayPrice = Number(context.prevDayPx);
  const currentPrice = midPrice ?? markPrice;
  const change24hPct = prevDayPrice === 0 ? 0 : ((currentPrice - prevDayPrice) / prevDayPrice) * 100;

  return {
    symbol: asset.name,
    price: currentPrice,
    midPrice,
    change24hPct,
    prevDayPrice,
    fundingRate: toNumber(context.funding),
    openInterest: toNumber(context.openInterest),
    volume24h: toNumber(context.dayNtlVlm),
    maxLeverage: asset.maxLeverage,
    isDelisted: asset.isDelisted ?? false,
    onlyIsolated: asset.onlyIsolated ?? false,
  };
}

let flushScheduled = false;
let pendingMids: Record<string, string> = {};

export const useMarketStore = createStore<MarketState>((set, get) => ({
  assets: [],
  mids: {},
  loading: false,
  error: null,
  connectionStatus: "idle",
  async initialize() {
    if (get().loading || get().assets.length > 0) {
      return;
    }

    set({ loading: true, error: null });

    try {
      const [meta, assetCtxs] = await fetchMetaAndAssetCtxs();
      const assets = meta.universe
        .map((asset, index) => {
          const context = assetCtxs[index];
          return context ? buildAssetRow(asset, context) : null;
        })
        .filter((asset): asset is AssetRow => asset !== null)
        .sort((left, right) => right.price - left.price);

      set({
        assets,
        mids: Object.fromEntries(
          assets
            .map((asset) => [asset.symbol, asset.midPrice ?? asset.price] as const)
            .filter(([, value]) => value !== null),
        ),
        loading: false,
        error: null,
      });
    } catch (error) {
      set({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load market metadata from Hyperliquid.",
      });
    }
  },
  applyMids(mids) {
    pendingMids = { ...pendingMids, ...mids };

    if (flushScheduled) {
      return;
    }

    flushScheduled = true;

    window.setTimeout(() => {
      const nextPending = pendingMids;
      pendingMids = {};
      flushScheduled = false;

      set((state) => {
        const numericMids = Object.fromEntries(
          Object.entries(nextPending)
            .map(([symbol, value]) => [symbol, Number(value)] as const)
            .filter(([, value]) => Number.isFinite(value)),
        );

        if (Object.keys(numericMids).length === 0) {
          return state;
        }

        return {
          mids: { ...state.mids, ...numericMids },
          assets: state.assets.map((asset) => {
            const liveMid = numericMids[asset.symbol];

            if (liveMid === undefined) {
              return asset;
            }

            return {
              ...asset,
              price: liveMid,
              midPrice: liveMid,
              change24hPct:
                asset.prevDayPrice === 0
                  ? 0
                  : ((liveMid - asset.prevDayPrice) / asset.prevDayPrice) * 100,
            };
          }),
        };
      });
    }, 100);
  },
  setConnectionStatus(status) {
    set({ connectionStatus: status });
  },
  setError(message) {
    set({ error: message });
  },
}));
