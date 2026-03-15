import { useEffect, useState } from "react";

import {
  fetchLeaderboardWallets,
  type LeaderboardWallet,
} from "../../data/api/leaderboard";

export function useLeaderboardWallets() {
  const [wallets, setWallets] = useState<LeaderboardWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchLeaderboardWallets()
      .then((nextWallets) => {
        if (cancelled) {
          return;
        }

        setWallets(nextWallets);
        setLoading(false);
        setError(null);
      })
      .catch((nextError) => {
        if (cancelled) {
          return;
        }

        setLoading(false);
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to load Hyperliquid leaderboard.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { wallets, loading, error };
}
