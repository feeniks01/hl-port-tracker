import type { ConnectionStatus } from "../../domain/types/market";

const LABELS: Record<ConnectionStatus, string> = {
  idle: "Waiting",
  connecting: "Connecting",
  connected: "Live",
  reconnecting: "Reconnecting",
  disconnected: "Prices Offline",
};

const COLORS: Record<ConnectionStatus, string> = {
  idle: "bg-zinc-500/20 text-zinc-300",
  connecting: "bg-amber-500/20 text-amber-200",
  connected: "bg-emerald-500/20 text-emerald-200",
  reconnecting: "bg-amber-500/20 text-amber-200",
  disconnected: "bg-amber-500/16 text-amber-200",
};

interface ConnectionPillProps {
  status: ConnectionStatus;
}

export function ConnectionPill({ status }: ConnectionPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-[0.16em] ${COLORS[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
