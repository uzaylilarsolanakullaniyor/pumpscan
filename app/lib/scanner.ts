import { createSupabaseAdmin } from "@/lib/supabase";

const DEX_BASE = "https://api.dexscreener.com";
const RUGCHECK_BASE =
  process.env.RUGCHECK_API_BASE_URL ?? "https://api.rugcheck.xyz";
const RPC_URL =
  process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const SOLANA = "solana";

type JsonRecord = Record<string, any>;

interface Pair {
  mintAddress: string;
  pairAddress: string | null;
  name: string | null;
  symbol: string | null;
  dexId: string | null;
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  liquidityUsd: number | null;
  volume5m: number | null;
  volume1h: number | null;
  volume6h: number | null;
  volume24h: number | null;
  priceChange5m: number | null;
  priceChange1h: number | null;
  priceChange6h: number | null;
  priceChange24h: number | null;
  buys24h: number | null;
  sells24h: number | null;
  pairCreatedAt: string | null;
  dexUrl: string | null;
}

interface Security {
  status: "verified" | "unknown" | "risky";
  score: number | null;
  mintAuthority: "disabled" | "enabled" | "unknown";
  freezeAuthority: "disabled" | "enabled" | "unknown";
  lpLockedPct: number | null;
  top10HolderPct: number | null;
  clusterPct: number | null;
  bundlerPct: number | null;
  devSells: number | null;
  riskFlags: string[];
  highestRisk: string | null;
}

function numberOrNull(value: unknown): number | null {
  const valueAsNumber =
    typeof value === "number" ? value : Number(value);
  return Number.isFinite(valueAsNumber) ? valueAsNumber : null;
}

function readValue(source: unknown, path: string[]): unknown {
  let current: any = source;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

async function requestJson(
  url: string,
  options: { method?: string; body?: string } = {},
  timeoutMs = 10_000,
): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      body: options.body,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "SOL-MEME-TRENCHES/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(url + " returned " + response.status);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(limit, Math.max(items.length, 1)) },
      () => worker(),
    ),
  );
  return results;
}

function normalizePair(raw: JsonRecord): Pair | null {
  const mintAddress = raw?.baseToken?.address;
  if (typeof mintAddress !== "string" || !mintAddress) return null;

  return {
    mintAddress,
    pairAddress: raw.pairAddress ?? null,
    name: raw.baseToken?.name ?? null,
    symbol: raw.baseToken?.symbol ?? null,
    dexId: raw.dexId ?? null,
    priceUsd: numberOrNull(raw.priceUsd),
    marketCap: numberOrNull(raw.marketCap ?? raw.fdv),
    fdv: numberOrNull(raw.fdv),
    liquidityUsd: numberOrNull(raw.liquidity?.usd),
    volume5m: numberOrNull(raw.volume?.m5),
    volume1h: numberOrNull(raw.volume?.h1),
    volume6h: numberOrNull(raw.volume?.h6),
    volume24h: numberOrNull(raw.volume?.h24),
    priceChange5m: numberOrNull(raw.priceChange?.m5),
    priceChange1h: numberOrNull(raw.priceChange?.h1),
    priceChange6h: numberOrNull(raw.priceChange?.h6),
    priceChange24h: numberOrNull(raw.priceChange?.h24),
    buys24h: numberOrNull(raw.txns?.h24?.buys),
    sells24h: numberOrNull(raw.txns?.h24?.sells),
    pairCreatedAt: raw.pairCreatedAt
      ? new Date(raw.pairCreatedAt).toISOString()
      : null,
    dexUrl: raw.url ?? null,
  };
}

