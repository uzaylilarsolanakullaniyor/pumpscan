-- SOL MEME TRENCHES / Supabase PostgreSQL
-- Run once in Supabase SQL Editor. API keys stay in Vercel Environment Variables.

create table if not exists tokens (
  mint_address text primary key,
  pair_address text,
  name text,
  symbol text,
  dex_id text,
  price_usd numeric,
  market_cap numeric,
  fdv numeric,
  liquidity_usd numeric,
  volume_5m numeric,
  volume_1h numeric,
  volume_6h numeric,
  volume_24h numeric,
  price_change_5m numeric,
  price_change_1h numeric,
  price_change_6h numeric,
  price_change_24h numeric,
  buys_24h integer,
  sells_24h integer,
  unique_traders_24h integer,
  buy_volume_usd numeric,
  sell_volume_usd numeric,
  pair_created_at timestamptz,
  lp_burned boolean,
  lp_locked_pct numeric,
  mint_authority_null boolean,
  freeze_authority_null boolean,
  top10_holder_pct numeric,
  cluster_pct numeric,
  bundler_pct numeric,
  dev_sells integer,
  security_status text not null default 'unknown',
  safety_score numeric,
  momentum_score numeric,
  radar_score numeric,
  decision text not null default 'conditional',
  risk_flags jsonb not null default '[]'::jsonb,
  radar_reason text,
  highest_risk text,
  dex_url text,
  rugcheck_url text,
  updated_at timestamptz not null default now()
);

alter table tokens add column if not exists pair_address text;
alter table tokens add column if not exists dex_id text;
alter table tokens add column if not exists market_cap numeric;
alter table tokens add column if not exists volume_5m numeric;
alter table tokens add column if not exists volume_1h numeric;
alter table tokens add column if not exists volume_6h numeric;
alter table tokens add column if not exists price_change_5m numeric;
alter table tokens add column if not exists unique_traders_24h integer;
alter table tokens add column if not exists buy_volume_usd numeric;
alter table tokens add column if not exists sell_volume_usd numeric;
alter table tokens add column if not exists lp_locked_pct numeric;
alter table tokens add column if not exists cluster_pct numeric;
alter table tokens add column if not exists bundler_pct numeric;
alter table tokens add column if not exists dev_sells integer;
alter table tokens add column if not exists security_status text not null default 'unknown';
alter table tokens add column if not exists radar_score numeric;
alter table tokens add column if not exists decision text not null default 'conditional';
alter table tokens add column if not exists risk_flags jsonb not null default '[]'::jsonb;
alter table tokens add column if not exists radar_reason text;
alter table tokens add column if not exists highest_risk text;
alter table tokens add column if not exists rugcheck_url text;

create table if not exists token_snapshots (
  id bigserial primary key,
  mint_address text not null references tokens(mint_address) on delete cascade,
  price_usd numeric,
  market_cap numeric,
  volume_5m numeric,
  volume_1h numeric,
  volume_6h numeric,
  volume_24h numeric,
  liquidity_usd numeric,
  safety_score numeric,
  momentum_score numeric,
  radar_score numeric,
  decision text,
  recorded_at timestamptz not null default now()
);

alter table token_snapshots add column if not exists market_cap numeric;
alter table token_snapshots add column if not exists volume_5m numeric;
alter table token_snapshots add column if not exists volume_1h numeric;
alter table token_snapshots add column if not exists volume_6h numeric;
alter table token_snapshots add column if not exists radar_score numeric;
alter table token_snapshots add column if not exists decision text;

create table if not exists watchlist (
  watcher_id text not null,
  mint_address text not null references tokens(mint_address) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (watcher_id, mint_address)
);

create index if not exists idx_tokens_radar on tokens (radar_score desc nulls last);
create index if not exists idx_tokens_decision on tokens (decision);
create index if not exists idx_tokens_updated on tokens (updated_at desc);
create index if not exists idx_snapshots_mint_time
  on token_snapshots (mint_address, recorded_at desc);
create index if not exists idx_watchlist_watcher on watchlist (watcher_id);

alter table tokens enable row level security;
alter table token_snapshots enable row level security;
alter table watchlist enable row level security;

drop policy if exists "public read tokens" on tokens;
create policy "public read tokens" on tokens for select using (true);

drop policy if exists "public read snapshots" on token_snapshots;
create policy "public read snapshots" on token_snapshots for select using (true);

-- Watchlist read/write is server-only through SUPABASE_SERVICE_ROLE_KEY.
-- No anon policies are created for watchlist.
