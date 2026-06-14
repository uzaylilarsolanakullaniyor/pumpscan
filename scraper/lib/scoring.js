/**
 * Güvenlik ve momentum skorlarının hesaplanması.
 *
 * İki skor da 0-100 aralığındadır. Ağırlıklar config.scoring altında tanımlıdır.
 * Eksik veri (null) o bileşeni 0 puan olarak ele alır; böylece bilinmeyen,
 * "kötü" yönde varsayılır (güvenlik açısından temkinli yaklaşım).
 */

const config = require('../config');
const { clamp } = require('./util');

/**
 * Güvenlik skoru (0-100).
 *   - LP burned/locked        (varsayılan %40)
 *   - mint authority null     (%30)
 *   - freeze authority null   (%15)
 *   - top10 holder dağılımı   (%15) — yoğunluk düştükçe puan artar
 *
 * @param {object} security  rugcheck.fetchSecurity çıktısı (veya null)
 */
function computeSafetyScore(security) {
  const w = config.scoring.safety;
  if (!security) return 0;

  let score = 0;

  // LP: tam kilit/yakım için tam puan, kısmiyse orantılı.
  if (security.lpLockedPct !== null && security.lpLockedPct !== undefined) {
    const frac = clamp(security.lpLockedPct / w.lpLockedPctThreshold, 0, 1);
    score += w.lpBurned * frac;
  } else if (security.lpBurned) {
    score += w.lpBurned;
  }

  if (security.mintAuthorityNull) score += w.mintAuthorityNull;
  if (security.freezeAuthorityNull) score += w.freezeAuthorityNull;

  // Holder dağılımı: top10 %0 → tam puan, %100 → 0 puan.
  if (security.top10HolderPct !== null && security.top10HolderPct !== undefined) {
    const distribution = clamp(1 - security.top10HolderPct / 100, 0, 1);
    score += w.holderDistribution * distribution;
  }

  return Math.round(clamp(score, 0, 100));
}

/**
 * Momentum skoru (0-100).
 *   - hacim büyüklüğü/değişimi (%40)
 *   - alış/satış oranı         (%30)
 *   - 1s + 6s fiyat momentumu  (%30)
 *
 * @param {object} pair     normalize edilmiş DexScreener pair
 * @param {object} [prev]   önceki snapshot ({ volume_24h }) — varsa hacim
 *                          değişimi gerçek delta'dan hesaplanır
 */
function computeMomentumScore(pair, prev) {
  const w = config.scoring.momentum;
  let score = 0;

  // --- Hacim bileşeni -------------------------------------------------------
  // Önceki snapshot varsa hacim artışını (delta) kullan; yoksa mutlak hacmi
  // log-ölçeğinde puanla.
  const volume = pair.volume24h || 0;
  let volumeFrac;
  if (prev && prev.volume_24h && prev.volume_24h > 0) {
    const change = (volume - prev.volume_24h) / prev.volume_24h; // -1..+∞
    // %0 değişim → 0.5, +%100 ve üzeri → 1.0, -%100 → 0.0
    volumeFrac = clamp(0.5 + change / 2, 0, 1);
  } else {
    // log10 ölçeği: volumeFullScoreUsd'de tam puan.
    const ratio = volume / w.volumeFullScoreUsd;
    volumeFrac = clamp(Math.log10(ratio * 9 + 1), 0, 1);
  }
  score += w.volume * volumeFrac;

  // --- Alış/satış oranı -----------------------------------------------------
  const buys = pair.buys24h || 0;
  const sells = pair.sells24h || 0;
  const total = buys + sells;
  if (total > 0) {
    // %50/50 → 0.5, tamamı alış → 1.0
    score += w.buySellRatio * (buys / total);
  } else {
    score += w.buySellRatio * 0.5; // veri yoksa nötr
  }

  // --- Fiyat momentumu (1s + 6s) -------------------------------------------
  // Her biri ±%50'de doygunluğa ulaşır; ortalaması alınır.
  const pc1 = priceChangeFrac(pair.priceChange1h);
  const pc6 = priceChangeFrac(pair.priceChange6h);
  score += w.priceChange * ((pc1 + pc6) / 2);

  return Math.round(clamp(score, 0, 100));
}

/** Yüzde fiyat değişimini 0-1 momentum kesrine çevirir (±%50 doygunluk). */
function priceChangeFrac(pct) {
  if (pct === null || pct === undefined) return 0.5; // veri yoksa nötr
  return clamp(0.5 + pct / 100, 0, 1);
}

module.exports = { computeSafetyScore, computeMomentumScore };
