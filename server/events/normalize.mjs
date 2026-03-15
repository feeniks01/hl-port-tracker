/** @typedef {import("./types").FreeCryptoNewsArticle} FreeCryptoNewsArticle */
/** @typedef {import("./types").PriceEventShape} PriceEventShape */

/** @type {Array<[RegExp, number]>} */
const EVENT_SIGNALS = [
  [/\blist(ed|ing|s)?\b/i, 6],
  [/\bdelist(ed|ing|s)?\b/i, 6],
  [/\bunlock(s|ed)?\b/i, 6],
  [/\btoken unlock\b/i, 6],
  [/\betf\b/i, 6],
  [/\bsec\b/i, 5],
  [/\bfed\b/i, 5],
  [/\bcpi\b/i, 5],
  [/\binflation\b/i, 5],
  [/\binterest rate(s)?\b/i, 5],
  [/\bopen interest\b/i, 5],
  [/\bshort squeeze\b/i, 5],
  [/\bliquidation(s)?\b/i, 5],
  [/\bfunding\b/i, 5],
  [/\bmarket structure\b/i, 5],
  [/\bapproval\b/i, 5],
  [/\bfiling\b/i, 5],
  [/\blawsuit\b/i, 5],
  [/\bhack(ed|ing)?\b/i, 5],
  [/\bexploit(ed)?\b/i, 5],
  [/\bmainnet\b/i, 4],
  [/\btestnet\b/i, 4],
  [/\bprotocol\b/i, 4],
  [/\bpartnership\b/i, 4],
  [/\bintegration\b/i, 4],
  [/\bgovernance\b/i, 4],
  [/\bproposal\b/i, 4],
  [/\bexchange\b/i, 4],
  [/\blaunch\b/i, 4],
  [/\broadmap\b/i, 4],
  [/\bupgrade\b/i, 4],
  [/\btokenomics\b/i, 4],
  [/\bstaking\b/i, 4],
  [/\bvalidator(s)?\b/i, 4],
  [/\btreasury\b/i, 4],
  [/\bairdrop\b/i, 4],
  [/\bburn\b/i, 4],
  [/\bbuyback\b/i, 4],
  [/\bfork\b/i, 4],
];

/** @param {FreeCryptoNewsArticle} post */
function getEventText(post) {
  return `${post?.title ?? ""} ${post?.description ?? ""}`;
}

/** @param {FreeCryptoNewsArticle} post
 *  @returns {"positive" | "negative" | "neutral"}
 */
function inferSentiment(post) {
  const positiveVotes = Number(post?.votes?.positive ?? 0);
  const negativeVotes = Number(post?.votes?.negative ?? 0);

  if (positiveVotes > negativeVotes) {
    return "positive";
  }

  if (negativeVotes > positiveVotes) {
    return "negative";
  }

  return "neutral";
}

/** @param {FreeCryptoNewsArticle} post */
export function isAllowedEvent(post) {
  const text = getEventText(post);
  return EVENT_SIGNALS.some(([pattern]) => pattern.test(text));
}

/** @param {FreeCryptoNewsArticle} post */
export function getEventRelevanceScore(post) {
  const text = getEventText(post);
  const title = post?.title ?? "";
  const importantVotes = Math.min(Number(post?.votes?.important ?? 0), 5);
  const savedCount = Math.min(Number(post?.votes?.saved ?? 0), 3);
  const commentsCount = Math.min(Number(post?.votes?.comments ?? 0), 3);
  const instrumentCount = Array.isArray(post?.instruments) ? Math.min(post.instruments.length, 3) : 0;

  const signalScore = EVENT_SIGNALS.reduce((total, [pattern, weight]) => {
    if (pattern.test(title)) {
      return total + weight + 1;
    }

    if (pattern.test(text)) {
      return total + weight;
    }

    return total;
  }, 0);

  return signalScore + importantVotes + savedCount + commentsCount + instrumentCount;
}

/** @param {FreeCryptoNewsArticle} post
 *  @param {string} asset
 *  @returns {PriceEventShape | null}
 */
export function normalizePost(post, asset) {
  const timestamp = Date.parse(post.pubDate ?? post.published_at ?? post.created_at ?? "");

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const fallbackId = `${asset}:${timestamp}:${post.title ?? "untitled"}`;

  return {
    id: String(post.id ?? fallbackId),
    timestamp,
    title: post.title ?? "Untitled event",
    source: typeof post.source === "string" ? post.source : post.source?.title ?? "Free Crypto News",
    asset,
    url: post.link ?? post.original_url ?? post.url ?? null,
    sentiment: inferSentiment(post),
  };
}
