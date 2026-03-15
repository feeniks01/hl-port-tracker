import { useEffect, useMemo, useRef, useState } from "react";

import { Hero } from "./presentation/components/Hero";
import { PositionsList } from "./presentation/components/PositionsList";
import { AddressInput } from "./presentation/components/AddressInput";
import { AccountSummaryRows } from "./presentation/components/AccountSummaryRows";
import { MarketList } from "./presentation/components/MarketList";
import { BottomNav } from "./presentation/components/BottomNav";
import { SectionHeading } from "./presentation/components/SectionHeading";
import { PriceChart } from "./presentation/components/PriceChart";
import { ErrorBoundary } from "./presentation/components/ErrorBoundary";
import { AssetDetailSheet } from "./presentation/components/AssetDetailSheet";
import { useBootstrap } from "./presentation/hooks/useBootstrap";
import { getLivePosition, getLiveSummary } from "./domain/utils/portfolioMath";
import { useMarketStore } from "./presentation/stores/marketStore";
import { usePortfolioStore } from "./presentation/stores/portfolioStore";
import type { MarketSortKey } from "./presentation/components/MarketList";

type TabId = "portfolio" | "markets";
const ACTIVE_TAB_STORAGE_KEY = "hyperliquid:active-tab";
const MAX_SHARED_CHART_SYMBOLS = 3;

interface UrlState {
  activeTab: TabId | null;
  address: string;
  chartSymbols: string[];
  detailSymbol: string | null;
}

