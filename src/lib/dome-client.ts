import { DomeApiError } from "./errors.js";
import type {
  ActivityResponse,
  CancelEscrowOrderResponse,
  CandlesticksResponse,
  CryptoPricesResponse,
  DomeClientOptions,
  EventsResponse,
  EscrowOrderRpcResponse,
  GetActivityParams,
  GetBinanceCryptoPricesParams,
  GetCandlesticksParams,
  GetChainlinkCryptoPricesParams,
  GetEventsParams,
  GetKalshiMarketsParams,
  GetKalshiMarketPriceParams,
  GetKalshiOrderbooksParams,
  GetKalshiTradesParams,
  GetMarketPriceParams,
  GetMarketsParams,
  GetMatchingMarketsBySportParams,
  GetMatchingMarketsParams,
  GetOrdersParams,
  GetPolymarketOrderbooksParams,
  GetPositionsParams,
  GetWalletParams,
  GetWalletPnLParams,
  JsonRpcRequest,
  JsonRpcResponse,
  KalshiMarketPriceResponse,
  KalshiMarketsResponse,
  KalshiOrderbooksResponse,
  KalshiTradesResponse,
  LinkCompleteParams,
  LinkCompleteResult,
  LinkHealthResponse,
  LinkPrepareParams,
  LinkPrepareResult,
  ListEscrowOrdersParams,
  ListEscrowOrdersRpcResponse,
  MarketPriceResponse,
  MarketsResponse,
  MatchingMarketsBySportResponse,
  MatchingMarketsResponse,
  OrdersResponse,
  PolymarketOrderbooksResponse,
  PositionsResponse,
  QueryParams,
  RequestOptions,
  ServerCancelOrderRequest,
  ServerCancelOrderResponse,
  ServerClaimWinningsRequest,
  ServerClaimWinningsResponse,
  ServerPlaceOrderRequest,
  ServerPlaceOrderResponse,
  SetAffiliateRequest,
  SetAffiliateResponse,
  SetAllowancesParams,
  SetAllowancesPrepareParams,
  SetAllowancesPrepareResult,
  SetAllowancesResult,
  UpdateUserSettingsRequest,
  UserSettingsResponse,
  WalletPnLResponse,
  WalletResponse
} from "./types.js";

function toSearchParams(query?: QueryParams): URLSearchParams {
  const sp = new URLSearchParams();
  if (!query) return sp;

  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item === undefined || item === null) continue;
        sp.append(k, String(item));
      }
      continue;
    }
    sp.append(k, String(v));
  }
  return sp;
}

