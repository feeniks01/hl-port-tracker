import { useEffect, useState } from "react";

import { fetchCandleSnapshot } from "../../data/api/candles";
import type { HyperliquidCandleSnapshot } from "../../data/types/api";
import {
  CHART_RANGE_CONFIG,
  type ChartRangeKey,
  type PriceCandle,
} from "../../domain/types/chart";

interface CandleSeriesState {
  candles: PriceCandle[];
  loading: boolean;
  error: string | null;
}

interface CandleCacheEntry {
  candles: PriceCandle[];
  fetchedAt: number;
}

interface CandleWindowConfig {
  interval: string;
  lookbackMs: number;
  cacheKey: string;
}

const CANDLE_CACHE_TTL_MS = 60 * 1000;
const candleCache = new Map<string, CandleCacheEntry>();
const candleRequestCache = new Map<string, Promise<PriceCandle[]>>();

function mapCandle(candle: HyperliquidCandleSnapshot): PriceCandle {
  return {
    startTime: candle.t,
    endTime: candle.T,
    open: Number(candle.o),
    close: Number(candle.c),
    high: Number(candle.h),
    low: Number(candle.l),
    volume: Number(candle.v),
    trades: candle.n,
  };
}

function getCacheKey(symbol: string, cacheKey: string) {
  return `${symbol}:${cacheKey}`;
}

function readCache(cacheKey: string) {
  return candleCache.get(cacheKey) ?? null;
}

function hasFreshCache(cacheKey: string) {
  const entry = readCache(cacheKey);

  if (!entry) {
    return false;
  }

  return Date.now() - entry.fetchedAt < CANDLE_CACHE_TTL_MS;
}

async function loadCandleSeriesWindow(symbol: string, config: CandleWindowConfig) {
  const cacheKey = getCacheKey(symbol, config.cacheKey);
  const cachedRequest = candleRequestCache.get(cacheKey);

  if (cachedRequest) {
    return cachedRequest;
  }

  const endTime = Date.now();
  const startTime = endTime - config.lookbackMs;

  const request = fetchCandleSnapshot({
    coin: symbol,
    interval: config.interval,
    startTime,
    endTime,
  })
    .then((response) => {
      const candles = response.map(mapCandle);
      candleCache.set(cacheKey, {
        candles,
        fetchedAt: Date.now(),
      });
      return candles;
    })
    .finally(() => {
      candleRequestCache.delete(cacheKey);
    });

  candleRequestCache.set(cacheKey, request);

  return request;
}

export async function loadCandleSeries(symbol: string, range: ChartRangeKey) {
  const { interval, lookbackMs } = CHART_RANGE_CONFIG[range];

  return loadCandleSeriesWindow(symbol, {
    interval,
    lookbackMs,
    cacheKey: range,
  });
}

export async function loadCandleSeriesByInterval(
  symbol: string,
  interval: string,
  lookbackMs: number,
  cacheKey: string,
) {
  return loadCandleSeriesWindow(symbol, {
    interval,
    lookbackMs,
    cacheKey,
  });
}

export function readCachedCandleSeries(symbol: string, range: ChartRangeKey) {
  return readCache(getCacheKey(symbol, range))?.candles ?? null;
}

export function prefetchCandleSeries(symbol: string, range: ChartRangeKey) {
  const cacheKey = getCacheKey(symbol, range);

  if (hasFreshCache(cacheKey) || candleRequestCache.has(cacheKey)) {
    return;
  }

  void loadCandleSeries(symbol, range);
}

export function useCandleSeries(symbol: string, range: ChartRangeKey) {
  const cacheKey = getCacheKey(symbol, range);
  const [state, setState] = useState<CandleSeriesState>({
    candles: readCache(cacheKey)?.candles ?? [],
    loading: !hasFreshCache(cacheKey),
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const cachedEntry = readCache(cacheKey);

    if (hasFreshCache(cacheKey) && cachedEntry) {
      setState({
        candles: cachedEntry.candles,
        loading: false,
        error: null,
      });
      return () => {
        cancelled = true;
      };
    }

    setState((current) => ({
      candles: cachedEntry?.candles ?? current.candles,
      loading: true,
      error: null,
    }));

    void loadCandleSeries(symbol, range)
      .then((candles) => {
        if (cancelled) {
          return;
        }

        setState({
          candles,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setState({
          candles: [],
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load candle history from Hyperliquid.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, range, symbol]);

  return state;
}
