/** @typedef {import("./types").AliasMap} AliasMap */
/** @typedef {import("./types").FreeCryptoNewsArticle} FreeCryptoNewsArticle */

/** @type {Record<string, string[]>} */
const PROJECT_ALIASES = {
  BTC: ["bitcoin", "btc"],
  ETH: ["ethereum", "ether", "eth"],
  SOL: ["solana", "sol"],
  HYPE: ["hyperliquid", "hype"],
  XMR: ["monero", "xmr"],
  ASTER: ["aster", "aster dex"],
  PUMP: ["pump.fun", "pumpfun", "pump"],
  HMSTR: ["hamster kombat", "hmstr"],
  PEPE: ["pepe"],
  kPEPE: ["pepe"],
  BLAST: ["blast"],
  FARTCOIN: ["fartcoin"],
  DOGE: ["dogecoin", "doge"],
  XRP: ["ripple", "xrp"],
  SUI: ["sui"],
  ADA: ["cardano", "ada"],
  TRUMP: ["official trump", "trump"],
  AVAX: ["avalanche", "avax"],
  BNB: ["bnb", "binance coin", "binance"],
};

/** @param {string} value */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** @param {string[]} symbols
 *  @returns {AliasMap}
 */
export function buildAliasMap(symbols) {
  return Object.fromEntries(
    symbols.map((symbol) => {
      const upper = symbol.toUpperCase();
      const aliases = new Set([upper.toLowerCase(), ...(PROJECT_ALIASES[upper] ?? [])]);
      return [upper, [...aliases]];
    }),
  );
}

/** @param {FreeCryptoNewsArticle} post
 *  @param {string[]} symbols
 *  @param {AliasMap} aliasMap
 *  @returns {string | null}
 */
export function matchAssetFromPost(post, symbols, aliasMap) {
  const instrumentMatches = Array.isArray(post.instruments)
    ? post.instruments
        .map((instrument) => {
          const code =
            typeof instrument?.code === "string"
              ? instrument.code.toUpperCase()
              : typeof instrument?.title === "string"
                ? instrument.title.toUpperCase()
                : null;
          return code && symbols.includes(code) ? code : null;
        })
        .filter(Boolean)
    : [];

  if (instrumentMatches.length > 0) {
    return instrumentMatches[0];
  }

  const haystack = `${post.title ?? ""} ${post.description ?? ""}`.toLowerCase();

  for (const symbol of symbols) {
    const aliases = aliasMap[symbol] ?? [symbol.toLowerCase()];
    const matched = aliases.some((alias) => {
      const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(alias.toLowerCase())}([^a-z0-9]|$)`, "i");
      return pattern.test(haystack);
    });

    if (matched) {
      return symbol;
    }
  }

  return null;
}

/** @param {FreeCryptoNewsArticle} post
 *  @param {string} symbol
 *  @param {AliasMap} aliasMap
 */
export function getAssetMentionScore(post, symbol, aliasMap) {
  const haystack = `${post.title ?? ""} ${post.description ?? ""}`.toLowerCase();
  const title = `${post.title ?? ""}`.toLowerCase();
  const aliases = aliasMap[symbol] ?? [symbol.toLowerCase()];

  return aliases.reduce((score, alias) => {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(alias.toLowerCase())}([^a-z0-9]|$)`, "i");

    if (pattern.test(title)) {
      return score + 4;
    }

    if (pattern.test(haystack)) {
      return score + 2;
    }

    return score;
  }, 0);
}
