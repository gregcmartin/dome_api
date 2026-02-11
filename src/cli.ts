#!/usr/bin/env node
import { Command } from "commander";
import process from "node:process";
import { DomeClient } from "./lib/dome-client.js";
import { DomeApiError } from "./lib/errors.js";
import type { QueryValue } from "./lib/types.js";
import {
  collect,
  parseInteger,
  parseNumber,
  parseOptionalInteger,
  parseUnixMilliseconds,
  parseUnixSeconds,
  requireApiKey
} from "./lib/parse.js";
import { printJson } from "./lib/print.js";

type GlobalOpts = {
  apiKey?: string;
  baseUrl: string;
  timeout: number;
  pretty: boolean;
  verbose: boolean;
};

function makeClient(opts: GlobalOpts) {
  return new DomeClient({
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl,
    timeoutMs: opts.timeout,
    logger: opts.verbose ? { debug: (msg: string) => console.error(msg) } : undefined
  });
}

async function runAction<T>(
  fn: () => Promise<T>,
  { pretty }: { pretty: boolean }
): Promise<void> {
  try {
    const data = await fn();
    printJson(data, { pretty });
  } catch (err) {
    if (err instanceof DomeApiError) {
      console.error(err.message);
      if (err.details.responseBody !== undefined) {
        printJson(err.details.responseBody, { pretty: true });
      }
      process.exitCode = 1;
      return;
    }
    console.error(err);
    process.exitCode = 1;
  }
}

const program = new Command()
  .name("dome")
  .description("CLI for the Dome API (docs.domeapi.io)")
  .option("--api-key <key>", "Dome API key (or set DOME_API_KEY)")
  .option("--base-url <url>", "API base URL", "https://api.domeapi.io/v1")
  .option("--timeout <ms>", "Request timeout (ms)", parseInteger, 30_000)
  .option("--pretty", "Pretty-print JSON output", true)
  .option("--no-pretty", "Minify JSON output")
  .option("--verbose", "Log request details to stderr", false);

program
  .command("get")
  .description("Perform an arbitrary GET request against the Dome API base URL")
  .argument("<path>", 'Path relative to base URL, e.g. "polymarket/markets"')
  .option(
    "--query <key=value>",
    "Query parameter (repeatable)",
    collect,
    [] as string[]
  )
  .action(async (path: string, cmdOpts: { query: string[] }) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);

    const client = makeClient({ ...globalOpts, apiKey });
    const query: Record<string, QueryValue> = {};
    for (const entry of cmdOpts.query) {
      const idx = entry.indexOf("=");
      if (idx === -1) throw new Error(`Invalid --query "${entry}" (expected key=value)`);
      const k = entry.slice(0, idx);
      const v = entry.slice(idx + 1);
      if (!query[k]) query[k] = v;
      else if (Array.isArray(query[k])) (query[k] as QueryValue[]).push(v);
      else query[k] = [query[k] as any, v];
    }

    await runAction(() => client.get(path, { query }), { pretty: globalOpts.pretty });
  });

program
  .command("post")
  .description("Perform an arbitrary POST request against the Dome API base URL")
  .argument("<path>", 'Path relative to base URL, e.g. "polymarket/placeOrder"')
  .requiredOption("--data <json>", "JSON body")
  .action(async (path: string, cmdOpts: { data: string }) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);

    const client = makeClient({ ...globalOpts, apiKey });
    const body = JSON.parse(cmdOpts.data);
    await runAction(() => client.post(path, { body }), { pretty: globalOpts.pretty });
  });

const polymarket = program.command("polymarket").description("Polymarket endpoints");

polymarket
  .command("markets")
  .description("List Polymarket markets")
  .option("--market-slug <slug>", "Filter by market slug (repeatable)", collect, [] as string[])
  .option("--event-slug <slug>", "Filter by event slug (repeatable)", collect, [] as string[])
  .option("--condition-id <id>", "Filter by condition_id (repeatable)", collect, [] as string[])
  .option("--token-id <id>", "Filter by token_id (repeatable)", collect, [] as string[])
  .option("--tag <tag>", "Filter by tag (repeatable)", collect, [] as string[])
  .option("--search <text>", "Search markets by text")
  .option("--status <open|closed>", "Filter by status")
  .option("--min-volume <number>", "Minimum volume_total", parseNumber)
  .option("--limit <number>", "Page size", parseOptionalInteger)
  .option("--pagination-key <key>", "Pagination key")
  .option("--start-time <seconds|iso>", "Start time (unix seconds or ISO-8601)")
  .option("--end-time <seconds|iso>", "End time (unix seconds or ISO-8601)")
  .option("--all", "Fetch all pages", false)
  .action(
    async (
      cmdOpts: {
        marketSlug: string[];
        eventSlug: string[];
        conditionId: string[];
        tokenId: string[];
        tag: string[];
        search?: string;
        status?: string;
        minVolume?: number;
        limit?: number;
        paginationKey?: string;
        startTime?: string;
        endTime?: string;
        all: boolean;
      }
    ) => {
      const globalOpts = program.opts<GlobalOpts>();
      const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
      requireApiKey(apiKey);
      const client = makeClient({ ...globalOpts, apiKey });

      const query = {
        market_slug: cmdOpts.marketSlug,
        event_slug: cmdOpts.eventSlug,
        condition_id: cmdOpts.conditionId,
        token_id: cmdOpts.tokenId,
        tags: cmdOpts.tag,
        search: cmdOpts.search,
        status: cmdOpts.status as "open" | "closed" | undefined,
        min_volume: cmdOpts.minVolume,
        limit: cmdOpts.limit,
        pagination_key: cmdOpts.paginationKey,
        start_time: cmdOpts.startTime ? parseUnixSeconds(cmdOpts.startTime) : undefined,
        end_time: cmdOpts.endTime ? parseUnixSeconds(cmdOpts.endTime) : undefined
      };

      await runAction(async () => {
        if (!cmdOpts.all) return client.polymarket.markets.list(query);

        const allMarkets: any[] = [];
        let paginationKey: string | undefined = undefined;
        // Preserve the user's limit for each page.
        for (;;) {
          const resp: any = await client.polymarket.markets.list({
            ...query,
            pagination_key: paginationKey ?? query.pagination_key
          });
          if (Array.isArray(resp?.markets)) allMarkets.push(...resp.markets);
          const hasMore = Boolean(resp?.pagination?.has_more);
          const nextKey = resp?.pagination?.pagination_key;
          if (!hasMore || !nextKey) return { ...resp, markets: allMarkets };
          paginationKey = nextKey;
        }
      }, { pretty: globalOpts.pretty });
    }
  );

