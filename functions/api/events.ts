import { fetchEventMarkers } from "../../server/events/event-service.mjs";

interface PagesRequestContext {
  request: Request;
}

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      ...init?.headers,
    },
    ...init,
  });
}

function parseSymbols(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol, index, array) => symbol.length > 0 && array.indexOf(symbol) === index);
}

export const onRequestGet = async ({ request }: PagesRequestContext) => {
  const url = new URL(request.url);
  const symbols = parseSymbols(url.searchParams.get("symbols"));
  const from = Number(url.searchParams.get("from") ?? 0);
  const to = Number(url.searchParams.get("to") ?? Date.now());

  if (symbols.length === 0 || !Number.isFinite(from) || !Number.isFinite(to)) {
    return json({ events: [] });
  }

  try {
    const events = await fetchEventMarkers({ symbols, from, to });
    return json({ events });
  } catch {
    return json({ events: [] });
  }
};
