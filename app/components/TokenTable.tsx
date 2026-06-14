'use client';

import { TokenWithHistory, SortKey, SortDir } from '@/lib/types';
import {
  formatUsd,
  formatPrice,
  formatPct,
  formatAge,
  buySellRatio,
  formatRatio,
} from '@/lib/format';
import ScoreBadge from './ScoreBadge';
import Sparkline from './Sparkline';

interface Props {
  tokens: TokenWithHistory[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  showSafetyWarning: boolean; // warn on low safety in the "High Momentum" tab
  safeThreshold: number;
}

// Sortable column definitions (also used as labels in the mobile card view).
const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
  { key: 'symbol', label: 'Token', align: 'left' },
  { key: 'price_usd', label: 'Price', align: 'right' },
  { key: 'price_change_1h', label: '1h', align: 'right' },
  { key: 'price_change_6h', label: '6h', align: 'right' },
  { key: 'price_change_24h', label: '24h', align: 'right' },
  { key: 'volume_24h', label: 'Volume', align: 'right' },
  { key: 'liquidity_usd', label: 'Liquidity', align: 'right' },
  { key: 'buy_sell_ratio', label: 'B/S', align: 'right' },
  { key: 'age', label: 'Age', align: 'right' },
  { key: 'safety_score', label: 'Safety', align: 'right' },
  { key: 'momentum_score', label: 'Momentum', align: 'right' },
];

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-slate-600">↕</span>;
  return <span className="text-emerald-400">{dir === 'desc' ? '↓' : '↑'}</span>;
}

// Renders a signed percentage with color.
function PctCell({ value }: { value: number | null }) {
  const color =
    value === null
      ? 'text-slate-500'
      : value > 0
        ? 'text-emerald-400'
        : value < 0
          ? 'text-red-400'
          : 'text-slate-400';
  return <span className={`tabular-nums ${color}`}>{formatPct(value)}</span>;
}

export default function TokenTable({
  tokens,
  sortKey,
  sortDir,
  onSort,
  showSafetyWarning,
  safeThreshold,
}: Props) {
  return (
    <>
      {/* ---- Desktop table ---- */}
      <div className="glass glass-sheen hidden overflow-x-auto rounded-2xl md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`whitespace-nowrap px-3 py-3 font-medium ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  <button
                    onClick={() => onSort(col.key)}
                    className={`inline-flex items-center gap-1 hover:text-white ${
                      col.align === 'right' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    {col.label}
                    <SortArrow active={sortKey === col.key} dir={sortDir} />
                  </button>
                </th>
              ))}
              <th className="px-3 py-3 text-right font-medium">24h Trend</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => {
              const lowSafety = (t.safety_score ?? 0) < safeThreshold;
              const ratio = buySellRatio(t.buys_24h, t.sells_24h);
              return (
                <tr
                  key={t.mint_address}
                  className="border-b border-white/5 transition-colors hover:bg-white/5"
                >
                  {/* Token name/symbol → DexScreener link */}
                  <td className="px-3 py-2.5">
                    <a
                      href={t.dex_url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex flex-col"
                    >
                      <span className="flex items-center gap-1.5 font-semibold text-slate-100 group-hover:text-emerald-300">
                        {t.symbol ?? '?'}
                        {showSafetyWarning && lowSafety && (
                          <span
                            title="Low safety score"
                            className="rounded bg-red-500/15 px-1 text-[10px] font-bold text-red-300 ring-1 ring-inset ring-red-500/30"
                          >
                            ⚠ RISK
                          </span>
                        )}
                      </span>
                      <span className="max-w-[160px] truncate text-xs text-slate-500">
                        {t.name ?? t.mint_address.slice(0, 8)}
                      </span>
                    </a>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">
                    {formatPrice(t.price_usd)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <PctCell value={t.price_change_1h} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <PctCell value={t.price_change_6h} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <PctCell value={t.price_change_24h} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                    {formatUsd(t.volume_24h)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                    {formatUsd(t.liquidity_usd)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                    {formatRatio(ratio)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">
                    {formatAge(t.pair_created_at)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <ScoreBadge score={t.safety_score} variant="safety" />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <ScoreBadge score={t.momentum_score} variant="plain" />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end">
                      <Sparkline data={t.history} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---- Mobile card view ---- */}
      <div className="space-y-3 md:hidden">
        {tokens.map((t) => {
          const lowSafety = (t.safety_score ?? 0) < safeThreshold;
          const ratio = buySellRatio(t.buys_24h, t.sells_24h);
          return (
            <a
              key={t.mint_address}
              href={t.dex_url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="glass glass-sheen block rounded-2xl p-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                    {t.symbol ?? '?'}
                    {showSafetyWarning && lowSafety && (
                      <span className="rounded bg-red-500/15 px-1 text-[10px] font-bold text-red-300 ring-1 ring-inset ring-red-500/30">
                        ⚠ RISK
                      </span>
                    )}
                  </div>
                  <div className="max-w-[180px] truncate text-xs text-slate-500">
                    {t.name ?? t.mint_address.slice(0, 8)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular-nums text-slate-100">
                    {formatPrice(t.price_usd)}
                  </div>
                  <Sparkline data={t.history} />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Stat label="1h">
                  <PctCell value={t.price_change_1h} />
                </Stat>
                <Stat label="6h">
                  <PctCell value={t.price_change_6h} />
                </Stat>
                <Stat label="24h">
                  <PctCell value={t.price_change_24h} />
                </Stat>
                <Stat label="Volume">{formatUsd(t.volume_24h)}</Stat>
                <Stat label="Liquidity">{formatUsd(t.liquidity_usd)}</Stat>
                <Stat label="B/S">{formatRatio(ratio)}</Stat>
                <Stat label="Age">{formatAge(t.pair_created_at)}</Stat>
                <Stat label="Safety">
                  <ScoreBadge score={t.safety_score} variant="safety" />
                </Stat>
                <Stat label="Momentum">
                  <ScoreBadge score={t.momentum_score} variant="plain" />
                </Stat>
              </div>
            </a>
          );
        })}
      </div>
    </>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="tabular-nums text-slate-200">{children}</span>
    </div>
  );
}
