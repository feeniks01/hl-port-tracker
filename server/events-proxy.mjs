import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { URL } from "node:url";
import { resolve } from "node:path";

import { fetchEventMarkers } from "./events/event-service.mjs";

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env.local");

  if (!existsSync(envPath)) {
    return {};
  }

  const raw = readFileSync(envPath, "utf8");
  const entries = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const separatorIndex = line.indexOf("=");

      if (separatorIndex === -1) {
        return null;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
      return key ? [key, value] : null;
    })
    .filter((entry) => entry !== null);

  return Object.fromEntries(entries);
}

const env = {
  ...loadLocalEnv(),
  ...process.env,
};

const PORT = Number(env.EVENTS_PROXY_PORT || 8787);

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function parseSymbols(value) {
  return (value ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol, index, array) => symbol.length > 0 && array.indexOf(symbol) === index);
}

createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { events: [] });
    return;
  }

  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    response.end();
    return;
  }

  if (url.pathname !== "/api/events") {
    sendJson(response, 404, { events: [] });
    return;
  }

  const symbols = parseSymbols(url.searchParams.get("symbols"));
  const from = Number(url.searchParams.get("from") ?? 0);
  const to = Number(url.searchParams.get("to") ?? Date.now());

  if (symbols.length === 0 || !Number.isFinite(from) || !Number.isFinite(to)) {
    sendJson(response, 200, { events: [] });
    return;
  }

  try {
    const events = await fetchEventMarkers({ symbols, from, to });
    sendJson(response, 200, { events });
  } catch {
    sendJson(response, 200, { events: [] });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`News events proxy listening on http://127.0.0.1:${PORT}`);
});
