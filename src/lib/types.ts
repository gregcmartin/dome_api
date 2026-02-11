export type QueryPrimitive = string | number | boolean;
export type QueryValue = QueryPrimitive | QueryPrimitive[];
export type QueryParams = Record<string, QueryValue | undefined | null>;

export type DomeApiErrorDetails = {
  status: number;
  url: string;
  responseBody?: unknown;
};

export type DomeClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  logger?: { debug: (msg: string) => void };
};

export type RequestOptions = {
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export type JsonRpcRequest<P = Record<string, unknown>> = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params: P;
};

export type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

export type JsonRpcResponse<R> = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: R;
  error?: JsonRpcError;
};

// Public market data endpoints

export type Pagination = {
  limit: number;
  offset?: number;
  total: number;
  has_more: boolean;
  pagination_key?: string;
};

export type OrderbooksPagination = {
  limit: number;
  count: number;
  pagination_key?: string;
  has_more: boolean;
};

export type MarketPriceResponse = {
  price: number;
  at_time: number;
};

export type GetMarketPriceParams = {
  token_id: string;
  at_time?: number;
};

export type KalshiSidePrice = {
  price: number;
  at_time: number;
};

export type KalshiMarketPriceResponse = {
  yes: KalshiSidePrice;
  no: KalshiSidePrice;
};

export type GetKalshiMarketPriceParams = {
  market_ticker: string;
  at_time?: number;
};

export type CandlestickPrice = {
  open: number;
  high: number;
  low: number;
  close: number;
  open_dollars: string;
  high_dollars: string;
  low_dollars: string;
  close_dollars: string;
  mean: number;
  mean_dollars: string;
  previous: number;
  previous_dollars: string;
};

export type CandlestickAskBid = {
  open: number;
  close: number;
  high: number;
  low: number;
  open_dollars: string;
  close_dollars: string;
  high_dollars: string;
  low_dollars: string;
};

export type CandlestickData = {
  end_period_ts: number;
  open_interest: number;
  price: CandlestickPrice;
  volume: number;
  yes_ask: CandlestickAskBid;
  yes_bid: CandlestickAskBid;
};

export type TokenMetadata = {
  token_id: string;
};

export type CandlestickTuple = [CandlestickData[], TokenMetadata];

export type CandlesticksResponse = {
  candlesticks: CandlestickTuple[];
};

export type GetCandlesticksParams = {
  condition_id: string;
  start_time: number;
  end_time: number;
  interval?: 1 | 60 | 1440;
};

export type OrderbookOrder = {
  size: string;
  price: string;
};

export type PolymarketOrderbookSnapshot = {
  asks: OrderbookOrder[];
  bids: OrderbookOrder[];
  hash: string;
  minOrderSize: string;
  negRisk: boolean;
  assetId: string;
  timestamp: number;
  tickSize: string;
  indexedAt: number;
  market: string;
};

export type PolymarketOrderbooksResponse = {
  snapshots: PolymarketOrderbookSnapshot[];
  pagination: OrderbooksPagination;
};

export type GetPolymarketOrderbooksParams = {
  token_id: string;
  start_time?: number;
  end_time?: number;
  limit?: number;
  pagination_key?: string;
};

export type MarketSide = {
  id: string;
  label: string;
};

export type PolymarketMarketInfo = {
  market_slug: string;
  condition_id: string;
  title: string;
  start_time: number;
  end_time: number;
  completed_time: number | null;
  close_time: number | null;
  game_start_time: string | null;
  tags: string[];
  volume_1_week: number;
  volume_1_month: number;
  volume_1_year: number;
  volume_total: number;
  resolution_source: string;
  image: string;
  side_a: MarketSide;
  side_b: MarketSide;
  winning_side: string | null;
  status: "open" | "closed";
};

export type MarketsResponse = {
  markets: PolymarketMarketInfo[];
  pagination: Pagination;
};

