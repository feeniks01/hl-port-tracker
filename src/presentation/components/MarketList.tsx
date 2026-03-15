import { useEffect, useMemo, useRef, useState } from "react";

import type { AssetRow, ConnectionStatus } from "../../domain/types/market";
import type { ChartRangeKey, PriceCandle } from "../../domain/types/chart";
import { useCandleSeries } from "../hooks/useCandleSeries";
import { ConnectionPill } from "./ConnectionPill";
import { SectionHeading } from "./SectionHeading";

export type MarketSortKey = "price" | "change" | "openInterest" | "volume" | "funding";

const PINNED_SYMBOLS = ["BTC", "ETH", "SOL", "HYPE"];

const compactUsdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

interface MarketListProps {
  assets: AssetRow[];
  status: ConnectionStatus;
  searchQuery: string;
  sortKey: MarketSortKey;
  showDelisted: boolean;
  loading: boolean;
  onSearchQueryChange: (value: string) => void;
  onSortKeyChange: (value: MarketSortKey) => void;
  onShowDelistedChange: (value: boolean) => void;
  onAssetSelect: (symbol: string) => void;
}

const sortOptions: Array<{ value: MarketSortKey; label: string }> = [
  { value: "openInterest", label: "Open Interest" },
  { value: "volume", label: "Volume" },
  { value: "change", label: "24h Move" },
  { value: "funding", label: "Funding" },
  { value: "price", label: "Price" },
];

function formatSignedPercent(value: number, fractionDigits = 2) {
  const normalized = Math.abs(value) < 10 ** -(fractionDigits + 1) ? 0 : value;
  return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(fractionDigits)}%`;
}

function sortAssets(assets: AssetRow[], sortKey: MarketSortKey) {
  return [...assets].sort((left, right) => {
    if (sortKey === "change") {
      return Math.abs(right.change24hPct) - Math.abs(left.change24hPct);
    }

    if (sortKey === "price") {
      return right.price - left.price;
    }

    if (sortKey === "volume") {
      return (right.volume24h ?? -1) - (left.volume24h ?? -1);
    }

    if (sortKey === "funding") {
      return Math.abs(right.fundingRate ?? -1) - Math.abs(left.fundingRate ?? -1);
    }

    return (right.openInterest ?? -1) - (left.openInterest ?? -1);
  });
}

function SectionTitle({
  icon,
  title,
}: {
  icon: string;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
      <i className={`${icon} text-[var(--gold)]`} aria-hidden="true" />
      <span>{title}</span>
    </div>
  );
}

function formatMarketPrice(price: number) {
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

const MINI_CHART_HEIGHT = 80;
const MINI_RANGE_OPTIONS: Array<{ key: ChartRangeKey; label: string }> = [
  { key: "24h", label: "24H" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
];

function formatMiniPrice(price: number) {
  if (price >= 1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
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

const MINI_PAD = 4;

interface MiniChartGeometry {
  linePath: string;
  areaPath: string;
  points: Array<{ x: number; y: number }>;
}

function buildMiniGeometry(candles: PriceCandle[], width: number, height: number): MiniChartGeometry {
  if (candles.length === 0) return { linePath: "", areaPath: "", points: [] };

  const closes = candles.map((c) => c.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const innerW = width - MINI_PAD * 2;
  const innerH = height - MINI_PAD * 2;

  const points = candles.map((c, i) => ({
    x: candles.length === 1 ? width / 2 : MINI_PAD + (i / (candles.length - 1)) * innerW,
    y: height - MINI_PAD - ((c.close - min) / range) * innerH,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const baseline = height - MINI_PAD;
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseline} L ${points[0].x.toFixed(1)} ${baseline} Z`;

  return { linePath, areaPath, points };
}

function formatMiniTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(timestamp);
}

