import { NextResponse } from "next/server";
import { scanAndPersist } from "@/lib/scanner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.VERCEL_ENV !== "production";

  const authorization = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-vercel-cron");
  return (
    authorization === "Bearer " + secret ||
    cronHeader === "1" ||
    cronHeader === "true"
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Yetkisiz tarama isteği." },
      { status: 401 },
    );
  }

  try {
    const result = await scanAndPersist();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Bilinmeyen tarama hatası.";
    console.error("scan_failed", message);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Canlı tarama tamamlanamadı. Kaynak veriler eksik veya geçici olarak erişilemiyor.",
        detail: message,
      },
      { status: 502 },
    );
  }
}