polymarket
  .command("events")
  .description("List Polymarket events")
  .option("--event-slug <slug>", "Filter by event slug (repeatable)", collect, [] as string[])
  .option("--tag <tag>", "Filter by tag (repeatable)", collect, [] as string[])
  .option("--status <open|closed>", "Filter by status")
  .option(
    "--include-markets",
    "Include markets in the response (true/false in API)",
    false
  )
  .option("--start-time <seconds|iso>", "Start time (unix seconds or ISO-8601)")
  .option("--end-time <seconds|iso>", "End time (unix seconds or ISO-8601)")
  .option("--game-start-time <seconds|iso>", "Game start time (unix seconds or ISO-8601)")
  .option("--limit <number>", "Page size", parseOptionalInteger)
  .option("--pagination-key <key>", "Pagination key")
  .option("--all", "Fetch all pages", false)
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      event_slug: cmdOpts.eventSlug as string[],
      tags: cmdOpts.tag as string[],
      status: cmdOpts.status as "open" | "closed" | undefined,
      include_markets: cmdOpts.includeMarkets ? true : undefined,
      start_time: cmdOpts.startTime ? parseUnixSeconds(cmdOpts.startTime) : undefined,
      end_time: cmdOpts.endTime ? parseUnixSeconds(cmdOpts.endTime) : undefined,
      game_start_time: cmdOpts.gameStartTime ? parseUnixSeconds(cmdOpts.gameStartTime) : undefined,
      limit: cmdOpts.limit as number | undefined,
      pagination_key: cmdOpts.paginationKey as string | undefined
    };

    await runAction(async () => {
      if (!cmdOpts.all) return client.polymarket.events.list(query);

      const allEvents: any[] = [];
      let paginationKey: string | undefined = undefined;
      for (;;) {
        const resp: any = await client.polymarket.events.list({
          ...query,
          pagination_key: paginationKey ?? query.pagination_key
        });
        if (Array.isArray(resp?.events)) allEvents.push(...resp.events);
        const hasMore = Boolean(resp?.pagination?.has_more);
        const nextKey = resp?.pagination?.pagination_key;
        if (!hasMore || !nextKey) return { ...resp, events: allEvents };
        paginationKey = nextKey;
      }
    }, { pretty: globalOpts.pretty });
  });

polymarket
  .command("orders")
  .description("Get Polymarket trade history (orders)")
  .option("--market-slug <slug>", "Filter by market slug (repeatable)", collect, [] as string[])
  .option("--condition-id <id>", "Filter by condition_id (repeatable)", collect, [] as string[])
  .option("--token-id <id>", "Filter by token_id (repeatable)", collect, [] as string[])
  .option("--user <address>", "Filter by user address")
  .option("--start-time <seconds|iso>", "Start time (unix seconds or ISO-8601)")
  .option("--end-time <seconds|iso>", "End time (unix seconds or ISO-8601)")
  .option("--limit <number>", "Page size", parseOptionalInteger)
  .option("--pagination-key <key>", "Pagination key")
  .option("--all", "Fetch all pages", false)
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      market_slug: cmdOpts.marketSlug as string[],
      condition_id: cmdOpts.conditionId as string[],
      token_id: cmdOpts.tokenId as string[],
      user: cmdOpts.user as string | undefined,
      start_time: cmdOpts.startTime ? parseUnixSeconds(cmdOpts.startTime) : undefined,
      end_time: cmdOpts.endTime ? parseUnixSeconds(cmdOpts.endTime) : undefined,
      limit: cmdOpts.limit as number | undefined,
      pagination_key: cmdOpts.paginationKey as string | undefined
    };

    await runAction(async () => {
      if (!cmdOpts.all) return client.polymarket.orders.list(query);

      const allOrders: any[] = [];
      let paginationKey: string | undefined = undefined;
      for (;;) {
        const resp: any = await client.polymarket.orders.list({
          ...query,
          pagination_key: paginationKey ?? query.pagination_key
        });
        if (Array.isArray(resp?.orders)) allOrders.push(...resp.orders);
        const hasMore = Boolean(resp?.pagination?.has_more);
        const nextKey = resp?.pagination?.pagination_key;
        if (!hasMore || !nextKey) return { ...resp, orders: allOrders };
        paginationKey = nextKey;
      }
    }, { pretty: globalOpts.pretty });
  });

