// Veritabanı satır tipleri ve frontend yardımcı tipleri.

export interface TokenRow {
  mint_address: string;
  name: string | null;
  symbol: string | null;
  price_usd: number | null;
  liquidity_usd: number | null;
  volume_24h: number | null;
  fdv: number | null;
  price_change_1h: number | null;
  price_change_6h: number | null;
  price_change_24h: number | null;
  buys_24h: number | null;
  sells_24h: number | null;
  pair_created_at: string | null;
  lp_burned: boolean | null;
  mint_authority_null: boolean | null;
  freeze_authority_null: boolean | null;
  top10_holder_pct: number | null;
  safety_score: number | null;
  momentum_score: number | null;
  dex_url: string | null;
  updated_at: string | null;
}

export interface SnapshotPoint {
  mint_address: string;
  price_usd: number | null;
  recorded_at: string;
}

// Token + o token'a ait son 24s snapshot serisi (sparkline için).
export interface TokenWithHistory extends TokenRow {
  history: number[]; // kronolojik fiyat dizisi
}

export type SortKey =
  | 'symbol'
  | 'price_usd'
  | 'price_change_1h'
  | 'price_change_6h'
  | 'price_change_24h'
  | 'volume_24h'
  | 'liquidity_usd'
  | 'buy_sell_ratio'
  | 'age'
  | 'safety_score'
  | 'momentum_score';

export type SortDir = 'asc' | 'desc';

export type ViewMode = 'safe' | 'momentum';
