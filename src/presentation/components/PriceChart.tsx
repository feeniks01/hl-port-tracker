import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { AssetRow, TickPoint } from "../../domain/types/market";
import type { Position } from "../../domain/types/portfolio";
import type { ChartRangeKey, PriceCandle, PriceEvent } from "../../domain/types/chart";
import {
  loadCandleSeries,
  loadCandleSeriesByInterval,
  prefetchCandleSeries,
  readCachedCandleSeries,
} from "../hooks/useCandleSeries";
import { usePriceEvents } from "../hooks/usePriceEvents";
import { useMarketStore } from "../stores/marketStore";
import { SectionHeading } from "./SectionHeading";

interface PriceChartProps {
  availableSymbols: string[];
  selectedSymbols: string[];
  onSelectedSymbolsChange: (symbols: string[]) => void;
  currentAsset: AssetRow | null;
  assetMap?: Record<string, AssetRow>;
  currentPosition: Position | null;
  showSymbolPicker?: boolean;
  sectionTitle?: string;
  bare?: boolean;
  hidePriceLabel?: boolean;
  allowTickMode?: boolean;
}

const RANGE_OPTIONS: Array<{ key: ChartRangeKey; label: string }> = [
  { key: "24h", label: "24H" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
];

const LIVE_RANGE_OPTIONS = [
  { key: "1m", label: "1m", windowMs: 1 * 60 * 1000 },
  { key: "5m", label: "5m", windowMs: 5 * 60 * 1000 },
  { key: "15m", label: "15m", windowMs: 15 * 60 * 1000 },
  { key: "1h", label: "1h", windowMs: 60 * 60 * 1000 },
  { key: "4h", label: "4h", windowMs: 4 * 60 * 60 * 1000 },
] as const;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactUsdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const CHART_HEIGHT = 190;
const CHART_PADDING_X = 0;
const CHART_PADDING_Y = 12;
const MAX_VISIBLE_LIQUIDATION_DISTANCE_PCT = 250;
const MAX_SELECTED_SYMBOLS = 3;
const MAX_VISIBLE_SYMBOL_CHIPS = 5;
const CHART_COMPARE_COLORS = ["var(--gold)", "rgb(16 185 129)", "rgb(96 165 250)"];
const LIVE_PREFILL_LOOKBACK_MS = 4 * 60 * 60 * 1000;

function formatDisplayPrice(price: number) {
  if (price >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  }

  if (price >= 1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }

  if (price >= 0.01) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 3,
      maximumFractionDigits: 4,
    }).format(price);
  }

  if (price > 0) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    }).format(price);
  }

  return "$0.00";
}