polymarket
  .command("orderbooks")
  .description("Get Polymarket orderbook history")
  .requiredOption("--token-id <id>", "Token ID")
  .option("--start-time <ms|iso>", "Start time (unix ms or ISO-8601)")
  .option("--end-time <ms|iso>", "End time (unix ms or ISO-8601)")
  .option("--limit <number>", "Max snapshots (<=200). Ignored when no start/end provided.", parseOptionalInteger)
  .option("--pagination-key <key>", "Pagination key")
  .option("--all", "Fetch all pages (only when start/end are provided)", false)
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      token_id: cmdOpts.tokenId as string,
      start_time: cmdOpts.startTime ? parseUnixMilliseconds(cmdOpts.startTime) : undefined,
      end_time: cmdOpts.endTime ? parseUnixMilliseconds(cmdOpts.endTime) : undefined,
      limit: cmdOpts.limit as number | undefined,
      pagination_key: cmdOpts.paginationKey as string | undefined
    };

    await runAction(async () => {
      if (!cmdOpts.all) return client.polymarket.orderbooks.list(query);

      const allSnapshots: any[] = [];
      let paginationKey: string | undefined = undefined;
      for (;;) {
        const resp: any = await client.polymarket.orderbooks.list({
          ...query,
          pagination_key: paginationKey ?? query.pagination_key
        });
        if (Array.isArray(resp?.snapshots)) allSnapshots.push(...resp.snapshots);
        const hasMore = Boolean(resp?.pagination?.has_more);
        const nextKey = resp?.pagination?.pagination_key;
        if (!hasMore || !nextKey) return { ...resp, snapshots: allSnapshots };
        paginationKey = nextKey;
      }
    }, { pretty: globalOpts.pretty });
  });

polymarket
  .command("activity")
  .description("Get Polymarket activity")
  .option("--user <address>", "Filter by user")
  .option("--market-slug <slug>", "Filter by market slug (repeatable)", collect, [] as string[])
  .option("--condition-id <id>", "Filter by condition_id (repeatable)", collect, [] as string[])
  .option("--start-time <seconds|iso>", "Start time (unix seconds or ISO-8601)")
  .option("--end-time <seconds|iso>", "End time (unix seconds or ISO-8601)")
  .option("--limit <number>", "Page size", parseOptionalInteger)
  .option("--pagination-key <key>", "Pagination key")
  .option("--all", "Fetch all pages", false)
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      user: cmdOpts.user as string | undefined,
      market_slug: cmdOpts.marketSlug as string[],
      condition_id: cmdOpts.conditionId as string[],
      start_time: cmdOpts.startTime ? parseUnixSeconds(cmdOpts.startTime) : undefined,
      end_time: cmdOpts.endTime ? parseUnixSeconds(cmdOpts.endTime) : undefined,
      limit: cmdOpts.limit as number | undefined,
      pagination_key: cmdOpts.paginationKey as string | undefined
    };

    await runAction(async () => {
      if (!cmdOpts.all) return client.polymarket.activity.list(query);

      const allActivities: any[] = [];
      let paginationKey: string | undefined = undefined;
      for (;;) {
        const resp: any = await client.polymarket.activity.list({
          ...query,
          pagination_key: paginationKey ?? query.pagination_key
        });
        if (Array.isArray(resp?.activities)) allActivities.push(...resp.activities);
        const hasMore = Boolean(resp?.pagination?.has_more);
        const nextKey = resp?.pagination?.pagination_key;
        if (!hasMore || !nextKey) return { ...resp, activities: allActivities };
        paginationKey = nextKey;
      }
    }, { pretty: globalOpts.pretty });
  });

polymarket
  .command("market-price")
  .description("Get Polymarket market price by token_id")
  .argument("<token_id>", "Token ID")
  .option("--at-time <seconds|iso>", "Get price at time (unix seconds or ISO-8601)")
  .action(async (tokenId: string, cmdOpts: { atTime?: string }) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      at_time: cmdOpts.atTime ? parseUnixSeconds(cmdOpts.atTime) : undefined
    };

    await runAction(
      () => client.polymarket.marketPrice.get(tokenId, query),
      { pretty: globalOpts.pretty }
    );
  });

polymarket
  .command("candlesticks")
  .description("Get Polymarket candlestick history by condition_id")
  .argument("<condition_id>", "Condition ID")
  .requiredOption("--start-time <seconds|iso>", "Start time (unix seconds or ISO-8601)")
  .requiredOption("--end-time <seconds|iso>", "End time (unix seconds or ISO-8601)")
  .option("--interval <1|60|1440>", "Candlestick interval in minutes", parseOptionalInteger)
  .action(async (conditionId: string, cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      start_time: parseUnixSeconds(cmdOpts.startTime),
      end_time: parseUnixSeconds(cmdOpts.endTime),
      interval:
        cmdOpts.interval === undefined
          ? undefined
          : ([1, 60, 1440] as number[]).includes(cmdOpts.interval)
            ? (cmdOpts.interval as 1 | 60 | 1440)
            : (() => {
                throw new Error("interval must be one of 1, 60, or 1440");
              })()
    };

    await runAction(
      () => client.polymarket.candlesticks.get(conditionId, query),
      { pretty: globalOpts.pretty }
    );
  });

