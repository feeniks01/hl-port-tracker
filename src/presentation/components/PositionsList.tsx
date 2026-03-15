import { useMemo, useState } from "react";

import type { Position } from "../../domain/types/portfolio";

import { useAnimatedNumber } from "../hooks/useAnimatedNumber";
import { SectionHeading } from "./SectionHeading";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
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

const MAX_VISIBLE_POSITIONS = 3;

function formatLeverageType(value: string) {
  if (!value) {
    return "Cross";
  }

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function AnimatedPnlValue({ value }: { value: number }) {
  const { displayValue, direction, isTicking } = useAnimatedNumber(value, 420);
  const positive = (displayValue ?? value) >= 0;

  return (
    <span
      className={`text-sm font-semibold ${
        positive ? "text-[var(--gold)]" : "text-[var(--negative)]"
      } ${isTicking ? (direction === "up" ? "value-tick-up" : "value-tick-down") : ""}`}
    >
      {roundedCurrencyFormatter.format(displayValue ?? value)}
    </span>
  );
}

interface PositionsListProps {
  positions: Position[];
  loading: boolean;
  hasAddress: boolean;
  onAssetSelect: (symbol: string) => void;
}

export function PositionsList({
  positions,
  loading,
  hasAddress,
  onAssetSelect,
}: PositionsListProps) {
  const [showAllPositions, setShowAllPositions] = useState(false);
  const visiblePositions = useMemo(
    () => (showAllPositions ? positions : positions.slice(0, MAX_VISIBLE_POSITIONS)),
    [positions, showAllPositions],
  );

  return (
    <section className="mb-8">
      <SectionHeading title="Open Positions" />
      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((index) => (
            <div
              key={index}
              className="panel rounded-[28px] px-5 py-4"
            >
              <div className="mb-4 h-4 w-24 animate-pulse rounded bg-white/8" />
              <div className="mb-3 h-3 w-32 animate-pulse rounded bg-white/6" />
              <div className="mb-2 h-3 w-20 animate-pulse rounded bg-white/6" />
              <div className="h-3 w-36 animate-pulse rounded bg-white/6" />
            </div>
          ))}
        </div>
      ) : positions.length === 0 ? (
        <div className="panel rounded-[28px] p-5 text-sm text-zinc-400">
          {hasAddress
            ? "No open perp positions for this address."
            : "Load a wallet address to inspect open perp positions."}
        </div>
      ) : (
        <div className="space-y-4">
          {visiblePositions.map((position, index) => {
            const positionKey = `${position.coin}-${index}`;
            const isLong = position.size >= 0;

            return (
              <button
                key={positionKey}
                type="button"
                onClick={() => onAssetSelect(position.coin)}
                className="panel w-full rounded-[28px] px-5 py-4 text-left transition hover:bg-white/[0.035]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-base font-semibold text-zinc-100">
                      <span>{position.coin}</span>
                      <span
                        className={`rounded-full px-2 py-1 text-[0.65rem] font-medium uppercase tracking-[0.16em] ${
                          isLong
                            ? "bg-emerald-500/12 text-emerald-200"
                            : "bg-amber-500/12 text-amber-200"
                        }`}
                      >
                        {isLong ? "Long" : "Short"}
                      </span>
                    </div>
                    <div className="mt-3 text-[1.05rem] font-medium text-zinc-100">
                      {sizeFormatter.format(position.size)} {position.coin}
                    </div>
                    <div className="mt-2 text-sm text-zinc-500">
                      {formatLeverageType(position.leverageType)} · {position.leverageValue}x
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm text-zinc-500">Unrealized PnL</div>
                    <div className="mt-1">
                      <AnimatedPnlValue value={position.unrealizedPnl} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {positions.length > MAX_VISIBLE_POSITIONS ? (
            <button
              type="button"
              onClick={() => setShowAllPositions((current) => !current)}
              className="w-full px-1 py-2 text-center text-sm font-medium text-zinc-300 transition hover:text-zinc-100"
            >
              {showAllPositions
                ? "Show fewer positions"
                : `View all positions (${positions.length})`}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
