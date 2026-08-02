"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Decision,
  FilterDecision,
  ScanPreset,
  SecurityStatus,
  TokenRow,
} from "@/lib/types";

interface DashboardProps {
  initialTokens: TokenRow[];
  initialLastUpdated: string | null;
  initialError: string | null;
}

const decisionLabels: Record<Decision, string> = {
  watch: "İzlemeye değer",
  conditional: "Şartlı izleme",
  rejected: "Elendi",
};

const decisionClass: Record<Decision, string> = {
  watch: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  conditional: "border-amber-300/25 bg-amber-300/10 text-amber-200",
  rejected: "border-rose-400/25 bg-rose-400/10 text-rose-200",
};

const securityLabels: Record<SecurityStatus, string> = {
  verified: "Kontroller tamam",
  unknown: "Doğrulanmadı",
  risky: "Riskli sinyal",
};

const securityClass: Record<SecurityStatus, string> = {
  verified: "text-emerald-300",
  unknown: "text-amber-200",
  risky: "text-rose-300",
};

function formatUsd(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Doğrulanmadı";
  }
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return "$" + (value / 1_000_000_000).toFixed(2) + "B";
  if (abs >= 1_000_000) return "$" + (value / 1_000_000).toFixed(2) + "M";
  if (abs >= 1_000) return "$" + (value / 1_000).toFixed(1) + "K";
  return "$" + value.toFixed(2);
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return (value > 0 ? "+" : "") + value.toFixed(1) + "%";
}

function formatAge(iso: string | null | undefined) {
  if (!iso) return "Doğrulanmadı";
  const elapsed = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return "—";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return minutes + "d";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "s";
  return Math.floor(hours / 24) + "g " + (hours % 24) + "s";
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "veri yok";
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function shortAddress(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 5) + "…" + value.slice(-4);
}

function tokenAgeHours(token: TokenRow) {
  if (!token.pair_created_at) return Infinity;
  return (Date.now() - new Date(token.pair_created_at).getTime()) / 3_600_000;
}

function isAccelerating(token: TokenRow) {
  const shortAvg = token.volume_1h !== null ? token.volume_1h / 12 : null;
  const mediumAvg = token.volume_6h !== null ? token.volume_6h / 6 : null;
  const shortRatio =
    token.volume_5m !== null && shortAvg && shortAvg > 0
      ? token.volume_5m / shortAvg
      : 0;
  const mediumRatio =
    token.volume_1h !== null && mediumAvg && mediumAvg > 0
      ? token.volume_1h / mediumAvg
      : 0;
  return shortRatio >= 1.35 || mediumRatio >= 1.25;
}

function volumeProfile(token: TokenRow) {
  return [
    { label: "5m", value: token.volume_5m },
    { label: "1h", value: token.volume_1h },
    { label: "6h", value: token.volume_6h },
    { label: "24h", value: token.volume_24h },
  ];
}

function NumberChange({ value }: { value: number | null | undefined }) {
  const className =
    value === null || value === undefined
      ? "text-slate-500"
      : value > 0
        ? "text-emerald-300"
        : value < 0
          ? "text-rose-300"
          : "text-slate-300";
  return <span className={"tabular-nums " + className}>{formatPct(value)}</span>;
}

function DecisionBadge({ decision }: { decision: Decision }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] " +
        decisionClass[decision]
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {decisionLabels[decision]}
    </span>
  );
}

function SecurityBadge({
  status,
  score,
}: {
  status: SecurityStatus;
  score: number | null;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={"text-xs font-semibold " + securityClass[status]}>
        {score === null ? "N/D" : score + "/100"}
      </span>
      <span className="text-[10px] text-slate-500">{securityLabels[status]}</span>
    </div>
  );
}

function Kpi({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent: string;
}) {
  return (
    <div className="terminal-panel-soft relative overflow-hidden rounded-xl p-4">
      <div className={"absolute inset-y-0 left-0 w-0.5 " + accent} />
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{note}</p>
    </div>
  );
}

