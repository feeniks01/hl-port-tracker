import type { AccountSummary } from "../../domain/types/portfolio";

const numberFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

interface AccountSummaryRowsProps {
  summary: AccountSummary | null;
  loading: boolean;
  bare?: boolean;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-zinc-100">{value}</span>
    </div>
  );
}

export function AccountSummaryRows({
  summary,
  loading,
  bare = false,
}: AccountSummaryRowsProps) {
  return (
    <div className={bare ? "" : "panel rounded-[28px] p-5"}>
      <div className="divide-y divide-white/6">
        <SummaryRow
          label="Equity"
          value={loading ? "Loading..." : summary ? numberFormatter.format(summary.netEquity) : "—"}
        />
        <SummaryRow
          label="Withdrawable"
          value={loading ? "Loading..." : summary ? numberFormatter.format(summary.withdrawable) : "—"}
        />
        <SummaryRow
          label="Margin Used"
          value={loading ? "Loading..." : summary ? numberFormatter.format(summary.marginUsed) : "—"}
        />
        <SummaryRow
          label="Maintenance"
          value={
            loading
              ? "Loading..."
              : summary
                ? numberFormatter.format(summary.maintenanceMargin)
                : "—"
          }
        />
        <SummaryRow
          label="Notional"
          value={
            loading
              ? "Loading..."
              : summary
                ? numberFormatter.format(summary.notionalPosition)
                : "—"
          }
        />
        <SummaryRow
          label="Leverage"
          value={
            loading
              ? "Loading..."
              : summary?.leverage !== null && summary?.leverage !== undefined
                ? `${summary.leverage.toFixed(2)}x`
                : "—"
          }
        />
      </div>
    </div>
  );
}
