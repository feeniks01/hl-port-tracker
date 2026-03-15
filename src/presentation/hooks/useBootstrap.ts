import { useEffect } from "react";

import { createPriceStream } from "../../data/ws/prices";
import { useMarketStore } from "../stores/marketStore";
import { usePortfolioStore } from "../stores/portfolioStore";

export function useBootstrap() {
  const initialize = useMarketStore((state) => state.initialize);
  const applyMids = useMarketStore((state) => state.applyMids);
  const setConnectionStatus = useMarketStore((state) => state.setConnectionStatus);
  const setError = useMarketStore((state) => state.setError);
  const hydrateFromStorage = usePortfolioStore((state) => state.hydrateFromStorage);

  useEffect(() => {
    void initialize();
    hydrateFromStorage();

    const stream = createPriceStream({
      onMids: applyMids,
      onStatusChange: (status) => {
        setConnectionStatus(status);

        if (status === "connected") {
          setError(null);
        }
      },
      onError: (message) => setError(message),
    });

    return () => {
      stream.disconnect();
    };
  }, [applyMids, hydrateFromStorage, initialize, setConnectionStatus, setError]);
}
