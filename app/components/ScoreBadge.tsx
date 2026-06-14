'use client';

// Skoru renkli bir badge olarak gösterir.
// Güvenlik: yeşil >70, sarı 40-70, kırmızı <40.

interface Props {
  score: number | null;
  // 'safety' eşik renklendirmesi kullanır; 'plain' nötr gri tonlu.
  variant?: 'safety' | 'plain';
}

export default function ScoreBadge({ score, variant = 'safety' }: Props) {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return <span className="text-xs text-slate-600">—</span>;
  }

  let classes = 'bg-slate-700/40 text-slate-300 ring-slate-600/40';
  if (variant === 'safety') {
    if (score > 70) {
      classes = 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30';
    } else if (score >= 40) {
      classes = 'bg-amber-500/15 text-amber-300 ring-amber-500/30';
    } else {
      classes = 'bg-red-500/15 text-red-300 ring-red-500/30';
    }
  }

  return (
    <span
      className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ${classes}`}
    >
      {Math.round(score)}
    </span>
  );
}
