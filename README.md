# Dome CLI + TypeScript Client

CLI and TypeScript API client for the [Dome API](https://docs.domeapi.io/) (Polymarket, Kalshi, matching markets, crypto prices, websockets, and order router).

## Setup

```bash
npm install
npm run build
```

## Auth

Most endpoints require a Dome API key.

```bash
export DOME_API_KEY="..."
```

You can also pass `--api-key` per command.

## CLI Usage

```bash
# Polymarket markets
node dist/cli.js polymarket markets --limit 5

# Polymarket market price
node dist/cli.js polymarket market-price 12345

# Polymarket candlesticks
node dist/cli.js polymarket candlesticks <condition_id> --start-time 1700000000 --end-time 1700086400 --interval 60

# Kalshi markets
node dist/cli.js kalshi markets --status open --limit 10

# Matching markets
node dist/cli.js matching-markets sports --polymarket-market-slug "some-market-slug"
node dist/cli.js matching-markets sports-by-date nba --date 2025-01-01

# Crypto prices
node dist/cli.js crypto-prices binance --currency btcusdt --limit 100

# WebSocket: subscribe to orders for a user (Ctrl-C to exit)
node dist/cli.js ws subscribe --user 0x0000000000000000000000000000000000000000

# Order router: link flows (see docs for required signature steps)
node dist/cli.js router health
node dist/cli.js router link-prepare --wallet-address 0x0000000000000000000000000000000000000000
node dist/cli.js router link-complete --session-id <session-id> --signature <0x...>

# Order router settings
node dist/cli.js router user-settings
node dist/cli.js router update-user-settings --data '{"feeBps":25}'
node dist/cli.js router set-affiliate --affiliate 0x0000000000000000000000000000000000000000

# Order router order actions
node dist/cli.js router place-order --data '{"jsonrpc":"2.0","method":"placeOrder","id":"req-1","params":{...}}'
node dist/cli.js router cancel-order --data '{"orderId":"0x...","signerAddress":"0x...","credentials":{"apiKey":"...","apiSecret":"...","apiPassphrase":"..."}}'
node dist/cli.js router claim-winnings --data '{"positionId":"0x...","walletType":"eoa","payerAddress":"0x...","signerAddress":"0x...","performanceFeeAuth":{...},"signedRedeemTx":"0x..."}'

# Fee-escrow order management (beta endpoints)
node dist/cli.js router escrow-orders --limit 20
node dist/cli.js router escrow-order <order_id>
node dist/cli.js router cancel-escrow-order <order_id>
```

## Library Usage

```ts
import { DomeClient } from "dome-cli";

const client = new DomeClient({ apiKey: process.env.DOME_API_KEY });
const markets = await client.polymarket.markets.list({ limit: 5 });
console.log(markets);
```

## Testing

```bash
# Unit tests
npm test

# Live API tests (requires DOME_API_KEY)
RUN_LIVE_TESTS=1 npm run test:live

# Live API + websocket test
RUN_LIVE_TESTS=1 RUN_LIVE_WS_TESTS=1 npm run test:live:ws
```

## Notes

- Time flags accept either unix timestamps or ISO-8601 strings.
- Order Router endpoints require a Dome API key.
- Live tests are intentionally opt-in and skipped unless `RUN_LIVE_TESTS=1`.
- Global flags: `--base-url`, `--timeout`, `--pretty/--no-pretty`, `--verbose`.
