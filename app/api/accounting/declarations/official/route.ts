import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { getOfficialAnafForm } from "@/lib/accounting/anaf-official-forms";
import type { DeclarationType } from "@/lib/accounting/declarations";

export const runtime = "nodejs";

async function GETHandler(req: NextRequest) {
  try {
    const type = String(req.nextUrl.searchParams.get("type") || "") as DeclarationType;
    if (!["D300", "D394", "D390"].includes(type)) throw new Error("Tip de declarație invalid.");
    const year = Number(req.nextUrl.searchParams.get("year"));
    const month = Number(req.nextUrl.searchParams.get("month"));
    const form = getOfficialAnafForm(type, year, month);
    const upstream = await fetch(form.pdfUrl, {
      cache: "no-store",
      headers: { "User-Agent": "Elmont-Facturare/1.0 (+https://elmontz.vercel.app)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok) throw new Error(`ANAF nu a furnizat formularul (${upstream.status}).`);
    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength < 5 || new TextDecoder("ascii").decode(bytes.slice(0, 5)) !== "%PDF-") {
      throw new Error("Fișierul furnizat de ANAF nu este un PDF valid.");
    }
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${type}_${year}_${String(month).padStart(2, "0")}_formular_oficial_ANAF.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-ANAF-Form-Version": form.version,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Formularul oficial nu a putut fi descărcat." }, { status: 502 });
  }
}

export const GET = accountingApi(GETHandler);
