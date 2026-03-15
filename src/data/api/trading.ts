import { ExchangeClient, HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { formatPrice, formatSize } from "@nktkas/hyperliquid/utils";
import { BrowserProvider, Wallet } from "ethers";

const transport = new HttpTransport();
const infoClient = new InfoClient({ transport });
const AGENT_STORAGE_PREFIX = "hyperliquid:trade-agent:";
const PREFERRED_WALLET_STORAGE_KEY = "hyperliquid:preferred-evm-wallet";

interface StoredAgent {
  privateKey: `0x${string}`;
  name: string;
  createdAt: number;
}

export interface TradeSession {
  walletAddress: `0x${string}`;
  agentAddress: `0x${string}`;
  agentName: string;
  approved: boolean;
}

export interface CopyTradeRequest {
  walletAddress: `0x${string}`;
  assetIndex: number;
  sizeDecimals: number;
  size: number;
  referencePrice: number;
  side: "long" | "short";
  leverage: number;
  leverageType: string;
  slippagePercent: number;
}

export interface CopyTradeResult {
  orderId: number | null;
  averagePrice: string | null;
  status: string;
}

function normalizeAddress(address: string) {
  return address.toLowerCase() as `0x${string}`;
}

function getStorageKey(walletAddress: string) {
  return `${AGENT_STORAGE_PREFIX}${normalizeAddress(walletAddress)}`;
}

function getProviderLabel(provider: EthereumProvider | undefined) {
  if (!provider) {
    return "wallet";
  }

  if (provider.isRabby) {
    return "rabby";
  }

  if (provider.isMetaMask) {
    return "metamask";
  }

  if (provider.isCoinbaseWallet) {
    return "coinbase";
  }

  if (provider.isTrust || provider.isTrustWallet) {
    return "trust";
  }

  if (provider.isPhantom) {
    return "phantom";
  }

  return "wallet";
}

function rememberPreferredProvider(provider: EthereumProvider) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PREFERRED_WALLET_STORAGE_KEY, getProviderLabel(provider));
}

function rankProvider(provider: EthereumProvider) {
  const label = getProviderLabel(provider);
  const preferredLabel = typeof window === "undefined"
    ? null
    : window.localStorage.getItem(PREFERRED_WALLET_STORAGE_KEY);

  if (preferredLabel && label === preferredLabel) {
    return 100;
  }

  switch (label) {
    case "rabby":
      return 90;
    case "metamask":
      return 80;
    case "coinbase":
      return 70;
    case "trust":
      return 60;
    case "phantom":
      return 10;
    default:
      return 40;
  }
}

function getEthereumProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No injected wallet found. Install MetaMask or another EVM wallet.");
  }

  const providers = window.ethereum.providers?.length
    ? window.ethereum.providers
    : [window.ethereum];

  const ranked = [...providers].sort((left, right) => rankProvider(right) - rankProvider(left));
  return ranked[0];
}

function toFriendlyWalletError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    Number((error as { code?: unknown }).code) === -32002
  ) {
    return new Error(
      "A wallet connection request is already pending. Open the wallet extension you clicked earlier and reject or finish it, then try again.",
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Unable to connect wallet.");
}

async function getBrowserSigner(requestAccess: boolean) {
  const injectedProvider = getEthereumProvider();
  const provider = new BrowserProvider(injectedProvider);

  if (requestAccess) {
    try {
      await provider.send("eth_requestAccounts", []);
      rememberPreferredProvider(injectedProvider);
    } catch (error) {
      throw toFriendlyWalletError(error);
    }
  }

  return provider.getSigner();
}

function readStoredAgent(walletAddress: string): StoredAgent | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getStorageKey(walletAddress));

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAgent>;
    if (typeof parsed.privateKey !== "string" || typeof parsed.name !== "string") {
      return null;
    }

    return {
      privateKey: parsed.privateKey as `0x${string}`,
      name: parsed.name,
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
    };
  } catch {
    return null;
  }
}

function createStoredAgent(walletAddress: string) {
  const agentWallet = Wallet.createRandom();
  const storedAgent: StoredAgent = {
    privateKey: agentWallet.privateKey as `0x${string}`,
    name: `plt-${agentWallet.address.slice(2, 10).toLowerCase()}`,
    createdAt: Date.now(),
  };

  window.localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(storedAgent));
  return storedAgent;
}

