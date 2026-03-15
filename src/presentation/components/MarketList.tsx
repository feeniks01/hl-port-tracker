import { useEffect, useMemo, useRef, useState } from "react";

import type { AssetRow, ConnectionStatus } from "../../domain/types/market";
import type { ChartRangeKey, PriceCandle } from "../../domain/types/chart";
import type { LeaderboardPeriodKey, LeaderboardWallet } from "../../data/api/leaderboard";
import { useCandleSeries } from "../hooks/useCandleSeries";
import { useLeaderboardWallets } from "../hooks/useLeaderboardWallets";
import { SectionHeading } from "./SectionHeading";

export type MarketSortKey = "price" | "change" | "openInterest" | "volume" | "funding";

const PINNED_SYMBOLS = ["BTC", "ETH", "SOL", "HYPE"];

const compactUsdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

function formatNotionalVolume(volume: number) {
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
  onWalletInspect: (address: string) => void;
}

const sortOptions: Array<{ value: MarketSortKey; label: string }> = [
  { value: "openInterest", label: "Open Interest" },
  { value: "volume", label: "Volume" },
  { value: "change", label: "24h Move" },
  { value: "funding", label: "Funding" },
  { value: "price", label: "Price" },
];

const fullListSizeOptions = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
  { value: "all", label: "All" },
] as const;
const FULL_LIST_INCREMENT = 50;