function normalizeBaseUrl(baseUrl: string): string {
  // Ensure trailing slash so URL(path, baseUrl) preserves `/v1`.
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function normalizePath(path: string): string {
  // Leading slash would override `/v1` when used with URL().
  return path.replace(/^\//, "");
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export class DomeClient {
  private apiKey?: string;
  private baseUrl: string;
  private timeoutMs: number;
  private logger?: { debug: (msg: string) => void };

  constructor(opts: DomeClientOptions = {}) {
    this.apiKey = opts.apiKey;
    this.baseUrl = normalizeBaseUrl(opts.baseUrl ?? "https://api.domeapi.io/v1");
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.logger = opts.logger;
  }

  setApiKey(apiKey?: string) {
    this.apiKey = apiKey;
  }

  getWebSocketUrl(apiKeyOverride?: string) {
    const apiKey = apiKeyOverride ?? this.apiKey;
    if (!apiKey) throw new Error("Missing API key. Provide --api-key or set DOME_API_KEY.");
    return `wss://ws.domeapi.io/${apiKey}`;
  }

  async get<T = unknown>(
    path: string,
    opts?: { query?: QueryParams; headers?: Record<string, string>; timeoutMs?: number; withAuth?: boolean }
  ) {
    return this.request<T>(path, {
      method: "GET",
      query: opts?.query,
      headers: opts?.headers,
      timeoutMs: opts?.timeoutMs,
      withAuth: opts?.withAuth
    });
  }

  async post<T = unknown>(
    path: string,
    opts?: {
      query?: QueryParams;
      body?: unknown;
      headers?: Record<string, string>;
      timeoutMs?: number;
      withAuth?: boolean;
    }
  ) {
    return this.request<T>(path, {
      method: "POST",
      query: opts?.query,
      body: opts?.body,
      headers: opts?.headers,
      timeoutMs: opts?.timeoutMs,
      withAuth: opts?.withAuth
    });
  }

  async put<T = unknown>(
    path: string,
    opts?: {
      query?: QueryParams;
      body?: unknown;
      headers?: Record<string, string>;
      timeoutMs?: number;
      withAuth?: boolean;
    }
  ) {
    return this.request<T>(path, {
      method: "PUT",
      query: opts?.query,
      body: opts?.body,
      headers: opts?.headers,
      timeoutMs: opts?.timeoutMs,
      withAuth: opts?.withAuth
    });
  }

  async delete<T = unknown>(
    path: string,
    opts?: {
      query?: QueryParams;
      body?: unknown;
      headers?: Record<string, string>;
      timeoutMs?: number;
      withAuth?: boolean;
    }
  ) {
    return this.request<T>(path, {
      method: "DELETE",
      query: opts?.query,
      body: opts?.body,
      headers: opts?.headers,
      timeoutMs: opts?.timeoutMs,
      withAuth: opts?.withAuth
    });
  }

  private rpc<P, R>(
    path: string,
    method: string,
    params: P,
    opts?: RequestOptions & { id?: string | number | null; withAuth?: boolean }
  ) {
    return this.post<JsonRpcResponse<R>>(path, {
      body: {
        jsonrpc: "2.0",
        id: opts?.id ?? 1,
        method,
        params
      } satisfies JsonRpcRequest<P>,
      timeoutMs: opts?.timeoutMs,
      headers: opts?.headers,
      withAuth: opts?.withAuth
    });
  }

  private async request<T>(
    path: string,
    opts: {
      method: HttpMethod;
      query?: QueryParams;
      body?: unknown;
      headers?: Record<string, string>;
      timeoutMs?: number;
      withAuth?: boolean;
    }
  ): Promise<T> {
    const url = new URL(normalizePath(path), this.baseUrl);
    const sp = toSearchParams(opts.query);
    if ([...sp.keys()].length > 0) url.search = sp.toString();

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(opts.headers ?? {})
    };

    if (opts.withAuth !== false && this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const bodyJson = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
    if (bodyJson) headers["Content-Type"] = headers["Content-Type"] ?? "application/json";

    this.logger?.debug(`${opts.method} ${url.toString()}`);

    const controller = new AbortController();
    const timeoutMs = opts.timeoutMs ?? this.timeoutMs;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: opts.method,
        headers,
        body: bodyJson,
        signal: controller.signal
      });

      const contentType = res.headers.get("content-type") ?? "";
      const isJson = contentType.includes("application/json");
      const responseBody =
        res.status === 204
          ? undefined
          : isJson
            ? await res.json().catch(async () => await res.text())
            : await res.text();

      if (!res.ok) {
        throw new DomeApiError(`Request failed (${res.status}) ${opts.method} ${url.toString()}`, {
          status: res.status,
          url: url.toString(),
          responseBody
        });
      }

      return responseBody as T;
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new DomeApiError(`Request timed out after ${timeoutMs}ms: ${opts.method} ${url.toString()}`, {
          status: 0,
          url: url.toString()
        });
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  polymarket = {
    markets: {
      list: (query: GetMarketsParams = {}, opts?: RequestOptions) =>
        this.get<MarketsResponse>("polymarket/markets", { query, ...opts })
    },
    events: {
      list: (query: GetEventsParams = {}, opts?: RequestOptions) =>
        this.get<EventsResponse>("polymarket/events", { query, ...opts })
    },
    orders: {
      list: (query: GetOrdersParams = {}, opts?: RequestOptions) =>
        this.get<OrdersResponse>("polymarket/orders", { query, ...opts })
    },
    orderbooks: {
      list: (query: GetPolymarketOrderbooksParams, opts?: RequestOptions) =>
        this.get<PolymarketOrderbooksResponse>("polymarket/orderbooks", { query, ...opts })
    },
    activity: {
      list: (query: GetActivityParams = {}, opts?: RequestOptions) =>
        this.get<ActivityResponse>("polymarket/activity", { query, ...opts })
    },
    marketPrice: {
      get: (tokenId: string, query?: Omit<GetMarketPriceParams, "token_id">, opts?: RequestOptions) =>
        this.get<MarketPriceResponse>(`polymarket/market-price/${encodeURIComponent(tokenId)}`, {
          query,
          ...opts
        })
    },
    candlesticks: {
      get: (
        conditionId: string,
        query: Omit<GetCandlesticksParams, "condition_id">,
        opts?: RequestOptions
      ) =>
        this.get<CandlesticksResponse>(`polymarket/candlesticks/${encodeURIComponent(conditionId)}`, {
          query,
          ...opts
        })
    },
    positions: {
      listForWallet: (
        walletAddress: string,
        query: Omit<GetPositionsParams, "wallet_address"> = {},
        opts?: RequestOptions
      ) =>
        this.get<PositionsResponse>(`polymarket/positions/wallet/${encodeURIComponent(walletAddress)}`, {
          query,
          ...opts
        })
    },
    wallet: {
      lookup: (query: GetWalletParams, opts?: RequestOptions) =>
        this.get<WalletResponse>("polymarket/wallet", { query, ...opts }),
      pnl: (
        walletAddress: string,
        query: Omit<GetWalletPnLParams, "wallet_address">,
        opts?: RequestOptions
      ) =>
        this.get<WalletPnLResponse>(`polymarket/wallet/pnl/${encodeURIComponent(walletAddress)}`, {
          query,
          ...opts
        })
    },
    userSettings: {
      get: (opts?: RequestOptions) =>
        this.get<UserSettingsResponse>("polymarket/user-settings", { ...opts }),
      update: (body: UpdateUserSettingsRequest, opts?: RequestOptions) =>
        this.put<UserSettingsResponse>("polymarket/user-settings", { body, ...opts })
    },
    fees: {
      // Backward-compatible alias used in some docs (`/polymarket/fees`).
      get: (opts?: RequestOptions) =>
        this.get<UserSettingsResponse>("polymarket/fees", { ...opts }),
      update: (body: UpdateUserSettingsRequest, opts?: RequestOptions) =>
        this.put<UserSettingsResponse>("polymarket/fees", { body, ...opts })
    }
  };

  kalshi = {
    markets: {
      list: (query: GetKalshiMarketsParams = {}, opts?: RequestOptions) =>
        this.get<KalshiMarketsResponse>("kalshi/markets", { query, ...opts })
    },
    trades: {
      list: (query: GetKalshiTradesParams = {}, opts?: RequestOptions) =>
        this.get<KalshiTradesResponse>("kalshi/trades", { query, ...opts })
    },
    marketPrice: {
      get: (
        marketTicker: string,
        query?: Omit<GetKalshiMarketPriceParams, "market_ticker">,
        opts?: RequestOptions
      ) =>
        this.get<KalshiMarketPriceResponse>(`kalshi/market-price/${encodeURIComponent(marketTicker)}`, {
          query,
          ...opts
        })
    },
    orderbooks: {
      list: (query: GetKalshiOrderbooksParams, opts?: RequestOptions) =>
        this.get<KalshiOrderbooksResponse>("kalshi/orderbooks", { query, ...opts })
    }
  };

  matchingMarkets = {
    sports: {
      list: (query: GetMatchingMarketsParams = {}, opts?: RequestOptions) =>
        this.get<MatchingMarketsResponse>("matching-markets/sports", { query, ...opts })
    },
    sportsByDate: {
      get: (
        sport: string,
        query: Omit<GetMatchingMarketsBySportParams, "sport">,
        opts?: RequestOptions
      ) =>
        this.get<MatchingMarketsBySportResponse>(`matching-markets/sports/${encodeURIComponent(sport)}`, {
          query,
          ...opts
        })
    }
  };

  cryptoPrices = {
    binance: {
      list: (query: GetBinanceCryptoPricesParams, opts?: RequestOptions) =>
        this.get<CryptoPricesResponse>("crypto-prices/binance", { query, ...opts })
    },
    chainlink: {
      list: (query: GetChainlinkCryptoPricesParams, opts?: RequestOptions) =>
        this.get<CryptoPricesResponse>("crypto-prices/chainlink", { query, ...opts })
    }
  };

  orderRouter = {
    linkHealth: (opts?: RequestOptions) =>
      this.get<LinkHealthResponse>("polymarket/link-health", { ...opts }),

    linkPrepare: (
      params: LinkPrepareParams,
      opts?: RequestOptions & { id?: string | number | null }
    ) =>
      this.rpc<LinkPrepareParams, LinkPrepareResult>(
        "polymarket/link-prepare",
        "linkPrepare",
        params,
        opts
      ),

    linkComplete: (
      params: LinkCompleteParams,
      opts?: RequestOptions & { id?: string | number | null }
    ) =>
      this.rpc<LinkCompleteParams, LinkCompleteResult>(
        "polymarket/link-complete",
        "linkComplete",
        params,
        opts
      ),

    setAllowancesPrepare: (
      params: SetAllowancesPrepareParams,
      opts?: RequestOptions & { id?: string | number | null }
    ) =>
      this.rpc<SetAllowancesPrepareParams, SetAllowancesPrepareResult>(
        "polymarket/link-set-allowances-prepare",
        "setAllowancesPrepare",
        params,
        opts
      ),

    setAllowances: (
      params: SetAllowancesParams,
      opts?: RequestOptions & { id?: string | number | null }
    ) =>
      this.rpc<SetAllowancesParams, SetAllowancesResult>(
        "polymarket/link-set-allowances",
        "setAllowances",
        params,
        opts
      ),

    setAffiliate: (
      params: SetAffiliateRequest | { affiliate: string; apiKey?: string },
      opts?: RequestOptions
    ) => {
      const affiliateAddress =
        "affiliateAddress" in params ? params.affiliateAddress : params.affiliate;
      return this.post<SetAffiliateResponse>("polymarket/affiliate", {
        body: {
          ...params,
          affiliateAddress
        },
        ...opts
      });
    },

    userSettings: {
      get: (opts?: RequestOptions) =>
        this.get<UserSettingsResponse>("polymarket/user-settings", { ...opts }),
      update: (body: UpdateUserSettingsRequest, opts?: RequestOptions) =>
        this.put<UserSettingsResponse>("polymarket/user-settings", { body, ...opts })
    },

    placeOrder: (body: ServerPlaceOrderRequest, opts?: RequestOptions) =>
      this.post<ServerPlaceOrderResponse>("polymarket/placeOrder", { body, ...opts }),

    cancelOrder: (body: ServerCancelOrderRequest, opts?: RequestOptions) =>
      this.post<ServerCancelOrderResponse>("polymarket/cancelOrder", { body, ...opts }),

    claimWinnings: (body: ServerClaimWinningsRequest, opts?: RequestOptions) =>
      this.post<ServerClaimWinningsResponse>("polymarket/claimWinnings", { body, ...opts }),

    escrow: {
      getOrder: (orderId: string, opts?: RequestOptions) =>
        this.get<EscrowOrderRpcResponse>(`polymarket/orders/${encodeURIComponent(orderId)}`, {
          ...opts
        }),
      listOrders: (query: ListEscrowOrdersParams = {}, opts?: RequestOptions) =>
        this.get<ListEscrowOrdersRpcResponse>("polymarket/orders", { query, ...opts }),
      cancelOrder: (orderId: string, opts?: RequestOptions) =>
        this.delete<CancelEscrowOrderResponse>(`polymarket/orders/${encodeURIComponent(orderId)}`, {
          ...opts
        })
    }
  };
}