function MiniChart({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<ChartRangeKey>("24h");
  const { candles, loading, error } = useCandleSeries(symbol, range);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [width, setWidth] = useState(280);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(Math.round(el.clientWidth), 200));
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setActiveIndex(null);
  }, [range, symbol]);

  const geometry = useMemo(
    () => buildMiniGeometry(candles, width, MINI_CHART_HEIGHT),
    [candles, width],
  );

  const firstPrice = candles[0]?.open ?? null;
  const lastPrice = candles[candles.length - 1]?.close ?? null;
  const pctChange =
    firstPrice && lastPrice && firstPrice !== 0
      ? ((lastPrice - firstPrice) / firstPrice) * 100
      : null;

  const displayIndex = activeIndex ?? (candles.length > 0 ? candles.length - 1 : null);
  const displayCandle = displayIndex !== null ? candles[displayIndex] ?? null : null;
  const displayPoint = displayIndex !== null ? geometry.points[displayIndex] ?? null : null;
  const displayPrice = displayCandle?.close ?? lastPrice;
  const displayPct =
    displayCandle && firstPrice && firstPrice !== 0
      ? ((displayCandle.close - firstPrice) / firstPrice) * 100
      : pctChange;

  const updateActiveIndex = (clientX: number) => {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds || candles.length === 0) return;
    const relativeX = Math.min(Math.max(clientX - bounds.left, 0), bounds.width);
    const normalizedX = relativeX / bounds.width;
    const nextIndex = Math.round(normalizedX * (candles.length - 1));
    setActiveIndex(Math.min(Math.max(nextIndex, 0), candles.length - 1));
  };

  return (
    <div
      className="border-t border-white/6 px-4 pb-4 pt-3"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {MINI_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRange(opt.key)}
              className={`rounded-full px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.14em] transition ${
                opt.key === range
                  ? "bg-white/10 text-zinc-100"
                  : "bg-transparent text-zinc-500 hover:bg-white/6"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {displayPrice !== null && displayPct !== null ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-zinc-200">
              {formatMiniPrice(displayPrice)}
            </span>
            <span
              className={`font-semibold ${displayPct >= 0 ? "text-emerald-200" : "text-[var(--negative)]"}`}
            >
              {displayPct >= 0 ? "+" : ""}
              {displayPct.toFixed(2)}%
            </span>
          </div>
        ) : null}
      </div>

      <div ref={wrapRef} className="relative rounded-[14px] border border-white/6 bg-white/[0.02] p-2">
        {loading && candles.length === 0 ? (
          <div
            className="animate-pulse rounded-[10px] bg-white/6"
            style={{ height: `${MINI_CHART_HEIGHT}px` }}
          />
        ) : error && candles.length === 0 ? (
          <div className="px-3 py-3 text-xs text-rose-300">{error}</div>
        ) : candles.length === 0 ? (
          <div
            className="flex items-center justify-center text-xs text-zinc-500"
            style={{ height: `${MINI_CHART_HEIGHT}px` }}
          >
            No data
          </div>
        ) : (
          <>
            {displayCandle ? (
              <div className="mb-1 flex items-center justify-between text-[0.65rem] text-zinc-500">
                <span>{formatMiniTimestamp(displayCandle.endTime)}</span>
                <span>
                  Vol {displayCandle.volume >= 1000
                    ? compactUsdFormatter.format(displayCandle.volume)
                    : displayCandle.volume.toFixed(1)}
                </span>
              </div>
            ) : null}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${MINI_CHART_HEIGHT}`}
              className="w-full overflow-visible touch-none"
              style={{ height: `${MINI_CHART_HEIGHT}px` }}
              onPointerDown={(e) => updateActiveIndex(e.clientX)}
              onPointerMove={(e) => {
                if (e.pointerType === "mouse" || e.pressure > 0) {
                  updateActiveIndex(e.clientX);
                }
              }}
              onPointerLeave={() => setActiveIndex(null)}
            >
              <defs>
                <linearGradient id={`mini-fill-${symbol}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(212,168,79,0.3)" />
                  <stop offset="100%" stopColor="rgba(212,168,79,0)" />
                </linearGradient>
              </defs>
              <path d={geometry.areaPath} fill={`url(#mini-fill-${symbol})`} />
              <path
                d={geometry.linePath}
                fill="none"
                stroke="var(--gold)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {activeIndex !== null && displayPoint ? (
                <>
                  <line
                    x1={displayPoint.x}
                    x2={displayPoint.x}
                    y1={MINI_PAD}
                    y2={MINI_CHART_HEIGHT - MINI_PAD}
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={MINI_PAD}
                    x2={width - MINI_PAD}
                    y1={displayPoint.y}
                    y2={displayPoint.y}
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={displayPoint.x}
                    cy={displayPoint.y}
                    r="4"
                    fill="var(--gold)"
                    stroke="rgba(5,5,5,0.9)"
                    strokeWidth="2"
                  />
                  <g
                    transform={`translate(${Math.min(Math.max(displayPoint.x - 38, 4), width - 80)}, ${Math.max(displayPoint.y - 28, 2)})`}
                  >
                    <rect
                      x="0"
                      y="0"
                      width="76"
                      height="20"
                      rx="10"
                      fill="rgba(15,15,15,0.92)"
                      stroke="rgba(255,255,255,0.08)"
                    />
                    <text
                      x="38"
                      y="14"
                      textAnchor="middle"
                      fill="var(--gold)"
                      fontSize="9"
                      fontWeight="600"
                      letterSpacing="0.04em"
                    >
                      {formatMiniPrice(displayCandle?.close ?? 0)}
                    </text>
                  </g>
                </>
              ) : null}
              <rect
                x={0}
                y={0}
                width={width}
                height={MINI_CHART_HEIGHT}
                fill="transparent"
                pointerEvents="none"
              />
            </svg>
          </>
        )}
      </div>
    </div>
  );
}

