const LEADERBOARD_ENDPOINT = "https://stats-data.hyperliquid.xyz/Mainnet/leaderboard";
const CACHE_TTL_MS = 60_000;
const EXCLUDED_LEADERBOARD_ADDRESSES = new Set([
  "0x574bafce69d9411f662a433896e74e4f153096fa",
  "0x8dafbe89302656a7df43c470e9ebcb4c540835c0",
  "0xa822a9ceb6d6cb5b565bd10098abcfa9cf18d748",
  "0xe6111266afdcdf0b1fe8505028cc1f7419d798a7",
  "0x24de6b77e8bc31c40aa452926daa6bbab7a71b0f",
  "0x54cd89623888e8010fdea1c62e86265a9c6da950",
  "0xa8249e9b92fa94f8de8b016937e0b321c9a62874",
  "0x1f6093d33db935b2ebd81d23312da5f11759973e",
]);

interface RawLeaderboardPerformance {
  pnl: string;
  roi: string;
  vlm: string;
}

interface RawLeaderboardRow {
  ethAddress: string;
  accountValue: string;
  windowPerformances: Array<[string, RawLeaderboardPerformance]>;
  prize: number;
  displayName: string | null;
}

interface RawLeaderboardResponse {
  leaderboardRows?: RawLeaderboardRow[];
}

export type LeaderboardPeriodKey = "day" | "week" | "month";

export interface LeaderboardPerformance {
  pnl: number;
  roi: number;
  volume: number;
}

export interface LeaderboardWallet {
  address: string;
  displayName: string | null;
  accountValue: number;
  day: LeaderboardPerformance;
  week: LeaderboardPerformance;
  month: LeaderboardPerformance;
}

let cachedAt = 0;
let cachedRows: LeaderboardWallet[] | null = null;
let inflightRequest: Promise<LeaderboardWallet[]> | null = null;

function toNumber(value: string | null | undefined) {
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapRows(response: RawLeaderboardResponse) {
  return (response.leaderboardRows ?? [])
    .filter((row) => !EXCLUDED_LEADERBOARD_ADDRESSES.has(row.ethAddress.toLowerCase()))
    .map((row) => {
      const perfMap = Object.fromEntries(row.windowPerformances ?? []);
      const zero = { pnl: "0", roi: "0", vlm: "0" };
      const dayPerf = perfMap.day ?? zero;
      const weekPerf = perfMap.week ?? dayPerf;
      const monthPerf = perfMap.month ?? weekPerf;

      return {
        address: row.ethAddress.toLowerCase(),
        displayName: row.displayName,
        accountValue: toNumber(row.accountValue),
        day: {
          pnl: toNumber(dayPerf.pnl),
          roi: toNumber(dayPerf.roi),
          volume: toNumber(dayPerf.vlm),
        },
        week: {
          pnl: toNumber(weekPerf.pnl),
          roi: toNumber(weekPerf.roi),
          volume: toNumber(weekPerf.vlm),
        },
        month: {
          pnl: toNumber(monthPerf.pnl),
          roi: toNumber(monthPerf.roi),
          volume: toNumber(monthPerf.vlm),
        },
      };
    })
    .sort((left, right) => right.day.pnl - left.day.pnl);
}

export async function fetchLeaderboardWallets(force = false) {
  const now = Date.now();

  if (!force && cachedRows && now - cachedAt < CACHE_TTL_MS) {
    return cachedRows;
  }

  if (!force && inflightRequest) {
    return inflightRequest;
  }

  inflightRequest = fetch(LEADERBOARD_ENDPOINT)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Leaderboard request failed with ${response.status}`);
      }

      const json = (await response.json()) as RawLeaderboardResponse;
      const rows = mapRows(json);
      cachedRows = rows;
      cachedAt = Date.now();
      return rows;
    })
    .finally(() => {
      inflightRequest = null;
    });

  return inflightRequest;
}