function VolumeBars({ token }: { token: TokenRow }) {
  const values = volumeProfile(token);
  const max = Math.max(...values.map((item) => item.value ?? 0), 1);

  return (
    <div className="grid grid-cols-4 gap-2">
      {values.map((item) => (
        <div key={item.label} className="space-y-1.5">
          <div className="flex h-24 items-end rounded-md border border-white/[0.05] bg-black/20 p-1">
            <div
              className="w-full rounded-[3px] bg-gradient-to-t from-cyan-400/70 to-emerald-300/80"
              style={{
                height: Math.max(5, ((item.value ?? 0) / max) * 100) + "%",
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500">{item.label}</span>
            <span className="text-slate-300">{formatUsd(item.value)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({
  initialTokens,
  initialLastUpdated,
  initialError,
}: DashboardProps) {
  const [tokens, setTokens] = useState(initialTokens);
  const [lastUpdated, setLastUpdated] = useState(initialLastUpdated);
  const [error, setError] = useState(initialError);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [decisionFilter, setDecisionFilter] = useState<FilterDecision>("all");
  const [preset, setPreset] = useState<ScanPreset>("all");
  const [marketCapFilter, setMarketCapFilter] = useState("all");
  const [ageFilter, setAgeFilter] = useState("all");
  const [traderFilter, setTraderFilter] = useState("all");
  const [dexFilter, setDexFilter] = useState("all");
  const [selected, setSelected] = useState<TokenRow | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [watcherId, setWatcherId] = useState("");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = async () => {
      setIsRefreshing(true);
      try {
        const response = await fetch("/api/tokens", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error);
        setTokens(payload.tokens ?? []);
        setLastUpdated(payload.lastUpdated ?? null);
        setError(null);
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : "Canlı tablo yenilenemedi.",
        );
      } finally {
        setIsRefreshing(false);
      }
    };

    const interval = window.setInterval(refresh, 45_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const storageKey = "sol-meme-trenches-watcher";
    let id = window.localStorage.getItem(storageKey);
    if (!id) {
      id =
        "watcher_" +
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2);
      window.localStorage.setItem(storageKey, id);
    }
    setWatcherId(id);
  }, []);

  useEffect(() => {
    if (!watcherId) return;
    fetch("/api/watchlist?watcher=" + encodeURIComponent(watcherId), {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok) setWatchlist(payload.mints ?? []);
      })
      .catch(() => undefined);
  }, [watcherId]);

  const dexes = useMemo(
    () =>
      Array.from(
        new Set(tokens.map((token) => token.dex_id).filter(Boolean)),
      ).sort(),
    [tokens],
  );

  const filtered = useMemo(() => {
    return tokens.filter((token) => {
      if (decisionFilter !== "all" && token.decision !== decisionFilter) return false;
      if (preset === "new" && tokenAgeHours(token) > 24) return false;
      if (preset === "accelerating" && !isAccelerating(token)) return false;
      if (
        preset === "deep-liquidity" &&
        (token.liquidity_usd === null ||
          token.volume_24h === null ||
          token.liquidity_usd / Math.max(token.volume_24h, 1) < 0.08)
      ) {
        return false;
      }
      if (
        marketCapFilter !== "all" &&
        (token.market_cap === null ||
          token.market_cap < Number(marketCapFilter))
      ) {
        return false;
      }
      if (ageFilter !== "all" && tokenAgeHours(token) > Number(ageFilter)) {
        return false;
      }
      if (
        traderFilter !== "all" &&
        (token.unique_traders_24h === null ||
          token.unique_traders_24h < Number(traderFilter))
      ) {
        return false;
      }
      if (dexFilter !== "all" && token.dex_id !== dexFilter) return false;
      return true;
    });
  }, [
    ageFilter,
    decisionFilter,
    dexFilter,
    marketCapFilter,
    preset,
    tokens,
    traderFilter,
  ]);

  const counts = useMemo(
    () => ({
      watch: tokens.filter((token) => token.decision === "watch").length,
      conditional: tokens.filter((token) => token.decision === "conditional").length,
      rejected: tokens.filter((token) => token.decision === "rejected").length,
    }),
    [tokens],
  );

  const fastest = useMemo(
    () =>
      [...tokens]
        .filter((token) => isAccelerating(token))
        .sort((a, b) => (b.radar_score ?? 0) - (a.radar_score ?? 0))
        .slice(0, 3),
    [tokens],
  );

  const toggleWatchlist = async (token: TokenRow) => {
    if (!watcherId) return;
    const isWatched = watchlist.includes(token.mint_address);
    const next = isWatched
      ? watchlist.filter((mint) => mint !== token.mint_address)
      : [...watchlist, token.mint_address];
    setWatchlist(next);
    setWatchlistError(null);

    try {
      const response = await fetch("/api/watchlist", {
        method: isWatched ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watcherId,
          mintAddress: token.mint_address,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error);
    } catch {
      setWatchlist(watchlist);
      setWatchlistError("Watchlist kaydı için Supabase şemasını kontrol edin.");
    }
  };

  return (
    <main className="terminal-grid min-h-screen">
      <div className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span className="text-emerald-300">● live radar</span>
              <span className="text-slate-700">/</span>
              <span>solana mainnet</span>
              <span className="text-slate-700">/</span>
              <span>45s refresh</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-2xl shadow-[0_0_28px_rgba(52,211,153,0.12)]">
                🛰️
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-[-0.04em] text-white sm:text-3xl">
                  SOL MEME TRENCHES
                </h1>
                <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                  Erken hacim hareketi için canlı Solana meme coin radarı
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
              {error ? "API DEGRADED" : "API CONNECTED"}
            </span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-slate-400">
              Son güncelleme: {formatTime(lastUpdated)}
            </span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-slate-500">
              {isRefreshing ? "syncing…" : "cache window 45s"}
            </span>
          </div>
        </header>

        <section className="scan-line mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#121b20] via-[#0d1219] to-[#13101b] p-5 sm:p-7">
          <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300/75">
                // signal desk
              </p>
              <h2 className="mt-3 text-xl font-semibold leading-tight tracking-[-0.03em] text-white sm:text-3xl">
                Hacim ivmesini, likidite kalitesini ve doğrulanabilir güvenlik sinyallerini tek radarda birleştir.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                Yeşil karar için kritik güvenlik alanları doğrulanmış olmalı. Kaynaklar eksik veya çelişkiliyse sistem tokeni otomatik olarak şartlıya çeker.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[560px]">
              <Kpi label="Taranan pair" value={String(tokens.length)} note="anlamlı aday havuzu" accent="bg-cyan-300" />
              <Kpi label="İzlemeye değer" value={String(counts.watch)} note="kritik açık yok" accent="bg-emerald-300" />
              <Kpi label="Şartlı izleme" value={String(counts.conditional)} note="doğrulama eksiği var" accent="bg-amber-300" />
              <Kpi label="Elendi" value={String(counts.rejected)} note="risk veya LP problemi" accent="bg-rose-300" />
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-amber-100">Canlı veri bağlantısı şu an sınırlı.</p>
              <p className="mt-1 text-xs text-amber-100/60">
                Mock veri gösterilmiyor. Vercel/Supabase bağlantısı düzelince tablo otomatik yenilenecek.
              </p>
            </div>
            <span className="text-[11px] text-amber-200/70">{error}</span>
          </div>
        )}

        <section className="mt-6 grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr]">
          <div className="terminal-panel rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  En hızlı ivmelenenler
                </p>
                <p className="mt-1 text-xs text-slate-400">5m / 1h pencereleri kısa vadeli basıncı gösterir</p>
              </div>
              <span className="text-lg text-cyan-300">↗</span>
            </div>
            <div className="mt-4 space-y-2">
              {fastest.length ? (
                fastest.map((token) => (
                  <button
                    key={token.mint_address}
                    onClick={() => setSelected(token)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-left transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.05]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-100">{token.symbol ?? "—"}</span>
                      <span className="block truncate text-[10px] text-slate-500">{token.name ?? shortAddress(token.mint_address)}</span>
                    </span>
                    <span className="ml-3 flex items-center gap-3">
                      <NumberChange value={token.price_change_1h} />
                      <DecisionBadge decision={token.decision} />
                    </span>
                  </button>
                ))
              ) : (
                <p className="py-3 text-xs text-slate-500">İvme verisi henüz doğrulanmadı.</p>
              )}
            </div>
          </div>

          <div className="terminal-panel rounded-xl p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Radar mantığı</p>
            <div className="mt-4 space-y-3">
              <RadarWeight label="Hacim ivmesi" value="30%" color="bg-cyan-300" />
              <RadarWeight label="Likidite kalitesi" value="20%" color="bg-violet-300" />
              <RadarWeight label="Trader / B-S USD" value="15%" color="bg-amber-300" />
              <RadarWeight label="Güvenlik kontrolleri" value="25%" color="bg-emerald-300" />
              <RadarWeight label="Erken yakalama" value="10%" color="bg-rose-300" />
            </div>
          </div>

          <div className="terminal-panel rounded-xl p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Kaynak durumu</p>
            <div className="mt-4 space-y-3 text-xs">
              <SourceRow label="DexScreener" value="pair / volume / liquidity" ok={!error} />
              <SourceRow label="RugCheck" value="security enrichment" ok={!error} />
              <SourceRow label="Solana RPC" value="authority fallback" ok={!error} />
              <SourceRow label="Supabase" value="snapshots / watchlist" ok={!error} />
            </div>
            <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] leading-4 text-slate-500">
              Her kaynağın eksikliği kullanıcıya açıkça “Doğrulanmadı” olarak yansır.
            </p>
          </div>
        </section>

        <section className="mt-6 terminal-panel rounded-xl">
          <div className="flex flex-col gap-4 border-b border-white/[0.07] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">// live candidate matrix</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-white">Radar tablosu</h2>
                <span className="rounded bg-white/[0.06] px-2 py-1 text-[10px] text-slate-400">{filtered.length} gösteriliyor</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "watch", "conditional", "rejected"] as FilterDecision[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setDecisionFilter(filter)}
                  className={
                    "rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition " +
                    (decisionFilter === filter
                      ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                      : "border-white/[0.08] text-slate-500 hover:border-white/20 hover:text-slate-200")
                  }
                >
                  {filter === "all" ? "Tümü" : decisionLabels[filter]}
                </button>
              ))}
              <button
                onClick={() => setShowReport((value) => !value)}
                className="rounded-lg border border-violet-300/25 bg-violet-300/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-100 transition hover:bg-violet-300/15"
              >
                {showReport ? "Tabloya dön" : "3s rapor modu"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 border-b border-white/[0.07] bg-black/10 p-4 md:grid-cols-2 xl:grid-cols-6">
            <FilterSelect label="Tarama preset" value={preset} onChange={setPreset}>
              <option value="all">Tüm adaylar</option>
              <option value="new">Yeni pairler &lt;24s</option>
              <option value="accelerating">Hacmi hızlananlar</option>
              <option value="deep-liquidity">LP / hacim güçlü</option>
            </FilterSelect>
            <FilterSelect label="Market cap" value={marketCapFilter} onChange={setMarketCapFilter}>
              <option value="all">Sınır yok</option>
              <option value="250000">$250K+</option>
              <option value="1000000">$1M+</option>
              <option value="5000000">$5M+</option>
              <option value="10000000">$10M+</option>
            </FilterSelect>
            <FilterSelect label="Pair yaşı" value={ageFilter} onChange={setAgeFilter}>
              <option value="all">Her yaş</option>
              <option value="6">6s</option>
              <option value="24">24s</option>
              <option value="72">3g</option>
              <option value="168">7g</option>
            </FilterSelect>
            <FilterSelect label="Min. unique trader" value={traderFilter} onChange={setTraderFilter}>
              <option value="all">Doğrulanmadı dahil</option>
              <option value="25">25+</option>
              <option value="100">100+</option>
              <option value="500">500+</option>
            </FilterSelect>
            <FilterSelect label="DEX" value={dexFilter} onChange={setDexFilter}>
              <option value="all">Tüm DEX'ler</option>
              {dexes.map((dex) => <option key={dex} value={dex as string}>{dex}</option>)}
            </FilterSelect>
            <button
              onClick={() => {
                setDecisionFilter("all");
                setPreset("all");
                setMarketCapFilter("all");
                setAgeFilter("all");
                setTraderFilter("all");
                setDexFilter("all");
              }}
              className="self-end rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-slate-400 transition hover:border-white/20 hover:text-white"
            >
              Filtreleri temizle
            </button>
          </div>

          {showReport ? (
            <ReportPanel tokens={filtered} lastUpdated={lastUpdated} />
          ) : (
            <TokenTable
              tokens={filtered}
              watchlist={watchlist}
              onSelect={setSelected}
              onToggleWatchlist={toggleWatchlist}
            />
          )}
        </section>

        {watchlistError && (
          <p className="mt-3 text-right text-[11px] text-amber-200/70">{watchlistError}</p>
        )}

        <footer className="mt-5 flex flex-col gap-2 border-t border-white/[0.08] py-5 text-[10px] leading-5 text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>DexScreener + RugCheck + Solana RPC · yatırım tavsiyesi değildir.</span>
          <span>Yeşil karar kesin güvenlik veya getiri anlamına gelmez.</span>
        </footer>
      </div>

      {selected && (
        <TokenDetail
          token={selected}
          isWatched={watchlist.includes(selected.mint_address)}
          onClose={() => setSelected(null)}
          onToggleWatchlist={() => toggleWatchlist(selected)}
        />
      )}
    </main>
  );
}

