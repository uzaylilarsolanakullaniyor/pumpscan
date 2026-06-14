/**
 * Solana Token Tarayıcı — ana giriş noktası.
 *
 * GitHub Actions üzerinde saatlik cron ile çalışır. Akış:
 *   1) DexScreener'dan Solana aday tokenlarını topla
 *   2) Eşikleri (likidite / hacim / yaş) uygula
 *   3) Eşiği geçenler için RugCheck güvenlik raporunu çek
 *   4) Güvenlik + momentum skorlarını hesapla
 *   5) Supabase'e upsert et + snapshot ekle
 *
 * Hata yönetimi: tek bir token'ın hatası tüm taramayı durdurmaz; loglanıp
 * atlanır. Yalnızca ölümcül hatalar (ör. eksik env, Supabase yazma hatası)
 * process'i non-zero kod ile sonlandırır.
 */

const config = require('./config');
const { logger, sleep } = require('./lib/util');
const dex = require('./lib/dexscreener');
const { fetchSecurity } = require('./lib/rugcheck');
const { computeSafetyScore, computeMomentumScore } = require('./lib/scoring');
const {
  createSupabase,
  persistTokens,
  fetchPreviousVolumes,
} = require('./lib/supabase');

/** Eşik kontrolü: likidite, hacim ve yaş. */
function passesThresholds(pair) {
  const t = config.thresholds;
  if ((pair.liquidityUsd || 0) < t.minLiquidityUsd) return false;
  if ((pair.volume24h || 0) < t.minVolume24h) return false;

  if (pair.pairCreatedAt) {
    const ageDays = (Date.now() - pair.pairCreatedAt.getTime()) / 86400000;
    if (ageDays > t.maxAgeDays) return false;
  }
  // pairCreatedAt yoksa yaşı bilinmiyor → elemeyiz (diğer eşikler korur).
  return true;
}

async function main() {
  const startedAt = Date.now();
  logger.info('Tarama başlıyor…');
  logger.info(
    `Eşikler: likidite>=$${config.thresholds.minLiquidityUsd}, ` +
      `hacim>=$${config.thresholds.minVolume24h}, ` +
      `yaş<=${config.thresholds.maxAgeDays}g`,
  );

  const supabase = createSupabase();

  // --- 1) Adayları topla ----------------------------------------------------
  const addressSet = await dex.collectCandidateAddresses();
  const searchPairs = await dex.searchSolanaPairs(addressSet);

  // search'ten gelen pair'ler için tekrar tokens çağrısı yapmamak adına
  // bunları doğrudan kullanırız. Kalan adresler için tokens ucunu çağırırız.
  const pairsByMint = new Map();
  for (const p of searchPairs) {
    if (!pairsByMint.has(p.mintAddress)) pairsByMint.set(p.mintAddress, p);
  }

  const remaining = [...addressSet].filter((a) => !pairsByMint.has(a));
  logger.info(
    `Toplam aday: ${addressSet.size} | search'ten hazır: ${pairsByMint.size} | ` +
      `pair çekilecek: ${remaining.length}`,
  );

  for (const address of remaining) {
    try {
      const pair = await dex.fetchBestPairForToken(address);
      if (pair) pairsByMint.set(pair.mintAddress, pair);
    } catch (err) {
      logger.warn(`Pair alınamadı (${address}): ${err.message}`);
    }
    await sleep(config.rateLimit.dexscreenerMs);
  }

  // --- 2) Eşikleri uygula ---------------------------------------------------
  let candidates = [...pairsByMint.values()].filter(passesThresholds);
  logger.info(`Eşikleri geçen token: ${candidates.length}`);

  // En likit/hacimli olanları önceliklendirip RugCheck çağrısını sınırla.
  candidates.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
  if (candidates.length > config.maxTokensPerRun) {
    logger.info(
      `RugCheck için ilk ${config.maxTokensPerRun} token alınıyor ` +
        `(toplam ${candidates.length}).`,
    );
    candidates = candidates.slice(0, config.maxTokensPerRun);
  }

  // Momentum delta'sı için önceki hacimleri tek sorguda al.
  const prevVolumes = await fetchPreviousVolumes(
    supabase,
    candidates.map((c) => c.mintAddress),
  );

  // --- 3 & 4) RugCheck + skorlama ------------------------------------------
  const rows = [];
  let securityOk = 0;
  let securityFail = 0;

  for (const pair of candidates) {
    let security = null;
    try {
      security = await fetchSecurity(pair.mintAddress);
      if (security) securityOk++;
      else securityFail++;
    } catch (err) {
      securityFail++;
      logger.warn(`RugCheck hatası (${pair.symbol || pair.mintAddress}): ${err.message}`);
    }

    const safetyScore = computeSafetyScore(security);
    const momentumScore = computeMomentumScore(
      pair,
      prevVolumes.get(pair.mintAddress),
    );

    rows.push({
      ...pair,
      lpBurned: security?.lpBurned ?? null,
      mintAuthorityNull: security?.mintAuthorityNull ?? null,
      freezeAuthorityNull: security?.freezeAuthorityNull ?? null,
      top10HolderPct: security?.top10HolderPct ?? null,
      safetyScore,
      momentumScore,
    });

    await sleep(config.rateLimit.rugcheckMs);
  }

  logger.info(`RugCheck: ${securityOk} başarılı, ${securityFail} başarısız/eksik`);

  // --- 5) Supabase'e yaz ----------------------------------------------------
  const { upserted, snapshots } = await persistTokens(supabase, rows);
  logger.info(`Yazıldı: ${upserted} token upsert, ${snapshots} snapshot`);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  logger.info(`Tarama tamamlandı (${elapsed}s).`);
}

main().catch((err) => {
  logger.error('ÖLÜMCÜL HATA:', err.stack || err.message);
  process.exit(1);
});
