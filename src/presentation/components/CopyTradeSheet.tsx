import { useEffect, useMemo, useState } from "react";

import type { AssetRow } from "../../domain/types/market";
import type { Position } from "../../domain/types/portfolio";
import { useTradeStore } from "../stores/tradeStore";

const compactUsdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

interface CopyTradeSheetProps {
  asset: AssetRow;
  position: Position;
  onClose: () => void;
}

export function CopyTradeSheet({ asset, position, onClose }: CopyTradeSheetProps) {
  const busy = useTradeStore((state) => state.busy);
  const walletAddress = useTradeStore((state) => state.walletAddress);
  const error = useTradeStore((state) => state.error);
  const lastStatus = useTradeStore((state) => state.lastStatus);
  const submitCopyTrade = useTradeStore((state) => state.submitCopyTrade);
  const clearError = useTradeStore((state) => state.clearError);

  const [sizeInput, setSizeInput] = useState(() => String(Math.abs(position.size)));
  const [slippageInput, setSlippageInput] = useState("1.5");

  useEffect(() => {
    clearError();
    return () => clearError();
  }, [clearError]);

  const parsedSize = Number(sizeInput);
  const parsedSlippage = Number(slippageInput);
  const sideLabel = position.size >= 0 ? "Long" : "Short";
  const referencePrice = asset.midPrice ?? asset.price ?? position.markPrice;
  const estimatedNotional = useMemo(() => {
    if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      return null;
    }

    return parsedSize * referencePrice;
  }, [parsedSize, referencePrice]);

  const handleSubmit = async () => {
    const success = await submitCopyTrade({
      assetIndex: asset.assetIndex,
      sizeDecimals: asset.sizeDecimals,
      size: parsedSize,
      referencePrice,
      side: position.size >= 0 ? "long" : "short",
      leverage: position.leverageValue,
      leverageType: asset.onlyIsolated ? "isolated" : position.leverageType,
      slippagePercent: parsedSlippage,
    });

    if (success) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel w-full max-w-[28rem] rounded-[28px] p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Copy Trade
            </div>
            <div className="mt-2 text-xl font-semibold text-zinc-100">
              {position.coin} {sideLabel}
            </div>
            {walletAddress ? (
              <div className="mt-2 text-sm text-zinc-400">
                Trading from {formatAddress(walletAddress)}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close copy trade"
            className="rounded-full border border-white/8 px-3 py-2 text-zinc-300 transition hover:bg-white/[0.04]"
          >
            <span aria-hidden="true" className="block text-sm leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="rounded-[18px] bg-white/[0.03] px-4 py-3">
            <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-zinc-500">
              Size ({position.coin})
            </div>
            <input
              value={sizeInput}
              onChange={(event) => setSizeInput(event.target.value)}
              inputMode="decimal"
              className="w-full bg-transparent text-base font-medium text-zinc-100 outline-none"
            />
          </label>
          <label className="rounded-[18px] bg-white/[0.03] px-4 py-3">
            <div className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-zinc-500">
              Slippage Guard
            </div>
            <div className="flex items-center gap-2">
              <input
                value={slippageInput}
                onChange={(event) => setSlippageInput(event.target.value)}
                inputMode="decimal"
                className="w-full bg-transparent text-base font-medium text-zinc-100 outline-none"
              />
              <span className="text-sm text-zinc-500">%</span>
            </div>
          </label>
        </div>

        <div className="mt-4 rounded-[20px] border border-white/6 bg-white/[0.02] px-4 py-3 text-sm text-zinc-300">
          <div className="flex items-center justify-between gap-3">
            <span className="text-zinc-500">Est. notional</span>
            <span>{estimatedNotional !== null ? compactUsdFormatter.format(estimatedNotional) : "—"}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-zinc-500">Leverage</span>
            <span>
              {position.leverageValue}x {asset.onlyIsolated ? "isolated" : position.leverageType}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-zinc-500">Execution</span>
            <span>Market-style IOC</span>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-[18px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
        {lastStatus ? (
          <div className="mt-4 rounded-[18px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {lastStatus}
          </div>
        ) : null}

        <button
          type="button"
          disabled={busy || !Number.isFinite(parsedSize) || parsedSize <= 0}
          onClick={() => {
            void handleSubmit();
          }}
          className="mt-5 w-full rounded-[20px] bg-[var(--gold)] px-4 py-3 text-sm font-semibold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Submitting trade..." : `Copy ${sideLabel.toLowerCase()} position`}
        </button>
      </div>
    </div>
  );
}