export type GetMarketsParams = {
  market_slug?: string[];
  event_slug?: string[];
  condition_id?: string[];
  token_id?: string[];
  tags?: string[];
  search?: string;
  status?: "open" | "closed";
  min_volume?: number;
  limit?: number;
  offset?: number;
  pagination_key?: string;
  start_time?: number;
  end_time?: number;
};

export type EventInfo = {
  event_slug: string;
  title: string;
  subtitle: string | null;
  status: "open" | "closed";
  start_time: number;
  end_time: number;
  volume_fiat_amount: number;
  settlement_sources: string | null;
  rules_url: string | null;
  image: string | null;
  tags: string[];
  market_count: number;
  markets?: PolymarketMarketInfo[];
};

export type EventsResponse = {
  events: EventInfo[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    has_more: boolean;
    pagination_key?: string;
  };
};

export type GetEventsParams = {
  event_slug?: string[];
  tags?: string[];
  status?: "open" | "closed";
  include_markets?: boolean | "true" | "false";
  start_time?: number;
  end_time?: number;
  game_start_time?: number;
  limit?: number;
  offset?: number;
  pagination_key?: string;
};

export type Order = {
  token_id: string;
  token_label: string;
  side: "BUY" | "SELL";
  market_slug: string;
  condition_id: string;
  shares: number;
  shares_normalized: number;
  price: number;
  tx_hash: string;
  title: string;
  timestamp: number;
  order_hash: string;
  user: string;
  taker: string;
};

export type OrdersResponse = {
  orders: Order[];
  pagination: Pagination;
};

export type GetOrdersParams = {
  market_slug?: string[];
  condition_id?: string[];
  token_id?: string[];
  start_time?: number;
  end_time?: number;
  limit?: number;
  offset?: number;
  pagination_key?: string;
  user?: string;
};

export type Activity = {
  token_id: string;
  side: "MERGE" | "SPLIT" | "REDEEM";
  market_slug: string;
  condition_id: string;
  shares: number;
  shares_normalized: number;
  price: number;
  tx_hash: string;
  title: string;
  timestamp: number;
  order_hash: string;
  user: string;
};

export type ActivityPagination = {
  limit: number;
  count: number;
  has_more: boolean;
  pagination_key?: string;
};

export type ActivityResponse = {
  activities: Activity[];
  pagination: ActivityPagination;
};

export type GetActivityParams = {
  user?: string;
  start_time?: number;
  end_time?: number;
  market_slug?: string[];
  condition_id?: string[];
  limit?: number;
  offset?: number;
  pagination_key?: string;
};

export type HighestVolumeDay = {
  date: string;
  volume: number;
  trades: number;
};

export type WalletMetrics = {
  total_volume: number;
  total_trades: number;
  total_markets: number;
  highest_volume_day: HighestVolumeDay;
  merges: number;
  splits: number;
  conversions: number;
  redemptions: number;
};

export type WalletResponse = {
  eoa: string;
  proxy: string;
  wallet_type: string;
  handle?: string | null;
  pseudonym?: string | null;
  image?: string | null;
  wallet_metrics?: WalletMetrics;
};

export type GetWalletParams = {
  eoa?: string;
  proxy?: string;
  handle?: string;
  with_metrics?: boolean | "true" | "false";
  start_time?: number;
  end_time?: number;
};

export type PnLDataPoint = {
  timestamp: number;
  pnl_to_date: number;
};

export type WalletPnLResponse = {
  granularity: string;
  start_time: number;
  end_time: number;
  wallet_address: string;
  pnl_over_time: PnLDataPoint[];
};

export type GetWalletPnLParams = {
  wallet_address: string;
  granularity: "day" | "week" | "month" | "year" | "all";
  start_time?: number;
  end_time?: number;
};

export type WinningOutcome = {
  id: string;
  label: string;
};

export type Position = {
  wallet: string;
  token_id: string;
  condition_id: string;
  title: string;
  shares: number;
  shares_normalized: number;
  redeemable: boolean;
  market_slug: string;
  event_slug: string;
  image: string;
  label: string;
  winning_outcome: WinningOutcome | null;
  start_time: number;
  end_time: number;
  completed_time: number | null;
  close_time: number | null;
  game_start_time: string | null;
  market_status: "open" | "closed";
  negativeRisk: boolean;
};

