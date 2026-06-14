'use client';

// Bağımlılıksız, hafif SVG sparkline. token_snapshots'tan gelen fiyat
// dizisini küçük bir trend çizgisi olarak çizer.

interface Props {
  data: number[];
  width?: number;
  height?: number;
}

export default function Sparkline({ data, width = 80, height = 24 }: Props) {
  if (!data || data.length < 2) {
    return <span className="text-xs text-slate-600">—</span>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // düz çizgi için sıfıra bölmeyi engelle

  const stepX = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      // SVG y ekseni ters; yüksek değer yukarıda olsun.
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Yön rengi: son nokta ilk noktadan yüksekse yeşil, değilse kırmızı.
  const up = data[data.length - 1] >= data[0];
  const stroke = up ? '#34d399' : '#f87171';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
