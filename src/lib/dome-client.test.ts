import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DomeClient } from "./dome-client.js";
import { DomeApiError } from "./errors.js";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("DomeClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serializes array query params as repeated keys", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ markets: [], pagination: { total: 0, limit: 2, has_more: false } }));

    const client = new DomeClient({ apiKey: "key" });
    await client.polymarket.markets.list({
      market_slug: ["slug-a", "slug-b"],
      limit: 2
    });

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const parsed = new URL(String(url));
    expect(parsed.searchParams.getAll("market_slug")).toEqual(["slug-a", "slug-b"]);
    expect(parsed.searchParams.get("limit")).toBe("2");
  });

  it("adds authorization header when api key is configured", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "ok", service: "link", timestamp: Date.now() }));
    const client = new DomeClient({ apiKey: "abc123" });

    await client.orderRouter.linkHealth();

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer abc123");
  });

  it("can disable auth per request", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = new DomeClient({ apiKey: "abc123" });

    await client.get("polymarket/link-health", { withAuth: false });

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("throws DomeApiError with parsed response body for HTTP errors", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "Forbidden", message: "Authentication required" }, 403)
    );
    const client = new DomeClient({ apiKey: "bad-key" });

    await expect(client.orderRouter.linkHealth()).rejects.toMatchObject({
      name: "DomeApiError",
      details: {
        status: 403,
        responseBody: {
          error: "Forbidden",
          message: "Authentication required"
        }
      }
    });
  });

  it("maps abort errors to timeout DomeApiError", async () => {
    const abort = new Error("aborted");
    Object.assign(abort, { name: "AbortError" });
    fetchMock.mockRejectedValueOnce(abort);

    const client = new DomeClient({ apiKey: "k", timeoutMs: 5 });
    await expect(client.orderRouter.linkHealth()).rejects.toBeInstanceOf(DomeApiError);
  });

  it("encodes path params safely", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ yes: { price: 0.5, at_time: 1 }, no: { price: 0.5, at_time: 1 } }));
    const client = new DomeClient({ apiKey: "k" });

    await client.kalshi.marketPrice.get("ABC/DEF");

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toContain("/kalshi/market-price/ABC%2FDEF");
  });

  it("sends correct JSON-RPC body for link-prepare", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        jsonrpc: "2.0",
        id: 1,
        result: { sessionId: "s1", expiresAt: 1, eip712Payload: { domain: {}, types: {}, primaryType: "X", message: {} } }
      })
    );
    const client = new DomeClient({ apiKey: "k" });

    await client.orderRouter.linkPrepare({ walletAddress: "0xabc", walletType: "eoa" });

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      jsonrpc: "2.0",
      method: "linkPrepare",
      params: {
        walletAddress: "0xabc",
        walletType: "eoa"
      }
    });
  });

  it("maps legacy affiliate field to affiliateAddress", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        message: "ok",
        affiliateAddress: "0xabc"
      })
    );
    const client = new DomeClient({ apiKey: "k" });

    await client.orderRouter.setAffiliate({ affiliate: "0xabc" });

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.affiliateAddress).toBe("0xabc");
    expect(body.affiliate).toBe("0xabc");
  });

  it("uses PUT for user settings update", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, settings: { feeBps: 25 } }));
    const client = new DomeClient({ apiKey: "k" });

    await client.orderRouter.userSettings.update({ feeBps: 25 });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toContain("/polymarket/user-settings");
    expect(init.method).toBe("PUT");
  });

  it("calls cancelOrder endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    const client = new DomeClient({ apiKey: "k" });

    await client.orderRouter.cancelOrder({
      orderId: "ord-1",
      signerAddress: "0xabc",
      credentials: { apiKey: "pk", apiSecret: "ps", apiPassphrase: "pp" }
    });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toContain("/polymarket/cancelOrder");
    expect(init.method).toBe("POST");
  });

  it("calls claimWinnings endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, status: "completed" }));
    const client = new DomeClient({ apiKey: "k" });

    await client.orderRouter.claimWinnings({
      positionId: "0xpos",
      walletType: "eoa",
      payerAddress: "0xpayer",
      signerAddress: "0xsigner",
      performanceFeeAuth: {
        positionId: "0xpos",
        payer: "0xpayer",
        expectedWinnings: "1",
        domeAmount: "1",
        affiliateAmount: "0",
        chainId: 137,
        deadline: 1,
        signature: "0xsig"
      },
      signedRedeemTx: "0xtx"
    });

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toContain("/polymarket/claimWinnings");
  });

  it("supports escrow order management endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ jsonrpc: "2.0", id: "1", result: { order: { orderId: "a" } } }))
      .mockResolvedValueOnce(jsonResponse({ jsonrpc: "2.0", id: "1", result: { orders: [], total: 0, limit: 50, offset: 0 } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, escrowOrderId: "a", polymarketOrderId: "b", status: "cancelled" }));

    const client = new DomeClient({ apiKey: "k" });
    await client.orderRouter.escrow.getOrder("ord-1");
    await client.orderRouter.escrow.listOrders({ payer: "0xpayer", limit: 10 });
    await client.orderRouter.escrow.cancelOrder("ord-1");

    const [getUrl] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const [listUrl] = fetchMock.mock.calls[1] as [URL, RequestInit];
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[2] as [URL, RequestInit];
    expect(String(getUrl)).toContain("/polymarket/orders/ord-1");
    expect(new URL(String(listUrl)).searchParams.get("payer")).toBe("0xpayer");
    expect(new URL(String(listUrl)).searchParams.get("limit")).toBe("10");
    expect(String(deleteUrl)).toContain("/polymarket/orders/ord-1");
    expect(deleteInit.method).toBe("DELETE");
  });

  it("serializes chainlink query params correctly", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ prices: [], total: 0 }));
    const client = new DomeClient({ apiKey: "k" });

    await client.cryptoPrices.chainlink.list({
      currency: "btc/usd",
      limit: 1
    });

    const [url] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const parsed = new URL(String(url));
    expect(parsed.searchParams.get("currency")).toBe("btc/usd");
    expect(parsed.searchParams.get("limit")).toBe("1");
  });

  it("builds websocket URL from configured api key", () => {
    const client = new DomeClient({ apiKey: "abc123" });
    expect(client.getWebSocketUrl()).toBe("wss://ws.domeapi.io/abc123");
  });

  it("throws if websocket URL requested without api key", () => {
    const client = new DomeClient();
    expect(() => client.getWebSocketUrl()).toThrow("Missing API key");
  });
});

