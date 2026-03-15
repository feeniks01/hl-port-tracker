import { useEffect, useMemo, useState } from "react";

import type { Position } from "../../domain/types/portfolio";
import { loadCandleSeriesByInterval } from "./useCandleSeries";

function getHourlyVolatility(closes: number[]) {
  if (closes.length < 6) {
    return null;
  }

  const returns = closes
    .slice(1)
    .map((close, index) => {
      const previous = closes[index];

      if (close <= 0 || previous <= 0) {
        return null;
      }

      return Math.log(close / previous);
    })
    .filter((value): value is number => value !== null);

  if (returns.length < 5) {
    return null;
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  const volatility = Math.sqrt(variance);

  return Number.isFinite(volatility) && volatility > 0 ? volatility : null;
}

export function useHourlyVolatility(positions: Position[]) {
  const symbols = useMemo(
    () =>
      positions
        .filter((position) => position.liquidationPrice)
        .map((position) => position.coin)
        .filter((symbol, index, array) => array.indexOf(symbol) === index),
    [positions],
  );
  const symbolsKey = symbols.join("|");
  const [volatilityMap, setVolatilityMap] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (symbols.length === 0) {
      setVolatilityMap({});
      return;
    }

    let cancelled = false;

    void Promise.all(
      symbols.map(async (symbol) => {
        try {
          const candles = await loadCandleSeriesByInterval(
            symbol,
            "1h",
            24 * 60 * 60 * 1000,
            "volatility-1h",
          );
          const closes = candles.map((candle) => candle.close);

          return [symbol, getHourlyVolatility(closes)] as const;
        } catch {
          return [symbol, null] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) {
        return;
      }

      setVolatilityMap(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [symbolsKey]);

  return volatilityMap;
}