polymarket
  .command("positions")
  .description("Get Polymarket positions for a wallet")
  .argument("<wallet_address>", "Wallet address")
  .option("--limit <number>", "Page size (default 100)", parseOptionalInteger)
  .option("--pagination-key <key>", "Pagination key")
  .option("--all", "Fetch all pages", false)
  .action(async (walletAddress: string, cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      limit: cmdOpts.limit as number | undefined,
      pagination_key: cmdOpts.paginationKey as string | undefined
    };

    await runAction(async () => {
      if (!cmdOpts.all) return client.polymarket.positions.listForWallet(walletAddress, query);

      const allPositions: any[] = [];
      let paginationKey: string | undefined = undefined;
      for (;;) {
        const resp: any = await client.polymarket.positions.listForWallet(walletAddress, {
          ...query,
          pagination_key: paginationKey ?? query.pagination_key
        });
        if (Array.isArray(resp?.positions)) allPositions.push(...resp.positions);
        const hasMore = Boolean(resp?.pagination?.has_more);
        const nextKey = resp?.pagination?.pagination_key;
        if (!hasMore || !nextKey) return { ...resp, positions: allPositions };
        paginationKey = nextKey;
      }
    }, { pretty: globalOpts.pretty });
  });

polymarket
  .command("wallet")
  .description("Look up Polymarket wallet info by EOA, proxy wallet, or username")
  .option("--eoa <address>", "Externally Owned Account address")
  .option("--proxy <address>", "Polymarket proxy wallet address")
  .option("--handle <name>", "Polymarket username")
  .option("--with-metrics", "Include metrics in response", false)
  .option("--start-time <seconds|iso>", "Metrics start time (unix seconds or ISO-8601)")
  .option("--end-time <seconds|iso>", "Metrics end time (unix seconds or ISO-8601)")
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const idFlags = [cmdOpts.eoa, cmdOpts.proxy, cmdOpts.handle].filter(Boolean);
    if (idFlags.length !== 1) {
      throw new Error("Provide exactly one of --eoa, --proxy, or --handle.");
    }

    const query = {
      eoa: cmdOpts.eoa as string | undefined,
      proxy: cmdOpts.proxy as string | undefined,
      handle: cmdOpts.handle as string | undefined,
      with_metrics: cmdOpts.withMetrics ? true : undefined,
      start_time: cmdOpts.startTime ? parseUnixSeconds(cmdOpts.startTime) : undefined,
      end_time: cmdOpts.endTime ? parseUnixSeconds(cmdOpts.endTime) : undefined
    };

    await runAction(() => client.polymarket.wallet.lookup(query), { pretty: globalOpts.pretty });
  });

polymarket
  .command("wallet-pnl")
  .description("Get Polymarket wallet PnL history")
  .argument("<wallet_address>", "Wallet address")
  .requiredOption(
    "--granularity <day|week|month|year|all>",
    "PnL granularity (required)"
  )
  .option("--start-time <seconds|iso>", "Start time (unix seconds or ISO-8601)")
  .option("--end-time <seconds|iso>", "End time (unix seconds or ISO-8601)")
  .action(async (walletAddress: string, cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      granularity: cmdOpts.granularity as "day" | "week" | "month" | "year" | "all",
      start_time: cmdOpts.startTime ? parseUnixSeconds(cmdOpts.startTime) : undefined,
      end_time: cmdOpts.endTime ? parseUnixSeconds(cmdOpts.endTime) : undefined
    };

    await runAction(
      () => client.polymarket.wallet.pnl(walletAddress, query),
      { pretty: globalOpts.pretty }
    );
  });

const kalshi = program.command("kalshi").description("Kalshi endpoints");

kalshi
  .command("markets")
  .description("List Kalshi markets")
  .option("--market-ticker <ticker>", "Filter by market ticker (repeatable)", collect, [] as string[])
  .option("--event-ticker <ticker>", "Filter by event ticker (repeatable)", collect, [] as string[])
  .option("--search <text>", "Search markets by text")
  .option("--status <open|closed>", "Filter by status")
  .option("--min-volume <number>", "Minimum volume_total", parseNumber)
  .option("--limit <number>", "Page size", parseOptionalInteger)
  .option("--pagination-key <key>", "Pagination key")
  .option("--all", "Fetch all pages", false)
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      market_ticker: cmdOpts.marketTicker as string[],
      event_ticker: cmdOpts.eventTicker as string[],
      search: cmdOpts.search as string | undefined,
      status: cmdOpts.status as "open" | "closed" | undefined,
      min_volume: cmdOpts.minVolume as number | undefined,
      limit: cmdOpts.limit as number | undefined,
      pagination_key: cmdOpts.paginationKey as string | undefined
    };

    await runAction(async () => {
      if (!cmdOpts.all) return client.kalshi.markets.list(query);

      const allMarkets: any[] = [];
      let paginationKey: string | undefined = undefined;
      for (;;) {
        const resp: any = await client.kalshi.markets.list({
          ...query,
          pagination_key: paginationKey ?? query.pagination_key
        });
        if (Array.isArray(resp?.markets)) allMarkets.push(...resp.markets);
        const hasMore = Boolean(resp?.pagination?.has_more);
        const nextKey = resp?.pagination?.pagination_key;
        if (!hasMore || !nextKey) return { ...resp, markets: allMarkets };
        paginationKey = nextKey;
      }
    }, { pretty: globalOpts.pretty });
  });