function MarketRow({
  asset,
  expanded,
  onSelect,
  onToggleExpand,
}: {
  asset: AssetRow;
  expanded: boolean;
  onSelect: (symbol: string) => void;
  onToggleExpand: (symbol: string) => void;
}) {
  const positive = asset.change24hPct >= 0;

  return (
    <div>
      <div className="flex items-start gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
        <button
          type="button"
          onClick={() => onSelect(asset.symbol)}
          className="flex min-w-0 flex-1 items-start justify-between gap-4 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <span>{asset.symbol}</span>
              {asset.onlyIsolated ? (
                <span className="rounded-full bg-white/6 px-2 py-1 text-[0.62rem] uppercase tracking-[0.16em] text-zinc-400">
                  Isolated
                </span>
              ) : null}
              {asset.isDelisted ? (
                <span className="rounded-full bg-rose-500/12 px-2 py-1 text-[0.62rem] uppercase tracking-[0.16em] text-rose-200">
                  Delisted
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-xs text-zinc-400">
              Vol {asset.volume24h !== null ? compactUsdFormatter.format(asset.volume24h) : "—"} • OI{" "}
              {asset.openInterest !== null ? compactUsdFormatter.format(asset.openInterest) : "—"}
            </div>
          </div>
          <div className="flex items-start gap-2 text-right">
            <div>
              <div className="text-sm font-medium text-zinc-100">
                {formatMarketPrice(asset.price)}
              </div>
              <div
                className={`mt-1 text-xs font-semibold ${
                  positive ? "text-emerald-200" : "text-[var(--negative)]"
                }`}
              >
                {formatSignedPercent(asset.change24hPct)}
              </div>
            </div>
          </div>
        </button>
        <button
          type="button"
          aria-label={expanded ? `Collapse ${asset.symbol} quick chart` : `Expand ${asset.symbol} quick chart`}
          onClick={() => onToggleExpand(asset.symbol)}
          className="mt-1 shrink-0 rounded-full p-1.5 text-zinc-500 transition hover:bg-white/6 hover:text-zinc-300"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      </div>
      {expanded ? <MiniChart symbol={asset.symbol} /> : null}
    </div>
  );
}

function MarketSection({
  icon,
  title,
  assets,
  expandedSymbol,
  onAssetSelect,
  onToggleExpand,
}: {
  icon: string;
  title: string;
  assets: AssetRow[];
  expandedSymbol: string | null;
  onAssetSelect: (symbol: string) => void;
  onToggleExpand: (symbol: string) => void;
}) {
  if (assets.length === 0) {
    return null;
  }

  return (
    <section className="mb-6">
      <SectionTitle icon={icon} title={title} />
      <div className="panel overflow-hidden rounded-[22px] divide-y divide-white/6">
        {assets.map((asset) => (
          <MarketRow
            key={asset.symbol}
            asset={asset}
            expanded={expandedSymbol === asset.symbol}
            onSelect={onAssetSelect}
            onToggleExpand={onToggleExpand}
          />
        ))}
      </div>
    </section>
  );
}

export function MarketList({
  assets,
  status,
  searchQuery,
  sortKey,
  showDelisted,
  loading,
  onSearchQueryChange,
  onSortKeyChange,
  onShowDelistedChange,
  onAssetSelect,
}: MarketListProps) {
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const handleToggleExpand = (symbol: string) => {
    setExpandedSymbol((current) => (current === symbol ? null : symbol));
  };
  const sortedAssets = useMemo(() => sortAssets(assets, sortKey), [assets, sortKey]);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredAssets = useMemo(() => {
    if (!normalizedQuery) {
      return sortedAssets;
    }

    return sortedAssets.filter((asset) =>
      asset.symbol.toLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery, sortedAssets]);
  const pinnedMarkets = useMemo(
    () =>
      PINNED_SYMBOLS.map((symbol) => assets.find((asset) => asset.symbol === symbol) ?? null).filter(
        (asset): asset is AssetRow => asset !== null,
      ),
    [assets],
  );
  const pinnedSet = useMemo(() => new Set(pinnedMarkets.map((asset) => asset.symbol)), [pinnedMarkets]);
  const scannerAssets = useMemo(
    () => sortedAssets.filter((asset) => !pinnedSet.has(asset.symbol)),
    [pinnedSet, sortedAssets],
  );
  const topOpenInterest = useMemo(() => sortAssets(scannerAssets, "openInterest").slice(0, 4), [scannerAssets]);
  const statusMessage =
    status === "reconnecting"
      ? "Live prices are reconnecting. Values may lag briefly."
      : status === "disconnected"
        ? "Live prices are offline. Pull to refresh or wait for the stream to reconnect."
        : null;

  return (
    <section className="min-h-[calc(100vh-15rem)] pb-36">
      <SectionHeading title="Markets" action={<ConnectionPill status={status} />} />
      <div className="sticky top-0 z-10 mb-5 pb-4 pt-1">
        <div className="panel rounded-[28px] p-4">
          <label className="block">
            <input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search markets..."
              className="w-full rounded-[18px] border border-white/8 bg-white/4 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[var(--gold)] focus:bg-white/6"
            />
          </label>
          <div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-3">
            <label className="flex min-w-0 items-center gap-3 rounded-[18px] border border-white/8 bg-white/4 px-4 py-3 text-sm text-zinc-300">
              <span className="shrink-0 text-zinc-500">Sort</span>
              <select
                value={sortKey}
                onChange={(event) => onSortKeyChange(event.target.value as MarketSortKey)}
                className="w-full min-w-0 bg-transparent text-zinc-100 outline-none"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={!showDelisted}
                onChange={(event) => onShowDelistedChange(!event.target.checked)}
                className="h-4 w-4 rounded border-white/10 bg-white/6 accent-[var(--gold)]"
              />
              <span>Hide delisted</span>
            </label>
          </div>
          {statusMessage ? (
            <div className="mt-4 rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
              {statusMessage}
            </div>
          ) : null}
        </div>
      </div>

      <div className="pr-1">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="panel rounded-[24px] px-4 py-4">
                <div className="mb-2 h-4 w-16 animate-pulse rounded bg-white/8" />
                <div className="mb-3 h-4 w-28 animate-pulse rounded bg-white/6" />
                <div className="h-3 w-40 animate-pulse rounded bg-white/6" />
              </div>
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="panel rounded-[28px] p-5 text-sm text-zinc-400">
            No markets match the current filters.
          </div>
        ) : (
          <>
            <MarketSection
              icon="fa-solid fa-star"
              title="Major Markets"
              assets={pinnedMarkets}
              expandedSymbol={expandedSymbol}
              onAssetSelect={onAssetSelect}
              onToggleExpand={handleToggleExpand}
            />
            <MarketSection
              icon="fa-solid fa-building-columns"
              title="Highest Open Interest"
              assets={topOpenInterest}
              expandedSymbol={expandedSymbol}
              onAssetSelect={onAssetSelect}
              onToggleExpand={handleToggleExpand}
            />
            <MarketSection
              icon="fa-solid fa-table-list"
              title="Full Market List"
              assets={filteredAssets}
              expandedSymbol={expandedSymbol}
              onAssetSelect={onAssetSelect}
              onToggleExpand={handleToggleExpand}
            />
          </>
        )}
      </div>
    </section>
  );
}
