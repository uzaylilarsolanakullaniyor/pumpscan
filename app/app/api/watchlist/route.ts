import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function validWatcher(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{12,80}$/.test(value);
}

function validMint(value: unknown): value is string {
  return typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,50}$/.test(value);
}

export async function GET(request: Request) {
  const watcher = new URL(request.url).searchParams.get("watcher");
  if (!validWatcher(watcher)) {
    return NextResponse.json({ ok: false, error: "Geçersiz watchlist kimliği." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("watchlist")
      .select("mint_address")
      .eq("watcher_id", watcher)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({
      ok: true,
      mints: (data ?? []).map((row) => row.mint_address),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Watchlist verisi okunamadı.",
        detail: error instanceof Error ? error.message : "Bilinmeyen hata",
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!validWatcher(body?.watcherId) || !validMint(body?.mintAddress)) {
      return NextResponse.json({ ok: false, error: "Geçersiz watchlist girdisi." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from("watchlist").upsert(
      {
        watcher_id: body.watcherId,
        mint_address: body.mintAddress,
      },
      { onConflict: "watcher_id,mint_address" },
    );

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Token watchlist'e eklenemedi." },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    if (!validWatcher(body?.watcherId) || !validMint(body?.mintAddress)) {
      return NextResponse.json({ ok: false, error: "Geçersiz watchlist girdisi." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { error } = await supabase
      .from("watchlist")
      .delete()
      .eq("watcher_id", body.watcherId)
      .eq("mint_address", body.mintAddress);

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Token watchlist'ten çıkarılamadı." },
      { status: 502 },
    );
  }
}
