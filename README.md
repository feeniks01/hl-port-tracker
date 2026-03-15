# Hyperliquid Portfolio Tracker

Mobile-first portfolio tracker for Hyperliquid perpetual accounts.
Combines live market data, wallet inspection, charting, leaderboard discovery, event overlays, and optional copy trading through agent-wallet approval.

## Stack

- Vite
- React + TypeScript
- Zustand
- Tailwind CSS v4
- Ethers
- `@nktkas/hyperliquid`

## Architecture

The app is organized into four layers:

- `src/data`
  Hyperliquid REST/WebSocket clients, leaderboard fetchers, event fetchers, and trade client.
- `src/domain`
  Models and pure calculation utilities such as PnL, liquidation distance, and formatting.
- `src/presentation`
  Zustand stores, hooks, and React UI for portfolio, markets, charts, and copy trading.
- `functions` + `server/events`
  Lightweight backend proxy for chart event overlays and Cloudflare deployment.

## Data Flow

1. `metaAndAssetCtxs` loads the perp universe, prices, leverage limits, and funding.
2. A shared `allMids` WebSocket streams live prices.
3. Updates are batched every `100ms` to avoid rerendering on each tick.
4. Portfolio state loads through `clearinghouseState`.
5. PnL and account value derive from live mids rather than repeated polling.
6. Historical charts use candle snapshots; event markers come from a cached backend proxy.
7. Copy trading uses Hyperliquid agent wallets: the trading wallet approves a local signer once, which then submits trades.

## State

- `marketStore`
  Market universe, live mids, connection status, and metadata.
- `portfolioStore`
  Inspected wallet address, account summary, positions, persistence, and race-safe portfolio loads.
- `tradeStore`
  Connected trading wallet, agent approval state, and copy-trade submission state.

## Main UI Surfaces

- `Portfolio`
  Account value, open positions, liquidation context, shared chart, account metrics, and position detail sheets.
- `Markets`
  Top wallets, market scanner, search/sort/filter controls, and route-driven market detail views.
- `Asset Detail`
  Charting, liquidation context, market metrics, and copy-trade actions.

## Diagram

```text
Hyperliquid APIs + WebSocket
            │
            ▼
       marketStore
            │
      ┌─────┼─────┐
      ▼     ▼     ▼
 Portfolio  Markets  Charts

clearinghouseState
        │
        ▼
  portfolioStore
        │
        ▼
   Portfolio UI

Trading wallet
     │
     ▼
  tradeStore
     │
     ▼
 Copy-trade flow
```

## Hyperliquid Documentation References

Implementation was based on Hyperliquid’s official docs:

- Info endpoint overview: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
- Perpetuals info requests including `metaAndAssetCtxs` and `clearinghouseState`: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals
- WebSocket subscriptions including `allMids`: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions
- Candle snapshots: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals
- Exchange endpoint: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint
- Nonces and API / agent wallets: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets

## Running Locally

```bash
npm install
npm run dev:all
```

That starts:

- the Vite frontend
- the local events proxy used by the chart overlay

## What’s Implemented

- Live market data from Hyperliquid with websocket-backed price updates
- Portfolio inspection by wallet address with persistence and URL-shareable state
- Open positions with live mark, live PnL, liquidation distance, and ETA-to-liquidation
- Shared price history chart with compare mode, crosshair, and liquidation guide when relevant
- Real event markers on charts through a cached backend news/event pipeline
- Markets scanner with top wallets, major markets, highest open interest, and deduped full market list
- Route-driven market detail plus modal position detail
- Copy-trade flow with wallet connect, agent approval, and trade ticket submission

## Performance Notes

- A single shared WebSocket connection is used for market data.
- Mid-price updates are batched to a `100ms` flush cadence before updating the store.
- Candle history and chart events are cached and deduped.
- Portfolio value and PnL are recomputed from live mids instead of repeated account polling.
- Event/news data is cached more aggressively than live price data.

## Known Limitations

- The news/event layer is still heuristic. Asset matching and event taxonomy are curated, not exchange-grade.
- The live chart is a stitched view of websocket mids plus recent candle-based prefill. It is useful for short-term context, but it is not an exchange-grade tick-history product.

## If I Had More Time

- Tighten event quality further with better source ranking and richer event attribution