async function discoverPairs(): Promise<Pair[]> {
  const profilesUrl = DEX_BASE + "/token-profiles/latest/v1";
  const boostsUrl = DEX_BASE + "/token-boosts/latest/v1";
  const queries = ["solana", "SOL", "USDC", "WSOL", "pump", "bonk", "meme"];

  const discovery = await Promise.allSettled([
    requestJson(profilesUrl),
    requestJson(boostsUrl),
    ...queries.map((query) =>
      requestJson(
        DEX_BASE + "/latest/dex/search?q=" + encodeURIComponent(query),
        {},
        8_000,
      ),
    ),
  ]);

  const addresses = new Set<string>();
  const pairsByAddress = new Map<string, Pair>();

  for (const item of discovery) {
    if (item.status !== "fulfilled") continue;
    const payload = item.value;
    const entries = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.pairs)
        ? payload.pairs
        : [];

    for (const entry of entries) {
      if (entry?.chainId === SOLANA && entry?.tokenAddress) {
        addresses.add(entry.tokenAddress);
      }
      if (entry?.chainId === SOLANA) {
        const pair = normalizePair(entry);
        if (pair) {
          const existing = pairsByAddress.get(pair.mintAddress);
          if (
            !existing ||
            (pair.liquidityUsd ?? 0) > (existing.liquidityUsd ?? 0)
          ) {
            pairsByAddress.set(pair.mintAddress, pair);
          }
          addresses.add(pair.mintAddress);
        }
      }
    }
  }

  const directAddresses = [...addresses].slice(0, 120);
  const directPairs = await mapLimit(
    directAddresses,
    8,
    async (address) => {
      try {
        const payload = await requestJson(
          DEX_BASE +
            "/token-pairs/v1/solana/" +
            encodeURIComponent(address),
          {},
          8_000,
        );
        const pairs = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.pairs)
            ? payload.pairs
            : [];
        return pairs
          .filter((entry: JsonRecord) => entry?.chainId === SOLANA)
          .map(normalizePair)
          .filter((pair: Pair | null): pair is Pair => Boolean(pair))
          .sort(
            (a: Pair, b: Pair) =>
              (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0),
          )[0] ?? null;
      } catch {
        return null;
      }
    },
  );

  for (const pair of directPairs) {
    if (!pair) continue;
    const existing = pairsByAddress.get(pair.mintAddress);
    if (
      !existing ||
      (pair.liquidityUsd ?? 0) > (existing.liquidityUsd ?? 0)
    ) {
      pairsByAddress.set(pair.mintAddress, pair);
    }
  }

  return [...pairsByAddress.values()]
    .filter((pair) => pair.mintAddress)
    .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
}

function authorityState(
  report: JsonRecord | null,
  field: "mintAuthority" | "freezeAuthority",
): Security["mintAuthority"] {
  const paths = [
    ["token", field],
    [field],
  ];

  for (const path of paths) {
    const value = readValue(report, path);
    if (value !== undefined) {
      return value === null ||
        value === "" ||
        value === "11111111111111111111111111111111"
        ? "disabled"
        : "enabled";
    }
  }

  return "unknown";
}

async function rpcAuthority(
  mintAddress: string,
  field: "mintAuthority" | "freezeAuthority",
): Promise<Security["mintAuthority"]> {
  try {
    const payload = await requestJson(
      RPC_URL,
      {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getAccountInfo",
          params: [
            mintAddress,
            { encoding: "jsonParsed", commitment: "confirmed" },
          ],
        }),
      },
      8_000,
    );
    const value = readValue(payload, [
      "result",
      "value",
      "data",
      "parsed",
      "info",
      field,
    ]);
    if (value !== undefined) {
      return value === null || value === ""
        ? "disabled"
        : "enabled";
    }
  } catch {
    // RPC is an enrichment source; the scanner continues with an unknown field.
  }
  return "unknown";
}

function extractLockedPct(report: JsonRecord | null): number | null {
  const markets = Array.isArray(report?.markets) ? report.markets : [];
  const values = markets
    .map(
      (market: JsonRecord) =>
        numberOrNull(market?.lp?.lpLockedPct) ??
        numberOrNull(market?.lp?.lpLockedPercentage),
    )
    .filter((value: number | null): value is number => value !== null);

  const topLevel =
    numberOrNull(report?.totalMarketLiquidity?.lpLockedPct) ??
    numberOrNull(report?.lpLockedPct);

  if (topLevel !== null) values.push(topLevel);
  return values.length ? Math.max(0, Math.min(100, Math.max(...values))) : null;
}

