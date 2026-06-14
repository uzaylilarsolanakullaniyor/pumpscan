import { createSupabaseServer } from '@/lib/supabase';
import { TokenRow, SnapshotPoint, TokenWithHistory } from '@/lib/types';
import { formatRelativeTime } from '@/lib/format';
import Dashboard from '@/components/Dashboard';

// Veriyi her istekte tazele (cron saatlik yazıyor; 60sn ISR yeterli).
export const revalidate = 60;

async function getData(): Promise<{
  tokens: TokenWithHistory[];
  lastUpdated: string | null;
}> {
  const supabase = createSupabaseServer();

  // 1) Tokenları çek (momentum'a göre sıralı; üst sınır koy).
  const { data: tokenData, error: tokenError } = await supabase
    .from('tokens')
    .select('*')
    .order('momentum_score', { ascending: false })
    .limit(300);

  if (tokenError) {
    throw new Error(`tokens okunamadı: ${tokenError.message}`);
  }
  const tokens = (tokenData ?? []) as TokenRow[];

  // 2) Bu tokenlar için son 24s snapshot'ları tek sorguda çek (sparkline).
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
      // Sparkline kritik değil; hata olursa boş geç.
      console.warn('snapshots okunamadı:', snapError.message);
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

  // En son güncellenme zamanı (header için).
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
    error = err instanceof Error ? err.message : 'Bilinmeyen hata';
  }

  return (
    <main className="mx-auto max-w-[1400px] px-3 py-6 sm:px-6">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Solana Token Tarayıcı
          </h1>
          <p className="text-sm text-slate-400">
            DexScreener + RugCheck · hacim, momentum ve güvenlik analizi
          </p>
        </div>
        <div className="text-xs text-slate-500">
          {lastUpdated ? (
            <span>Son güncelleme: {formatRelativeTime(lastUpdated)}</span>
          ) : (
            <span>Henüz veri yok</span>
          )}
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-300">
          <p className="font-semibold">Veri yüklenemedi.</p>
          <p className="mt-1 text-red-400/80">{error}</p>
          <p className="mt-2 text-red-400/60">
            Supabase ortam değişkenlerinin (NEXT_PUBLIC_SUPABASE_URL /
            NEXT_PUBLIC_SUPABASE_ANON_KEY) doğru ayarlandığını kontrol edin.
          </p>
        </div>
      ) : tokens.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-slate-400">
          <p className="font-medium">Gösterilecek token yok.</p>
          <p className="mt-1 text-sm text-slate-500">
            Scraper henüz çalışmadıysa GitHub Actions iş akışını manuel
            tetikleyebilir (workflow_dispatch) ya da saatlik cron'u
            bekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <Dashboard tokens={tokens} />
      )}

      <footer className="mt-8 border-t border-border pt-4 text-center text-xs text-slate-600">
        Veriler yatırım tavsiyesi değildir. Kaynak: DexScreener &amp; RugCheck
        public API.
      </footer>
    </main>
  );
}
