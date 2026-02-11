# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TypeScript CLI and API client for **Dome** (https://docs.domeapi.io/) — a prediction market data aggregation platform covering Polymarket and Kalshi. The CLI provides access to real-time market prices, historical candlestick data, wallet analytics, order tracking, cross-platform market matching, and WebSocket streaming.

## Dome API Reference

Full endpoint documentation: https://docs.domeapi.io/llms.txt

Official TypeScript SDK: `@dome-api/sdk` (npm). Authentication is via API key from dashboard.domeapi.io, required on all requests. Rate limits are tier-based (Free: 1 req/s, Dev: 100 req/s, Pro: 300 req/s).

### API Surface Areas

- **Market Data**: activity, candlesticks, events, markets (Polymarket & Kalshi), market prices, orderbook history, trade history
- **Price Feeds**: Binance and Chainlink historical crypto prices
- **Cross-Platform**: sports market matching across Polymarket and Kalshi
- **Wallet/User**: wallet info, positions, profit-and-loss tracking
- **Order Router**: account linking, user settings, fee escrow
- **WebSocket**: real-time order data subscriptions

## Project Status

This project is in initial setup. The following scaffolding decisions should be made when building out:

- **Package manager**: npm or pnpm
- **CLI framework**: Commander.js, oclif, or yargs
- **Build**: tsc or tsup for bundling
- **Testing**: vitest or jest
- **Linting**: eslint + prettier
- **Output formatting**: chalk for colors, cli-table3 or columnify for tabular data

### Current Implementation Choices

- **Package manager**: npm
- **CLI framework**: Commander.js
- **Build**: tsc (TypeScript `moduleResolution: NodeNext`)
- **Testing**: vitest
- **Lint/format**: eslint + prettier
