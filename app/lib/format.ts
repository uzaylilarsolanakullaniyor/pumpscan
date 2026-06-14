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

/** pair_created_at → age text like "3d 4h". */
export function formatAge(iso: string | null | undefined): string {
  if (!iso) return '—';
  const created = new Date(iso).getTime();
  if (!Number.isFinite(created)) return '—';
  const ms = Date.now() - created;
  if (ms < 0) return '—';
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h`;
  const mins = Math.floor(ms / 60_000);
  return `${mins}m`;
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

/** Relative time like "just now", "5 min ago". */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.floor(hr / 24);
  return `${day} d ago`;
}
