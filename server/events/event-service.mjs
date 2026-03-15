/** @typedef {import("./types").AliasMap} AliasMap */
/** @typedef {import("./types").MatchedArticle} MatchedArticle */
/** @typedef {import("./types").ScoredEvent} ScoredEvent */
/** @typedef {import("./types").NewsRequest} NewsRequest */

import { getCachedFreeCryptoNews } from "./free-crypto-news.mjs";
import { buildAliasMap, getAssetMentionScore, matchAssetFromPost } from "./matchers.mjs";
import { getEventRelevanceScore, isAllowedEvent, normalizePost } from "./normalize.mjs";

const MAX_EVENTS = 18;
const MIN_EVENTS_BEFORE_RELAXING = 4;
const STALE_EVENTS_TTL_MS = 15 * 60 * 1000;

/** @type {Map<string, { events: import("./types").PriceEventShape[]; fetchedAt: number }>} */
const lastSuccessfulEventsCache = new Map();

/** @type {Record<string, string>} */
const SYMBOL_CATEGORY_MAP = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

/** @param {string[]} symbols
 *  @param {AliasMap} aliasMap
 *  @returns {NewsRequest[]}
 */
function buildRequests(symbols, aliasMap) {
  return symbols.map((symbol) => {
    const category = SYMBOL_CATEGORY_MAP[symbol];

    if (category) {
      return { type: "category", value: category };
    }

    const aliases = aliasMap[symbol] ?? [symbol.toLowerCase()];
    const preferredAlias = aliases
      .filter((alias) => alias.length >= 3)
      .sort((left, right) => right.length - left.length)[0];

    return { type: "search", value: preferredAlias ?? symbol.toLowerCase() };
  });
}

/** @param {string[]} symbols
 *  @param {number} from
 *  @param {number} to
 */
function getEventsCacheKey(symbols, from, to) {
  return `${[...symbols].sort().join(",")}:${Math.max(0, to - from)}`;
}

/** @param {{ symbols: string[]; from: number; to: number }} params */
export async function fetchEventMarkers({ symbols, from, to }) {
  const cacheKey = getEventsCacheKey(symbols, from, to);
  const aliasMap = buildAliasMap(symbols);
  const requests = buildRequests(symbols, aliasMap);
  const articles = await getCachedFreeCryptoNews({ requests });

  /** @type {MatchedArticle[]} */
  const matchedPosts = articles
    .map((article) => {
      const asset = matchAssetFromPost(article, symbols, aliasMap);

      if (!asset) {
        return null;
      }

      return { post: article, asset };
    })
    .filter((entry) => entry !== null);

  /** @type {ScoredEvent[]} */
  const strictEvents = matchedPosts
    .filter((entry) => isAllowedEvent(entry.post))
    .map((entry) => {
      const event = normalizePost(entry.post, entry.asset);

      return event
        ? {
            event,
            score: getEventRelevanceScore(entry.post) + getAssetMentionScore(entry.post, entry.asset, aliasMap),
          }
        : null;
    })
    .filter((entry) => entry !== null)
    .filter((entry) => entry.event.timestamp >= from && entry.event.timestamp <= to);

  const strictIds = new Set(strictEvents.map((entry) => entry.event.id));
  /** @type {ScoredEvent[]} */
  const relaxedEvents =
    strictEvents.length >= MIN_EVENTS_BEFORE_RELAXING
      ? []
      : matchedPosts
          .map((entry) => {
            const event = normalizePost(entry.post, entry.asset);

            if (!event || strictIds.has(event.id) || event.timestamp < from || event.timestamp > to) {
              return null;
            }

            const assetScore = getAssetMentionScore(entry.post, entry.asset, aliasMap);

            if (assetScore <= 0) {
              return null;
            }

            return {
              event,
              score: assetScore,
            };
          })
          .filter((entry) => entry !== null);

  const events = [...strictEvents, ...relaxedEvents]
    .sort((left, right) => right.score - left.score || right.event.timestamp - left.event.timestamp)
    .slice(0, MAX_EVENTS)
    .map((entry) => entry.event)
    .sort((left, right) => left.timestamp - right.timestamp);

  if (events.length > 0) {
    lastSuccessfulEventsCache.set(cacheKey, {
      events,
      fetchedAt: Date.now(),
    });
    return events;
  }

  const stale = lastSuccessfulEventsCache.get(cacheKey);

  if (stale && Date.now() - stale.fetchedAt <= STALE_EVENTS_TTL_MS) {
    return stale.events;
  }

  return events;
}
