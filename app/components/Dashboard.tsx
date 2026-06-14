'use client';

import { useMemo, useState } from 'react';
import { TokenWithHistory, SortKey, SortDir, ViewMode } from '@/lib/types';
import { buySellRatio } from '@/lib/format';
import Filters, { FilterState } from './Filters';
import TokenTable from './TokenTable';

interface Props {
  tokens: TokenWithHistory[];
}

const SAFE_THRESHOLD = 70; // "Trend & Güvenli" sekmesi eşiği

export default function Dashboard({ tokens }: Props) {
  const [view, setView] = useState<ViewMode>('safe');
  const [sortKey, setSortKey] = useState<SortKey>('momentum_score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filters, setFilters] = useState<FilterState>({
    minLiquidity: 0,
    minVolume: 0,
    minSafety: 0,
  });

  // Kolon başlığına tıklama: aynı kolon → yön değiştir, farklı → o kolonda desc.
  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  // Filtreleme + sekme + sıralama tamamen client-side; tekrar API çağrısı yok.
  const visible = useMemo(() => {
    let rows = tokens.filter((t) => {
      if ((t.liquidity_usd ?? 0) < filters.minLiquidity) return false;
      if ((t.volume_24h ?? 0) < filters.minVolume) return false;
      if ((t.safety_score ?? 0) < filters.minSafety) return false;
      // "Trend & Güvenli" sekmesi: yalnızca güvenli tokenlar.
      if (view === 'safe' && (t.safety_score ?? 0) < SAFE_THRESHOLD) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      return compare(a, b, sortKey) * dir;
    });

    return rows;
  }, [tokens, filters, view, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      {/* Sekmeler */}
      <div className="flex items-center gap-2">
        <TabButton active={view === 'safe'} onClick={() => setView('safe')}>
          Trend &amp; Güvenli
        </TabButton>
        <TabButton
          active={view === 'momentum'}
          onClick={() => setView('momentum')}
        >
          Yüksek Momentum
        </TabButton>
        <span className="ml-auto text-xs text-slate-500">
          {visible.length} token
        </span>
      </div>

      <Filters value={filters} onChange={setFilters} />

      <TokenTable
        tokens={visible}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        showSafetyWarning={view === 'momentum'}
        safeThreshold={SAFE_THRESHOLD}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30'
          : 'bg-surface text-slate-400 ring-1 ring-inset ring-border hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

// İki token'ı verilen sıralama anahtarına göre kıyaslar.
function compare(a: TokenWithHistory, b: TokenWithHistory, key: SortKey): number {
  switch (key) {
    case 'symbol':
      return (a.symbol ?? '').localeCompare(b.symbol ?? '');
    case 'buy_sell_ratio': {
      const ra = buySellRatio(a.buys_24h, a.sells_24h) ?? -1;
      const rb = buySellRatio(b.buys_24h, b.sells_24h) ?? -1;
      return ra - rb;
    }
    case 'age': {
      // Daha yeni = daha büyük created timestamp.
      const ta = a.pair_created_at ? new Date(a.pair_created_at).getTime() : 0;
      const tb = b.pair_created_at ? new Date(b.pair_created_at).getTime() : 0;
      return ta - tb;
    }
    default: {
      // Bu noktada `key` yalnızca sayısal DB kolonlarına denk gelir.
      const k = key as keyof TokenWithHistory;
      const va = (a[k] as number | null) ?? -Infinity;
      const vb = (b[k] as number | null) ?? -Infinity;
      return va - vb;
    }
  }
}
