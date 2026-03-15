import { useEffect, useRef, useState } from "react";

import type { AccountSummary } from "../../domain/types/portfolio";
import { useAnimatedNumber } from "../hooks/useAnimatedNumber";

interface HeroProps {
  summary: AccountSummary | null;
  currentAddress?: string;
  walletOptions?: string[];
  onWalletSelect?: (address: string) => void;
  onAddWallet?: () => void;
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

function formatWalletLabel(address: string) {
  if (address.length <= 18) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Hero({ summary, currentAddress, walletOptions = [], onWalletSelect, onAddWallet }: HeroProps) {
  const { displayValue, direction, isTicking } = useAnimatedNumber(summary?.netEquity ?? null, 560);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!walletMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!walletMenuRef.current?.contains(event.target as Node)) {
        setWalletMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [walletMenuOpen]);

  return (
    <section className="hero-glow mb-10 pt-4">
      <div className="mb-5 flex items-start justify-start">
        <div className="relative" ref={walletMenuRef}>
          <button
            type="button"
            onClick={() => setWalletMenuOpen((current) => !current)}
            className="flex items-center gap-3 rounded-full border border-white/6 bg-white/[0.035] px-4 py-2.5 text-zinc-100 transition hover:bg-white/[0.06]"
          >
            <span className="text-xl font-medium tracking-[-0.02em]">
              {currentAddress ? formatWalletLabel(currentAddress) : "Account"}
            </span>
            <svg
              className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${walletMenuOpen ? "rotate-180" : ""}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
          {walletMenuOpen ? (
            <div className="absolute left-0 top-[calc(100%+1rem)] z-20 min-w-[15rem] rounded-[20px] border border-white/6 bg-zinc-950/96 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur">
              {walletOptions.map((address) => {
                const active = address === currentAddress;

                return (
                  <button
                    key={address}
                    type="button"
                    onClick={() => {
                      setWalletMenuOpen(false);
                      onWalletSelect?.(address);
                    }}
                    className={`flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-sm transition ${
                      active
                        ? "bg-white/[0.06] text-zinc-100"
                        : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                    }`}
                  >
                    <span>{formatWalletLabel(address)}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setWalletMenuOpen(false);
                  onAddWallet?.();
                }}
                className="mt-1 flex w-full items-center rounded-[14px] px-3 py-2 text-left text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-100"
              >
                Add Wallet
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
        Account Value
      </p>
      <div
        className={`display-serif metallic-text text-[4.2rem] leading-none tracking-[-0.04em] transition-transform duration-300 sm:text-[5rem] ${
          isTicking ? (direction === "up" ? "value-tick-up" : "value-tick-down") : ""
        }`}
      >
        {formatUsd(displayValue)}
      </div>
    </section>
  );
}
