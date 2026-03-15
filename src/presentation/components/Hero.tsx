import type { AccountSummary } from "../../domain/types/portfolio";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";

interface HeroProps {
  summary: AccountSummary | null;
}

function formatUsd(value: number | null) {
  if (value === null) {
    return "Connect a wallet";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function Hero({ summary }: HeroProps) {
  const { displayValue, direction, isTicking } = useAnimatedNumber(summary?.netEquity ?? null, 560);

  return (
    <section className="hero-glow mb-10 pt-4">
      <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
        Account Value
      </p>
      <div
        className={`display-serif metallic-text text-[3.8rem] leading-none tracking-[-0.04em] transition-transform duration-300 sm:text-[4.5rem] ${
          isTicking ? (direction === "up" ? "value-tick-up" : "value-tick-down") : ""
        }`}
      >
        {formatUsd(displayValue)}
      </div>
    </section>
  );
}