kalshi
  .command("trades")
  .description("Get Kalshi trade history")
  .option("--ticker <ticker>", "Filter by market ticker")
  .option("--start-time <seconds|iso>", "Start time (unix seconds or ISO-8601)")
  .option("--end-time <seconds|iso>", "End time (unix seconds or ISO-8601)")
  .option("--limit <number>", "Page size", parseOptionalInteger)
  .option("--pagination-key <key>", "Pagination key")
  .option("--all", "Fetch all pages", false)
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      ticker: cmdOpts.ticker as string | undefined,
      start_time: cmdOpts.startTime ? parseUnixSeconds(cmdOpts.startTime) : undefined,
      end_time: cmdOpts.endTime ? parseUnixSeconds(cmdOpts.endTime) : undefined,
      limit: cmdOpts.limit as number | undefined,
      pagination_key: cmdOpts.paginationKey as string | undefined
    };

    await runAction(async () => {
      if (!cmdOpts.all) return client.kalshi.trades.list(query);

      const allTrades: any[] = [];
      let paginationKey: string | undefined = undefined;
      for (;;) {
        const resp: any = await client.kalshi.trades.list({
          ...query,
          pagination_key: paginationKey ?? query.pagination_key
        });
        if (Array.isArray(resp?.trades)) allTrades.push(...resp.trades);
        const hasMore = Boolean(resp?.pagination?.has_more);
        const nextKey = resp?.pagination?.pagination_key;
        if (!hasMore || !nextKey) return { ...resp, trades: allTrades };
        paginationKey = nextKey;
      }
    }, { pretty: globalOpts.pretty });
  });

kalshi
  .command("market-price")
  .description("Get Kalshi market price by market ticker")
  .argument("<market_ticker>", "Market ticker")
  .option("--at-time <seconds|iso>", "Get price at time (unix seconds or ISO-8601)")
  .action(async (marketTicker: string, cmdOpts: { atTime?: string }) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      at_time: cmdOpts.atTime ? parseUnixSeconds(cmdOpts.atTime) : undefined
    };

    await runAction(
      () => client.kalshi.marketPrice.get(marketTicker, query),
      { pretty: globalOpts.pretty }
    );
  });

kalshi
  .command("orderbooks")
  .description("Get Kalshi orderbook history")
  .requiredOption("--ticker <ticker>", "Market ticker")
  .option("--start-time <ms|iso>", "Start time (unix ms or ISO-8601)")
  .option("--end-time <ms|iso>", "End time (unix ms or ISO-8601)")
  .option("--limit <number>", "Max snapshots (<=200). Ignored when no start/end provided.", parseOptionalInteger)
  .option("--pagination-key <key>", "Pagination key")
  .option("--all", "Fetch all pages (only when start/end are provided)", false)
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      ticker: cmdOpts.ticker as string,
      start_time: cmdOpts.startTime ? parseUnixMilliseconds(cmdOpts.startTime) : undefined,
      end_time: cmdOpts.endTime ? parseUnixMilliseconds(cmdOpts.endTime) : undefined,
      limit: cmdOpts.limit as number | undefined,
      paginationKey: cmdOpts.paginationKey as string | undefined
    };

    await runAction(async () => {
      if (!cmdOpts.all) return client.kalshi.orderbooks.list(query);

      const allSnapshots: any[] = [];
      let paginationKey: string | undefined = undefined;
      for (;;) {
        const resp: any = await client.kalshi.orderbooks.list({
          ...query,
          paginationKey: paginationKey ?? query.paginationKey
        });
        if (Array.isArray(resp?.snapshots)) allSnapshots.push(...resp.snapshots);
        const hasMore = Boolean(resp?.pagination?.has_more);
        const nextKey = resp?.pagination?.pagination_key;
        if (!hasMore || !nextKey) return { ...resp, snapshots: allSnapshots };
        paginationKey = nextKey;
      }
    }, { pretty: globalOpts.pretty });
  });

const matchingMarkets = program
  .command("matching-markets")
  .description("Cross-platform market matching endpoints");

matchingMarkets
  .command("sports")
  .description("Match Polymarket and Kalshi sports markets")
  .option(
    "--polymarket-market-slug <slug>",
    "Polymarket market_slug (repeatable)",
    collect,
    [] as string[]
  )
  .option(
    "--kalshi-event-ticker <ticker>",
    "Kalshi event ticker (repeatable)",
    collect,
    [] as string[]
  )
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const pm = cmdOpts.polymarketMarketSlug as string[];
    const k = cmdOpts.kalshiEventTicker as string[];
    if ((pm.length > 0) === (k.length > 0)) {
      throw new Error(
        "Provide either --polymarket-market-slug (one or more) OR --kalshi-event-ticker (one or more)."
      );
    }

    const query = {
      polymarket_market_slug: pm.length ? pm : undefined,
      kalshi_event_ticker: k.length ? k : undefined
    };

    await runAction(() => client.matchingMarkets.sports.list(query), {
      pretty: globalOpts.pretty
    });
  });

