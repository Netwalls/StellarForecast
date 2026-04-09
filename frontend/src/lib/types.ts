export type MarketState = "open" | "closed" | "resolved" | "resolving";

export interface Market {
  id: number;
  creator: string;
  question: string;
  end_time: number; // unix timestamp
  yes_pool: string; // stroops as string
  no_pool: string;
  state: MarketState;
  outcome: 0 | 1 | 2; // 0=unresolved, 1=YES, 2=NO
  evidence_hash: string;
}

export interface Bet {
  market_id: number;
  is_yes: boolean;
  amount: string;
  claimed: boolean;
}

export interface OracleResolution {
  market_id: number;
  outcome: 1 | 2;
  evidence: string;
  tx_hash: string;
}
