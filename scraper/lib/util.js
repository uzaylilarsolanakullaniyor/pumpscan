/**
 * Ortak yardımcılar: loglama, bekleme, sayı dönüştürme ve dayanıklı HTTP isteği.
 */

const config = require('../config');

/** ISO zaman damgalı, seviye etiketli basit logger (GitHub Actions dostu). */
function log(level, ...args) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}]`;
  if (level === 'error') console.error(line, ...args);
  else if (level === 'warn') console.warn(line, ...args);
  else console.log(line, ...args);
}

const logger = {
  info: (...a) => log('info', ...a),
  warn: (...a) => log('warn', ...a),
  error: (...a) => log('error', ...a),
  debug: (...a) => {
    if (process.env.DEBUG) log('debug', ...a);
  },
};

/** Belirtilen ms kadar bekler. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Güvenli sayı dönüşümü; geçersizse null döner. */
function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Değeri [min, max] aralığına sıkıştırır. */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Timeout + yeniden deneme destekli JSON fetch.
 * Başarısızlıkta hata fırlatır; çağıran tarafın yakalaması beklenir.
 */
async function fetchJson(url, { retries = config.http.retries } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.http.timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          accept: 'application/json',
          'user-agent': config.http.userAgent,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        // 429 / 5xx geçici olabilir → yeniden dene; diğer 4xx kalıcı.
        const retryable = res.status === 429 || res.status >= 500;
        const err = new Error(`HTTP ${res.status} for ${url}`);
        err.status = res.status;
        if (retryable && attempt < retries) {
          const backoff = 500 * (attempt + 1);
          logger.warn(`${err.message} — ${backoff}ms sonra tekrar denenecek`);
          await sleep(backoff);
          lastError = err;
          continue;
        }
        throw err;
      }

      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) {
        const backoff = 500 * (attempt + 1);
        logger.warn(`İstek hatası (${err.message}) — ${backoff}ms sonra tekrar`);
        await sleep(backoff);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError;
}

module.exports = { logger, sleep, toNumber, clamp, fetchJson };