matchingMarkets
  .command("sports-by-date")
  .description("Get matching sports markets for a given sport and date")
  .argument("<sport>", "Sport (e.g. nba, nfl, mlb)")
  .requiredOption("--date <YYYY-MM-DD>", "Date")
  .action(async (sport: string, cmdOpts: { date: string }) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    await runAction(
      () => client.matchingMarkets.sportsByDate.get(sport, { date: cmdOpts.date }),
      { pretty: globalOpts.pretty }
    );
  });

const cryptoPrices = program.command("crypto-prices").description("Crypto price endpoints");

cryptoPrices
  .command("binance")
  .description("Get Binance crypto prices")
  .requiredOption("--currency <symbol>", 'Currency symbol (e.g. "btcusdt")')
  .option("--start-time <ms|iso>", "Start time (unix ms or ISO-8601)")
  .option("--end-time <ms|iso>", "End time (unix ms or ISO-8601)")
  .option("--limit <number>", "Number of results (<=1000)", parseOptionalInteger)
  .option("--pagination-key <key>", "Pagination key")
  .option("--all", "Fetch all pages", false)
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      currency: cmdOpts.currency as string,
      start_time: cmdOpts.startTime ? parseUnixMilliseconds(cmdOpts.startTime) : undefined,
      end_time: cmdOpts.endTime ? parseUnixMilliseconds(cmdOpts.endTime) : undefined,
      limit: cmdOpts.limit as number | undefined,
      pagination_key: cmdOpts.paginationKey as string | undefined
    };

    await runAction(async () => {
      if (!cmdOpts.all) return client.cryptoPrices.binance.list(query);

      const allPrices: any[] = [];
      let paginationKey: string | undefined = undefined;
      for (;;) {
        const resp: any = await client.cryptoPrices.binance.list({
          ...query,
          pagination_key: paginationKey ?? query.pagination_key
        });
        if (Array.isArray(resp?.prices)) allPrices.push(...resp.prices);
        const nextKey = resp?.pagination_key;
        if (!nextKey) return { ...resp, prices: allPrices };
        paginationKey = nextKey;
      }
    }, { pretty: globalOpts.pretty });
  });

cryptoPrices
  .command("chainlink")
  .description("Get Chainlink crypto prices")
  .requiredOption("--currency <symbol>", 'Currency symbol (e.g. "btc/usd")')
  .option("--start-time <ms|iso>", "Start time (unix ms or ISO-8601)")
  .option("--end-time <ms|iso>", "End time (unix ms or ISO-8601)")
  .option("--limit <number>", "Number of results (<=1000)", parseOptionalInteger)
  .option("--pagination-key <key>", "Pagination key")
  .option("--all", "Fetch all pages", false)
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      currency: cmdOpts.currency as string,
      start_time: cmdOpts.startTime ? parseUnixMilliseconds(cmdOpts.startTime) : undefined,
      end_time: cmdOpts.endTime ? parseUnixMilliseconds(cmdOpts.endTime) : undefined,
      limit: cmdOpts.limit as number | undefined,
      pagination_key: cmdOpts.paginationKey as string | undefined
    };

    await runAction(async () => {
      if (!cmdOpts.all) return client.cryptoPrices.chainlink.list(query);

      const allPrices: any[] = [];
      let paginationKey: string | undefined = undefined;
      for (;;) {
        const resp: any = await client.cryptoPrices.chainlink.list({
          ...query,
          pagination_key: paginationKey ?? query.pagination_key
        });
        if (Array.isArray(resp?.prices)) allPrices.push(...resp.prices);
        const nextKey = resp?.pagination_key;
        if (!nextKey) return { ...resp, prices: allPrices };
        paginationKey = nextKey;
      }
    }, { pretty: globalOpts.pretty });
  });

const ws = program.command("ws").description("WebSocket streaming (orders)");

ws
  .command("subscribe")
  .description("Open a WebSocket subscription for Polymarket orders")
  .option("--user <address>", "Subscribe by user (repeatable; '*' allowed)", collect, [] as string[])
  .option("--condition-id <id>", "Subscribe by condition_id (repeatable)", collect, [] as string[])
  .option("--market-slug <slug>", "Subscribe by market_slug (repeatable)", collect, [] as string[])
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);

    const criteria = [
      (cmdOpts.user as string[]).length > 0,
      (cmdOpts.conditionId as string[]).length > 0,
      (cmdOpts.marketSlug as string[]).length > 0
    ].filter(Boolean).length;
    if (criteria !== 1) {
      throw new Error(
        "Provide exactly one subscription criteria: --user OR --condition-id OR --market-slug."
      );
    }

    const wsUrl = `wss://ws.domeapi.io/${apiKey}`;
    const socket = new WebSocket(wsUrl);

    socket.addEventListener("open", () => {
      const filters = {
        users: (cmdOpts.user as string[]).length ? (cmdOpts.user as string[]) : undefined,
        condition_ids: (cmdOpts.conditionId as string[]).length
          ? (cmdOpts.conditionId as string[])
          : undefined,
        market_slugs: (cmdOpts.marketSlug as string[]).length
          ? (cmdOpts.marketSlug as string[])
          : undefined
      };
      const msg = {
        action: "subscribe",
        platform: "polymarket",
        version: 1,
        type: "orders",
        filters
      };
      socket.send(JSON.stringify(msg));
    });

    socket.addEventListener("message", (evt) => {
      try {
        const data = JSON.parse(String(evt.data));
        printJson(data, { pretty: globalOpts.pretty });
      } catch {
        process.stdout.write(String(evt.data) + "\n");
      }
    });

    socket.addEventListener("error", (evt) => {
      console.error("WebSocket error:", evt);
      process.exitCode = 1;
    });

    socket.addEventListener("close", () => {
      // Normal close (Ctrl-C or server close).
    });
  });

