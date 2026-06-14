/**
 * RugCheck public API istemcisi.
 *
 * `GET /v1/tokens/{mint}/report` raporundan güvenlikle ilgili alanları çıkarır.
 * RugCheck rapor yapısı zamanla değişebildiği için tüm erişimler savunmacıdır
 * (opsiyonel zincirleme + makul varsayılanlar).
 */

const { fetchJson, toNumber, clamp } = require('./util');
const config = require('../config');

const BASE = 'https://api.rugcheck.xyz/v1';

/**
 * Tek bir mint için güvenlik özeti döndürür.
 * Rapor alınamazsa null döner (çağıran token'ı atlamaz, bilinmeyen olarak işler).
 */
async function fetchSecurity(mint) {
  const report = await fetchJson(`${BASE}/tokens/${mint}/report`);
  if (!report || typeof report !== 'object') return null;

  // --- Mint / freeze authority ---------------------------------------------
  // Authority null/boş ise yetki devre dışı (güvenli kabul edilir).
  const mintAuthority =
    report?.token?.mintAuthority ?? report?.mintAuthority ?? null;
  const freezeAuthority =
    report?.token?.freezeAuthority ?? report?.freezeAuthority ?? null;
  const mintAuthorityNull = isEmptyAuthority(mintAuthority);
  const freezeAuthorityNull = isEmptyAuthority(freezeAuthority);

  // --- LP burned / locked ---------------------------------------------------
  // Market(ler)deki en yüksek lpLockedPct değerini baz alırız.
  const lpLockedPct = extractLpLockedPct(report);
  const lpBurned =
    lpLockedPct !== null &&
    lpLockedPct >= config.scoring.safety.lpLockedPctThreshold;

  // --- Top holder yoğunluğu -------------------------------------------------
  const top10HolderPct = extractTop10Pct(report);

  // --- RugCheck'in kendi risk skoru (referans/log için) ---------------------
  const rugcheckScore =
    toNumber(report?.score_normalised) ?? toNumber(report?.score);

  return {
    mintAuthorityNull,
    freezeAuthorityNull,
    lpBurned,
    lpLockedPct,
    top10HolderPct,
    rugcheckScore,
  };
}

/** Authority değeri null, boş string veya bilinen "yok" değeri mi? */
function isEmptyAuthority(value) {
  if (value === null || value === undefined) return true;
  const s = String(value).trim().toLowerCase();
  return s === '' || s === 'null' || s === '11111111111111111111111111111111';
}

/** Market listesinden en yüksek LP kilit yüzdesini çıkarır (0-100). */
function extractLpLockedPct(report) {
  const markets = Array.isArray(report?.markets) ? report.markets : [];
  let best = null;
  for (const m of markets) {
    const pct =
      toNumber(m?.lp?.lpLockedPct) ??
      toNumber(m?.lp?.lpLockedPercentage) ??
      null;
    if (pct !== null) best = best === null ? pct : Math.max(best, pct);
  }
  // Bazı yanıtlarda üst seviyede de bulunabilir.
  if (best === null) {
    const top = toNumber(report?.totalMarketLiquidity?.lpLockedPct);
    if (top !== null) best = top;
  }
  return best === null ? null : clamp(best, 0, 100);
}

/** İlk 10 holder'ın toplam yüzdesini çıkarır (0-100). */
function extractTop10Pct(report) {
  const holders = Array.isArray(report?.topHolders) ? report.topHolders : [];
  if (holders.length === 0) return null;
  const top10 = holders.slice(0, 10);
  let sum = 0;
  for (const h of top10) {
    const pct = toNumber(h?.pct) ?? toNumber(h?.percentage);
    if (pct !== null) sum += pct;
  }
  return clamp(sum, 0, 100);
}

module.exports = { fetchSecurity };