function RadarWeight({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-200">{value}</span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-white/[0.06]">
        <div className={"h-1 rounded-full " + color} style={{ width: value }} />
      </div>
    </div>
  );
}

function SourceRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-slate-300">
        <span className={"h-1.5 w-1.5 rounded-full " + (ok ? "bg-emerald-300" : "bg-amber-300")} />
        {label}
      </span>
      <span className="text-[10px] text-slate-600">{value}</span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: any) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/[0.09] bg-[#121720] px-3 py-2 text-xs text-slate-300 outline-none transition focus:border-cyan-300/40"
      >
        {children}
      </select>
    </label>
  );
}

function TokenTable({
  tokens,
  watchlist,
  onSelect,
  onToggleWatchlist,
}: {
  tokens: TokenRow[];
  watchlist: string[];
  onSelect: (token: TokenRow) => void;
  onToggleWatchlist: (token: TokenRow) => void;
}) {
  if (!tokens.length) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm font-medium text-slate-300">Bu filtreyle eşleşen aday yok.</p>
        <p className="mt-2 text-xs text-slate-600">Daha geniş bir filtre seç veya sonraki canlı taramayı bekle.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-[1520px] w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/[0.07] bg-white/[0.018] text-[10px] uppercase tracking-[0.14em] text-slate-600">
              <th className="w-8 px-3 py-3 text-left" />
              <th className="px-3 py-3 text-left">Token</th>
              <th className="px-3 py-3 text-right">Pair yaşı</th>
              <th className="px-3 py-3 text-right">MC</th>
              <th className="px-3 py-3 text-right">LP</th>
              <th className="px-3 py-3 text-right">Hacim 5m</th>
              <th className="px-3 py-3 text-right">Hacim 1h</th>
              <th className="px-3 py-3 text-right">Hacim 6h</th>
              <th className="px-3 py-3 text-right">Hacim 24h</th>
              <th className="px-3 py-3 text-right">Fiyat 5m / 1h / 6h / 24h</th>
              <th className="px-3 py-3 text-right">Trader</th>
              <th className="px-3 py-3 text-right">Buy / Sell USD</th>
              <th className="px-3 py-3 text-right">Güvenlik</th>
              <th className="px-3 py-3 text-left">Risk uyarısı</th>
              <th className="px-3 py-3 text-left">Karar</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => {
              const watched = watchlist.includes(token.mint_address);
              return (
                <tr
                  key={token.mint_address}
                  tabIndex={0}
                  onClick={() => onSelect(token)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onSelect(token);
                  }}
                  className="cursor-pointer border-b border-white/[0.045] transition hover:bg-cyan-300/[0.035] focus:bg-cyan-300/[0.05] focus:outline-none"
                >
                  <td className="px-3 py-3">
                    <button
                      aria-label={watched ? "Watchlist'ten çıkar" : "Watchlist'e ekle"}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleWatchlist(token);
                      }}
                      className={"text-base transition " + (watched ? "text-amber-200" : "text-slate-700 hover:text-amber-200")}
                    >
                      {watched ? "★" : "☆"}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-gradient-to-br from-cyan-300/20 to-violet-300/20 text-[11px] font-bold text-slate-200">
                        {(token.symbol ?? "?").slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100">{token.symbol ?? "—"}</span>
                          {isAccelerating(token) && <span className="rounded bg-cyan-300/10 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-200">ACCEL</span>}
                          {tokenAgeHours(token) < 24 && <span className="rounded bg-violet-300/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-200">NEW</span>}
                        </div>
                        <span className="block max-w-[145px] truncate text-[10px] text-slate-600">{token.name ?? shortAddress(token.mint_address)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-400">{formatAge(token.pair_created_at)}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-300">{formatUsd(token.market_cap)}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-300">{formatUsd(token.liquidity_usd)}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-300">{formatUsd(token.volume_5m)}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-300">{formatUsd(token.volume_1h)}</td>
                  <td className="px-3 py-3 text-right font-mono text-slate-300">{formatUsd(token.volume_6h)}</td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-slate-100">{formatUsd(token.volume_24h)}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="space-y-0.5 font-mono text-[10px]">
                      <NumberChange value={token.price_change_5m} /> <NumberChange value={token.price_change_1h} /> <NumberChange value={token.price_change_6h} /> <NumberChange value={token.price_change_24h} />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-400">{token.unique_traders_24h === null ? "Doğrulanmadı" : token.unique_traders_24h.toLocaleString("tr-TR")}</td>
                  <td className="px-3 py-3 text-right font-mono text-[10px] text-slate-400">
                    {token.buy_volume_usd === null || token.sell_volume_usd === null ? "Doğrulanmadı" : formatUsd(token.buy_volume_usd) + " / " + formatUsd(token.sell_volume_usd)}
                  </td>
                  <td className="px-3 py-3 text-right"><SecurityBadge status={token.security_status} score={token.safety_score} /></td>
                  <td className="max-w-[190px] px-3 py-3">
                    <span className="block truncate text-[10px] text-amber-100/70" title={token.risk_flags.join(" · ")}>{token.highest_risk ?? "Belirgin risk yok"}</span>
                  </td>
                  <td className="px-3 py-3"><DecisionBadge decision={token.decision} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 p-3 lg:hidden">
        {tokens.map((token) => {
          const watched = watchlist.includes(token.mint_address);
          return (
            <button
              key={token.mint_address}
              onClick={() => onSelect(token)}
              className="block w-full rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-left transition hover:border-cyan-300/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleWatchlist(token);
                    }}
                    className={"text-lg " + (watched ? "text-amber-200" : "text-slate-700")}
                  >
                    {watched ? "★" : "☆"}
                  </span>
                  <div className="min-w-0">
                    <span className="block truncate font-semibold text-white">{token.symbol ?? "—"}</span>
                    <span className="block truncate text-[10px] text-slate-600">{token.name ?? shortAddress(token.mint_address)}</span>
                  </div>
                </div>
                <DecisionBadge decision={token.decision} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                <MiniStat label="MC" value={formatUsd(token.market_cap)} />
                <MiniStat label="LP" value={formatUsd(token.liquidity_usd)} />
                <MiniStat label="24h vol" value={formatUsd(token.volume_24h)} />
                <MiniStat label="5m / 1h" value={formatPct(token.price_change_5m) + " / " + formatPct(token.price_change_1h)} />
                <MiniStat label="6h / 24h" value={formatPct(token.price_change_6h) + " / " + formatPct(token.price_change_24h)} />
                <MiniStat label="security" value={token.safety_score === null ? "N/D" : token.safety_score + "/100"} />
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-black/15 p-2">
      <span className="block uppercase tracking-[0.12em] text-slate-600">{label}</span>
      <span className="mt-1 block truncate font-mono text-slate-300">{value}</span>
    </div>
  );
}

function ReportPanel({
  tokens,
  lastUpdated,
}: {
  tokens: TokenRow[];
  lastUpdated: string | null;
}) {
  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-2 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/70">// generated brief</p>
          <h3 className="mt-2 text-xl font-semibold text-white">🛰️ SOL MEME TRENCHES</h3>
          <p className="mt-1 text-xs text-slate-500">3 saatlik görünüm · {formatTime(lastUpdated)}</p>
        </div>
        <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-violet-100">
          canlı snapshot
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="min-w-[780px] w-full text-xs">
          <thead className="bg-white/[0.025] text-left text-[10px] uppercase tracking-[0.13em] text-slate-600">
            <tr>
              <th className="px-3 py-3">Token</th>
              <th className="px-3 py-3 text-right">MC</th>
              <th className="px-3 py-3 text-right">LP</th>
              <th className="px-3 py-3 text-right">1s / 6s / 24s hacim</th>
              <th className="px-3 py-3 text-right">6s / 24s fiyat</th>
              <th className="px-3 py-3 text-left">Karar</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <tr key={token.mint_address} className="border-t border-white/[0.05]">
                <td className="px-3 py-3">
                  <span className="font-semibold text-slate-100">{token.symbol ?? "—"}</span>
                  <span className="ml-2 text-[10px] text-slate-600">{shortAddress(token.mint_address)}</span>
                  <p className="mt-2 max-w-[310px] text-[10px] leading-4 text-slate-500"><b className="font-medium text-slate-400">Neden:</b> {token.radar_reason ?? "Yeterli gerekçe doğrulanmadı."}</p>
                  <p className="mt-1 max-w-[310px] text-[10px] leading-4 text-amber-100/60"><b className="font-medium text-amber-100/80">Güvenlik:</b> {token.highest_risk ?? "Belirgin risk sinyali yok."}</p>
                </td>
                <td className="px-3 py-3 text-right font-mono text-slate-300">{formatUsd(token.market_cap)}</td>
                <td className="px-3 py-3 text-right font-mono text-slate-300">{formatUsd(token.liquidity_usd)}</td>
                <td className="px-3 py-3 text-right font-mono text-slate-400">{formatUsd(token.volume_1h)} / {formatUsd(token.volume_6h)} / {formatUsd(token.volume_24h)}</td>
                <td className="px-3 py-3 text-right font-mono"><NumberChange value={token.price_change_6h} /> / <NumberChange value={token.price_change_24h} /></td>
                <td className="px-3 py-3"><DecisionBadge decision={token.decision} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-cyan-200/70">Bugünün erken sinyali</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Hacmi hızlanan ancak kritik güvenlik alanları doğrulanmayan pairler şartlı izleme olarak tutuluyor. Bu rapor karar değil, sonraki taramaya bırakılan bir araştırma kuyruğudur.
        </p>
      </div>
    </div>
  );
}

function TokenDetail({
  token,
  isWatched,
  onClose,
  onToggleWatchlist,
}: {
  token: TokenRow;
  isWatched: boolean;
  onClose: () => void;
  onToggleWatchlist: () => void;
}) {
  const volume = volumeProfile(token);
  const riskFlags = token.risk_flags.length
    ? token.risk_flags
    : ["Kaynaklardan açık risk sinyali dönmedi."];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-xl overflow-y-auto border-l border-white/[0.1] bg-[#0b0f16] p-5 shadow-[-20px_0_60px_rgba(0,0,0,0.35)] sm:p-7"
        onClick={(event) => event.stopPropagation()}
        aria-label="Token detayları"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">// token dossier</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-sm font-bold text-cyan-100">{(token.symbol ?? "?").slice(0, 2)}</div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white">{token.symbol ?? "—"}</h2>
                <p className="text-xs text-slate-500">{token.name ?? shortAddress(token.mint_address)}</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-slate-400 hover:text-white">Kapat</button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <DecisionBadge decision={token.decision} />
          <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] text-slate-500">{token.dex_id ?? "DEX doğrulanmadı"}</span>
          <button onClick={onToggleWatchlist} className="rounded-full border border-amber-200/20 bg-amber-200/[0.07] px-2.5 py-1 text-[10px] text-amber-100">{isWatched ? "★ Watchlist'te" : "☆ Watchlist'e ekle"}</button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <DetailMetric label="Price" value={formatUsd(token.price_usd)} />
          <DetailMetric label="MC" value={formatUsd(token.market_cap)} />
          <DetailMetric label="LP" value={formatUsd(token.liquidity_usd)} />
          <DetailMetric label="Pair age" value={formatAge(token.pair_created_at)} />
        </div>

        <section className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">volume pulse</p>
              <h3 className="mt-1 text-sm font-semibold text-white">5m → 1h → 6h → 24h</h3>
            </div>
            <span className="font-mono text-xs text-cyan-200">radar {token.radar_score ?? "N/D"}</span>
          </div>
          <VolumeBars token={token} />
          <div className="mt-4 grid grid-cols-4 gap-2 text-center font-mono text-[10px]">
            <NumberChange value={token.price_change_5m} />
            <NumberChange value={token.price_change_1h} />
            <NumberChange value={token.price_change_6h} />
            <NumberChange value={token.price_change_24h} />
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">security ledger</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <SecurityItem label="Güvenlik skoru" value={token.safety_score === null ? "Doğrulanmadı" : token.safety_score + "/100"} tone={token.security_status} />
            <SecurityItem label="Mint authority" value={token.mint_authority_null === null ? "Doğrulanmadı" : token.mint_authority_null ? "Devre dışı" : "Açık"} tone={token.mint_authority_null === false ? "risky" : "verified"} />
            <SecurityItem label="Freeze authority" value={token.freeze_authority_null === null ? "Doğrulanmadı" : token.freeze_authority_null ? "Devre dışı" : "Açık"} tone={token.freeze_authority_null === false ? "risky" : "verified"} />
            <SecurityItem label="LP kilidi / burn" value={token.lp_locked_pct === null ? "Doğrulanmadı" : token.lp_locked_pct.toFixed(1) + "%"} tone={token.lp_locked_pct === null ? "unknown" : "verified"} />
            <SecurityItem label="Top 10 holder" value={token.top10_holder_pct === null ? "Doğrulanmadı" : token.top10_holder_pct.toFixed(1) + "%"} tone={token.top10_holder_pct !== null && token.top10_holder_pct > 45 ? "risky" : "unknown"} />
            <SecurityItem label="Cluster / bundler" value={token.cluster_pct === null && token.bundler_pct === null ? "Doğrulanmadı" : String(token.cluster_pct ?? "—") + " / " + String(token.bundler_pct ?? "—")} tone="unknown" />
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.045] p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-amber-200/70">why this score</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{token.radar_reason ?? "Bu token için yeterli gerekçe doğrulanmadı."}</p>
          <div className="mt-3 space-y-2">
            {riskFlags.map((risk) => <p key={risk} className="flex gap-2 text-xs text-amber-100/75"><span className="text-amber-300">!</span>{risk}</p>)}
          </div>
        </section>

        <div className="mt-5 flex flex-wrap gap-2">
          {token.dex_url && <a href={token.dex_url} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-300/15">DexScreener ↗</a>}
          {token.rugcheck_url && <a href={token.rugcheck_url} target="_blank" rel="noreferrer" className="rounded-lg border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-xs text-violet-100 hover:bg-violet-300/15">RugCheck ↗</a>}
          <span className="rounded-lg border border-white/[0.07] px-3 py-2 text-[10px] text-slate-600">{shortAddress(token.mint_address)}</span>
        </div>
      </aside>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">{label}</p>
      <p className="mt-1 truncate font-mono text-sm text-slate-200">{value}</p>
    </div>
  );
}

function SecurityItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: SecurityStatus | "verified" | "risky";
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/15 p-3">
      <p className="text-[10px] text-slate-600">{label}</p>
      <p className={"mt-1 text-xs font-semibold " + securityClass[tone as SecurityStatus]}>{value}</p>
    </div>
  );
}
