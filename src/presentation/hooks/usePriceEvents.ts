import { useEffect, useState } from "react";

import { fetchPriceEvents } from "../../data/api/news";
import type { ChartRangeKey, PriceEvent } from "../../domain/types/chart";

interface PriceEventsState {
  events: PriceEvent[];
  loading: boolean;
  error: string | null;
}

export function usePriceEvents(symbols: string[], range: ChartRangeKey) {
  const [state, setState] = useState<PriceEventsState>({
    events: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (symbols.length === 0) {
      setState({
        events: [],
        loading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;
    const symbolsKey = symbols.join("|");

    setState((current) => ({
      events: current.events,
      loading: true,
      error: null,
    }));

    void fetchPriceEvents(symbols, range)
      .then((events) => {
        if (cancelled) {
          return;
        }

        setState({
          events,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setState((current) => ({
          events: current.events,
          loading: false,
          error: null,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [range, symbols.join("|")]);

  return state;
}
