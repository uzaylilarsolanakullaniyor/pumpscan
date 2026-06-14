'use client';

import { useMemo, useState } from 'react';
import { TokenWithHistory, SortKey, SortDir, ViewMode } from '@/lib/types';
import { buySellRatio } from '@/lib/format';
import Filters, { FilterState } from './Filters';
import TokenTable from './TokenTable';

interface Props {
  tokens: TokenWithHistory[];
}

const SAFE_THRESHOLD = 70; // "Trending & Safe" tab threshold

export default function Dashboard({ tokens }: Props) {
  const [view, setView] = useState<ViewMode>('safe');
  const [sortKey, setSortKey] = useState<SortKey>('momentum_score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filters, setFilters] = useState<FilterState>({
    minLiquidity: 0,
    minVolume: 0,
    minSafety: 0,
  });

  // Header click: same column → toggle direction, different → sort desc on it.
  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  // Filtering + tab + sorting are fully client-side; no extra API calls.
  const visible = useMemo(() => {
    let rows = tokens.filter((t) => {
      if ((t.liquidity_usd ?? 0) < filters.minLiquidity) return false;
      if ((t.volume_24h ?? 0) < filters.minVolume) return false;
      if ((t.safety_score ?? 0) < filters.minSafety) return false;
      // "Trending & Safe" tab: only safe tokens.
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
      {/* Tabs */}
      <div className="flex items-center gap-2">
        <TabButton active={view === 'safe'} onClick={() => setView('safe')}>
          Trending &amp; Safe
        </TabButton>
        <TabButton
          active={view === 'momentum'}
          onClick={() => setView('momentum')}
        >
          High Momentum
        </TabButton>
        <span className="ml-auto text-xs text-slate-400">
          {visible.length} tokens
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
      className={`glass-sheen rounded-xl px-4 py-2 text-sm font-medium transition-all ${
        active
          ? 'glass-strong text-emerald-200 ring-1 ring-inset ring-emerald-400/30'
          : 'glass text-slate-300 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

// Compare two tokens by the given sort key.
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
      // Newer = larger created timestamp.
      const ta = a.pair_created_at ? new Date(a.pair_created_at).getTime() : 0;
      const tb = b.pair_created_at ? new Date(b.pair_created_at).getTime() : 0;
      return ta - tb;
    }
    default: {
      // At this point `key` only maps to numeric DB columns.
      const k = key as keyof TokenWithHistory;
      const va = (a[k] as number | null) ?? -Infinity;
      const vb = (b[k] as number | null) ?? -Infinity;
      return va - vb;
    }
  }
}
