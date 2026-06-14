/**
 * Supabase yazma katmanı (scraper tarafı).
 *
 * service_role key kullanılır → RLS bypass edilir. Bu key ASLA frontend'e
 * ya da public repoya konmamalıdır; GitHub Secrets üzerinden gelir.
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./util');

function createSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL ve SUPABASE_SERVICE_KEY ortam değişkenleri gerekli.',
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Bir token grubunu `tokens` tablosuna upsert eder ve `token_snapshots`'a
 * geçmiş kayıt ekler. Toplu (batch) işlem yapılır.
 *
 * @param {object} supabase
 * @param {Array<object>} rows  DB satır şekline getirilmiş token kayıtları
 */
async function persistTokens(supabase, rows) {
  if (rows.length === 0) {
    logger.warn('Yazılacak token yok.');
    return { upserted: 0, snapshots: 0 };
  }

  // --- tokens upsert (mint_address çakışmasında günceller) ------------------
  const tokenRows = rows.map((r) => ({
    mint_address: r.mintAddress,
    name: r.name,
    symbol: r.symbol,
    price_usd: r.priceUsd,
    liquidity_usd: r.liquidityUsd,
    volume_24h: r.volume24h,
    fdv: r.fdv,
    price_change_1h: r.priceChange1h,
    price_change_6h: r.priceChange6h,
    price_change_24h: r.priceChange24h,
    buys_24h: r.buys24h,
    sells_24h: r.sells24h,
    pair_created_at: r.pairCreatedAt ? r.pairCreatedAt.toISOString() : null,
    lp_burned: r.lpBurned,
    mint_authority_null: r.mintAuthorityNull,
    freeze_authority_null: r.freezeAuthorityNull,
    top10_holder_pct: r.top10HolderPct,
    safety_score: r.safetyScore,
    momentum_score: r.momentumScore,
    dex_url: r.dexUrl,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from('tokens')
    .upsert(tokenRows, { onConflict: 'mint_address' });
  if (upsertError) {
    throw new Error(`tokens upsert hatası: ${upsertError.message}`);
  }

  // --- token_snapshots insert (zaman serisi) --------------------------------
  const snapshotRows = rows.map((r) => ({
    mint_address: r.mintAddress,
    price_usd: r.priceUsd,
    volume_24h: r.volume24h,
    liquidity_usd: r.liquidityUsd,
    safety_score: r.safetyScore,
    momentum_score: r.momentumScore,
  }));

  const { error: snapshotError } = await supabase
    .from('token_snapshots')
    .insert(snapshotRows);
  if (snapshotError) {
    throw new Error(`token_snapshots insert hatası: ${snapshotError.message}`);
  }

  return { upserted: tokenRows.length, snapshots: snapshotRows.length };
}

/**
 * Verilen mint'ler için en son snapshot'ın hacmini döndürür (momentum delta
 * hesabı için). Map<mint, { volume_24h }> döner.
 */
async function fetchPreviousVolumes(supabase, mints) {
  const result = new Map();
  if (mints.length === 0) return result;

  const { data, error } = await supabase
    .from('tokens')
    .select('mint_address, volume_24h')
    .in('mint_address', mints);

  if (error) {
    logger.warn(`Önceki hacim verisi alınamadı: ${error.message}`);
    return result;
  }
  for (const row of data || []) {
    result.set(row.mint_address, { volume_24h: row.volume_24h });
  }
  return result;
}

module.exports = { createSupabase, persistTokens, fetchPreviousVolumes };
