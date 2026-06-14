import { createSupabaseServer } from '@/lib/supabase';
import { TokenRow, SnapshotPoint, TokenWithHistory } from '@/lib/types';
import { formatRelativeTime } from '@/lib/format';
import Dashboard from '@/components/Dashboard';

// Refresh data on each request (cron writes hourly; 60s ISR is plenty).
export const revalidate = 60;

async function getData(): Promise<{
  tokens: TokenWithHistory[];
  lastUpdated: string | null;
}> {
  const supabase = createSupabaseServer();

  // 1) Fetch tokens (sorted by momentum; capped).
  const { data: tokenData, error: tokenError } = await supabase
    .from('tokens')
    .select('*')
    .order('momentum_score', { ascending: false })
    .limit(300);

  if (tokenError) {
    throw new Error(`Failed to read tokens: ${tokenError.message}`);
  }
  const tokens = (tokenData ?? []) as TokenRow[];

  // 2) Fetch last 24h snapshots for these tokens in one query (sparkline).
  const mints = tokens.map((t) => t.mint_address);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const historyByMint = new Map<string, number[]>();
  if (mints.length > 0) {
    const { data: snapData, error: snapError } = await supabase
      .from('token_snapshots')
      .select('mint_address, price_usd, recorded_at')
      .in('mint_address', mints)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true });

    if (snapError) {
      // Sparkline is non-critical; continue empty on error.
      console.warn('Failed to read snapshots:', snapError.message);
    } else {
      for (const row of (snapData ?? []) as SnapshotPoint[]) {
        if (row.price_usd === null) continue;
        const arr = historyByMint.get(row.mint_address) ?? [];
        arr.push(row.price_usd);
        historyByMint.set(row.mint_address, arr);
      }
    }
  }

  const withHistory: TokenWithHistory[] = tokens.map((t) => ({
    ...t,
    history: historyByMint.get(t.mint_address) ?? [],
  }));

  // Most recent update time (for the header).
  const lastUpdated =
    tokens.reduce<string | null>((acc, t) => {
      if (!t.updated_at) return acc;
      if (!acc || t.updated_at > acc) return t.updated_at;
      return acc;
    }, null) ?? null;

  return { tokens: withHistory, lastUpdated };
}

export default async function HomePage() {
  let tokens: TokenWithHistory[] = [];
  let lastUpdated: string | null = null;
  let error: string | null = null;

  try {
    const data = await getData();
    tokens = data.tokens;
    lastUpdated = data.lastUpdated;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
  }

  return (
    <main className="mx-auto max-w-[1400px] px-3 py-6 sm:px-6">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="bg-gradient-to-r from-violet-300 via-white to-emerald-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            PumpScan
          </h1>
          <p className="text-sm text-slate-400">
            Solana token scanner · volume, momentum &amp; safety analysis
          </p>
        </div>
        <div className="text-xs text-slate-400">
          {lastUpdated ? (
            <span className="glass glass-sheen rounded-full px-3 py-1.5">
              Last updated: {formatRelativeTime(lastUpdated)}
            </span>
          ) : (
            <span>No data yet</span>
          )}
        </div>
      </header>

      {error ? (
        <div className="glass glass-sheen rounded-2xl border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <p className="font-semibold">Failed to load data.</p>
          <p className="mt-1 text-red-300/80">{error}</p>
          <p className="mt-2 text-red-300/60">
            Check that the Supabase environment variables
            (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) are set
            correctly.
          </p>
        </div>
      ) : tokens.length === 0 ? (
        <div className="glass glass-sheen rounded-2xl p-8 text-center text-slate-300">
          <p className="font-medium">No tokens to show.</p>
          <p className="mt-1 text-sm text-slate-400">
            If the scraper hasn&apos;t run yet, trigger the GitHub Actions
            workflow manually (workflow_dispatch) or wait for the hourly cron.
          </p>
        </div>
      ) : (
        <Dashboard tokens={tokens} />
      )}

      <footer className="mt-8 border-t border-white/10 pt-4 text-center text-xs text-slate-500">
        Not financial advice. Data source: DexScreener &amp; RugCheck public API.
      </footer>
    </main>
  );
}