export type PositionsPagination = {
  has_more: boolean;
  limit: number;
  pagination_key?: string;
};

export type PositionsResponse = {
  wallet_address: string;
  positions: Position[];
  pagination: PositionsPagination;
};

export type GetPositionsParams = {
  wallet_address: string;
  limit?: number;
  pagination_key?: string;
};

export type KalshiMarketInfo = {
  event_ticker: string;
  market_ticker: string;
  title: string;
  start_time: number;
  end_time: number;
  close_time: number | null;
  status: "open" | "closed";
  last_price: number;
  volume: number;
  volume_24h: number;
  result: string | null;
};

export type KalshiMarketsResponse = {
  markets: KalshiMarketInfo[];
  pagination: Pagination;
};

export type GetKalshiMarketsParams = {
  market_ticker?: string[];
  event_ticker?: string[];
  search?: string;
  status?: "open" | "closed";
  min_volume?: number;
  limit?: number;
  offset?: number;
  pagination_key?: string;
};

export type KalshiOrderbookSnapshot = {
  orderbook: {
    yes: Array<[number, number]>;
    no: Array<[number, number]>;
    yes_dollars: Array<[string, number]>;
    no_dollars: Array<[string, number]>;
  };
  timestamp: number;
  ticker: string;
};

export type KalshiOrderbooksPagination = {
  limit: number;
  count: number;
  has_more: boolean;
  paginationKey?: string;
};

export type KalshiOrderbooksResponse = {
  snapshots: KalshiOrderbookSnapshot[];
  pagination: KalshiOrderbooksPagination;
};

export type GetKalshiOrderbooksParams = {
  ticker: string;
  start_time?: number;
  end_time?: number;
  limit?: number;
  paginationKey?: string;
};

export type KalshiTrade = {
  trade_id: string;
  market_ticker: string;
  count: number;
  yes_price: number;
  no_price: number;
  yes_price_dollars: number;
  no_price_dollars: number;
  taker_side: "yes" | "no";
  created_time: number;
};

export type KalshiTradesResponse = {
  trades: KalshiTrade[];
  pagination: Pagination;
};

export type GetKalshiTradesParams = {
  ticker?: string;
  start_time?: number;
  end_time?: number;
  limit?: number;
  offset?: number;
  pagination_key?: string;
};

export type KalshiMarket = {
  platform: "KALSHI";
  event_ticker: string;
  market_tickers: string[];
};

export type PolymarketMatchingMarket = {
  platform: "POLYMARKET";
  market_slug: string;
  token_ids: string[];
};

export type MatchingMarketData = KalshiMarket | PolymarketMatchingMarket;

export type MatchingMarketsResponse = {
  markets: Record<string, MatchingMarketData[]>;
};

export type GetMatchingMarketsParams = {
  polymarket_market_slug?: string[];
  kalshi_event_ticker?: string[];
};

export type GetMatchingMarketsBySportParams = {
  sport: "nfl" | "mlb" | "cfb" | "nba" | "nhl" | "cbb" | string;
  date: string;
};

export type MatchingMarketsBySportResponse = {
  markets: Record<string, MatchingMarketData[]>;
  sport: string;
  date: string;
};

export type CryptoPrice = {
  symbol: string;
  value: string | number;
  timestamp: number;
};

export type CryptoPricesResponse = {
  prices: CryptoPrice[];
  pagination_key?: string;
  total: number;
};

export type GetBinanceCryptoPricesParams = {
  currency: string;
  start_time?: number;
  end_time?: number;
  limit?: number;
  pagination_key?: string;
};

export type GetChainlinkCryptoPricesParams = {
  currency: string;
  start_time?: number;
  end_time?: number;
  limit?: number;
  pagination_key?: string;
};

// WebSocket protocol

