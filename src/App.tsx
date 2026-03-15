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
import { useTradeStore } from "./presentation/stores/tradeStore";
import type { MarketSortKey } from "./presentation/components/MarketList";

type TabId = "portfolio" | "markets";
const ACTIVE_TAB_STORAGE_KEY = "hyperliquid:active-tab";
const MAX_SHARED_CHART_SYMBOLS = 3;

interface UrlState {
  activeTab: TabId | null;
  address: string;
  chartSymbols: string[];
  marketDetailSymbol: string | null;
  portfolioDetailSymbol: string | null;
}

function parseUrlState(): UrlState {
  if (typeof window === "undefined") {
    return {
      activeTab: null,
      address: "",
      chartSymbols: [],
      marketDetailSymbol: null,
      portfolioDetailSymbol: null,
    };
  }

  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  const segments = pathname.split("/").filter(Boolean);
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const chartSymbols = (params.get("charts") ?? "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter((symbol, index, array) => symbol.length > 0 && array.indexOf(symbol) === index)
    .slice(0, MAX_SHARED_CHART_SYMBOLS);
  const queryAddress = params.get("address")?.trim() ?? "";
  const queryDetailSymbol = params.get("detail")?.trim() || null;

  if (segments[0] === "markets") {
    return {
      activeTab: "markets",
      address: queryAddress,
      chartSymbols,
      marketDetailSymbol: segments[1] ? decodeURIComponent(segments[1]).trim() : null,
      portfolioDetailSymbol: null,
    };
  }

  if (segments[0] === "portfolio") {
    return {
      activeTab: "portfolio",
      address: segments[1] ? decodeURIComponent(segments[1]).trim() : queryAddress,
      chartSymbols,
      marketDetailSymbol: null,
      portfolioDetailSymbol: queryDetailSymbol,
    };
  }

  return {
    activeTab: tab === "markets" || tab === "portfolio" ? tab : null,
    address: queryAddress,
    chartSymbols,
    marketDetailSymbol: null,
    portfolioDetailSymbol: queryDetailSymbol,
  };
}

function buildUrlLocation({
  activeTab,
  address,
  chartSymbols,
  marketDetailSymbol,
  portfolioDetailSymbol,
}: {
  activeTab: TabId;
  address: string;
  chartSymbols: string[];
  marketDetailSymbol: string | null;
  portfolioDetailSymbol: string | null;
}) {
  const trimmedAddress = address.trim();
  const pathname = activeTab === "markets"
    ? marketDetailSymbol
      ? `/markets/${encodeURIComponent(marketDetailSymbol)}`
      : "/markets"
    : trimmedAddress
      ? `/portfolio/${encodeURIComponent(trimmedAddress)}`
      : "/portfolio";
  const params = new URLSearchParams();

  if (
    chartSymbols.length > 0 &&
    !(chartSymbols.length === 1 && chartSymbols[0] === "BTC")
  ) {
    params.set("charts", chartSymbols.join(","));
  }

  if (activeTab === "portfolio" && portfolioDetailSymbol) {
    params.set("detail", portfolioDetailSymbol);
  }

  return {
    pathname,
    search: params.toString(),
  };
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
  const [marketDetailSymbol, setMarketDetailSymbol] = useState<string | null>(
    () => parseUrlState().marketDetailSymbol,
  );
  const [portfolioDetailSymbol, setPortfolioDetailSymbol] = useState<string | null>(
    () => parseUrlState().portfolioDetailSymbol,
  );
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const hasPushedUrlStateRef = useRef(false);
  const assets = useMarketStore((state) => state.assets);
  const marketLoading = useMarketStore((state) => state.loading);
  const marketError = useMarketStore((state) => state.error);
  const connectionStatus = useMarketStore((state) => state.connectionStatus);
  const mids = useMarketStore((state) => state.mids);

  const address = usePortfolioStore((state) => state.address);
  const recentAddresses = usePortfolioStore((state) => state.recentAddresses);
  const hydrated = usePortfolioStore((state) => state.hydrated);
  const summary = usePortfolioStore((state) => state.summary);
  const positions = usePortfolioStore((state) => state.positions);
  const portfolioError = usePortfolioStore((state) => state.error);
  const loading = usePortfolioStore((state) => state.loading);
  const loadPortfolio = usePortfolioStore((state) => state.loadPortfolio);
  const clearPortfolio = usePortfolioStore((state) => state.clearPortfolio);
  const setAddress = usePortfolioStore((state) => state.setAddress);
  const initializeTrade = useTradeStore((state) => state.initialize);

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
  const activeDetailSymbol = marketDetailSymbol ?? portfolioDetailSymbol;
  const detailAsset = useMemo(
    () => assets.find((asset) => asset.symbol === activeDetailSymbol) ?? null,
    [activeDetailSymbol, assets],
  );
  const detailPosition = useMemo(
    () => livePositions.find((position) => position.coin === activeDetailSymbol) ?? null,
    [activeDetailSymbol, livePositions],
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
    void initializeTrade();
  }, [initializeTrade]);

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
    if (!marketDetailSymbol) {
      return;
    }

    const existsInAssets = assets.some((asset) => asset.symbol === marketDetailSymbol);
    const existsInPositions = livePositions.some((position) => position.coin === marketDetailSymbol);

    if (!existsInAssets && !existsInPositions) {
      setMarketDetailSymbol(null);
    }
  }, [assets, livePositions, marketDetailSymbol]);

  useEffect(() => {
    if (!portfolioDetailSymbol) {
      return;
    }

    const existsInAssets = assets.some((asset) => asset.symbol === portfolioDetailSymbol);
    const existsInPositions = livePositions.some((position) => position.coin === portfolioDetailSymbol);

    if (!existsInAssets && !existsInPositions) {
      setPortfolioDetailSymbol(null);
    }
  }, [assets, livePositions, portfolioDetailSymbol]);

  useEffect(() => {
    const nextLocation = buildUrlLocation({
      activeTab,
      address,
      chartSymbols: selectedChartSymbols,
      marketDetailSymbol,
      portfolioDetailSymbol,
    });
    const nextSearch = nextLocation.search;
    const currentSearch = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;
    const currentPathname = window.location.pathname.replace(/\/+$/, "") || "/";

    if (nextLocation.pathname === currentPathname && nextSearch === currentSearch) {
      return;
    }

    const nextUrl = `${nextLocation.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;

    if (!hasPushedUrlStateRef.current) {
      window.history.replaceState(null, "", nextUrl);
      hasPushedUrlStateRef.current = true;
      return;
    }

    window.history.pushState(null, "", nextUrl);
  }, [activeTab, address, marketDetailSymbol, portfolioDetailSymbol, selectedChartSymbols]);

  useEffect(() => {
    const handlePopState = () => {
      const urlState = parseUrlState();

      setActiveTab(urlState.activeTab ?? "portfolio");
      setSelectedChartSymbols(urlState.chartSymbols.length > 0 ? urlState.chartSymbols : ["BTC"]);
      setChartSeededFromPosition(urlState.chartSymbols.length > 0);
      setMarketDetailSymbol(urlState.marketDetailSymbol);
      setPortfolioDetailSymbol(urlState.portfolioDetailSymbol);

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

  const openPositionDetail = (symbol: string) => {
    setSelectedChartSymbols((current) => {
      const withoutSymbol = current.filter((selected) => selected !== symbol);
      return [symbol, ...withoutSymbol].slice(0, 3);
    });
    setPortfolioDetailSymbol(symbol);
  };

  const openMarketDetail = (symbol: string) => {
    setActiveTab("markets");
    setMarketDetailSymbol(symbol);
  };

  const inspectWallet = (nextAddress: string) => {
    setActiveTab("portfolio");
    setAddress(nextAddress);
    setMarketDetailSymbol(null);
    setPortfolioDetailSymbol(null);
    setWalletModalOpen(false);
    void loadPortfolio(nextAddress);
  };

  return (
    <div className="flex min-h-screen justify-center bg-transparent px-5 pb-36 pt-6 text-zinc-100 sm:px-6">
      <main className="w-full max-w-[29rem]">
        {activeTab === "portfolio" ? (
          <>
            <ErrorBoundary label="Net equity" resetKey={liveSummary ? String(liveSummary.netEquity) : "empty"}>
              <Hero
                summary={liveSummary}
                currentAddress={address || undefined}
                walletOptions={recentAddresses}
                onWalletSelect={inspectWallet}
                onAddWallet={() => {
                  setActiveTab("portfolio");
                  setWalletModalOpen(true);
                }}
              />
            </ErrorBoundary>
            <ErrorBoundary label="Positions" resetKey={address}>
              <PositionsList
                positions={livePositions}
                loading={loading}
                hasAddress={Boolean(address)}
                onAssetSelect={openPositionDetail}
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
                    {summary || loading ? (
                      <AccountSummaryRows
                        summary={summary}
                        loading={loading}
                        bare
                      />
                    ) : null}
                  </div>
                </div>
              </section>
            </ErrorBoundary>
          </>
        ) : marketDetailSymbol ? (
          <ErrorBoundary label="Market detail" resetKey={marketDetailSymbol}>
            <AssetDetailSheet
              symbol={marketDetailSymbol}
              asset={detailAsset}
              position={detailPosition}
              sourceAddress={address || null}
              onClose={() => setMarketDetailSymbol(null)}
              modal={false}
            />
          </ErrorBoundary>
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
                onAssetSelect={openMarketDetail}
                onWalletInspect={inspectWallet}
              />
            </>
          </ErrorBoundary>
        )}
      </main>
      {portfolioDetailSymbol ? (
        <ErrorBoundary label="Asset detail" resetKey={portfolioDetailSymbol}>
          <AssetDetailSheet
            symbol={portfolioDetailSymbol}
            asset={detailAsset}
            position={detailPosition}
            sourceAddress={address || null}
            onClose={() => setPortfolioDetailSymbol(null)}
          />
        </ErrorBoundary>
      ) : null}
      {walletModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-[1px]">
          <div className="panel w-full max-w-md rounded-[28px] p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                Add Wallet
              </div>
              <button
                type="button"
                onClick={() => setWalletModalOpen(false)}
                className="p-1 text-2xl leading-none text-zinc-400 transition hover:text-zinc-100"
                aria-label="Close add wallet"
              >
                ×
              </button>
            </div>
            {portfolioError ? (
              <div className="mb-4 rounded-[18px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {portfolioError}
              </div>
            ) : null}
            <AddressInput
              address=""
              loading={loading}
              connected={false}
              bare
              forceExpanded
              onSubmit={(nextAddress) => {
                setAddress(nextAddress);
                if (/^0x[a-fA-F0-9]{40}$/.test(nextAddress.trim())) {
                  setWalletModalOpen(false);
                }
                void loadPortfolio(nextAddress);
              }}
            />
          </div>
        </div>
      ) : null}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);

          if (tab === "markets") {
            setPortfolioDetailSymbol(null);
            return;
          }

          setMarketDetailSymbol(null);
        }}
      />
    </div>
  );
}

export default App;
