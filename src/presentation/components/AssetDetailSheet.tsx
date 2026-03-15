import { useState } from "react";

import type { AssetRow } from "../../domain/types/market";
import type { Position } from "../../domain/types/portfolio";
import {
  formatEstimatedTime,
  getEstimatedHoursToLiq,
  getLiquidationDistancePct,
  getLiquidationRisk,
} from "../../domain/utils/liquidation";
import { useHourlyVolatility } from "../hooks/useHourlyVolatility";
import { useTradeStore } from "../stores/tradeStore";
import { CopyTradeSheet } from "./CopyTradeSheet";
import { PriceChart } from "./PriceChart";

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

const roundedCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const sizeFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function formatSignedPercent(value: number, fractionDigits = 2) {
  const normalized = Math.abs(value) < 10 ** -(fractionDigits + 1) ? 0 : value;
  return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(fractionDigits)}%`;
}

function formatFundingRatePercent(value: number) {
  return formatSignedPercent(value * 100, 4);
}

function MetricCard({
  label,
  value,
  toneClass = "text-zinc-100",
}: {
  label: string;
  value: string;
  toneClass?: string;
}) {
  return (
    <div className="rounded-[18px] bg-white/[0.03] px-4 py-3">
      <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className={`text-sm font-medium ${toneClass}`}>{value}</div>
    </div>
  );
}

function MetricStripItem({
  label,
  value,
  toneClass = "text-zinc-200",
  hint,
}: {
  label: string;
  value: string;
  toneClass?: string;
  hint?: string;
}) {
  return (
    <div className="flex h-full min-h-[4.5rem] flex-col justify-start rounded-[16px] border border-white/7 bg-white/[0.025] px-2 py-2 text-center">
      <div className="relative min-h-[1.45rem]">
        <span
          className="group relative inline-flex max-w-full items-center justify-center text-center text-[0.54rem] font-medium uppercase tracking-[0.1em] text-zinc-500"
          tabIndex={hint ? 0 : -1}
        >
          <span className="truncate">{label}</span>
          {hint ? (
            <span className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-20 hidden w-44 -translate-x-1/2 rounded-[14px] border border-white/8 bg-[#111111] px-3 py-2 text-left text-[0.68rem] normal-case tracking-normal text-zinc-200 shadow-[0_18px_40px_rgba(0,0,0,0.45)] group-hover:block group-focus-visible:block">
              {hint}
            </span>
          ) : null}
        </span>
      </div>
      <div className={`mt-1 text-[0.8rem] font-medium ${toneClass}`}>{value}</div>
    </div>
  );
}

function TooltipHint({
  id,
  text,
  activeTooltipId,
  onToggle,
}: {
  id: string;
  text: string;
  activeTooltipId: string | null | undefined;
  onToggle: (id: string) => void;
}) {
  const active = activeTooltipId === id;

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="Show explanation"
        onClick={(event) => {
          event.stopPropagation();
          onToggle(id);
        }}
        onMouseEnter={() => onToggle(id)}
        onMouseLeave={() => onToggle("")}
        onFocus={() => onToggle(id)}
        onBlur={() => onToggle("")}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[0.58rem] leading-none transition ${
          active
            ? "border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--gold)]"
            : "border-white/10 text-zinc-500 hover:border-white/18 hover:text-zinc-300"
        }`}
      >
        i
      </button>
      {active ? (
        <span className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-20 w-44 -translate-x-1/2 rounded-[14px] border border-white/8 bg-[#111111] px-3 py-2 text-left text-[0.68rem] normal-case tracking-normal text-zinc-200 shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
          {text}
        </span>
      ) : null}
    </span>
  );
}

interface AssetDetailSheetProps {
  symbol: string;
  asset: AssetRow | null;
  position: Position | null;
  sourceAddress: string | null;
  onClose: () => void;
  modal?: boolean;
}

