// Görsel biçimlendirme yardımcıları.

/** $1.23K, $4.56M gibi kısa para biçimi. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

/** Küçük fiyatlar için anlamlı basamaklı fiyat biçimi. */
export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value === 0) return '$0';
  if (value >= 1) return `$${value.toFixed(4)}`;
  // Çok küçük değerlerde anlamlı basamakları koru.
  return `$${value.toPrecision(3)}`;
}

/** Yüzde değişim: işaretli, % ile. */
export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/** pair_created_at → "3g 4s" gibi yaş metni. */
export function formatAge(iso: string | null | undefined): string {
  if (!iso) return '—';
  const created = new Date(iso).getTime();
  if (!Number.isFinite(created)) return '—';
  const ms = Date.now() - created;
  if (ms < 0) return '—';
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days}g ${hours % 24}s`;
  if (hours >= 1) return `${hours}s`;
  const mins = Math.floor(ms / 60_000);
  return `${mins}d`;
}

/** Alış/satış oranı: buys/sells. */
export function buySellRatio(
  buys: number | null | undefined,
  sells: number | null | undefined,
): number | null {
  const b = buys ?? 0;
  const s = sells ?? 0;
  if (b + s === 0) return null;
  if (s === 0) return b; // tamamı alış
  return b / s;
}

export function formatRatio(ratio: number | null): string {
  if (ratio === null) return '—';
  return ratio.toFixed(2);
}

/** "az önce", "5 dk önce" gibi göreli zaman. */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return 'az önce';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}