export type WebSocketSubscriptionFilters = {
  users?: string[];
  condition_ids?: string[];
  market_slugs?: string[];
};

export type WebSocketSubscribeMessage = {
  action: "subscribe";
  platform: "polymarket";
  version: 1;
  type: "orders";
  filters: WebSocketSubscriptionFilters;
};

export type WebSocketUpdateMessage = {
  action: "update";
  subscription_id: string;
  platform: "polymarket";
  version: 1;
  type: "orders";
  filters: WebSocketSubscriptionFilters;
};

export type WebSocketUnsubscribeMessage = {
  action: "unsubscribe";
  version: 1;
  subscription_id: string;
};

export type WebSocketAckMessage = {
  type: "ack";
  subscription_id: string;
};

export type WebSocketEventMessage = {
  type: "event";
  subscription_id: string;
  data: Order;
};

export type WebSocketMessage = WebSocketAckMessage | WebSocketEventMessage;

// Order Router + user settings

export type Eip712Payload = {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
};

export type PolymarketCredentials = {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
};

export type LinkHealthResponse = {
  status: "ok" | string;
  service: string;
  region?: string;
  activeSessions?: number;
  timestamp: number;
};

export type AllowanceType = "CTF_EXCHANGE" | "NEG_RISK_CTF_EXCHANGE" | "NEG_RISK_ADAPTER";

export type SafeInfo = {
  safeAddress: string;
  isDeployed: boolean;
  wasDeployed: boolean;
  hasAllowances: boolean;
  allowancesMissing: AllowanceType[];
};

export type SafeTxPayload = Eip712Payload & {
  messageHash?: string;
};

export type LinkPrepareParams = {
  walletAddress: string;
  walletType?: "eoa" | "safe";
  autoDeploySafe?: boolean;
  chainId?: number;
};

export type LinkPrepareResult = {
  sessionId: string;
  expiresAt: number;
  eip712Payload: Eip712Payload;
  safeInfo?: SafeInfo;
  safeDeployPayload?: Eip712Payload;
};

export type LinkCompleteParams = {
  sessionId: string;
  signature: string;
  deploymentSignature?: string;
};

export type LinkCompleteResult = {
  success: boolean;
  credentials: PolymarketCredentials;
  signerAddress: string;
  safeAddress?: string;
  safeDeployed?: boolean;
  safeDeployTxHash?: string;
  safeTxPayload?: SafeTxPayload;
  allowancesToSet?: AllowanceType[];
};

export type SetAllowancesPrepareParams = {
  sessionId: string;
  chainId?: number;
};

export type SetAllowancesPrepareResult = {
  sessionId: string;
  safeAddress: string;
  safeTxPayload: SafeTxPayload;
  allowancesToSet: AllowanceType[];
  nonce: number;
};

export type SetAllowancesParams = {
  sessionId: string;
  chainId?: number;
  allowanceSignature: string;
};

export type SetAllowancesResult = {
  success: boolean;
  safeAddress: string;
  allowancesSet: AllowanceType[];
  transactionId?: string;
  transactionHash?: string;
};

export type SetAffiliateRequest = {
  affiliateAddress: string;
  apiKey?: string;
};

export type SetAffiliateResponse = {
  success: boolean;
  message: string;
  affiliateAddress: string;
  note?: string;
};

export type UserSettings = {
  apiKey?: string;
  affiliateAddress?: string | null;
  feeBps?: number;
  minFeeAmount?: string;
  maxFeeAmount?: string;
  updatedAt?: string;
};

export type UpdateUserSettingsRequest = {
  affiliateAddress?: string | null;
  feeBps?: number;
  minFeeAmount?: string;
  maxFeeAmount?: string;
  apiKey?: string;
};

export type UserSettingsResponse = {
  success: boolean;
  settings: UserSettings;
  message?: string;
};

export type SignedPolymarketOrder = {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: "BUY" | "SELL";
  signatureType: number;
  signature: string;
};

export type PolymarketOrderType = "GTC" | "GTD" | "FOK" | "FAK";