function extractTop10Pct(report: JsonRecord | null): number | null {
  const holders = Array.isArray(report?.topHolders)
    ? report.topHolders.slice(0, 10)
    : [];
  if (!holders.length) return null;

  const values = holders
    .map(
      (holder: JsonRecord) =>
        numberOrNull(holder?.pct) ?? numberOrNull(holder?.percentage),
    )
    .filter((value: number | null): value is number => value !== null);

  return values.length
    ? Math.max(0, Math.min(100, values.reduce((sum, value) => sum + value, 0)))
    : null;
}

function extractRiskFlags(report: JsonRecord | null): string[] {
  const risks = Array.isArray(report?.risks) ? report.risks : [];
  return risks
    .map((risk: JsonRecord) => {
      const label = risk?.name ?? risk?.description ?? risk?.value;
      const level = risk?.level ? String(risk.level).toUpperCase() : "";
      return label ? (level ? level + ": " + label : String(label)) : null;
    })
    .filter((value: string | null): value is string => Boolean(value))
    .slice(0, 6);
}

async function fetchSecurity(mintAddress: string): Promise<Security> {
  let report: JsonRecord | null = null;
  try {
    report = await requestJson(
      RUGCHECK_BASE + "/v1/tokens/" + encodeURIComponent(mintAddress) + "/report",
      {},
      10_000,
    );
  } catch {
    report = null;
  }

  let mintAuthority = authorityState(report, "mintAuthority");
  let freezeAuthority = authorityState(report, "freezeAuthority");

  if (mintAuthority === "unknown") {
    mintAuthority = await rpcAuthority(mintAddress, "mintAuthority");
  }
  if (freezeAuthority === "unknown") {
    freezeAuthority = await rpcAuthority(mintAddress, "freezeAuthority");
  }

  const lpLockedPct = extractLockedPct(report);
  const top10HolderPct = extractTop10Pct(report);
  const riskFlags = extractRiskFlags(report);

  if (mintAuthority === "enabled") riskFlags.unshift("Mint authority açık");
  if (freezeAuthority === "enabled") riskFlags.unshift("Freeze authority açık");
  if (lpLockedPct === null) riskFlags.push("LP kilidi/burn doğrulanmadı");
  if (top10HolderPct === null) riskFlags.push("Holder yoğunluğu doğrulanmadı");

  const critical =
    mintAuthority === "enabled" ||
    freezeAuthority === "enabled" ||
    riskFlags.some((risk) => /CRITICAL|DANGER|HIGH/i.test(risk));

  const components = [
    mintAuthority === "disabled" ? 100 : mintAuthority === "enabled" ? 0 : null,
    freezeAuthority === "disabled" ? 100 : freezeAuthority === "enabled" ? 0 : null,
    lpLockedPct === null ? null : Math.min(100, lpLockedPct),
    top10HolderPct === null ? null : Math.max(0, 100 - top10HolderPct),
  ].filter((value): value is number => value !== null);

  const score =
    components.length === 4
      ? Math.round(components.reduce((sum, value) => sum + value, 0) / 4)
      : null;

  return {
    status: !report
      ? "unknown"
      : critical
        ? "risky"
        : components.length === 4
          ? "verified"
          : "unknown",
    score,
    mintAuthority,
    freezeAuthority,
    lpLockedPct,
    top10HolderPct,
    clusterPct: numberOrNull(
      report?.clusterPct ?? report?.cluster?.percentage,
    ),
    bundlerPct: numberOrNull(
      report?.bundlerPct ?? report?.bundlers?.percentage,
    ),
    devSells: numberOrNull(report?.devSells ?? report?.creator?.sells),
    riskFlags: [...new Set(riskFlags)].slice(0, 8),
    highestRisk: riskFlags[0] ?? null,
  };
}

function ratioScore(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, 50 + Math.log2(Math.max(value, 0.1)) * 24));
}

