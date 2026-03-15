import { fetchMetaAndAssetCtxs } from "../../data/api/market";
import type { HyperliquidAssetContext, HyperliquidUniverseAsset } from "../../data/types/api";
import type { AssetRow, ConnectionStatus, MidsMap, TickSeriesMap } from "../../domain/types/market";
import { createStore } from "./createStore";

interface MarketState {
  assets: AssetRow[];
  mids: MidsMap;
  tickSeries: TickSeriesMap;
  loading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  initialize: () => Promise<void>;
  applyMids: (mids: Record<string, string>) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setError: (message: string | null) => void;
}

const LIVE_TICK_RETENTION_MS = 4 * 60 * 60 * 1000;
const LIVE_TICK_SAMPLE_INTERVAL_MS = 5 * 1000;

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
  assetIndex: number,
): AssetRow {
  const markPrice = Number(context.markPx);
  const midPrice = toNumber(context.midPx);
  const prevDayPrice = Number(context.prevDayPx);
  const currentPrice = midPrice ?? markPrice;
  const change24hPct = prevDayPrice === 0 ? 0 : ((currentPrice - prevDayPrice) / prevDayPrice) * 100;

  return {
    assetIndex,
    symbol: asset.name,
    price: currentPrice,
    midPrice,
    change24hPct,
    prevDayPrice,
    sizeDecimals: asset.szDecimals,
    fundingRate: toNumber(context.funding),
    openInterest: toNumber(context.openInterest),
    volume24h: toNumber(context.dayNtlVlm),
    maxLeverage: asset.maxLeverage,
    isDelisted: asset.isDelisted ?? false,
    onlyIsolated: asset.onlyIsolated ?? false,
  };
}

function appendTickPoint(
  existing: Array<{ timestamp: number; price: number }>,
  timestamp: number,
  price: number,
) {
  const retentionCutoff = timestamp - LIVE_TICK_RETENTION_MS;
  const retained = existing.filter((point) => point.timestamp >= retentionCutoff);
  const lastPoint = retained[retained.length - 1];
  const currentBucket = Math.floor(timestamp / LIVE_TICK_SAMPLE_INTERVAL_MS);
  const lastBucket = lastPoint
    ? Math.floor(lastPoint.timestamp / LIVE_TICK_SAMPLE_INTERVAL_MS)
    : null;

  if (lastPoint && lastBucket === currentBucket) {
    return [...retained.slice(0, -1), { timestamp, price }];
  }

  return [...retained, { timestamp, price }];
}

let flushScheduled = false;
let pendingMids: Record<string, string> = {};

export const useMarketStore = createStore<MarketState>((set, get) => ({
  assets: [],
  mids: {},
  tickSeries: {},
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
          return context ? buildAssetRow(asset, context, index) : null;
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
        tickSeries: Object.fromEntries(
          assets.map((asset) => [
            asset.symbol,
            [{ timestamp: Date.now(), price: asset.midPrice ?? asset.price }],
          ]),
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
      const timestamp = Date.now();

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
          tickSeries: {
            ...state.tickSeries,
            ...Object.fromEntries(
              Object.entries(numericMids).map(([symbol, price]) => {
                const existing = state.tickSeries[symbol] ?? [];
                return [symbol, appendTickPoint(existing, timestamp, price)] as const;
              }),
            ),
          },
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