ws
  .command("update")
  .description("Update an existing WebSocket subscription (opens a new connection)")
  .requiredOption("--subscription-id <id>", "Subscription ID")
  .option("--user <address>", "Update by user (repeatable; '*' allowed)", collect, [] as string[])
  .option("--condition-id <id>", "Update by condition_id (repeatable)", collect, [] as string[])
  .option("--market-slug <slug>", "Update by market_slug (repeatable)", collect, [] as string[])
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);

    const criteria = [
      (cmdOpts.user as string[]).length > 0,
      (cmdOpts.conditionId as string[]).length > 0,
      (cmdOpts.marketSlug as string[]).length > 0
    ].filter(Boolean).length;
    if (criteria !== 1) {
      throw new Error(
        "Provide exactly one update criteria: --user OR --condition-id OR --market-slug."
      );
    }

    const wsUrl = `wss://ws.domeapi.io/${apiKey}`;
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(wsUrl);

      socket.addEventListener("open", () => {
        const filters = {
          users: (cmdOpts.user as string[]).length ? (cmdOpts.user as string[]) : undefined,
          condition_ids: (cmdOpts.conditionId as string[]).length
            ? (cmdOpts.conditionId as string[])
            : undefined,
          market_slugs: (cmdOpts.marketSlug as string[]).length
            ? (cmdOpts.marketSlug as string[])
            : undefined
        };
        const msg = {
          action: "update",
          subscription_id: cmdOpts.subscriptionId as string,
          platform: "polymarket",
          version: 1,
          type: "orders",
          filters
        };
        socket.send(JSON.stringify(msg));
      });

      socket.addEventListener("message", (evt) => {
        try {
          const data = JSON.parse(String(evt.data));
          printJson(data, { pretty: globalOpts.pretty });
        } catch {
          process.stdout.write(String(evt.data) + "\n");
        } finally {
          socket.close();
          resolve();
        }
      });

      socket.addEventListener("error", (evt) => {
        console.error("WebSocket error:", evt);
        reject(new Error("WebSocket error"));
      });
    });
  });

ws
  .command("unsubscribe")
  .description("Unsubscribe from a WebSocket subscription (opens a new connection)")
  .requiredOption("--subscription-id <id>", "Subscription ID")
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);

    const wsUrl = `wss://ws.domeapi.io/${apiKey}`;
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(wsUrl);

      socket.addEventListener("open", () => {
        const msg = {
          action: "unsubscribe",
          version: 1,
          subscription_id: cmdOpts.subscriptionId as string
        };
        socket.send(JSON.stringify(msg));
      });

      socket.addEventListener("message", (evt) => {
        try {
          const data = JSON.parse(String(evt.data));
          printJson(data, { pretty: globalOpts.pretty });
        } catch {
          process.stdout.write(String(evt.data) + "\n");
        } finally {
          socket.close();
          resolve();
        }
      });

      socket.addEventListener("error", (evt) => {
        console.error("WebSocket error:", evt);
        reject(new Error("WebSocket error"));
      });
    });
  });

const router = program.command("router").description("Order Router endpoints (Polymarket)");

router
  .command("health")
  .description("Check link-health endpoint")
  .action(async () => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });
    await runAction(() => client.orderRouter.linkHealth(), { pretty: globalOpts.pretty });
  });

router
  .command("link-prepare")
  .description("Prepare a link session (JSON-RPC)")
  .requiredOption("--wallet-address <address>", "Wallet address")
  .option("--wallet-type <eoa|safe>", "Wallet type", "eoa")
  .option("--auto-deploy-safe", "Auto deploy Safe (wallet_type=safe only)", false)
  .option("--chain-id <number>", "Chain ID", parseInteger, 137)
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const params = {
      walletAddress: cmdOpts.walletAddress as string,
      walletType: cmdOpts.walletType as "eoa" | "safe",
      autoDeploySafe: cmdOpts.autoDeploySafe as boolean,
      chainId: cmdOpts.chainId as number
    };

    await runAction(() => client.orderRouter.linkPrepare(params), { pretty: globalOpts.pretty });
  });

router
  .command("link-complete")
  .description("Complete a link session (JSON-RPC)")
  .requiredOption("--session-id <id>", "Session ID from link-prepare")
  .requiredOption("--signature <sig>", "EIP-712 signature from wallet")
  .option("--deployment-signature <sig>", "Deployment signature (safe only)")
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const params: any = {
      sessionId: cmdOpts.sessionId as string,
      signature: cmdOpts.signature as string
    };
    if (cmdOpts.deploymentSignature) params.deploymentSignature = cmdOpts.deploymentSignature;

    await runAction(() => client.orderRouter.linkComplete(params), { pretty: globalOpts.pretty });
  });

