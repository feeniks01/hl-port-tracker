import { fetchClearinghouseState } from "../../data/api/portfolio";
import { getLivePosition } from "../../domain/utils/portfolioMath";
import type { AccountSummary, Position } from "../../domain/types/portfolio";
import { createStore } from "./createStore";

interface PortfolioState {
  address: string;
  summary: AccountSummary | null;
  positions: Position[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;
  hydrateFromStorage: () => void;
  clearPortfolio: () => void;
  setAddress: (address: string) => void;
  loadPortfolio: (address: string) => Promise<void>;
}

const STORAGE_KEY = "hyperliquid:last-address";
let latestPortfolioRequestId = 0;

function isValidAddress(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function toNumber(value: string | undefined) {
  return value ? Number(value) : 0;
}

export const usePortfolioStore = createStore<PortfolioState>((set) => ({
  address: "",
  summary: null,
  positions: [],
  loading: false,
  error: null,
  hydrated: false,
  hydrateFromStorage() {
    if (typeof window === "undefined") {
      return;
    }

    const storedAddress = window.localStorage.getItem(STORAGE_KEY)?.trim() ?? "";

    set({
      address: storedAddress,
      hydrated: true,
    });
  },
  clearPortfolio() {
    set({
      address: "",
      summary: null,
      positions: [],
      loading: false,
      error: null,
    });
  },
  setAddress(address) {
    set({ address });
  },
  async loadPortfolio(address) {
    const trimmed = address.trim();
    const requestId = latestPortfolioRequestId + 1;
    latestPortfolioRequestId = requestId;

    if (!isValidAddress(trimmed)) {
      set({
        address: trimmed,
        error: "Invalid address. Use a 42-character 0x wallet address.",
        summary: null,
        positions: [],
        loading: false,
      });
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    }

    set({ address: trimmed, loading: true, error: null });

    try {
      const state = await fetchClearinghouseState(trimmed);

      if (requestId !== latestPortfolioRequestId) {
        return;
      }

      const netEquity = Number(state.marginSummary.accountValue);
      const withdrawable = Number(state.withdrawable);
      const marginUsed = Number(state.marginSummary.totalMarginUsed);
      const notionalPosition = Number(state.marginSummary.totalNtlPos);
      const maintenanceMargin = Number(state.crossMaintenanceMarginUsed);

      const positions = state.assetPositions.map(({ position }) => ({
        coin: position.coin,
        size: Number(position.szi),
        entryPrice: Number(position.entryPx),
        markPrice:
          Number(position.positionValue) === 0 || Number(position.szi) === 0
            ? Number(position.entryPx)
            : Number(position.positionValue) / Math.abs(Number(position.szi)),
        marginUsed: Number(position.marginUsed),
        notionalValue: Number(position.positionValue),
        unrealizedPnl: Number(position.unrealizedPnl),
        maxLeverage: position.maxLeverage,
        leverageType: position.leverage.type,
        leverageValue: position.leverage.value,
        liquidationPrice: position.liquidationPx ? Number(position.liquidationPx) : null,
      }));

      set({
        address: trimmed,
        summary: {
          netEquity,
          withdrawable,
          marginUsed,
          notionalPosition,
          maintenanceMargin,
          leverage: netEquity > 0 ? notionalPosition / netEquity : null,
        },
        positions,
        loading: false,
        error: null,
      });
    } catch (error) {
      if (requestId !== latestPortfolioRequestId) {
        return;
      }

      set({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load portfolio state from Hyperliquid.",
      });
    }
  },
}));