export type ServerPlaceOrderRequest = {
  jsonrpc: "2.0";
  method: "placeOrder";
  id: string;
  params: {
    payerAddress?: string;
    signerAddress?: string;
    signedOrder: SignedPolymarketOrder;
    orderType?: PolymarketOrderType;
    credentials: PolymarketCredentials;
    clientOrderId: string;
    feeAuth?: Record<string, unknown>;
    orderFeeAuth?: Record<string, unknown>;
    affiliate?: string;
  };
};

export type ServerPlaceOrderResult = {
  success: true;
  orderId: string;
  clientOrderId: string;
  status: "LIVE" | "MATCHED" | "DELAYED";
  orderHash?: string;
  transactionHashes?: string[];
  pullFeeTxHash?: string;
  metadata: {
    region: string;
    latencyMs: number;
    timestamp: number;
  };
};

export type ServerPlaceOrderError = {
  code: number;
  message: string;
  data?: {
    reason?: string;
    maker?: string;
    tokenId?: string;
  };
};

export type ServerPlaceOrderResponse = {
  jsonrpc: "2.0";
  id: string;
  result?: ServerPlaceOrderResult;
  error?: ServerPlaceOrderError;
};

export type ServerCancelOrderRequest = {
  orderId: string;
  signerAddress: string;
  credentials: PolymarketCredentials;
};

export type ServerCancelOrderResponse = {
  success?: boolean;
  orderId?: string;
  clobCancelResult?: {
    canceled: string[];
    not_canceled: Record<string, string>;
    error?: string;
    status?: number;
  };
  escrow?: {
    escrowOrderId: string;
    previousStatus: string;
    refundTriggered: boolean;
    refundTxHash?: string;
    refundedAmount?: string;
  };
  error?: string;
  message?: string;
  latencyMs?: number;
};

export type PerformanceFeeAuthorizationParams = {
  positionId: string;
  payer: string;
  expectedWinnings: string;
  domeAmount: string;
  affiliateAmount: string;
  chainId: number;
  deadline: number;
  signature: string;
};

export type ServerClaimWinningsRequest = {
  positionId: string;
  walletType: "eoa" | "privy";
  payerAddress: string;
  signerAddress: string;
  performanceFeeAuth: PerformanceFeeAuthorizationParams;
  signedRedeemTx?: string;
  privyWalletId?: string;
  conditionId?: string;
  outcomeIndex?: number;
  affiliate?: string;
};

export type ServerClaimWinningsResponse = {
  success?: boolean;
  positionId?: string;
  walletType?: "eoa" | "privy";
  feePulled?: boolean;
  domeAmount?: string;
  affiliateAmount?: string;
  pullFeeTxHash?: string;
  distributeTxHash?: string;
  redeemed?: boolean;
  claimTxHash?: string;
  status?: "completed" | "failed";
  error?: string;
  message?: string;
};

// Fee escrow order management endpoints (beta docs)

export type EscrowOrderStatus = "pending" | "distributed" | "refunded" | "cancelled";

export type EscrowOrder = {
  orderId: string;
  payer: string;
  signer: string;
  feeAmount: string;
  affiliate: string;
  status: EscrowOrderStatus;
  polymarketOrderId: string;
  pullFeeTxHash: string | null;
  distributeTxHash: string | null;
  refundTxHash: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EscrowOrderRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: {
    order: EscrowOrder;
  };
  error?: JsonRpcError;
};

export type ListEscrowOrdersParams = {
  payer?: string;
  signer?: string;
  status?: EscrowOrderStatus;
  limit?: number;
  offset?: number;
};

export type ListEscrowOrdersRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: {
    orders: EscrowOrder[];
    total: number;
    limit: number;
    offset: number;
  };
  error?: JsonRpcError;
};

export type CancelEscrowOrderResponse = {
  success: boolean;
  escrowOrderId: string;
  polymarketOrderId: string;
  status: EscrowOrderStatus;
  refunded?: string;
  refundTxHash?: string;
};