function parseUrlState(): UrlState {
  if (typeof window === "undefined") {
    return {
      activeTab: null,
      address: "",
      chartSymbols: [],
      detailSymbol: null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const chartSymbols = (params.get("charts") ?? "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter((symbol, index, array) => symbol.length > 0 && array.indexOf(symbol) === index)
    .slice(0, MAX_SHARED_CHART_SYMBOLS);
  const detailSymbol = params.get("detail")?.trim() || null;

  return {
    activeTab: tab === "markets" || tab === "portfolio" ? tab : null,
    address: params.get("address")?.trim() ?? "",
    chartSymbols,
    detailSymbol,
  };
}

function buildUrlSearch({
  activeTab,
  address,
  chartSymbols,
  detailSymbol,
}: {
  activeTab: TabId;
  address: string;
  chartSymbols: string[];
  detailSymbol: string | null;
}) {
  const params = new URLSearchParams();

  if (activeTab !== "portfolio") {
    params.set("tab", activeTab);
  }

  if (address.trim()) {
    params.set("address", address.trim());
  }

  if (
    chartSymbols.length > 0 &&
    !(chartSymbols.length === 1 && chartSymbols[0] === "BTC")
  ) {
    params.set("charts", chartSymbols.join(","));
  }

  if (detailSymbol) {
    params.set("detail", detailSymbol);
  }

  return params.toString();
}

function App() {
  useBootstrap();

  const [restoredAddressLoaded, setRestoredAddressLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === "undefined") {
      return "portfolio";
    }

    const urlState = parseUrlState();
    if (urlState.activeTab) {
      return urlState.activeTab;
    }

    const storedTab = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    return storedTab === "markets" ? "markets" : "portfolio";
  });
  const [marketQuery, setMarketQuery] = useState("");
  const [marketSortKey, setMarketSortKey] = useState<MarketSortKey>("openInterest");
  const [showDelisted, setShowDelisted] = useState(false);
  const initialUrlState = useMemo(() => parseUrlState(), []);
  const [selectedChartSymbols, setSelectedChartSymbols] = useState<string[]>(() => {
    const urlState = parseUrlState();
    return urlState.chartSymbols.length > 0 ? urlState.chartSymbols : ["BTC"];
  });
  const [chartSeededFromPosition, setChartSeededFromPosition] = useState(
    initialUrlState.chartSymbols.length > 0,
  );
  const [detailSymbol, setDetailSymbol] = useState<string | null>(() => parseUrlState().detailSymbol);
  const hasPushedUrlStateRef = useRef(false);
  const assets = useMarketStore((state) => state.assets);
  const marketLoading = useMarketStore((state) => state.loading);
  const marketError = useMarketStore((state) => state.error);
  const connectionStatus = useMarketStore((state) => state.connectionStatus);
  const mids = useMarketStore((state) => state.mids);

  const address = usePortfolioStore((state) => state.address);
  const hydrated = usePortfolioStore((state) => state.hydrated);
  const summary = usePortfolioStore((state) => state.summary);
  const positions = usePortfolioStore((state) => state.positions);
  const portfolioError = usePortfolioStore((state) => state.error);
  const loading = usePortfolioStore((state) => state.loading);
  const loadPortfolio = usePortfolioStore((state) => state.loadPortfolio);
  const clearPortfolio = usePortfolioStore((state) => state.clearPortfolio);
  const setAddress = usePortfolioStore((state) => state.setAddress);

  const livePositions = useMemo(
    () => positions.map((position) => getLivePosition(position, mids)),
    [mids, positions],
  );
  const liveSummary = useMemo(
    () => getLiveSummary(summary, positions, livePositions),
    [livePositions, positions, summary],
  );
  const primaryChartSymbol = selectedChartSymbols[0] ?? null;
  const visibleAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (!showDelisted && asset.isDelisted) {
        return false;
      }

      return true;
    });
  }, [assets, showDelisted]);
  const currentChartAsset = useMemo(
    () => assets.find((asset) => asset.symbol === primaryChartSymbol) ?? null,
    [assets, primaryChartSymbol],
  );
  const currentChartPosition = useMemo(
    () => livePositions.find((position) => position.coin === primaryChartSymbol) ?? null,
    [livePositions, primaryChartSymbol],
  );
  const detailAsset = useMemo(
    () => assets.find((asset) => asset.symbol === detailSymbol) ?? null,
    [assets, detailSymbol],
  );
  const detailPosition = useMemo(
    () => livePositions.find((position) => position.coin === detailSymbol) ?? null,
    [detailSymbol, livePositions],
  );
  const assetMap = useMemo(
    () => Object.fromEntries(assets.map((asset) => [asset.symbol, asset] as const)),
    [assets],
  );
  const chartSymbols = useMemo(() => {
    const preferred = [...positions.map((position) => position.coin), "BTC", "ETH", "SOL", "HYPE"];
    return preferred.filter((symbol, index) => {
      if (preferred.indexOf(symbol) !== index) {
        return false;
      }

      return assets.some((asset) => asset.symbol === symbol);
    });
  }, [assets, positions]);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    setChartSeededFromPosition(false);
  }, [address]);

  useEffect(() => {
    if (!hydrated || restoredAddressLoaded) {
      return;
    }

    const urlState = parseUrlState();
    setRestoredAddressLoaded(true);

    if (urlState.address) {
      setAddress(urlState.address);
      void loadPortfolio(urlState.address);
      return;
    }

    if (address) {
      void loadPortfolio(address);
    }
  }, [address, hydrated, loadPortfolio, restoredAddressLoaded, setAddress]);

  useEffect(() => {
    if (chartSeededFromPosition || positions.length === 0) {
      return;
    }

    setSelectedChartSymbols([positions[0].coin]);
    setChartSeededFromPosition(true);
  }, [chartSeededFromPosition, positions]);

  useEffect(() => {
    if (chartSymbols.length === 0) {
      return;
    }

    const nextSelected = selectedChartSymbols.filter((symbol) => chartSymbols.includes(symbol));

    if (nextSelected.length !== selectedChartSymbols.length) {
      setSelectedChartSymbols(nextSelected.length > 0 ? nextSelected : [chartSymbols[0]]);
      return;
    }

    if (nextSelected.length === 0) {
      setSelectedChartSymbols([chartSymbols[0]]);
    }
  }, [chartSymbols, selectedChartSymbols]);

  useEffect(() => {
    if (!detailSymbol) {
      return;
    }

    const existsInAssets = assets.some((asset) => asset.symbol === detailSymbol);
    const existsInPositions = livePositions.some((position) => position.coin === detailSymbol);

    if (!existsInAssets && !existsInPositions) {
      setDetailSymbol(null);
    }
  }, [assets, detailSymbol, livePositions]);

  useEffect(() => {
    const nextSearch = buildUrlSearch({
      activeTab,
      address,
      chartSymbols: selectedChartSymbols,
      detailSymbol,
    });
    const currentSearch = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;

    if (nextSearch === currentSearch) {
      return;
    }

    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;

    if (!hasPushedUrlStateRef.current) {
      window.history.replaceState(null, "", nextUrl);
      hasPushedUrlStateRef.current = true;
      return;
    }

    window.history.pushState(null, "", nextUrl);
  }, [activeTab, address, detailSymbol, selectedChartSymbols]);

  useEffect(() => {
    const handlePopState = () => {
      const urlState = parseUrlState();

      setActiveTab(urlState.activeTab ?? "portfolio");
      setSelectedChartSymbols(urlState.chartSymbols.length > 0 ? urlState.chartSymbols : ["BTC"]);
      setChartSeededFromPosition(urlState.chartSymbols.length > 0);
      setDetailSymbol(urlState.detailSymbol);

      if (urlState.address) {
        setAddress(urlState.address);
        void loadPortfolio(urlState.address);
        return;
      }

      clearPortfolio();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [clearPortfolio, loadPortfolio, setAddress]);

  const openAssetDetail = (symbol: string) => {
    setSelectedChartSymbols((current) => {
      const withoutSymbol = current.filter((selected) => selected !== symbol);
      return [symbol, ...withoutSymbol].slice(0, 3);
    });
    setDetailSymbol(symbol);
  };

  return (
    <div className="min-h-screen bg-transparent px-4 pb-36 pt-6 text-zinc-100">
      <main className="mx-auto max-w-[32rem]">
        <ErrorBoundary label="Net equity" resetKey={liveSummary ? String(liveSummary.netEquity) : "empty"}>
          <Hero summary={liveSummary} />
        </ErrorBoundary>

        {activeTab === "portfolio" ? (
          <>
            <ErrorBoundary label="Positions" resetKey={address}>
              <PositionsList
                positions={livePositions}
                loading={loading}
                hasAddress={Boolean(address)}
                onAssetSelect={openAssetDetail}
              />
            </ErrorBoundary>
            {chartSymbols.length > 0 ? (
              <ErrorBoundary
                label="Price history"
                resetKey={`${selectedChartSymbols.join(",")}:${chartSymbols.join("|")}`}
              >
                <PriceChart
                  availableSymbols={chartSymbols}
                  selectedSymbols={selectedChartSymbols}
                  onSelectedSymbolsChange={setSelectedChartSymbols}
                  currentAsset={currentChartAsset}
                  assetMap={assetMap}
                  currentPosition={currentChartPosition}
                />
              </ErrorBoundary>
            ) : null}
            <ErrorBoundary label="Account" resetKey={address}>
              <section className="mb-8">
                <SectionHeading title="Account" />
                <div className="space-y-4">
                  {portfolioError ? (
                    <div className="rounded-[20px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                      {portfolioError}
                    </div>
                  ) : null}
                  <div className="panel rounded-[28px] p-5">
                    <AddressInput
                      address={address}
                      loading={loading}
                      connected={Boolean(summary && address)}
                      bare
                      onSubmit={(nextAddress) => {
                        setAddress(nextAddress);
                        void loadPortfolio(nextAddress);
                      }}
                    />
                    {summary || loading ? (
                      <div className="mt-5 border-t border-white/6 pt-5">
                        <AccountSummaryRows
                          summary={summary}
                          loading={loading}
                          bare
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            </ErrorBoundary>
          </>
        ) : (
          <ErrorBoundary
            label="Markets"
            resetKey={`${marketQuery}:${marketSortKey}:${showDelisted ? "1" : "0"}`}
          >
            <>
              {marketError ? (
                <div className="mb-4 rounded-[20px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {marketError}
                </div>
              ) : null}
              <MarketList
                assets={visibleAssets}
                status={connectionStatus}
                searchQuery={marketQuery}
                sortKey={marketSortKey}
                showDelisted={showDelisted}
                loading={marketLoading}
                onSearchQueryChange={setMarketQuery}
                onSortKeyChange={setMarketSortKey}
                onShowDelistedChange={setShowDelisted}
                onAssetSelect={openAssetDetail}
              />
            </>
          </ErrorBoundary>
        )}
      </main>
      {detailSymbol ? (
        <ErrorBoundary label="Asset detail" resetKey={detailSymbol}>
          <AssetDetailSheet
            symbol={detailSymbol}
            asset={detailAsset}
            position={detailPosition}
            onClose={() => setDetailSymbol(null)}
          />
        </ErrorBoundary>
      ) : null}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
