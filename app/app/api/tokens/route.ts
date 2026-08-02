import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import type { TokenRow } from "@/lib/types";

export const dynamic = "force-dynamic";

function normalizeRow(row: any, history: number[]): TokenRow {
  return {
    ...row,
    security_status: row.security_status ?? "unknown",
    decision: row.decision ?? "conditional",
    risk_flags: Array.isArray(row.risk_flags) ? row.risk_flags : [],
    history,
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("tokens")
      .select("*")
      .order("radar_score", { ascending: false, nullsFirst: false })
      .limit(500);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as any[];
    const mints = rows.map((row) => row.mint_address).filter(Boolean);
    const historyByMint = new Map<string, number[]>();

    if (mints.length) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const historyResult = await supabase
        .from("token_snapshots")
        .select("mint_address, price_usd, recorded_at")
        .in("mint_address", mints)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true });

      if (!historyResult.error) {
        for (const snapshot of historyResult.data ?? []) {
          if (typeof snapshot.price_usd !== "number") continue;
          const values = historyByMint.get(snapshot.mint_address) ?? [];
          values.push(snapshot.price_usd);
          historyByMint.set(snapshot.mint_address, values);
        }
      }
    }

    const tokens = rows.map((row) =>
      normalizeRow(row, historyByMint.get(row.mint_address) ?? []),
    );
    const lastUpdated =
      tokens
        .map((token) => token.updated_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    return NextResponse.json(
      { ok: true, tokens, lastUpdated },
      {
        headers: {
          "Cache-Control": "s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Veri okunamadı.";
    return NextResponse.json(
      {
        ok: false,
        error:
          "Canlı tablo verisi yüklenemedi. Supabase bağlantısı veya şema kontrol edilmeli.",
        detail: message,
      },
      { status: 502 },
    );
  }
}
