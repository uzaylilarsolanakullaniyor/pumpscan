/**
 * Tarayıcı yapılandırması.
 *
 * Eşik değerleri ve skor ağırlıkları burada tutulur; kod değiştirmeden
 * davranışı ayarlamak için bu dosyayı düzenleyin. Ortam değişkeni ile de
 * geçersiz kılınabilen alanlar `envNumber()` ile okunur.
 */

function envNumber(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  // --- Eleme eşikleri -------------------------------------------------------
  thresholds: {
    minLiquidityUsd: envNumber('MIN_LIQUIDITY_USD', 5000),
    minVolume24h: envNumber('MIN_VOLUME_24H', 10000),
    // 0 = yaş sınırı yok (her yaştaki token listeye girebilir).
    maxAgeDays: envNumber('MAX_AGE_DAYS', 0),
  },

  // --- Skor ağırlıkları (her grup kendi içinde toplanır) --------------------
  scoring: {
    safety: {
      lpBurned: 40, // LP burned/locked
      mintAuthorityNull: 30, // mint authority devre dışı
      freezeAuthorityNull: 15, // freeze authority devre dışı
      holderDistribution: 15, // top10 holder yoğunluğu düşüklüğü
      // LP %90+ kilitli/yakılmışsa "burned" kabul edilir.
      lpLockedPctThreshold: 90,
    },
    momentum: {
      volume: 40, // 24s hacim büyüklüğü / değişimi
      buySellRatio: 30, // alış/satış dengesi
      priceChange: 30, // 1s + 6s fiyat momentumu
      // Hacim log-ölçeği: bu USD değerinde tam puan verilir.
      volumeFullScoreUsd: envNumber('VOLUME_FULL_SCORE_USD', 250000),
    },
  },

  // --- Rate limiting (istekler arası bekleme, ms) ---------------------------
  rateLimit: {
    dexscreenerMs: envNumber('DEX_DELAY_MS', 250),
    rugcheckMs: envNumber('RUGCHECK_DELAY_MS', 400),
  },

  // --- Genel ----------------------------------------------------------------
  // Tek bir taramada RugCheck'e sorulacak maksimum token sayısı (rate limit
  // ve süre koruması). En likit/hacimli adaylar önceliklidir.
  maxTokensPerRun: envNumber('MAX_TOKENS_PER_RUN', 150),

  // --- Token bulma (discovery) ----------------------------------------------
  // DexScreener search ucuna gönderilecek sorgular. Aday havuzunu genişletmek
  // için birden çok terim kullanılır; her sorgu ~30 pair döndürebilir.
  // SEARCH_QUERIES ortam değişkeniyle (virgülle ayrılmış) override edilebilir.
  search: {
    queries: process.env.SEARCH_QUERIES
      ? process.env.SEARCH_QUERIES.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [
          'solana',
          'SOL',
          'USDC',
          'WSOL',
          'USDT',
          'raydium',
          'pump',
          'bonk',
          'wif',
          'meme',
          'AI',
          'cat',
          'dog',
        ],
  },

  // HTTP istekleri için yeniden deneme sayısı ve timeout.
  http: {
    retries: envNumber('HTTP_RETRIES', 2),
    timeoutMs: envNumber('HTTP_TIMEOUT_MS', 12000),
    userAgent: 'solana-token-scanner/1.0 (+https://github.com)',
  },
};
