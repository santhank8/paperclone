export interface BrokerOrder {
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  type: "market" | "limit" | "stop" | "stop_limit";
  timeInForce: "day" | "gtc" | "ioc";
  limitPrice?: number;
  stopPrice?: number;
}

export interface BrokerOrderResult {
  id: string;
  clientOrderId: string;
  symbol: string;
  side: string;
  qty: string;
  filledQty: string;
  filledAvgPrice: string | null;
  type: string;
  status: string;
  createdAt: string;
}

export interface BrokerPosition {
  symbol: string;
  qty: string;
  side: string;
  avgEntryPrice: string;
  marketValue: string;
  currentPrice: string;
  unrealizedPl: string;
  unrealizedPlpc: string;
}

export interface BrokerAccount {
  id: string;
  equity: string;
  cash: string;
  buyingPower: string;
  portfolioValue: string;
  currency: string;
}

export interface BrokerQuote {
  symbol: string;
  bidPrice: number;
  askPrice: number;
  lastPrice: number;
  timestamp: string;
}

export interface RiskCheck {
  passed: boolean;
  reason?: string;
  maxAllowedQty?: number;
}
