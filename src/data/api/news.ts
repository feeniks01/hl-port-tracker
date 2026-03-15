import {
  CHART_RANGE_CONFIG,
  type ChartRangeKey,
  type PriceEvent,
} from "../../domain/types/chart";

interface EventsResponse {
  events: PriceEvent[];
}

interface EventsCacheEntry {
  events: PriceEvent[];
  fetchedAt: number;
}

const EVENTS_CACHE_TTL_MS = 60 * 1000;
const EVENTS_STALE_CACHE_TTL_MS = 15 * 60 * 1000;
const eventsCache = new Map<string, EventsCacheEntry>();
const eventsRequestCache = new Map<string, Promise<PriceEvent[]>>();

function getCacheKey(symbols: string[], range: ChartRangeKey) {
  return `${range}:${[...symbols].sort().join(",")}`;
}

function readCache(cacheKey: string, maxAgeMs = EVENTS_CACHE_TTL_MS) {
  const entry = eventsCache.get(cacheKey);

  if (!entry) {
    return null;
  }

  if (Date.now() - entry.fetchedAt > maxAgeMs) {
    if (maxAgeMs === EVENTS_CACHE_TTL_MS) {
      eventsCache.delete(cacheKey);
    }
    return null;
  }

  return entry.events;
}

export async function fetchPriceEvents(
  symbols: string[],
  range: ChartRangeKey,
): Promise<PriceEvent[]> {
  if (symbols.length === 0) {
    return [];
  }

  const cacheKey = getCacheKey(symbols, range);
  const cached = readCache(cacheKey);

  if (cached) {
    return cached;
  }

  const pendingRequest = eventsRequestCache.get(cacheKey);

  if (pendingRequest) {
    return pendingRequest;
  }

  const now = Date.now();
  const { lookbackMs } = CHART_RANGE_CONFIG[range];
  const windowStart = now - lookbackMs;

  const request = fetch(
    `/api/events?symbols=${encodeURIComponent(symbols.join(","))}&from=${windowStart}&to=${now}`,
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Events request failed with ${response.status}`);
      }

      const payload = (await response.json()) as EventsResponse;
      const events = Array.isArray(payload.events) ? payload.events : [];
      const fallback = readCache(cacheKey, EVENTS_STALE_CACHE_TTL_MS) ?? [];

      if (events.length > 0) {
        eventsCache.set(cacheKey, {
          events,
          fetchedAt: Date.now(),
        });
        return events;
      }

      return fallback;
    })
    .catch((error) => {
      const fallback = readCache(cacheKey, EVENTS_STALE_CACHE_TTL_MS);

      if (fallback) {
        return fallback;
      }

      throw error;
    })
    .finally(() => {
      eventsRequestCache.delete(cacheKey);
    });

  eventsRequestCache.set(cacheKey, request);
  return request;
}
