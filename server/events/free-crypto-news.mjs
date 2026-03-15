/** @typedef {import("./types").NewsRequest} NewsRequest */
/** @typedef {import("./types").FreeCryptoNewsArticle} FreeCryptoNewsArticle */

const FREE_CRYPTO_NEWS_ENDPOINT = "https://cryptocurrency.cv/api/news";
const CACHE_TTL_MS = 60 * 1000;
const MAX_ARTICLES_PER_QUERY = 12;
const REQUEST_TIMEOUT_MS = 8000;
const REQUEST_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0",
};

/** @type {Map<string, { fetchedAt: number; value: FreeCryptoNewsArticle[] }>} */
const cache = new Map();

/** @param {NewsRequest} request */
function getRequestKey(request) {
  return `${request.type}:${request.value}`;
}

/** @param {NewsRequest[]} requests */
function getCacheKey(requests) {
  const bucket = Math.floor(Date.now() / CACHE_TTL_MS);
  return `${bucket}:${requests.map(getRequestKey).join("|")}`;
}

/** @param {string} key */
function readCache(key) {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

/** @param {string} key
 *  @param {FreeCryptoNewsArticle[]} value
 */
function writeCache(key, value) {
  cache.set(key, {
    fetchedAt: Date.now(),
    value,
  });
}

/** @param {NewsRequest} request */
function readLatestCacheForRequest(request) {
  const requestKey = getRequestKey(request);
  const latestEntry = [...cache.entries()]
    .filter(
      ([key]) =>
        key.includes(`:${requestKey}`) || key.includes(`|${requestKey}|`) || key.endsWith(`|${requestKey}`),
    )
    .map(([, entry]) => entry)
    .sort((left, right) => right.fetchedAt - left.fetchedAt)[0];

  return latestEntry?.value ?? null;
}

/** @param {unknown} link */
function sanitizeLink(link) {
  if (typeof link !== "string") {
    return null;
  }

  return link.replace("<![CDATA[", "").replace("]]>", "").trim();
}

/** @param {FreeCryptoNewsArticle[]} articles */
function dedupeArticles(articles) {
  const seen = new Set();

  return articles.filter((article) => {
    const key = `${article.link ?? ""}:${article.pubDate ?? ""}:${article.title ?? ""}`;

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/** @param {NewsRequest} request
 *  @returns {Promise<FreeCryptoNewsArticle[]>}
 */
async function fetchNewsRequest(request) {
  const url = new URL(FREE_CRYPTO_NEWS_ENDPOINT);
  url.searchParams.set("limit", String(MAX_ARTICLES_PER_QUERY));

  if (request.type === "category") {
    url.searchParams.set("category", request.value);
  } else {
    url.searchParams.set("search", request.value);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: REQUEST_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Free crypto news request failed with ${response.status}`);
    }

    const payload = await response.json();
    /** @type {FreeCryptoNewsArticle[]} */
    const articles = Array.isArray(payload?.articles) ? payload.articles : [];

    return articles.map((article) => ({
      title: article?.title ?? "",
      description: article?.description ?? "",
      pubDate: article?.pubDate ?? article?.publishedAt ?? "",
      source: article?.source ?? "Free Crypto News",
      sourceKey: article?.sourceKey ?? "",
      category: article?.category ?? "",
      link: sanitizeLink(article?.link),
    }));
  } finally {
    clearTimeout(timeoutId);
  }
}

/** @param {NewsRequest} request
 *  @returns {Promise<FreeCryptoNewsArticle[]>}
 */
async function fetchCachedNewsRequest(request) {
  const cacheKey = getCacheKey([request]);
  const cached = readCache(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const articles = await fetchNewsRequest(request);
    writeCache(cacheKey, articles);
    return articles;
  } catch (error) {
    const stale = readLatestCacheForRequest(request);

    if (stale) {
      return stale;
    }

    throw error;
  }
}

/** @param {{ requests: NewsRequest[] }} params
 *  @returns {Promise<FreeCryptoNewsArticle[]>}
 */
export async function getCachedFreeCryptoNews({ requests }) {
  const uniqueRequests = requests.filter(
    (request, index, array) =>
      request.value.trim().length > 0 &&
      array.findIndex(
        (candidate) => candidate.type === request.type && candidate.value === request.value,
      ) === index,
  );

  if (uniqueRequests.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    uniqueRequests.map((request) => fetchCachedNewsRequest(request)),
  );
  return dedupeArticles(
    results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
  );
}