function momentumScore(pair: Pair, previous: JsonRecord | undefined): number {
  const shortAvg = pair.volume1h === null ? null : pair.volume1h / 12;
  const mediumAvg = pair.volume6h === null ? null : pair.volume6h / 6;
  const longAvg = pair.volume24h === null ? null : pair.volume24h / 4;

  const ratios = [
    pair.volume5m !== null && shortAvg ? pair.volume5m / shortAvg : null,
    pair.volume1h !== null && mediumAvg ? pair.volume1h / mediumAvg : null,
    pair.volume6h !== null && longAvg ? pair.volume6h / longAvg : null,
  ].filter((value): value is number => value !== null && value > 0);

  const momentum = ratios.length
    ? ratios.reduce((sum, value) => sum + ratioScore(value), 0) / ratios.length
    : 0;

  const previousVolume = numberOrNull(previous?.volume_24h);
  const delta =
    previousVolume && pair.volume24h !== null
      ? Math.max(-1, Math.min(1, (pair.volume24h - previousVolume) / previousVolume))
      : 0;

  return Math.round(Math.max(0, Math.min(100, momentum * 0.8 + (delta + 1) * 10)));
}

function liquidityScore(pair: Pair, previous: JsonRecord | undefined): number {
  if (pair.liquidityUsd === null || pair.volume24h === null) return 0;
  const depthRatio = pair.liquidityUsd / Math.max(pair.volume24h, 1);
  const base = Math.max(0, Math.min(100, Math.log10(depthRatio * 100 + 1) * 48));
  const previousLp = numberOrNull(previous?.liquidity_usd);
  const preservation =
    previousLp && previousLp > 0
      ? Math.max(0, Math.min(100, 50 + ((pair.liquidityUsd - previousLp) / previousLp) * 100))
      : 50;
  return Math.round(base * 0.7 + preservation * 0.3);
}

function makeDecision(
  pair: Pair,
  security: Security,
  score: number,
): "watch" | "conditional" | "rejected" {
  const thinLiquidity =
    pair.liquidityUsd === null ||
    pair.volume24h === null ||
    pair.liquidityUsd / Math.max(pair.volume24h, 1) < 0.01;

  const critical =
    security.status === "risky" ||
    security.mintAuthority === "enabled" ||
    security.freezeAuthority === "enabled";

  if (thinLiquidity || critical) return "rejected";

  const securityUnknown =
    security.status !== "verified" ||
    security.score === null ||
    pair.liquidityUsd === null;

  if (securityUnknown || score < 68) return "conditional";
  return "watch";
}

function rowFromPair(
  pair: Pair,
  security: Security,
  previous: JsonRecord | undefined,
) {
  const momentum = momentumScore(pair, previous);
  const liquidity = liquidityScore(pair, previous);
  const traderQuality = 0;
  const securityScore = security.score ?? 0;
  const earlyCapture =
    pair.pairCreatedAt &&
    Date.now() - new Date(pair.pairCreatedAt).getTime() < 24 * 60 * 60 * 1000
      ? 100
      : 45;

  const radarScore = Math.round(
    momentum * 0.3 +
      liquidity * 0.2 +
      traderQuality * 0.15 +
      securityScore * 0.25 +
      earlyCapture * 0.1,
  );
  const decision = makeDecision(pair, security, radarScore);
  const risks = [...security.riskFlags];

  if (pair.liquidityUsd !== null && pair.volume24h !== null && pair.liquidityUsd / Math.max(pair.volume24h, 1) < 0.03) {
    risks.push("LP hacme göre ince");
  }
  if (security.top10HolderPct !== null && security.top10HolderPct > 45) {
    risks.push("İlk 10 holder yoğun");
  }
  if (pair.buys24h === null || pair.sells24h === null) {
    risks.push("Buy/Sell USD doğrulanmadı");
  }
  if (pair.volume5m === null || pair.volume1h === null || pair.volume6h === null) {
    risks.push("Hacim penceresi eksik");
  }

  const radarReason =
    momentum >= 68
      ? "Kısa ve orta vadeli hacim pencerelerinde ivme var."
      : "İvme henüz yeterince tutarlı değil.";
  const highestRisk =
    decision === "rejected"
      ? risks[0] ?? "Kritik doğrulama eksik"
      : security.highestRisk ?? risks[0] ?? "Belirgin risk sinyali yok";

  return {
    mint_address: pair.mintAddress,
    pair_address: pair.pairAddress,
    name: pair.name,
    symbol: pair.symbol,
    dex_id: pair.dexId,
    price_usd: pair.priceUsd,
    market_cap: pair.marketCap,
    fdv: pair.fdv,
    liquidity_usd: pair.liquidityUsd,
    volume_5m: pair.volume5m,
    volume_1h: pair.volume1h,
    volume_6h: pair.volume6h,
    volume_24h: pair.volume24h,
    price_change_5m: pair.priceChange5m,
    price_change_1h: pair.priceChange1h,
    price_change_6h: pair.priceChange6h,
    price_change_24h: pair.priceChange24h,
    buys_24h: pair.buys24h,
    sells_24h: pair.sells24h,
    unique_traders_24h: null,
    buy_volume_usd: null,
    sell_volume_usd: null,
    pair_created_at: pair.pairCreatedAt,
    lp_burned:
      security.lpLockedPct === null ? null : security.lpLockedPct >= 90,
    lp_locked_pct: security.lpLockedPct,
    mint_authority_null:
      security.mintAuthority === "unknown"
        ? null
        : security.mintAuthority === "disabled",
    freeze_authority_null:
      security.freezeAuthority === "unknown"
        ? null
        : security.freezeAuthority === "disabled",
    top10_holder_pct: security.top10HolderPct,
    cluster_pct: security.clusterPct,
    bundler_pct: security.bundlerPct,
    dev_sells: security.devSells,
    security_status: security.status,
    safety_score: security.score,
    momentum_score: momentum,
    radar_score: radarScore,
    decision,
    risk_flags: [...new Set(risks)].slice(0, 10),
    radar_reason: radarReason,
    highest_risk: highestRisk,
    dex_url: pair.dexUrl,
    rugcheck_url:
      "https://rugcheck.xyz/tokens/" + encodeURIComponent(pair.mintAddress),
    updated_at: new Date().toISOString(),
  };
}