function formatDisplayVolume(volume: number) {
  if (volume >= 1000) {
    return compactUsdFormatter.format(volume);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(volume);
}

interface ChartGeometry {
  areaPath: string;
  linePath: string;
  maxClose: number;
  minClose: number;
  points: Array<{ x: number; y: number }>;
}

interface TickGeometry {
  linePath: string;
  maxPrice: number;
  minPrice: number;
  points: Array<{ x: number; y: number }>;
}

function buildChartGeometry(candles: PriceCandle[], width: number, height: number): ChartGeometry {
  if (candles.length === 0) {
    return {
      linePath: "",
      areaPath: "",
      minClose: 0,
      maxClose: 0,
      points: [],
    };
  }

  const closes = candles.map((candle) => candle.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const innerWidth = width - CHART_PADDING_X * 2;
  const innerHeight = height - CHART_PADDING_Y * 2;

  const points = candles.map((candle, index) => {
    const x =
      candles.length === 1
        ? width / 2
        : CHART_PADDING_X + (index / (candles.length - 1)) * innerWidth;
    const y =
      height -
      CHART_PADDING_Y -
      ((candle.close - min) / range) * innerHeight;
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const baseline = height - CHART_PADDING_Y;
  const areaPath = `${linePath} L ${points[points.length - 1]?.x.toFixed(2)} ${baseline} L ${
    points[0]?.x.toFixed(2)
  } ${baseline} Z`;

  return { linePath, areaPath, minClose: min, maxClose: max, points };
}

function buildTickGeometry(
  ticks: TickPoint[],
  width: number,
  height: number,
  windowStart: number,
  windowEnd: number,
): TickGeometry {
  if (ticks.length === 0) {
    return {
      linePath: "",
      minPrice: 0,
      maxPrice: 0,
      points: [],
    };
  }

  const prices = ticks.map((tick) => tick.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const innerWidth = width - CHART_PADDING_X * 2;
  const innerHeight = height - CHART_PADDING_Y * 2;
  const timeSpan = Math.max(windowEnd - windowStart, 1);

  const points = ticks.map((tick) => {
    const normalized = Math.min(Math.max((tick.timestamp - windowStart) / timeSpan, 0), 1);
    const x = CHART_PADDING_X + normalized * innerWidth;
    const y =
      height -
      CHART_PADDING_Y -
      ((tick.price - min) / range) * innerHeight;
    return { x, y };
  });

  if (points.length === 1) {
    const point = points[0];
    const startX = Math.max(point.x - 18, CHART_PADDING_X);
    const endX = Math.min(point.x + 18, width - CHART_PADDING_X);

    return {
      linePath: `M ${startX.toFixed(2)} ${point.y.toFixed(2)} L ${endX.toFixed(2)} ${point.y.toFixed(2)}`,
      minPrice: min,
      maxPrice: max,
      points,
    };
  }

  const firstPoint = points[0];
  const pathSegments = [`M ${firstPoint.x.toFixed(2)} ${firstPoint.y.toFixed(2)}`];

  for (let index = 1; index < points.length; index += 1) {
    const previousPoint = points[index - 1];
    const point = points[index];
    pathSegments.push(`L ${point.x.toFixed(2)} ${previousPoint.y.toFixed(2)}`);
    pathSegments.push(`L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`);
  }

  const linePath = pathSegments.join(" ");

  return { linePath, minPrice: min, maxPrice: max, points };
}

function getChartY(value: number, min: number, max: number, height: number) {
  const range = max - min || 1;
  const innerHeight = height - CHART_PADDING_Y * 2;

  return (
    height -
    CHART_PADDING_Y -
    ((value - min) / range) * innerHeight
  );
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatSignedPercent(value: number, fractionDigits = 2) {
  const normalized = Math.abs(value) < 10 ** -(fractionDigits + 1) ? 0 : value;
  return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(fractionDigits)}%`;
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(timestamp);
}

function formatTimeLabel(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(timestamp);
}

function getLivePrefillConfig(windowMs: number) {
  if (windowMs >= 3 * 60 * 60 * 1000) {
    return {
      interval: "5m",
      cacheKey: "live-prefill-5m-4h",
    };
  }

  return {
    interval: "1m",
    cacheKey: "live-prefill-1m-4h",
  };
}

function getDisplayCandleTimestamp(candle: PriceCandle | null, range: ChartRangeKey) {
  if (!candle) {
    return "";
  }

  if (range === "30d") {
    return formatTimestamp(candle.startTime);
  }

  return formatTimestamp(candle.endTime + 1);
}

function getLiquidationDistancePct(markPrice: number | null, liquidationPrice: number | null) {
  if (!markPrice || !liquidationPrice || markPrice <= 0) {
    return null;
  }

  return Math.abs(((markPrice - liquidationPrice) / markPrice) * 100);
}

interface MultiCandleSeriesState {
  candlesBySymbol: Record<string, PriceCandle[]>;
  loading: boolean;
  error: string | null;
}

function useMultiCandleSeries(symbols: string[], range: ChartRangeKey) {
  const symbolsKey = symbols.join("|");
  const [state, setState] = useState<MultiCandleSeriesState>(() => ({
    candlesBySymbol: Object.fromEntries(
      symbols
        .map((symbol) => [symbol, readCachedCandleSeries(symbol, range) ?? []] as const)
        .filter(([, candles]) => candles.length > 0),
    ),
    loading: symbols.length > 0,
    error: null,
  }));

  useEffect(() => {
    if (symbols.length === 0) {
      setState({ candlesBySymbol: {}, loading: false, error: null });
      return;
    }

    let cancelled = false;

    setState((current) => ({
      candlesBySymbol: Object.fromEntries(
        symbols.map((symbol) => [symbol, current.candlesBySymbol[symbol] ?? readCachedCandleSeries(symbol, range) ?? []]),
      ),
      loading: true,
      error: null,
    }));

    void Promise.all(
      symbols.map(async (symbol) => [symbol, await loadCandleSeries(symbol, range)] as const),
    )
      .then((entries) => {
        if (cancelled) {
          return;
        }

        setState({
          candlesBySymbol: Object.fromEntries(entries),
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setState((current) => ({
          candlesBySymbol: current.candlesBySymbol,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load candle history from Hyperliquid.",
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [range, symbolsKey, symbols]);

  return state;
}

function buildCompareChartGeometries(
  candlesBySymbol: Record<string, PriceCandle[]>,
  symbols: string[],
  width: number,
  height: number,
) {
  const normalizedBySymbol = Object.fromEntries(
    symbols.map((symbol) => {
      const candles = candlesBySymbol[symbol] ?? [];
      const base = candles[0]?.open || candles[0]?.close || 0;
      const values = candles.map((candle) => (base > 0 ? (candle.close / base) * 100 : 100));
      return [symbol, values] as const;
    }),
  );

  const allValues = Object.values(normalizedBySymbol).flat().filter((value) => Number.isFinite(value));
  const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;
  const range = maxValue - minValue || 1;
  const innerWidth = width - CHART_PADDING_X * 2;
  const innerHeight = height - CHART_PADDING_Y * 2;

  const geometries = Object.fromEntries(
    symbols.map((symbol) => {
      const values = normalizedBySymbol[symbol] ?? [];
      const points = values.map((value, index) => ({
        x:
          values.length === 1
            ? width / 2
            : CHART_PADDING_X + (index / (values.length - 1)) * innerWidth,
        y: height - CHART_PADDING_Y - ((value - minValue) / range) * innerHeight,
      }));

      const linePath = points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(" ");

      return [symbol, { linePath, points }] as const;
    }),
  );

  return { geometries, minValue, maxValue };
}

function markerFill(sentiment: PriceEvent["sentiment"], active: boolean) {
  if (active) {
    return "var(--gold)";
  }

  if (sentiment === "positive") {
    return "rgb(16 185 129)";
  }

  if (sentiment === "negative") {
    return "rgb(244 63 94)";
  }

  return "rgba(255,255,255,0.9)";
}

export function PriceChart({
  availableSymbols,
  selectedSymbols,
  onSelectedSymbolsChange,
  currentAsset,
  assetMap,
  currentPosition,
  showSymbolPicker = true,
  sectionTitle = "Price History",
  bare = false,
  hidePriceLabel = false,
  allowTickMode = false,
}: PriceChartProps) {
  const [range, setRange] = useState<ChartRangeKey>("24h");
  const [chartMode, setChartMode] = useState<"line" | "ticks">("line");
  const [liveRange, setLiveRange] = useState<(typeof LIVE_RANGE_OPTIONS)[number]["key"]>("15m");
  const [showAllSymbols, setShowAllSymbols] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [focusedCompareSymbol, setFocusedCompareSymbol] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [livePrefillTicks, setLivePrefillTicks] = useState<TickPoint[]>([]);
  const chartRef = useRef<SVGSVGElement | null>(null);
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(1);
  const tickSeries = useMarketStore((state) => state.tickSeries);
  const primarySymbol = selectedSymbols[0] ?? null;
  const compareMode = selectedSymbols.length > 1;
  const { candlesBySymbol, loading, error } = useMultiCandleSeries(selectedSymbols, range);
  const candles = primarySymbol ? candlesBySymbol[primarySymbol] ?? [] : [];
  const rawLiveTicks = primarySymbol ? tickSeries[primarySymbol] ?? [] : [];
  const { events } = usePriceEvents(selectedSymbols, range);
  const liveRangeWindowMs = LIVE_RANGE_OPTIONS.find((option) => option.key === liveRange)?.windowMs
    ?? LIVE_RANGE_OPTIONS[3].windowMs;
  const livePrefillConfig = useMemo(
    () => getLivePrefillConfig(liveRangeWindowMs),
    [liveRangeWindowMs],
  );
  const combinedLiveTicks = useMemo(() => {
    const baseTicks = liveRangeWindowMs <= 5 * 60 * 1000
      ? []
      : livePrefillTicks;
    const lastPrefillTimestamp = baseTicks[baseTicks.length - 1]?.timestamp ?? 0;
    const merged = [...baseTicks, ...rawLiveTicks.filter((tick) => tick.timestamp > lastPrefillTimestamp)]
      .sort((left, right) => left.timestamp - right.timestamp);

    return merged.filter((tick, index) => {
      const previous = merged[index - 1];
      return !previous || previous.timestamp !== tick.timestamp;
    });
  }, [livePrefillTicks, liveRangeWindowMs, rawLiveTicks]);
  const liveWindowEnd = combinedLiveTicks[combinedLiveTicks.length - 1]?.timestamp ?? Date.now();
  const liveWindowStart = liveWindowEnd - liveRangeWindowMs;
  const liveTicks = useMemo(() => {
    if (combinedLiveTicks.length === 0) {
      return [];
    }

    const filtered = combinedLiveTicks.filter((tick) => tick.timestamp >= liveWindowStart);

    return filtered.length > 0 ? filtered : combinedLiveTicks.slice(-1);
  }, [combinedLiveTicks, liveWindowStart]);

  useLayoutEffect(() => {
    const element = chartWrapRef.current;

    if (!element) {
      return;
    }

    const updateWidth = () => {
      setChartWidth(Math.max(Math.round(element.clientWidth), 1));
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);

      return () => {
        window.removeEventListener("resize", updateWidth);
      };
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    setActiveEventId(null);
    setFocusedCompareSymbol(null);
  }, [chartMode, range, primarySymbol, selectedSymbols]);

  useEffect(() => {
    if (!allowTickMode || compareMode) {
      setChartMode("line");
    }
  }, [allowTickMode, compareMode]);

  useEffect(() => {
    if (!allowTickMode || !primarySymbol || liveRangeWindowMs <= 5 * 60 * 1000) {
      setLivePrefillTicks([]);
      return;
    }

    let cancelled = false;

    void loadCandleSeriesByInterval(
      primarySymbol,
      livePrefillConfig.interval,
      LIVE_PREFILL_LOOKBACK_MS,
      livePrefillConfig.cacheKey,
    )
      .then((candles) => {
        if (cancelled) {
          return;
        }

        setLivePrefillTicks(
          candles
            .map((candle) => ({
              timestamp: candle.endTime + 1,
              price: candle.close,
            }))
            .filter((tick) => Number.isFinite(tick.price)),
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setLivePrefillTicks([]);
      });

    return () => {
      cancelled = true;
    };
  }, [allowTickMode, livePrefillConfig.cacheKey, livePrefillConfig.interval, liveRangeWindowMs, primarySymbol]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const primaryPrefetchSymbol = selectedSymbols[0];

      if (primaryPrefetchSymbol) {
        RANGE_OPTIONS.filter((option) => option.key !== range).forEach((option) => {
          prefetchCandleSeries(primaryPrefetchSymbol, option.key);
        });
      }

      selectedSymbols.slice(1, 3).forEach((symbol) => {
        prefetchCandleSeries(symbol, range);
      });
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [range, selectedSymbols]);

  const currentPrice = candles[candles.length - 1]?.close ?? currentAsset?.price ?? null;
  const firstPrice = candles[0]?.open ?? null;
  const percentChange =
    currentPrice !== null && firstPrice !== null && firstPrice !== 0
      ? ((currentPrice - firstPrice) / firstPrice) * 100
      : currentAsset?.change24hPct ?? null;
  const totalVolume = candles.reduce((sum, candle) => sum + candle.volume, 0);
  const chartGeometry = useMemo(
    () => buildChartGeometry(candles, chartWidth, CHART_HEIGHT),
    [candles, chartWidth],
  );
  const tickGeometry = useMemo(
    () => buildTickGeometry(liveTicks, chartWidth, CHART_HEIGHT, liveWindowStart, liveWindowEnd),
    [chartWidth, liveTicks, liveWindowEnd, liveWindowStart],
  );
  const compareGeometries = useMemo(
    () => buildCompareChartGeometries(candlesBySymbol, selectedSymbols, chartWidth, CHART_HEIGHT),
    [candlesBySymbol, chartWidth, selectedSymbols],
  );
  const eventMarkers = useMemo(() => {
    if (chartMode === "ticks") {
      return [] as Array<{
        event: PriceEvent;
        x: number;
        y: number;
        anchorY: number;
        nearestIndex: number;
        stackLevel: number;
      }>;
    }

    if (candles.length === 0 || events.length === 0 || chartGeometry.points.length === 0) {
      return [] as Array<{
        event: PriceEvent;
        x: number;
        y: number;
        anchorY: number;
        nearestIndex: number;
        stackLevel: number;
      }>;
    }

    const startTime = candles[0].startTime;
    const endTime = candles[candles.length - 1].endTime;
    const timeSpan = Math.max(endTime - startTime, 1);

    const positioned = events
      .map((event) => {
        const normalized = (event.timestamp - startTime) / timeSpan;
        const x = Math.min(Math.max(normalized, 0), 1) * chartWidth;
        const nearestIndex = candles.reduce((closestIndex, candle, index) => {
          const currentDistance = Math.abs(candle.endTime - event.timestamp);
          const closestDistance = Math.abs(candles[closestIndex].endTime - event.timestamp);
          return currentDistance < closestDistance ? index : closestIndex;
        }, 0);

        return {
          event,
          x,
          y: chartGeometry.points[nearestIndex]?.y ?? Math.max(CHART_HEIGHT - 18, 18),
          anchorY: chartGeometry.points[nearestIndex]?.y ?? Math.max(CHART_HEIGHT - 18, 18),
          nearestIndex,
        };
      })
      .sort((left, right) => left.x - right.x);

    return positioned.map((marker, index) => {
      const previous = index > 0 ? positioned[index - 1] : null;
      const previousStackLevel =
        index > 0 && Math.abs((previous?.x ?? 0) - marker.x) < 18
          ? (positioned[index - 1] as typeof marker & { stackLevel?: number }).stackLevel ?? 0
          : -1;
      const stackLevel = previousStackLevel + 1;

      (positioned[index] as typeof marker & { stackLevel?: number }).stackLevel = stackLevel;

      return {
        ...marker,
        stackLevel,
        y: Math.max(marker.anchorY - 10 - stackLevel * 12, 18),
      };
    });
  }, [candles, chartGeometry.points, chartMode, chartWidth, events]);
  const isInspectingCandle = activeIndex !== null;
  const activeSeriesLength = chartMode === "ticks" ? liveTicks.length : candles.length;
  const highlightedIndex = activeIndex ?? activeSeriesLength - 1;
  const displaySymbol = compareMode
    ? focusedCompareSymbol ?? primarySymbol
    : primarySymbol;
  const displayCandles = displaySymbol ? candlesBySymbol[displaySymbol] ?? [] : candles;
  const displayAsset =
    (displaySymbol && assetMap?.[displaySymbol]) ?? (displaySymbol === primarySymbol ? currentAsset : null);
  const highlightedCandle = displayCandles[highlightedIndex] ?? null;
  const highlightedTick = chartMode === "ticks" ? liveTicks[highlightedIndex] ?? null : null;
  const highlightedPoint =
    activeIndex === null
      ? null
      : compareMode
        ? compareGeometries.geometries[displaySymbol ?? ""]?.points[highlightedIndex] ?? null
        : chartMode === "ticks"
          ? tickGeometry.points[highlightedIndex] ?? null
          : chartGeometry.points[highlightedIndex] ?? null;
  const hasActivePointer = activeIndex !== null && highlightedPoint !== null;
  const matchedCrosshairEvent = useMemo(() => {
    if (!isInspectingCandle) {
      return null;
    }

    const matchingMarkers = eventMarkers.filter((marker) => marker.nearestIndex === highlightedIndex);

    if (matchingMarkers.length === 0) {
      return null;
    }

    return matchingMarkers.reduce((closest, marker) =>
      marker.stackLevel < closest.stackLevel ? marker : closest,
    );
  }, [eventMarkers, highlightedIndex, isInspectingCandle]);
  const activeEvent =
    matchedCrosshairEvent ??
    eventMarkers.find((marker) => marker.event.id === activeEventId) ??
    null;
  const displayPrice =
    chartMode === "ticks"
      ? highlightedTick?.price ?? currentAsset?.price ?? null
      : isInspectingCandle && highlightedCandle
        ? highlightedCandle.close
        : currentPrice;
  const priceLabel =
    showSymbolPicker || !bare
      ? `${displaySymbol ?? primarySymbol ?? "Selection"} Price`
      : displaySymbol ?? primarySymbol ?? "Selection";
  const displayTimestamp = chartMode === "ticks"
    ? highlightedTick
      ? formatTimestamp(highlightedTick.timestamp)
      : ""
    : getDisplayCandleTimestamp(highlightedCandle, range);
  const displayVolume =
    chartMode === "ticks"
      ? " "
      : isInspectingCandle && highlightedCandle
        ? `${formatDisplayVolume(highlightedCandle.volume)} vol`
        : " ";
  const headerPercentChange = useMemo(() => {
    if (chartMode === "ticks") {
      if (liveTicks.length < 2) {
        return currentAsset?.change24hPct ?? null;
      }

      const basePrice = liveTicks[0]?.price ?? null;
      const latestPrice = liveTicks[liveTicks.length - 1]?.price ?? null;

      if (basePrice === null || latestPrice === null || basePrice === 0) {
        return currentAsset?.change24hPct ?? null;
      }

      return ((latestPrice - basePrice) / basePrice) * 100;
    }

    if (compareMode) {
      const symbolCandles = displaySymbol ? candlesBySymbol[displaySymbol] ?? [] : [];
      const basePrice = symbolCandles[0]?.open ?? null;
      const latestPrice = symbolCandles[symbolCandles.length - 1]?.close ?? null;

      if (basePrice === null || latestPrice === null || basePrice === 0) {
        return currentAsset?.change24hPct ?? null;
      }

      return ((latestPrice - basePrice) / basePrice) * 100;
    }

    if (candles.length >= 2) {
      const basePrice = candles[0]?.open ?? null;
      const latestPrice = candles[candles.length - 1]?.close ?? null;

      if (basePrice !== null && latestPrice !== null && basePrice !== 0) {
        return ((latestPrice - basePrice) / basePrice) * 100;
      }
    }

    return percentChange;
  }, [candles, candlesBySymbol, chartMode, compareMode, currentAsset?.change24hPct, displaySymbol, liveTicks, percentChange]);
  const compareReadouts = useMemo(
    () =>
      selectedSymbols.map((symbol) => {
        const symbolCandles = candlesBySymbol[symbol] ?? [];
        const symbolAsset = assetMap?.[symbol] ?? null;
        const currentSymbolPrice =
          symbolCandles[symbolCandles.length - 1]?.close ?? symbolAsset?.price ?? null;
        const basePrice = symbolCandles[0]?.open ?? null;
        const highlightedSymbolCandle = symbolCandles[highlightedIndex] ?? null;
        const displaySymbolPrice =
          isInspectingCandle && highlightedSymbolCandle
            ? highlightedSymbolCandle.close
            : currentSymbolPrice;
        const displaySymbolChange =
          displaySymbolPrice !== null && basePrice !== null && basePrice !== 0
            ? ((displaySymbolPrice - basePrice) / basePrice) * 100
            : symbolAsset?.change24hPct ?? null;

        return {
          symbol,
          price: displaySymbolPrice,
          changePct: displaySymbolChange,
        };
      }),
    [assetMap, candlesBySymbol, highlightedIndex, isInspectingCandle, selectedSymbols],
  );
  const liquidationPrice = currentPosition?.liquidationPrice ?? null;
  const liquidationDistancePct = getLiquidationDistancePct(
    currentPrice ?? currentPosition?.markPrice ?? null,
    liquidationPrice,
  );
  const liquidationInVisibleRange =
    liquidationPrice !== null &&
    candles.length > 0 &&
    liquidationPrice >= chartGeometry.minClose &&
    liquidationPrice <= chartGeometry.maxClose;
  const shouldShowLiquidationGuide =
    chartMode === "line" &&
    !compareMode &&
    liquidationPrice !== null &&
    liquidationDistancePct !== null &&
    liquidationDistancePct <= MAX_VISIBLE_LIQUIDATION_DISTANCE_PCT &&
    liquidationInVisibleRange;
  const liquidationLine = useMemo(() => {
    if (!shouldShowLiquidationGuide || !liquidationPrice || candles.length === 0) {
      return null;
    }

    const unclampedY = getChartY(
      liquidationPrice,
      chartGeometry.minClose,
      chartGeometry.maxClose,
      CHART_HEIGHT,
    );
    const y = Math.min(Math.max(unclampedY, CHART_PADDING_Y + 8), CHART_HEIGHT - CHART_PADDING_Y);

    return {
      y,
      label: `Liq ${currencyFormatter.format(liquidationPrice)}`,
    };
  }, [
    candles.length,
    chartGeometry.maxClose,
    chartGeometry.minClose,
    liquidationPrice,
    shouldShowLiquidationGuide,
  ]);

  const updateActiveIndex = (clientX: number, clientY: number) => {
    const bounds = chartRef.current?.getBoundingClientRect();

    if (!bounds || activeSeriesLength === 0) {
      return null;
    }

    const relativeX = Math.min(Math.max(clientX - bounds.left, 0), bounds.width);
    const nextIndex =
      chartMode === "ticks"
        ? tickGeometry.points.reduce((closestIndex, point, index) => {
            const closestPoint = tickGeometry.points[closestIndex];
            const currentDistance = Math.abs(point.x - relativeX);
            const closestDistance = Math.abs((closestPoint?.x ?? 0) - relativeX);
            return currentDistance < closestDistance ? index : closestIndex;
          }, 0)
        : (() => {
            const normalizedX = relativeX / bounds.width;
            const mappedIndex = Math.round(normalizedX * (activeSeriesLength - 1));
            return Math.min(Math.max(mappedIndex, 0), activeSeriesLength - 1);
          })();
    const clampedIndex = Math.min(Math.max(nextIndex, 0), activeSeriesLength - 1);
    if (compareMode) {
      const relativeY = Math.min(Math.max(clientY - bounds.top, 0), bounds.height);
      const closestSymbol = selectedSymbols.reduce<{ symbol: string | null; distance: number }>(
        (closest, symbol) => {
          const point = compareGeometries.geometries[symbol]?.points[clampedIndex];

          if (!point) {
            return closest;
          }

          const distance = Math.abs(point.y - relativeY);
          return distance < closest.distance ? { symbol, distance } : closest;
        },
        { symbol: focusedCompareSymbol ?? primarySymbol, distance: Number.POSITIVE_INFINITY },
      ).symbol;

      if (closestSymbol) {
        setFocusedCompareSymbol(closestSymbol);
      }
    }

    setActiveIndex(clampedIndex);
    const matchedEvent = chartMode === "ticks"
      ? null
      : eventMarkers
        .filter((marker) => marker.nearestIndex === clampedIndex)
        .reduce<typeof eventMarkers[number] | null>(
          (closest, marker) =>
            !closest || marker.stackLevel < closest.stackLevel ? marker : closest,
          null,
        );

    if (matchedEvent) {
      setActiveEventId(matchedEvent.event.id);
    }

    return clampedIndex;
  };

  const tooltipX = highlightedPoint
    ? Math.min(Math.max(highlightedPoint.x - 42, 8), chartWidth - 92)
    : 8;
  const tooltipY = highlightedPoint
    ? Math.max(highlightedPoint.y - 34, 8)
    : 8;
  const hiddenSymbolCount = Math.max(availableSymbols.length - MAX_VISIBLE_SYMBOL_CHIPS, 0);
  const visibleSymbols = showAllSymbols
    ? availableSymbols
    : availableSymbols.slice(0, MAX_VISIBLE_SYMBOL_CHIPS);

  return (
    <section className="mb-8">
      {sectionTitle ? <SectionHeading title={sectionTitle} /> : null}
      <div className={bare ? "px-0 py-0" : "panel rounded-[28px] p-5"}>
        {showSymbolPicker ? (
          <div className="mb-5 flex flex-wrap gap-2">
            {visibleSymbols.map((symbol) => {
              const activeIndex = selectedSymbols.indexOf(symbol);
              const active = activeIndex !== -1;
              const disabled = !active && selectedSymbols.length >= MAX_SELECTED_SYMBOLS;

              return (
                <button
                  key={symbol}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (active) {
                      if (selectedSymbols.length === 1) {
                        return;
                      }

                      onSelectedSymbolsChange(selectedSymbols.filter((selected) => selected !== symbol));
                      return;
                    }

                    if (selectedSymbols.length >= MAX_SELECTED_SYMBOLS) {
                      return;
                    }

                    onSelectedSymbolsChange([symbol, ...selectedSymbols]);
                  }}
                  className={`rounded-full px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] transition ${
                    active
                      ? "text-zinc-950"
                      : disabled
                        ? "cursor-not-allowed bg-white/[0.03] text-zinc-600"
                        : "bg-white/4 text-zinc-400 hover:bg-white/7"
                  }`}
                  style={
                    active
                      ? {
                          backgroundColor: CHART_COMPARE_COLORS[activeIndex] ?? "var(--gold)",
                        }
                      : undefined
                  }
                >
                  <span className="flex items-center gap-2">
                    {active ? (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-black/65" />
                    ) : null}
                    <span>{symbol}</span>
                  </span>
                </button>
              );
            })}
            {hiddenSymbolCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowAllSymbols((current) => !current)}
                className="rounded-full bg-white/4 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-400 transition hover:bg-white/7"
              >
                {showAllSymbols ? "Show Less" : `View ${hiddenSymbolCount} More`}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            {!hidePriceLabel ? (
              <div className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                {priceLabel}
              </div>
            ) : null}
            <div className="display-serif text-[2.6rem] leading-none tracking-[-0.04em] text-zinc-100">
              {displayPrice !== null ? formatDisplayPrice(displayPrice) : "—"}
            </div>
          </div>
          {compareMode ? null : (
            <div
              className={`rounded-full px-3 py-2 text-sm font-medium ${
                (headerPercentChange ?? 0) >= 0 ? "bg-emerald-500/12 text-emerald-200" : "bg-rose-500/12 text-rose-200"
              }`}
            >
              {headerPercentChange !== null ? formatSignedPercent(headerPercentChange) : "—"}
            </div>
          )}
        </div>

        {compareMode ? (
          <div className="mb-5 flex flex-wrap gap-2">
            {compareReadouts.map((readout, index) => {
              const active = readout.symbol === displaySymbol;

              return (
                <div
                  key={readout.symbol}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-right ${
                    active ? "bg-white/[0.06]" : "bg-transparent"
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: CHART_COMPARE_COLORS[index] ?? "var(--gold)" }}
                  />
                  <span className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-zinc-500">
                    {readout.symbol}
                  </span>
                  <span className="text-sm font-medium text-zinc-100">
                    {readout.price !== null ? formatDisplayPrice(readout.price) : "—"}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      (readout.changePct ?? 0) >= 0 ? "text-emerald-200" : "text-[var(--negative)]"
                    }`}
                  >
                    {readout.changePct !== null ? formatSignedPercent(readout.changePct) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        <div
          ref={chartWrapRef}
          className="relative rounded-[24px] border border-white/6 bg-white/[0.03] px-2 pb-4 pt-4"
        >
          {allowTickMode && !compareMode ? (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-2">
                {(["line", "ticks"] as const).map((mode) => {
                  const active = chartMode === mode;

                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setChartMode(mode)}
                        className={`px-2 py-1 text-[0.625rem] font-medium uppercase tracking-[0.14em] transition ${
                          active
                            ? "text-zinc-100"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {mode === "line" ? "Price" : "Live Chart"}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {chartMode === "ticks" && liveTicks.length === 0 ? (
            <div
              className="rounded-[18px] bg-white/4 px-4 py-4 text-sm text-zinc-400"
              style={{ height: `${CHART_HEIGHT}px` }}
            >
              Waiting for live ticks.
            </div>
          ) : loading && candles.length === 0 ? (
            <div
              className="animate-pulse rounded-[18px] bg-white/6"
              style={{ height: `${CHART_HEIGHT}px` }}
            />
          ) : error && candles.length === 0 ? (
            <div className="rounded-[18px] border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">
              {error}
            </div>
          ) : chartMode === "line" && candles.length === 0 ? (
            <div
              className="rounded-[18px] bg-white/4 px-4 py-4 text-sm text-zinc-400"
              style={{ height: `${CHART_HEIGHT}px` }}
            >
              No candle data returned for this selection.
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs text-zinc-500">
                <span>{displayTimestamp}</span>
                <span>{displayVolume}</span>
              </div>
              <svg
                ref={chartRef}
                viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
                className="w-full overflow-visible touch-none"
                style={{ height: `${CHART_HEIGHT}px` }}
                onPointerDown={(event) => {
                  updateActiveIndex(event.clientX, event.clientY);
                }}
                onPointerMove={(event) => {
                  if (event.pointerType === "mouse" || event.pressure > 0) {
                    updateActiveIndex(event.clientX, event.clientY);
                  }
                }}
                onPointerUp={() => {
                  setActiveIndex(null);
                  setFocusedCompareSymbol(null);
                }}
                onPointerCancel={() => {
                  setActiveIndex(null);
                  setFocusedCompareSymbol(null);
                }}
                onPointerLeave={() => {
                  setActiveIndex(null);
                  setFocusedCompareSymbol(null);
                }}
              >
                <defs>
                  <linearGradient id="price-chart-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(212,168,79,0.45)" />
                    <stop offset="100%" stopColor="rgba(212,168,79,0)" />
                  </linearGradient>
                </defs>
                {!compareMode && chartMode === "line" ? <path d={chartGeometry.areaPath} fill="url(#price-chart-fill)" /> : null}
                {compareMode
                  ? selectedSymbols.map((symbol, index) => {
                      const geometry = compareGeometries.geometries[symbol];

                      if (!geometry?.linePath) {
                        return null;
                      }

                      return (
                        <path
                          key={symbol}
                          d={geometry.linePath}
                          fill="none"
                          stroke={CHART_COMPARE_COLORS[index] ?? "var(--gold)"}
                          strokeWidth={symbol === primarySymbol ? "3" : "2.2"}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={symbol === primarySymbol ? 1 : 0.95}
                        />
                      );
                    })
                  : (
                    <path
                      d={chartMode === "ticks" ? tickGeometry.linePath : chartGeometry.linePath}
                      fill="none"
                      stroke="var(--gold)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    )}
                {liquidationLine ? (
                  <>
                    <line
                      x1={0}
                      x2={chartWidth}
                      y1={liquidationLine.y}
                      y2={liquidationLine.y}
                      stroke="rgba(244,63,94,0.58)"
                      strokeWidth="1.5"
                      strokeDasharray="6 5"
                    />
                    <g transform={`translate(8, ${Math.max(liquidationLine.y - 11, 4)})`}>
                      <rect
                        x="0"
                        y="0"
                        width="120"
                        height="18"
                        rx="9"
                        fill="rgba(35,8,14,0.92)"
                        stroke="rgba(244,63,94,0.18)"
                      />
                      <text
                        x="60"
                        y="12"
                        textAnchor="middle"
                        fill="rgb(254 205 211)"
                        fontSize="9"
                        fontWeight="600"
                        letterSpacing="0.04em"
                      >
                        {liquidationLine.label}
                      </text>
                    </g>
                  </>
                ) : null}
                {highlightedPoint ? (
                  <>
                    <line
                      x1={CHART_PADDING_X}
                      x2={chartWidth - CHART_PADDING_X}
                      y1={highlightedPoint.y}
                      y2={highlightedPoint.y}
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <line
                      x1={highlightedPoint.x}
                      x2={highlightedPoint.x}
                      y1={CHART_PADDING_Y}
                      y2={CHART_HEIGHT - CHART_PADDING_Y}
                      stroke="rgba(255,255,255,0.22)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    {compareMode
                      ? selectedSymbols.map((symbol, index) => {
                          const point =
                            compareGeometries.geometries[symbol]?.points[highlightedIndex] ?? null;

                          if (!point) {
                            return null;
                          }

                          return (
                            <circle
                              key={symbol}
                              cx={point.x}
                              cy={point.y}
                              r={symbol === primarySymbol ? "4" : "3.5"}
                              fill={CHART_COMPARE_COLORS[index] ?? "var(--gold)"}
                              stroke="rgba(5,5,5,0.9)"
                              strokeWidth="2"
                            />
                          );
                        })
                      : (
                        <circle
                          cx={highlightedPoint.x}
                          cy={highlightedPoint.y}
                          r="4"
                          fill="var(--gold)"
                          stroke="rgba(5,5,5,0.9)"
                          strokeWidth="2"
                        />
                        )}
                  </>
                ) : null}
                {eventMarkers.map((marker) => {
                  const isActive = marker.event.id === activeEventId;

                  return (
                    <g key={marker.event.id}>
                      <line
                        x1={marker.x}
                        x2={marker.x}
                        y1={marker.y + 6}
                        y2={marker.anchorY}
                        stroke={isActive ? "rgba(212,168,79,0.35)" : "rgba(255,255,255,0.12)"}
                        strokeWidth="1"
                        strokeDasharray="3 4"
                      />
                      <circle
                        cx={marker.x}
                        cy={marker.y}
                        r={isActive ? "6" : "5"}
                        fill={markerFill(marker.event.sentiment, isActive)}
                        stroke="rgba(5,5,5,0.95)"
                        strokeWidth="2"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          setActiveEventId((current) =>
                            current === marker.event.id ? null : marker.event.id,
                          );
                        }}
                        onPointerEnter={() => {
                          setActiveEventId(marker.event.id);
                        }}
                        style={{ cursor: "pointer" }}
                      />
                      <path
                        stroke="rgba(5,5,5,0.92)"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        d={`M ${marker.x} ${marker.y - 2.7} L ${marker.x} ${marker.y + 0.8}`}
                        pointerEvents="none"
                      />
                      <circle
                        cx={marker.x}
                        cy={marker.y + 2.5}
                        r="0.8"
                        fill="rgba(5,5,5,0.92)"
                        pointerEvents="none"
                      />
                    </g>
                  );
                })}
                {hasActivePointer ? (
                  <g transform={`translate(${tooltipX}, ${tooltipY})`}>
                    <rect
                      x="0"
                      y="0"
                      width="84"
                      height="24"
                      rx="12"
                      fill="rgba(15,15,15,0.92)"
                      stroke="rgba(255,255,255,0.08)"
                    />
                    <text
                      x="42"
                      y="16"
                      textAnchor="middle"
                      fill="var(--gold)"
                      fontSize="10"
                      fontWeight="600"
                      letterSpacing="0.04em"
                    >
                      {formatDisplayPrice(
                        chartMode === "ticks"
                          ? highlightedTick?.price ?? currentAsset?.price ?? 0
                          : highlightedCandle?.close ?? 0,
                      )}
                    </text>
                  </g>
                ) : null}
                <rect
                  x={0}
                  y={0}
                  width={chartWidth}
                  height={CHART_HEIGHT}
                  fill="transparent"
                  pointerEvents="none"
                />
              </svg>
              <svg
                viewBox={`0 0 ${chartWidth} 18`}
                className="mt-3 h-[18px] w-full overflow-visible"
              >
                <text
                  x={chartMode === "ticks" ? 2 : (
                    compareMode
                      ? compareGeometries.geometries[primarySymbol ?? ""]?.points[0]?.x
                      : chartGeometry.points[0]?.x
                  ) ?? CHART_PADDING_X}
                  y="13"
                  textAnchor={chartMode === "ticks" ? "start" : "middle"}
                  fill="rgb(113 113 122)"
                  fontSize="10"
                  letterSpacing="0.08em"
                >
                  {chartMode === "ticks"
                    ? formatTimeLabel(liveWindowStart)
                    : formatTime(candles[0].startTime)}
                </text>
                <text
                  x={chartMode === "ticks" ? chartWidth - 2 : (
                    compareMode
                      ? compareGeometries.geometries[primarySymbol ?? ""]?.points[
                          (compareGeometries.geometries[primarySymbol ?? ""]?.points.length ?? 1) - 1
                        ]?.x
                      : chartGeometry.points[chartGeometry.points.length - 1]?.x
                  ) ?? chartWidth - CHART_PADDING_X}
                  y="13"
                  textAnchor={chartMode === "ticks" ? "end" : "middle"}
                  fill="rgb(113 113 122)"
                  fontSize="10"
                  letterSpacing="0.08em"
                >
                  {chartMode === "ticks"
                    ? formatTimeLabel(liveWindowEnd)
                    : formatTime(candles[candles.length - 1].endTime)}
                </text>
              </svg>
              {chartMode === "ticks" ? (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  {LIVE_RANGE_OPTIONS.map((option) => {
                    const active = option.key === liveRange;

                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setLiveRange(option.key)}
                        className={`px-0 py-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] transition ${
                          active
                            ? "text-zinc-100"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  {RANGE_OPTIONS.map((option) => {
                    const active = option.key === range;

                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setRange(option.key)}
                        className={`px-0 py-0 text-[0.7rem] font-medium uppercase tracking-[0.12em] transition ${
                          active
                            ? "text-zinc-100"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {activeEvent ? (
                <div className="mt-3 rounded-[18px] border border-white/6 bg-black/20 px-4 py-3">
                  <div className="text-sm font-medium text-zinc-100">
                    {activeEvent.event.title}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-zinc-500">
                    <span>
                      {activeEvent.event.asset ? `${activeEvent.event.asset} · ` : ""}
                      {activeEvent.event.source}
                    </span>
                    <span>{formatTimestamp(activeEvent.event.timestamp)}</span>
                  </div>
                  {activeEvent.event.url ? (
                    <a
                      href={activeEvent.event.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-zinc-300 transition hover:text-zinc-100"
                    >
                      Read source
                      <span aria-hidden>↗</span>
                    </a>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-zinc-400">
          <div className="rounded-[18px] bg-white/[0.03] px-4 py-3">
            <div className="mb-1 text-xs uppercase tracking-[0.16em] text-zinc-500">24h Change</div>
            <div
              className={`font-medium ${
                (displayAsset?.change24hPct ?? 0) >= 0 ? "text-emerald-200" : "text-[var(--negative)]"
              }`}
            >
              {displayAsset ? formatSignedPercent(displayAsset.change24hPct) : "—"}
            </div>
          </div>
          <div className="rounded-[18px] bg-white/[0.03] px-4 py-3">
            <div className="mb-1 text-xs uppercase tracking-[0.16em] text-zinc-500">
              {shouldShowLiquidationGuide ? "Liq Distance" : "Range Volume"}
            </div>
            <div className="font-medium text-zinc-100">
              {shouldShowLiquidationGuide
                ? `${liquidationDistancePct?.toFixed(2) ?? "—"}%`
                : candles.length
                  ? formatDisplayVolume(totalVolume)
                  : "—"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