export function AssetDetailSheet({
  symbol,
  asset,
  position,
  sourceAddress,
  onClose,
  modal = true,
}: AssetDetailSheetProps) {
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);
  const [tradeSheetOpen, setTradeSheetOpen] = useState(false);
  const fundingRate = asset?.fundingRate ?? null;
  const tradeWalletAddress = useTradeStore((state) => state.walletAddress);
  const tradeApprovalStatus = useTradeStore((state) => state.approvalStatus);
  const tradeBusy = useTradeStore((state) => state.busy);
  const tradeError = useTradeStore((state) => state.error);
  const tradeLastStatus = useTradeStore((state) => state.lastStatus);
  const connectWallet = useTradeStore((state) => state.connectWallet);
  const enableOneTapTrading = useTradeStore((state) => state.enableOneTapTrading);
  const volatilityBySymbol = useHourlyVolatility(position ? [position] : []);
  const liquidationDistancePct = position ? getLiquidationDistancePct(position) : null;
  const liquidationRisk = position ? getLiquidationRisk(liquidationDistancePct) : null;
  const estimatedHoursToLiq = position
    ? getEstimatedHoursToLiq(position, volatilityBySymbol[position.coin])
    : null;
  const isLong = position ? position.size >= 0 : true;
  const safetyPct = liquidationRisk?.markerPct ?? 50;
  const gaugeMarkerPct = isLong ? safetyPct : 100 - safetyPct;
  const liquidationCushion =
    position?.liquidationPrice != null
      ? Math.abs(position.markPrice - position.liquidationPrice)
      : null;
  const endpointValues = position
    ? isLong
      ? {
          leftPrice: position.liquidationPrice
            ? currencyFormatter.format(position.liquidationPrice)
            : "—",
          leftLabel: "Liq",
          rightPrice: currencyFormatter.format(position.markPrice),
          rightLabel: "Mark",
          gradient:
            "linear-gradient(90deg, rgba(244,63,94,0.95) 0%, rgba(250,204,21,0.92) 45%, rgba(16,185,129,0.95) 100%)",
        }
      : {
          leftPrice: currencyFormatter.format(position.markPrice),
          leftLabel: "Mark",
          rightPrice: position.liquidationPrice
            ? currencyFormatter.format(position.liquidationPrice)
            : "—",
          rightLabel: "Liq",
          gradient:
            "linear-gradient(90deg, rgba(16,185,129,0.95) 0%, rgba(250,204,21,0.92) 55%, rgba(244,63,94,0.95) 100%)",
        }
    : null;

  const handleTooltipToggle = (id: string) => {
    setActiveTooltipId((current) => (current === id || id === "" ? null : id));
  };

  const sourceAddressLabel = sourceAddress
    ? `${sourceAddress.slice(0, 6)}...${sourceAddress.slice(-4)}`
    : "No source wallet loaded";
  const tradeStatusLabel = tradeWalletAddress
    ? `${tradeWalletAddress.slice(0, 6)}...${tradeWalletAddress.slice(-4)}`
    : "No wallet connected";

  const showPositionDetails = modal && Boolean(position);
  const chartPosition = modal ? position : null;

  const contentInner = (
    <div
      className={modal ? "panel rounded-[32px] p-5" : ""}
      onClick={(event) => {
        if (modal) {
          event.stopPropagation();
        }
      }}
    >
          {!modal ? (
            <div className="mb-4">
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to markets"
                className="inline-flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-zinc-500 transition hover:text-zinc-100"
              >
                <span aria-hidden className="text-[1rem] leading-none">←</span>
                <span>Back</span>
              </button>
            </div>
          ) : null}
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[2.1rem] font-semibold leading-none text-zinc-100">{symbol}</h2>
                {showPositionDetails ? (
                  <span
                    className={`rounded-full px-2 py-1 text-[0.65rem] font-medium uppercase tracking-[0.14em] ${
                      position!.size >= 0
                        ? "bg-emerald-500/12 text-emerald-200"
                        : "bg-amber-500/12 text-amber-200"
                    }`}
                  >
                    {position!.size >= 0 ? "Long" : "Short"}
                  </span>
                ) : null}
              </div>
            </div>
            {modal ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close detail"
                className="mt-[-0.1rem] inline-flex min-h-10 min-w-10 shrink-0 items-start justify-center p-1 text-zinc-400 transition hover:text-zinc-100"
              >
                <span aria-hidden="true" className="block text-[1.45rem] leading-none">
                  ×
                </span>
              </button>
            ) : null}
          </div>

          {showPositionDetails ? (
            <div className="mb-6">
              <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Unrealized PnL
              </div>
              <div
                className={`display-serif text-[3rem] leading-none tracking-[-0.05em] ${
                  position!.unrealizedPnl >= 0 ? "text-[var(--gold)]" : "text-[var(--negative)]"
                }`}
              >
                {roundedCurrencyFormatter.format(position!.unrealizedPnl)}
              </div>
            </div>
          ) : null}

          {showPositionDetails ? (
            <div className="mb-6">
              <div className="mb-4 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Position
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Size"
                  value={`${sizeFormatter.format(position!.size)} ${position!.coin}`}
                />
                <MetricCard
                  label="Margin Used"
                  value={compactUsdFormatter.format(position!.marginUsed)}
                />
                <MetricCard
                  label="Entry"
                  value={currencyFormatter.format(position!.entryPrice)}
                />
                <MetricCard
                  label="Mark"
                  value={currencyFormatter.format(position!.markPrice)}
                />
              </div>
            </div>
          ) : null}

          {showPositionDetails && liquidationRisk && endpointValues ? (
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Liquidation Proximity
                </span>
                <span
                  className={`text-[0.72rem] font-medium uppercase tracking-[0.14em] ${liquidationRisk.toneClass}`}
                >
                  {liquidationRisk.label}
                </span>
              </div>
              <div className="text-sm text-zinc-400">
                {liquidationDistancePct !== null ? `${liquidationDistancePct.toFixed(2)}% away` : ""}
                {liquidationCushion !== null
                  ? ` · ${roundedCurrencyFormatter.format(liquidationCushion)} cushion`
                  : ""}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500">
                <span>Est. time to liq {formatEstimatedTime(estimatedHoursToLiq)}</span>
                <TooltipHint
                  id="eta-to-liq"
                  text="Estimated from current distance to liquidation versus recent 1 hr realized volatility."
                  activeTooltipId={activeTooltipId}
                  onToggle={handleTooltipToggle}
                />
              </div>
              <div className="mt-4 relative h-2 rounded-full bg-white/8">
                <div
                  className="absolute inset-0 rounded-full opacity-85 transition-all duration-500"
                  style={{ background: endpointValues.gradient }}
                />
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-black bg-zinc-100 shadow-[0_0_0_2px_rgba(5,5,5,0.22)] transition-all duration-500"
                  style={{ left: `calc(${gaugeMarkerPct}% - 6px)` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 text-sm text-zinc-200">
                <span>{endpointValues.leftPrice}</span>
                <span>{endpointValues.rightPrice}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-4 text-[0.68rem] uppercase tracking-[0.16em] text-zinc-500">
                <span>{endpointValues.leftLabel}</span>
                <span>{endpointValues.rightLabel}</span>
              </div>
            </div>
          ) : null}

          <PriceChart
            availableSymbols={[symbol]}
            selectedSymbols={[symbol]}
            onSelectedSymbolsChange={() => {}}
            currentAsset={asset}
            assetMap={asset ? { [symbol]: asset } : undefined}
            currentPosition={chartPosition}
            showSymbolPicker={false}
            sectionTitle=""
            bare
            hidePriceLabel
            allowTickMode={!modal}
          />

          {showPositionDetails && asset ? (
            <div className="mt-6">
              <div>
                <div>
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    Copy Trade
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Mirror this position from the inspected wallet into your own connected Hyperliquid account.
                  </div>
                  <div className="mt-4 rounded-[18px] border border-white/6 bg-white/[0.02] px-4 py-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-zinc-500">Inspecting wallet</span>
                      <span className="font-medium text-zinc-200">{sourceAddressLabel}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/6 pt-3 text-sm">
                      <span className="text-zinc-500">Your trading wallet</span>
                      <span className="font-medium text-zinc-200">{tradeStatusLabel}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  {tradeApprovalStatus === "approved" ? (
                    <button
                      type="button"
                      onClick={() => setTradeSheetOpen(true)}
                      className="w-full rounded-[18px] bg-[var(--gold)] px-4 py-3 text-sm font-semibold text-black transition hover:brightness-105"
                    >
                      Copy Position
                    </button>
                  ) : tradeWalletAddress ? (
                    <button
                      type="button"
                      disabled={tradeBusy}
                      onClick={() => {
                        void enableOneTapTrading();
                      }}
                      className="w-full rounded-[18px] border border-white/10 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.04] disabled:opacity-60"
                    >
                      {tradeBusy && tradeApprovalStatus === "checking"
                        ? "Preparing..."
                        : "Enable Copy Trading"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={tradeBusy}
                      onClick={() => {
                        void connectWallet();
                      }}
                      className="w-full rounded-[18px] border border-white/10 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.04] disabled:opacity-60"
                    >
                      {tradeBusy ? "Connecting..." : "Connect Wallet"}
                    </button>
                  )}
                </div>
              </div>
              {tradeError ? (
                <div className="mt-3 text-sm text-rose-300">{tradeError}</div>
              ) : null}
              {tradeLastStatus && !tradeSheetOpen ? (
                <div className="mt-3 text-sm text-emerald-300">{tradeLastStatus}</div>
              ) : null}
            </div>
          ) : null}

          {asset ? (
            <div className="mt-6 border-t border-white/6 pt-5">
              <div className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Market Stats
              </div>
              <div className="grid grid-cols-4 gap-2">
                <MetricStripItem
                  label="Volume"
                  value={asset?.volume24h != null ? compactUsdFormatter.format(asset.volume24h) : "—"}
                  hint="Total traded notional over the last 24 hours."
                />
                <MetricStripItem
                  label="Open Interest"
                  value={
                    asset?.openInterest != null ? compactUsdFormatter.format(asset.openInterest) : "—"
                  }
                  hint="Total notional value of open contracts currently outstanding."
                />
                <MetricStripItem
                  label="Funding"
                  value={fundingRate !== null ? formatFundingRatePercent(fundingRate) : "—"}
                  toneClass={
                    fundingRate === null
                      ? "text-zinc-200"
                      : fundingRate >= 0
                        ? "text-emerald-200"
                        : "text-[var(--negative)]"
                  }
                  hint="Periodic payment rate between longs and shorts that keeps the perp anchored to spot."
                />
                <MetricStripItem
                  label="Max Leverage"
                  value={asset ? `${asset.maxLeverage}x` : position ? `${position.maxLeverage}x` : "—"}
                  hint="Highest leverage the market currently allows under Hyperliquid margin rules."
                />
              </div>
            </div>
          ) : null}
    </div>
  );

  if (!modal) {
    return (
      <>
        <section className="mb-8">
          {contentInner}
        </section>
        {tradeSheetOpen && position && asset ? (
          <CopyTradeSheet
            asset={asset}
            position={position}
            onClose={() => setTradeSheetOpen(false)}
          />
        ) : null}
      </>
    );
  }

  return (
    <div
      className="fixed inset-0 z-30 overflow-y-auto bg-black/72 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="mx-auto max-w-[32rem] px-4 py-6">
        {contentInner}
      </div>
      {tradeSheetOpen && position && asset ? (
        <CopyTradeSheet
          asset={asset}
          position={position}
          onClose={() => setTradeSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}