function SortDropdown({
  value,
  onChange,
}: {
  value: MarketSortKey;
  onChange: (value: MarketSortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = sortOptions.find((option) => option.value === value) ?? sortOptions[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative min-w-[7.5rem]">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-[16px] border border-white/8 bg-white/4 px-3.5 py-2.5 text-sm text-zinc-300 transition hover:bg-white/6"
      >
        <span className="min-w-0 truncate text-zinc-100">
          {selectedOption.label}
        </span>
        <i
          className={`fa-solid fa-chevron-down text-[0.7rem] text-zinc-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 rounded-[20px] border border-white/8 bg-[#101010] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
        >
          {sortOptions.map((option) => {
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-[14px] px-3 py-2.5 text-left text-sm transition ${
                  active
                    ? "bg-[var(--gold)]/12 text-[var(--gold)]"
                    : "text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
                }`}
              >
                <span>{option.label}</span>
                {active ? <i className="fa-solid fa-check text-[0.72rem]" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function FullListSizeDropdown({
  value,
  onChange,
}: {
  value: (typeof fullListSizeOptions)[number]["value"];
  onChange: (value: (typeof fullListSizeOptions)[number]["value"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = fullListSizeOptions.find((option) => option.value === value) ?? fullListSizeOptions[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-zinc-400 transition hover:bg-white/[0.05] hover:text-zinc-100"
      >
        <span>Show</span>
        <span className="text-zinc-100">{selectedOption.label}</span>
        <i
          className={`fa-solid fa-chevron-down text-[0.62rem] text-zinc-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-30 min-w-[6rem] rounded-[18px] border border-white/8 bg-[#101010] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
        >
          {fullListSizeOptions.map((option) => {
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-sm transition ${
                  active
                    ? "bg-[var(--gold)]/12 text-[var(--gold)]"
                    : "text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
                }`}
              >
                <span>{option.label}</span>
                {active ? <i className="fa-solid fa-check text-[0.72rem]" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

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

function formatWalletName(wallet: LeaderboardWallet) {
  if (wallet.displayName?.trim()) {
    return wallet.displayName.trim();
  }

  return `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
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

const MINI_CHART_HEIGHT = 64;
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
      className="border-t border-white/6 px-4 pb-3 pt-2.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
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
              <div className="mb-1 flex items-center justify-between text-[0.62rem] text-zinc-500">
                <span>{formatMiniTimestamp(displayCandle.endTime)}</span>
                <span>
                  Vol {formatNotionalVolume(displayCandle.volume)}
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
  onSelect,
}: {
  asset: AssetRow;
  onSelect: (symbol: string) => void;
}) {
  const positive = asset.change24hPct >= 0;

  return (
    <div className="px-4 py-3 transition hover:bg-white/[0.03]">
      <button
        type="button"
        onClick={() => onSelect(asset.symbol)}
        className="flex w-full min-w-0 items-start justify-between gap-4 text-left"
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
            Vol {compactUsdFormatter.format(asset.volume24h ?? 0)} • OI{" "}
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
    </div>
  );
}

function MarketSection({
  icon,
  title,
  assets,
  onAssetSelect,
  actions,
}: {
  icon: string;
  title: string;
  assets: AssetRow[];
  onAssetSelect: (symbol: string) => void;
  actions?: React.ReactNode;
}) {
  if (assets.length === 0) {
    return null;
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle icon={icon} title={title} />
        {actions}
      </div>
      <div className="panel overflow-hidden rounded-[22px] divide-y divide-white/6">
        {assets.map((asset) => (
          <MarketRow
            key={asset.symbol}
            asset={asset}
            onSelect={onAssetSelect}
          />
        ))}
      </div>
    </section>
  );
}

const leaderboardPeriodOptions: Array<{ key: LeaderboardPeriodKey; label: string }> = [
  { key: "day", label: "24H" },
  { key: "week", label: "7D" },
  { key: "month", label: "30D" },
];

function TopWalletsSection({
  wallets,
  loading,
  error,
  onInspect,
}: {
  wallets: LeaderboardWallet[];
  loading: boolean;
  error: string | null;
  onInspect: (address: string) => void;
}) {
  const [period, setPeriod] = useState<LeaderboardPeriodKey>("day");

  const topWallets = useMemo(() => {
    return wallets
      .map((wallet) => ({ wallet, performance: wallet[period] }))
      .sort((left, right) => right.performance.pnl - left.performance.pnl)
      .slice(0, 5);
  }, [period, wallets]);

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle icon="fa-solid fa-trophy" title="Top Wallets" />
        <div className="flex gap-1.5">
          {leaderboardPeriodOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPeriod(option.key)}
              className={`rounded-full px-3 py-1 text-[0.65rem] font-medium uppercase tracking-[0.14em] transition ${
                option.key === period
                  ? "bg-[var(--gold)] text-black"
                  : "bg-white/5 text-zinc-500 hover:bg-white/8 hover:text-zinc-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="panel overflow-hidden rounded-[22px] divide-y divide-white/6">
        {loading ? (
          [0, 1, 2].map((index) => (
            <div key={index} className="px-4 py-4">
              <div className="mb-2 h-4 w-28 animate-pulse rounded bg-white/8" />
              <div className="h-3 w-44 animate-pulse rounded bg-white/6" />
            </div>
          ))
        ) : error ? (
          <div className="px-4 py-4 text-sm text-zinc-400">
            Leaderboard unavailable right now.
          </div>
        ) : topWallets.length === 0 ? (
          <div className="px-4 py-4 text-sm text-zinc-400">No wallet data available.</div>
        ) : (
          topWallets.map(({ wallet, performance }, index) => (
            <div key={`${wallet.address}-${period}`} className="flex items-start justify-between gap-4 px-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                  <span className="text-zinc-500">{index + 1}</span>
                  <span className="truncate">{formatWalletName(wallet)}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">{wallet.address}</div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
                  <span>Value {compactUsdFormatter.format(wallet.accountValue)}</span>
                  <span>ROI {formatSignedPercent(performance.roi * 100)}</span>
                  <span>Vol {compactUsdFormatter.format(performance.volume)}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div
                  className={`text-sm font-semibold ${
                    performance.pnl >= 0 ? "text-emerald-200" : "text-[var(--negative)]"
                  }`}
                >
                  {performance.pnl >= 0 ? "+" : "-"}
                  {compactUsdFormatter.format(Math.abs(performance.pnl))}
                </div>
                <button
                  type="button"
                  onClick={() => onInspect(wallet.address)}
                  aria-label={`Inspect ${formatWalletName(wallet)}`}
                  className="mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/8 text-zinc-300 transition hover:bg-white/[0.04] hover:text-zinc-100"
                >
                  <i className="fa-solid fa-magnifying-glass text-[0.78rem]" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))
        )}
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
  onWalletInspect,
}: MarketListProps) {
  const [fullListSize, setFullListSize] = useState<(typeof fullListSizeOptions)[number]["value"]>("10");
  const [fullListRenderCount, setFullListRenderCount] = useState(FULL_LIST_INCREMENT);
  const [controlsPinned, setControlsPinned] = useState(false);
  const { wallets: leaderboardWallets, loading: leaderboardLoading, error: leaderboardError } = useLeaderboardWallets();
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
      PINNED_SYMBOLS.map((symbol) => filteredAssets.find((asset) => asset.symbol === symbol) ?? null).filter(
        (asset): asset is AssetRow => asset !== null,
      ),
    [filteredAssets],
  );
  const pinnedSet = useMemo(() => new Set(pinnedMarkets.map((asset) => asset.symbol)), [pinnedMarkets]);
  const scannerAssets = useMemo(
    () => filteredAssets.filter((asset) => !pinnedSet.has(asset.symbol)),
    [filteredAssets, pinnedSet],
  );
  const topOpenInterest = useMemo(() => sortAssets(scannerAssets, "openInterest").slice(0, 4), [scannerAssets]);
  const featuredSymbols = useMemo(
    () => new Set([...pinnedMarkets, ...topOpenInterest].map((asset) => asset.symbol)),
    [pinnedMarkets, topOpenInterest],
  );
  const fullListAssets = useMemo(
    () => filteredAssets.filter((asset) => !featuredSymbols.has(asset.symbol)),
    [featuredSymbols, filteredAssets],
  );

  useEffect(() => {
    setFullListRenderCount(FULL_LIST_INCREMENT);
  }, [fullListSize, normalizedQuery, sortKey, showDelisted]);

  const visibleFullListAssets = useMemo(() => {
    if (fullListSize === "all") {
      return fullListAssets.slice(0, fullListRenderCount);
    }

    return fullListAssets.slice(0, Number(fullListSize));
  }, [fullListAssets, fullListRenderCount, fullListSize]);
  const canLoadMoreFullList = fullListSize === "all" && visibleFullListAssets.length < fullListAssets.length;
  const statusMessage =
    status === "reconnecting"
      ? "Live prices are reconnecting. Values may lag briefly."
      : status === "disconnected"
        ? "Live prices are offline. Pull to refresh or wait for the stream to reconnect."
        : null;

  useEffect(() => {
    const handleScroll = () => {
      setControlsPinned(window.scrollY > 120);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <section className="min-h-[calc(100vh-15rem)] pb-36">
      <SectionHeading title="Markets" />
      <div className="mb-4 text-sm text-zinc-500">
        Scan majors, activity, and top wallets.
      </div>
      <div className="sticky top-0 z-20 mb-5 pt-1">
        <div
          className={`transition-all duration-200 ${
            controlsPinned
              ? "rounded-[24px] bg-[rgba(5,5,5,0.78)] px-3 py-3 backdrop-blur-sm"
              : "px-0 py-0"
          }`}
        >
          <label className="mb-3 block">
            <input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search markets..."
              className="w-full rounded-[18px] border border-white/8 bg-white/4 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[var(--gold)] focus:bg-white/6"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <SortDropdown value={sortKey} onChange={onSortKeyChange} />
            <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={!showDelisted}
                onChange={(event) => onShowDelistedChange(!event.target.checked)}
                className="h-4 w-4 rounded border-white/10 bg-white/6 accent-[var(--gold)]"
              />
              <span className="whitespace-nowrap">Hide delisted</span>
            </label>
          </div>
          {statusMessage ? (
            <div className="mt-4 rounded-[18px] border border-white/6 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
              {statusMessage}
            </div>
          ) : null}
        </div>
      </div>

      <div>
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
        ) : filteredAssets.length === 0 ? (
          <div className="panel rounded-[28px] p-5 text-sm text-zinc-400">
            No markets match the current filters.
          </div>
        ) : (
          <>
            <MarketSection
              icon="fa-solid fa-star"
              title="Major Markets"
              assets={pinnedMarkets}
              onAssetSelect={onAssetSelect}
            />
            <MarketSection
              icon="fa-solid fa-building-columns"
              title="Highest Open Interest"
              assets={topOpenInterest}
              onAssetSelect={onAssetSelect}
            />
            <MarketSection
              icon="fa-solid fa-table-list"
              title="Full Market List"
              assets={visibleFullListAssets}
              onAssetSelect={onAssetSelect}
              actions={
                <div className="flex items-center gap-2">
                  {fullListSize === "all" ? (
                    <span className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-zinc-500">
                      {visibleFullListAssets.length}/{fullListAssets.length}
                    </span>
                  ) : null}
                  <FullListSizeDropdown value={fullListSize} onChange={setFullListSize} />
                </div>
              }
            />
            {canLoadMoreFullList ? (
              <div className="mb-6 flex justify-center">
                <button
                  type="button"
                  onClick={() =>
                    setFullListRenderCount((current) =>
                      Math.min(current + FULL_LIST_INCREMENT, fullListAssets.length),
                    )
                  }
                  className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-zinc-300 transition hover:bg-white/[0.05] hover:text-zinc-100"
                >
                  Load 50 More
                </button>
              </div>
            ) : null}
            <TopWalletsSection
              wallets={leaderboardWallets}
              loading={leaderboardLoading}
              error={leaderboardError}
              onInspect={onWalletInspect}
            />
          </>
        )}
      </div>
    </section>
  );
}
