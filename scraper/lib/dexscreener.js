/**
 * DexScreener public API istemcisi.
 *
 * Akış:
 *   1. boosts + profiles + search uçlarından Solana aday token adreslerini topla.
 *   2. Her aday için en likit Solana pair'ini getir (tokens ucu).
 *   3. Pair verisini normalize edilmiş bir nesneye dönüştür.
 *
 * API key gerektirmez. Public endpoint olduğundan istekler arasına gecikme
 * koyarak rate limit'e saygı gösteririz (config.rateLimit.dexscreenerMs).
 */

const config = require('../config');
const { fetchJson, sleep, toNumber, logger } = require('./util');

const BASE = 'https://api.dexscreener.com';
const SOLANA = 'solana';

/** boosts ve profiles uçlarından Solana token adreslerini toplar. */
async function collectCandidateAddresses() {
  const addresses = new Set();

  const listEndpoints = [
    `${BASE}/token-boosts/latest/v1`,
    `${BASE}/token-profiles/latest/v1`,
  ];

  for (const url of listEndpoints) {
    try {
      const data = await fetchJson(url);
      const items = Array.isArray(data) ? data : data?.tokens || [];
      for (const item of items) {
        if (item?.chainId === SOLANA && item?.tokenAddress) {
          addresses.add(item.tokenAddress);
        }
      }
      logger.info(`${url} → ${addresses.size} aday (kümülatif)`);
    } catch (err) {
      logger.warn(`Aday listesi alınamadı (${url}): ${err.message}`);
    }
    await sleep(config.rateLimit.dexscreenerMs);
  }

  return addresses;
}

/**
 * search ucundan doğrudan trend pair'leri toplar. Bu uç pair verisini
 * tam olarak döndürdüğü için sonuçları normalize edip geri veririz; ek olarak
 * keşfedilen yeni adresleri de aday kümesine ekleriz.
 */
async function searchSolanaPairs(addressSet) {
  const pairs = [];
  try {
    const data = await fetchJson(`${BASE}/latest/dex/search?q=solana`);
    for (const pair of data?.pairs || []) {
      if (pair?.chainId !== SOLANA) continue;
      const normalized = normalizePair(pair);
      if (normalized) {
        pairs.push(normalized);
        addressSet.add(normalized.mintAddress);
      }
    }
    logger.info(`search?q=solana → ${pairs.length} pair`);
  } catch (err) {
    logger.warn(`search ucu hatası: ${err.message}`);
  }
  await sleep(config.rateLimit.dexscreenerMs);
  return pairs;
}

/** Bir token adresi için en likit Solana pair'ini getirir. */
async function fetchBestPairForToken(tokenAddress) {
  const url = `${BASE}/latest/dex/tokens/${tokenAddress}`;
  const data = await fetchJson(url);
  const pairs = (data?.pairs || []).filter((p) => p?.chainId === SOLANA);
  if (pairs.length === 0) return null;

  // En yüksek likiditeye sahip pair'i seç.
  pairs.sort(
    (a, b) => (toNumber(b?.liquidity?.usd) || 0) - (toNumber(a?.liquidity?.usd) || 0),
  );
  return normalizePair(pairs[0]);
}

/** DexScreener pair nesnesini iç modelimize çevirir. */
function normalizePair(pair) {
  const mintAddress = pair?.baseToken?.address;
  if (!mintAddress) return null;

  return {
    mintAddress,
    name: pair?.baseToken?.name || null,
    symbol: pair?.baseToken?.symbol || null,
    priceUsd: toNumber(pair?.priceUsd),
    liquidityUsd: toNumber(pair?.liquidity?.usd),
    volume24h: toNumber(pair?.volume?.h24),
    fdv: toNumber(pair?.fdv),
    priceChange1h: toNumber(pair?.priceChange?.h1),
    priceChange6h: toNumber(pair?.priceChange?.h6),
    priceChange24h: toNumber(pair?.priceChange?.h24),
    buys24h: toNumber(pair?.txns?.h24?.buys),
    sells24h: toNumber(pair?.txns?.h24?.sells),
    // pairCreatedAt ms cinsinden epoch; yoksa null.
    pairCreatedAt: pair?.pairCreatedAt ? new Date(pair.pairCreatedAt) : null,
    dexUrl: pair?.url || null,
  };
}

module.exports = {
  collectCandidateAddresses,
  searchSolanaPairs,
  fetchBestPairForToken,
  normalizePair,
};
