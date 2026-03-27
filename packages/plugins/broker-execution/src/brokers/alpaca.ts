import type { BrokerAccount, BrokerOrder, BrokerOrderResult, BrokerPosition, BrokerQuote } from "./types.js";

export class AlpacaClient {
  private baseUrl: string;
  private dataUrl: string;
  private headers: Record<string, string>;

  constructor(
    private apiKey: string,
    private apiSecret: string,
    private paper: boolean = true,
  ) {
    this.baseUrl = paper
      ? "https://paper-api.alpaca.markets"
      : "https://api.alpaca.markets";
    this.dataUrl = "https://data.alpaca.markets";
    this.headers = {
      "APCA-API-KEY-ID": apiKey,
      "APCA-API-SECRET-KEY": apiSecret,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: { ...this.headers, ...init?.headers },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Alpaca API error ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  async getAccount(): Promise<BrokerAccount> {
    const data = await this.request<Record<string, string>>(`${this.baseUrl}/v2/account`);
    return {
      id: data.id,
      equity: data.equity,
      cash: data.cash,
      buyingPower: data.buying_power,
      portfolioValue: data.portfolio_value,
      currency: data.currency,
    };
  }

  async getPositions(): Promise<BrokerPosition[]> {
    const data = await this.request<Record<string, string>[]>(`${this.baseUrl}/v2/positions`);
    return data.map((p) => ({
      symbol: p.symbol,
      qty: p.qty,
      side: p.side,
      avgEntryPrice: p.avg_entry_price,
      marketValue: p.market_value,
      currentPrice: p.current_price,
      unrealizedPl: p.unrealized_pl,
      unrealizedPlpc: p.unrealized_plpc,
    }));
  }

  async placeOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
    const body = {
      symbol: order.symbol,
      qty: String(order.qty),
      side: order.side,
      type: order.type,
      time_in_force: order.timeInForce,
      ...(order.limitPrice && { limit_price: String(order.limitPrice) }),
      ...(order.stopPrice && { stop_price: String(order.stopPrice) }),
    };

    const data = await this.request<Record<string, string | null>>(
      `${this.baseUrl}/v2/orders`,
      { method: "POST", body: JSON.stringify(body) },
    );

    return {
      id: data.id as string,
      clientOrderId: data.client_order_id as string,
      symbol: data.symbol as string,
      side: data.side as string,
      qty: data.qty as string,
      filledQty: data.filled_qty as string,
      filledAvgPrice: data.filled_avg_price,
      type: data.type as string,
      status: data.status as string,
      createdAt: data.created_at as string,
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    await fetch(`${this.baseUrl}/v2/orders/${orderId}`, {
      method: "DELETE",
      headers: this.headers,
    });
  }

  async closePosition(symbol: string): Promise<BrokerOrderResult> {
    return this.request<BrokerOrderResult>(
      `${this.baseUrl}/v2/positions/${symbol}`,
      { method: "DELETE" },
    );
  }

  async getQuote(symbol: string): Promise<BrokerQuote> {
    const data = await this.request<Record<string, unknown>>(
      `${this.dataUrl}/v2/stocks/${symbol}/quotes/latest`,
    );
    const quote = data.quote as Record<string, unknown>;
    return {
      symbol,
      bidPrice: Number(quote.bp),
      askPrice: Number(quote.ap),
      lastPrice: (Number(quote.bp) + Number(quote.ap)) / 2,
      timestamp: quote.t as string,
    };
  }

  async getCryptoQuote(symbol: string): Promise<BrokerQuote> {
    const data = await this.request<Record<string, unknown>>(
      `${this.dataUrl}/v1beta3/crypto/us/latest/quotes?symbols=${symbol}`,
    );
    const quotes = data.quotes as Record<string, Record<string, unknown>>;
    const quote = quotes[symbol];
    return {
      symbol,
      bidPrice: Number(quote.bp),
      askPrice: Number(quote.ap),
      lastPrice: (Number(quote.bp) + Number(quote.ap)) / 2,
      timestamp: quote.t as string,
    };
  }
}
