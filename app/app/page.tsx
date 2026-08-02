import { createSupabaseServer } from "@/lib/supabase";
import type { TokenRow } from "@/lib/types";
import Dashboard from "@/components/Dashboard";

export const revalidate = 45;

async function getData(): Promise<{
  tokens: TokenRow[];
  lastUpdated: string | null;
  error: string | null;
}> {
  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .order("radar_score", { ascending: false, nullsFirst: false })
      .limit(500);

    if (error) throw new Error(error.message);

    const tokens = ((data ?? []) as any[]).map((row) => ({
      ...row,
      security_status: row.security_status ?? "unknown",
      decision: row.decision ?? "conditional",
      risk_flags: Array.isArray(row.risk_flags) ? row.risk_flags : [],
      history: [],
    })) as TokenRow[];

    const lastUpdated =
      tokens
        .map((token) => token.updated_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    return { tokens, lastUpdated, error: null };
  } catch (error) {
    return {
      tokens: [],
      lastUpdated: null,
      error:
        error instanceof Error
          ? error.message
          : "Supabase bağlantısı kurulamadı.",
    };
  }
}

export default async function HomePage() {
  const data = await getData();

  return (
    <Dashboard
      initialTokens={data.tokens}
      initialLastUpdated={data.lastUpdated}
      initialError={data.error}
    />
  );
}
