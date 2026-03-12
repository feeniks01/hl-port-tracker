# Hyperliquid Portfolio Tracker

## Overview
Hyperliquid is a high-performance L1 decentralized exchange (DEX) specializing in perpetual futures. Your challenge is to build a mobile-first **Portfolio Tracker** that allows users to monitor real-time market data and account statistics via the Hyperliquid API.

---

## Technical Requirements/Deliverables

### 1. Market Data (Public)
* **Real-time Prices:** Connect to the Hyperliquid WebSocket to stream live prices for top assets (BTC, ETH, SOL).
* **Asset List:** Display a list of available trading pairs with 24h change percentages.

### 2. Portfolio View (Private/Read-Only)
* **Address Input:** Provide a text field for a user to enter a public Hyperliquid wallet address.
* **Account Summary:** Fetch and display:
    * Total Net Equity (USDC).
    * Withdrawable Balance.
    * Leverage/Margin usage.
* **Open Positions:** A list of active trades showing:
    * `Size`, `Entry Price`, `Mark Price`, and `Unrealized PnL`.

### 3. Architecture & Performance
* **State Management:** Use a scalable solution (e.g., **Riverpod, BLoC, or Redux**).
* **Performance:** Ensure the UI does not "jank" or lag during rapid price fluctuations.
* **Clean Code:** Follow the "Layered Architecture" (Data, Domain, Presentation).

---

## Submission Instructions
1.  Push your code to this GitHub repository.
2.  Update the `README.md` with:
    * Architecture overview.
    * Any known limitations or "if I had more time" features.
3.  Tell Joey you're done :)
---

> **Disclaimer:** You are NOT required to implement wallet connection (signing) or trade execution. Use the [Hyperliquid API Documentation](https://stats.hyperliquid.xyz/api) as your primary resource.