function getOrCreateStoredAgent(walletAddress: string) {
  return readStoredAgent(walletAddress) ?? createStoredAgent(walletAddress);
}

async function isAgentApproved(
  walletAddress: `0x${string}`,
  agentAddress: `0x${string}`,
) {
  const extraAgents = await infoClient.extraAgents({ user: walletAddress });
  const now = Date.now();

  return extraAgents.some((agent) => {
    if (normalizeAddress(agent.address) !== normalizeAddress(agentAddress)) {
      return false;
    }

    return !Number.isFinite(agent.validUntil) || agent.validUntil > now;
  });
}

async function buildTradeSession(walletAddress: `0x${string}`): Promise<TradeSession> {
  const storedAgent = getOrCreateStoredAgent(walletAddress);
  const agentWallet = new Wallet(storedAgent.privateKey);
  const agentAddress = normalizeAddress(agentWallet.address);
  const approved = await isAgentApproved(walletAddress, agentAddress);

  return {
    walletAddress,
    agentAddress,
    agentName: storedAgent.name,
    approved,
  };
}

export async function restoreTradeSession() {
  if (typeof window === "undefined" || !window.ethereum) {
    return null;
  }

  const provider = getEthereumProvider();
  const accounts = (await provider.request({
    method: "eth_accounts",
  })) as string[];
  const firstAccount = accounts[0];

  if (!firstAccount) {
    return null;
  }

  return buildTradeSession(normalizeAddress(firstAccount));
}

export async function connectTradeWallet() {
  const signer = await getBrowserSigner(true);
  const address = normalizeAddress(await signer.getAddress());
  return buildTradeSession(address);
}

export async function enableTradeAgent(walletAddress: `0x${string}`) {
  const signer = await getBrowserSigner(true);
  const session = await buildTradeSession(walletAddress);
  const exchange = new ExchangeClient({ transport, wallet: signer });

  await exchange.approveAgent({
    agentAddress: session.agentAddress,
    agentName: session.agentName,
  });

  return {
    ...session,
    approved: true,
  };
}

export async function submitCopyTrade({
  walletAddress,
  assetIndex,
  sizeDecimals,
  size,
  referencePrice,
  side,
  leverage,
  leverageType,
  slippagePercent,
}: CopyTradeRequest): Promise<CopyTradeResult> {
  const storedAgent = readStoredAgent(walletAddress);

  if (!storedAgent) {
    throw new Error("No trade agent found for this wallet. Enable one-tap trading first.");
  }

  const agentWallet = new Wallet(storedAgent.privateKey);
  const approved = await isAgentApproved(walletAddress, normalizeAddress(agentWallet.address));

  if (!approved) {
    throw new Error("Trade agent approval not found. Re-enable one-tap trading.");
  }

  const exchange = new ExchangeClient({ transport, wallet: agentWallet });
  const orderSize = formatSize(Math.abs(size), sizeDecimals);

  if (Number(orderSize) <= 0) {
    throw new Error("Order size is too small for this market.");
  }

  const guardMultiplier = side === "long"
    ? 1 + slippagePercent / 100
    : 1 - slippagePercent / 100;
  const orderPrice = formatPrice(referencePrice * guardMultiplier, sizeDecimals);

  await exchange.updateLeverage({
    asset: assetIndex,
    isCross: leverageType.toLowerCase() === "cross",
    leverage: Math.max(1, Math.round(leverage)),
  });

  const result = await exchange.order({
    orders: [
      {
        a: assetIndex,
        b: side === "long",
        p: orderPrice,
        s: orderSize,
        r: false,
        t: { limit: { tif: "FrontendMarket" } },
      },
    ],
    grouping: "na",
  });

  const firstStatus = result.response.data.statuses[0];

  if (typeof firstStatus === "string") {
    return {
      orderId: null,
      averagePrice: null,
      status: firstStatus,
    };
  }

  if ("error" in firstStatus) {
    throw new Error(String(firstStatus.error));
  }

  if ("filled" in firstStatus) {
    return {
      orderId: firstStatus.filled.oid,
      averagePrice: firstStatus.filled.avgPx,
      status: "filled",
    };
  }

  return {
    orderId: firstStatus.resting.oid,
    averagePrice: null,
    status: "resting",
  };
}