export async function scanAndPersist() {
  const supabase = createSupabaseAdmin();
  const pairs = await discoverPairs();

  if (!pairs.length) {
    throw new Error(
      "DexScreener taramasından Solana pair verisi alınamadı; mock veri kullanılmadı.",
    );
  }

  const mints = pairs.map((pair) => pair.mintAddress);
  const previousResult = await supabase
    .from("tokens")
    .select("mint_address, volume_24h, liquidity_usd")
    .in("mint_address", mints);

  if (previousResult.error) {
    throw new Error("Önceki snapshot verisi okunamadı: " + previousResult.error.message);
  }

  const previousByMint = new Map<string, JsonRecord>();
  for (const row of previousResult.data ?? []) {
    previousByMint.set(row.mint_address, row);
  }

  const securities = await mapLimit(pairs, 6, (pair) =>
    fetchSecurity(pair.mintAddress),
  );
  const rows = pairs.map((pair, index) =>
    rowFromPair(pair, securities[index], previousByMint.get(pair.mintAddress)),
  );

  const { error: upsertError } = await supabase
    .from("tokens")
    .upsert(rows, { onConflict: "mint_address" });

  if (upsertError) {
    throw new Error("Token snapshot upsert başarısız: " + upsertError.message);
  }

  const { error: snapshotError } = await supabase.from("token_snapshots").insert(
    rows.map((row) => ({
      mint_address: row.mint_address,
      price_usd: row.price_usd,
      market_cap: row.market_cap,
      volume_5m: row.volume_5m,
      volume_1h: row.volume_1h,
      volume_6h: row.volume_6h,
      volume_24h: row.volume_24h,
      liquidity_usd: row.liquidity_usd,
      safety_score: row.safety_score,
      momentum_score: row.momentum_score,
      radar_score: row.radar_score,
      decision: row.decision,
      recorded_at: row.updated_at,
    })),
  );

  if (snapshotError) {
    throw new Error("Token snapshot history yazılamadı: " + snapshotError.message);
  }

  return {
    scanned: pairs.length,
    watch: rows.filter((row) => row.decision === "watch").length,
    conditional: rows.filter((row) => row.decision === "conditional").length,
    rejected: rows.filter((row) => row.decision === "rejected").length,
    updatedAt: new Date().toISOString(),
  };
}
