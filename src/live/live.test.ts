import { describe, expect, it } from "vitest";
import { DomeClient } from "../lib/dome-client.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const runLive = process.env.RUN_LIVE_TESTS === "1";
const apiKey = process.env.DOME_API_KEY;
const describeLive = runLive && apiKey ? describe : describe.skip;

describeLive("Live Dome API", () => {
  const client = new DomeClient({ apiKey: apiKey as string });

  it(
    "fetches representative live market data",
    async () => {
      const pmMarkets = await client.polymarket.markets.list({ limit: 1 });
      expect(Array.isArray(pmMarkets.markets)).toBe(true);

      await sleep(1100);

      const pmEvents = await client.polymarket.events.list({ limit: 1 });
      expect(Array.isArray(pmEvents.events)).toBe(true);

      await sleep(1100);

      const kalshiMarkets = await client.kalshi.markets.list({ limit: 1 });
      expect(Array.isArray(kalshiMarkets.markets)).toBe(true);

      await sleep(1100);

      const chainlink = await client.cryptoPrices.chainlink.list({
        currency: "btc/usd",
        limit: 1
      });
      expect(Array.isArray(chainlink.prices)).toBe(true);

      await sleep(1100);

      const bySport = await client.matchingMarkets.sportsByDate.get("nba", {
        date: new Date().toISOString().slice(0, 10)
      });
      expect(typeof bySport).toBe("object");
      expect(bySport).toHaveProperty("markets");
    },
    60_000
  );

  const runWs = process.env.RUN_LIVE_WS_TESTS === "1";
  const itWs = runWs ? it : it.skip;

  itWs(
    "connects to websocket and receives subscription ack",
    async () => {
      const pmMarkets = await client.polymarket.markets.list({ limit: 1 });
      const marketSlug = pmMarkets.markets[0]?.market_slug;
      if (!marketSlug) return;

      const ws = new WebSocket(client.getWebSocketUrl());

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error("WebSocket live test timed out"));
        }, 20_000);

        ws.addEventListener("open", () => {
          ws.send(
            JSON.stringify({
              action: "subscribe",
              platform: "polymarket",
              version: 1,
              type: "orders",
              filters: { market_slugs: [marketSlug] }
            })
          );
        });

        ws.addEventListener("message", (evt) => {
          const data = JSON.parse(String(evt.data));
          if (data?.type === "ack" && data?.subscription_id) {
            ws.send(
              JSON.stringify({
                action: "unsubscribe",
                version: 1,
                subscription_id: data.subscription_id
              })
            );
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        });

        ws.addEventListener("error", () => {
          clearTimeout(timeout);
          ws.close();
          reject(new Error("WebSocket error"));
        });
      });
    },
    30_000
  );
});

