import {
  connectTradeWallet,
  enableTradeAgent,
  restoreTradeSession,
  submitCopyTrade,
  type CopyTradeRequest,
} from "../../data/api/trading";
import { createStore } from "./createStore";

type ApprovalStatus = "disconnected" | "checking" | "needsApproval" | "approved";

interface TradeState {
  walletAddress: `0x${string}` | null;
  agentAddress: `0x${string}` | null;
  agentName: string | null;
  approvalStatus: ApprovalStatus;
  initializing: boolean;
  busy: boolean;
  error: string | null;
  lastStatus: string | null;
  initialize: () => Promise<void>;
  connectWallet: () => Promise<void>;
  enableOneTapTrading: () => Promise<void>;
  submitCopyTrade: (request: Omit<CopyTradeRequest, "walletAddress">) => Promise<boolean>;
  clearError: () => void;
  disconnect: () => void;
}

export const useTradeStore = createStore<TradeState>((set, get) => ({
  walletAddress: null,
  agentAddress: null,
  agentName: null,
  approvalStatus: "disconnected",
  initializing: false,
  busy: false,
  error: null,
  lastStatus: null,
  async initialize() {
    if (get().initializing || get().walletAddress) {
      return;
    }

    set({ initializing: true, error: null });

    try {
      const session = await restoreTradeSession();

      if (!session) {
        set({
          initializing: false,
          approvalStatus: "disconnected",
        });
        return;
      }

      set({
        walletAddress: session.walletAddress,
        agentAddress: session.agentAddress,
        agentName: session.agentName,
        approvalStatus: session.approved ? "approved" : "needsApproval",
        initializing: false,
        error: null,
      });
    } catch (error) {
      set({
        initializing: false,
        approvalStatus: "disconnected",
        error: error instanceof Error ? error.message : "Unable to restore trading wallet.",
      });
    }
  },
  async connectWallet() {
    set({ busy: true, error: null, lastStatus: null });

    try {
      const session = await connectTradeWallet();
      set({
        walletAddress: session.walletAddress,
        agentAddress: session.agentAddress,
        agentName: session.agentName,
        approvalStatus: session.approved ? "approved" : "needsApproval",
        busy: false,
      });
    } catch (error) {
      set({
        busy: false,
        error: error instanceof Error ? error.message : "Unable to connect wallet.",
      });
    }
  },
  async enableOneTapTrading() {
    const walletAddress = get().walletAddress;

    if (!walletAddress) {
      throw new Error("Connect a wallet before enabling one-tap trading.");
    }

    set({ busy: true, error: null, lastStatus: null, approvalStatus: "checking" });

    try {
      const session = await enableTradeAgent(walletAddress);
      set({
        agentAddress: session.agentAddress,
        agentName: session.agentName,
        approvalStatus: "approved",
        busy: false,
        lastStatus: "One-tap trading enabled.",
      });
    } catch (error) {
      set({
        busy: false,
        approvalStatus: "needsApproval",
        error: error instanceof Error ? error.message : "Unable to approve trade agent.",
      });
    }
  },
  async submitCopyTrade(request) {
    const walletAddress = get().walletAddress;

    if (!walletAddress) {
      throw new Error("Connect a wallet before placing a trade.");
    }

    set({ busy: true, error: null, lastStatus: null });

    try {
      const result = await submitCopyTrade({
        walletAddress,
        ...request,
      });
      set({
        busy: false,
        lastStatus:
          result.status === "filled"
            ? `Trade filled${result.averagePrice ? ` @ ${result.averagePrice}` : ""}.`
            : `Trade submitted: ${result.status}.`,
      });
      return true;
    } catch (error) {
      set({
        busy: false,
        error: error instanceof Error ? error.message : "Unable to place trade.",
      });
      return false;
    }
  },
  clearError() {
    set({ error: null, lastStatus: null });
  },
  disconnect() {
    set({
      walletAddress: null,
      agentAddress: null,
      agentName: null,
      approvalStatus: "disconnected",
      busy: false,
      error: null,
      lastStatus: null,
    });
  },
}));
