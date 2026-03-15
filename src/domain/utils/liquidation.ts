import type { Position } from "../types/portfolio";

export function getLiquidationDistancePct(position: Position) {
  if (!position.liquidationPrice || position.markPrice <= 0) {
    return null;
  }

  const isLong = position.size >= 0;
  const rawDistance = isLong
    ? position.markPrice - position.liquidationPrice
    : position.liquidationPrice - position.markPrice;

  return Math.abs((rawDistance / position.markPrice) * 100);
}

export function getLiquidationRisk(distancePct: number | null) {
  if (distancePct === null) {
    return null;
  }

  if (distancePct <= 5) {
    return {
      label: "Danger",
      toneClass: "text-rose-200",
      barClass: "bg-rose-500",
      markerPct: 12,
    };
  }

  if (distancePct <= 15) {
    return {
      label: "Caution",
      toneClass: "text-amber-200",
      barClass: "bg-amber-400",
      markerPct: 38,
    };
  }

  return {
    label: "Safe",
    toneClass: "text-emerald-200",
    barClass: "bg-emerald-400",
    markerPct: Math.min(92, Math.max(56, distancePct * 2.8)),
  };
}

export function getEstimatedHoursToLiq(position: Position, hourlyVolatility: number | null | undefined) {
  if (!position.liquidationPrice || !hourlyVolatility || hourlyVolatility <= 0 || position.markPrice <= 0) {
    return null;
  }

  const distanceFraction =
    Math.abs(position.markPrice - position.liquidationPrice) / position.markPrice;
  const estimatedHours = (distanceFraction / hourlyVolatility) ** 2;

  if (!Number.isFinite(estimatedHours)) {
    return null;
  }

  return Math.max(0, Math.min(estimatedHours, 24 * 45));
}

export function formatEstimatedTime(hours: number | null) {
  if (hours === null) {
    return "—";
  }

  if (hours < 1) {
    return "<1h";
  }

  if (hours < 24) {
    return `~${Math.round(hours)}h`;
  }

  const days = hours / 24;

  if (days <= 30) {
    return `~${days >= 10 ? Math.round(days) : days.toFixed(1)}d`;
  }

  return ">30d";
}
