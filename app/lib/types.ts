export type Decision = "watch" | "conditional" | "rejected";

export type SecurityStatus = "verified" | "unknown" | "risky";

export interface VolumeWindows {
  m5: number | null;
  h1: number | null;
  h6: number | null;
  h24: number | null;
}

export interface PriceChanges {
  m5: number | null;
  h1: number | null;
  h6: number | null;
  h24: number | null;
}

export interface SecuritySnapshot {
  status: SecurityStatus;
  score: number | null;
  mintAuthority: "disabled" | "enabled" | "unknown";
  freezeAuthority: "disabled" | "enabled" | "unknown";
  lpLockedPct: number | null;
  top10HolderPct: number | null;
  clusterPct: number | null;
  bundlerPct: number | null;
  devSells: number | null;
  riskFlags: string[];
}

export interface TokenRow {
  mint_address: string;
  pair_address: string | null;
  name: string | null;
  symbol: string | null;
  dex_id: string | null;
  price_usd: number | null;
  market_cap: number | null;
  fdv: number | null;
  liquidity_usd: number | null;
  volume_5m: number | null;
  volume_1h: number | null;
  volume_6h: number | null;
  volume_24h: number | null;
  price_change_5m: number | null;
  price_change_1h: number | null;
  price_change_6h: number | null;
  price_change_24h: number | null;
  buys_24h: number | null;
  sells_24h: number | null;
  unique_traders_24h: number | null;
  buy_volume_usd: number | null;
  sell_volume_usd: number | null;
  pair_created_at: string | null;
  lp_burned: boolean | null;
  lp_locked_pct: number | null;
  mint_authority_null: boolean | null;
  freeze_authority_null: boolean | null;
  top10_holder_pct: number | null;
  cluster_pct: number | null;
  bundler_pct: number | null;
  dev_sells: number | null;
  security_status: SecurityStatus;
  safety_score: number | null;
  momentum_score: number | null;
  radar_score: number | null;
  decision: Decision;
  risk_flags: string[];
  radar_reason: string | null;
  highest_risk: string | null;
  dex_url: string | null;
  rugcheck_url: string | null;
  updated_at: string | null;
  history: number[];
}

export interface TokenWithHistory extends TokenRow {}

export type FilterDecision = "all" | Decision;
export type ScanPreset = "all" | "new" | "accelerating" | "deep-liquidity";