router
  .command("set-allowances-prepare")
  .description("Prepare allowances signature request (JSON-RPC)")
  .requiredOption("--session-id <id>", "Session ID from link-prepare")
  .option("--chain-id <number>", "Chain ID", parseInteger, 137)
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const params = {
      sessionId: cmdOpts.sessionId as string,
      chainId: cmdOpts.chainId as number
    };

    await runAction(() => client.orderRouter.setAllowancesPrepare(params), { pretty: globalOpts.pretty });
  });

router
  .command("set-allowances")
  .description("Submit allowances signature (JSON-RPC)")
  .requiredOption("--session-id <id>", "Session ID from link-prepare")
  .requiredOption("--allowance-signature <sig>", "Allowance signature")
  .option("--chain-id <number>", "Chain ID", parseInteger, 137)
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const params = {
      sessionId: cmdOpts.sessionId as string,
      chainId: cmdOpts.chainId as number,
      allowanceSignature: cmdOpts.allowanceSignature as string
    };

    await runAction(() => client.orderRouter.setAllowances(params), { pretty: globalOpts.pretty });
  });

router
  .command("set-affiliate")
  .description("Set affiliate address for a Polymarket account (requires API key)")
  .requiredOption("--affiliate <address>", "Affiliate address")
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    await runAction(() => client.orderRouter.setAffiliate({ affiliateAddress: cmdOpts.affiliate }), {
      pretty: globalOpts.pretty
    });
  });

router
  .command("user-settings")
  .description("Get order-router user settings (affiliate + fee config)")
  .action(async () => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    await runAction(() => client.orderRouter.userSettings.get(), {
      pretty: globalOpts.pretty
    });
  });

router
  .command("update-user-settings")
  .description("Update order-router user settings")
  .requiredOption("--data <json>", "JSON body (e.g. {\"feeBps\":25})")
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    await runAction(
      () => client.orderRouter.userSettings.update(JSON.parse(cmdOpts.data)),
      { pretty: globalOpts.pretty }
    );
  });

router
  .command("fees")
  .description("Get fee settings (alias endpoint)")
  .action(async () => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    await runAction(() => client.polymarket.fees.get(), {
      pretty: globalOpts.pretty
    });
  });

router
  .command("update-fees")
  .description("Update fee settings (alias endpoint)")
  .requiredOption("--data <json>", "JSON body (e.g. {\"feeBps\":25})")
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    await runAction(() => client.polymarket.fees.update(JSON.parse(cmdOpts.data)), {
      pretty: globalOpts.pretty
    });
  });

router
  .command("place-order")
  .description("Place an order via Order Router (requires API key)")
  .requiredOption("--data <json>", "JSON-RPC body for placeOrder")
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    await runAction(() => client.orderRouter.placeOrder(JSON.parse(cmdOpts.data)), {
      pretty: globalOpts.pretty
    });
  });

router
  .command("cancel-order")
  .description("Cancel an order via Order Router (requires API key)")
  .requiredOption("--data <json>", "JSON body for cancelOrder")
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    await runAction(() => client.orderRouter.cancelOrder(JSON.parse(cmdOpts.data)), {
      pretty: globalOpts.pretty
    });
  });

router
  .command("claim-winnings")
  .description("Claim winnings via Order Router (requires API key)")
  .requiredOption("--data <json>", "JSON body for claimWinnings")
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    await runAction(() => client.orderRouter.claimWinnings(JSON.parse(cmdOpts.data)), {
      pretty: globalOpts.pretty
    });
  });

router
  .command("escrow-order")
  .description("Get a fee-escrow order by ID")
  .argument("<order_id>", "Escrow order ID or Polymarket order ID")
  .action(async (orderId: string) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    await runAction(() => client.orderRouter.escrow.getOrder(orderId), {
      pretty: globalOpts.pretty
    });
  });

router
  .command("escrow-orders")
  .description("List fee-escrow orders")
  .option("--payer <address>", "Filter by payer")
  .option("--signer <address>", "Filter by signer")
  .option("--status <status>", "Filter by status")
  .option("--limit <number>", "Limit", parseOptionalInteger)
  .option("--offset <number>", "Offset", parseOptionalInteger)
  .action(async (cmdOpts: any) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    const query = {
      payer: cmdOpts.payer as string | undefined,
      signer: cmdOpts.signer as string | undefined,
      status: cmdOpts.status as "pending" | "distributed" | "refunded" | "cancelled" | undefined,
      limit: cmdOpts.limit as number | undefined,
      offset: cmdOpts.offset as number | undefined
    };

    await runAction(() => client.orderRouter.escrow.listOrders(query), {
      pretty: globalOpts.pretty
    });
  });

router
  .command("cancel-escrow-order")
  .description("Cancel a fee-escrow order by ID")
  .argument("<order_id>", "Escrow order ID or Polymarket order ID")
  .action(async (orderId: string) => {
    const globalOpts = program.opts<GlobalOpts>();
    const apiKey = globalOpts.apiKey ?? process.env.DOME_API_KEY;
    requireApiKey(apiKey);
    const client = makeClient({ ...globalOpts, apiKey });

    await runAction(() => client.orderRouter.escrow.cancelOrder(orderId), {
      pretty: globalOpts.pretty
    });
  });

await program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
