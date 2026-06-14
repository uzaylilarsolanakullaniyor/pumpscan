-- ============================================================================
-- Solana Token Tarayıcı — Supabase / PostgreSQL şeması
-- ----------------------------------------------------------------------------
-- Bu dosyayı Supabase projenizde SQL Editor üzerinden çalıştırın.
-- (Dashboard > SQL Editor > New query > yapıştır > Run)
-- ============================================================================

-- Güncel token durumu (mint adresine göre tekil).
create table if not exists tokens (
  mint_address          text primary key,
  name                  text,
  symbol                text,
  price_usd             numeric,
  liquidity_usd         numeric,
  volume_24h            numeric,
  fdv                   numeric,
  price_change_1h       numeric,
  price_change_6h       numeric,
  price_change_24h      numeric,
  buys_24h              integer,
  sells_24h             integer,
  pair_created_at       timestamptz,
  lp_burned             boolean,
  mint_authority_null   boolean,
  freeze_authority_null boolean,
  top10_holder_pct      numeric,
  safety_score          numeric,
  momentum_score        numeric,
  dex_url               text,
  updated_at            timestamptz default now()
);

-- Zaman serisi geçmişi (sparkline / trend için).
create table if not exists token_snapshots (
  id            bigserial primary key,
  mint_address  text references tokens(mint_address) on delete cascade,
  price_usd     numeric,
  volume_24h    numeric,
  liquidity_usd numeric,
  safety_score  numeric,
  momentum_score numeric,
  recorded_at   timestamptz default now()
);

create index if not exists idx_snapshots_mint_time
  on token_snapshots (mint_address, recorded_at);

-- Sık kullanılan sıralama/filtreleme için yardımcı indexler.
create index if not exists idx_tokens_momentum on tokens (momentum_score desc);
create index if not exists idx_tokens_safety   on tokens (safety_score desc);
create index if not exists idx_tokens_updated  on tokens (updated_at desc);

-- ============================================================================
-- Row Level Security (RLS)
-- ----------------------------------------------------------------------------
-- Frontend yalnızca anon key ile OKUMA yapar. Yazma işlemini sadece scraper
-- (service_role key) gerçekleştirir; service_role RLS'i bypass eder.
-- ============================================================================

alter table tokens          enable row level security;
alter table token_snapshots enable row level security;

-- Herkese (anon dahil) yalnızca okuma izni.
drop policy if exists "public read tokens" on tokens;
create policy "public read tokens"
  on tokens for select
  using (true);

drop policy if exists "public read snapshots" on token_snapshots;
create policy "public read snapshots"
  on token_snapshots for select
  using (true);

-- Not: INSERT/UPDATE/DELETE için anon politikası TANIMLANMADI; bu nedenle
-- anon key ile yazma reddedilir. Scraper service_role key kullandığından
-- RLS'ten etkilenmez.
