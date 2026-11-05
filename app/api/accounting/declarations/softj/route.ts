import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { generateOfficialD300Xml, generateOfficialD390Xml } from "@/lib/accounting/declarations";
import { getD394Export } from "@/lib/accounting/d394";

export const runtime = "nodejs";
export const maxDuration = 60;

type SoftJReply = { ok?: boolean; message?: string; error?: string; pdfBase64?: string };

async function POSTHandler(req: NextRequest) {
  try {
    const input = await req.json();
    const type = String(input.type || "");
    const mode = String(input.mode || "");
    const year = Number(input.year);
    const month = Number(input.month);
    if (!["D300", "D390", "D394"].includes(type) || !["validate", "pdf"].includes(mode)) {
      return NextResponse.json({ error: "Tipul sau operația Soft J este invalidă." }, { status: 400 });
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Perioada fiscală este invalidă." }, { status: 400 });
    }
    const serviceUrl = process.env.SOFTJ_INTERNAL_URL;
    if (!serviceUrl) return NextResponse.json({ error: "Serviciul Soft J nu este configurat pe server." }, { status: 503 });

    let xml: string;
    if (type === "D300") xml = await generateOfficialD300Xml(year, month);
    else if (type === "D390") xml = await generateOfficialD390Xml(year, month, Boolean(input.rectified));
    else {
      if (input.confirmed !== true) return NextResponse.json({ error: "Confirmă domeniul limitat al D394 înainte de validare." }, { status: 400 });
      const result = await getD394Export(year, month, true);
      if (!result.xml) throw new Error(`XML D394 blocat: ${result.blockers.join(" ")}`);
      xml = result.xml;
    }

    const upstream = await fetch(new URL("/render", serviceUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, mode, xml }),
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
    const result = (await upstream.json()) as SoftJReply;
    if (!upstream.ok || !result.ok) {
      return NextResponse.json({ error: result.error || "Validarea Soft J a eșuat." }, { status: upstream.status >= 400 ? upstream.status : 422 });
    }
    if (mode === "validate") return NextResponse.json({ ok: true, message: result.message || "XML validat de Soft J ANAF." }, { headers: { "Cache-Control": "private, no-store" } });
    if (!result.pdfBase64) throw new Error("Soft J nu a produs fișierul PDF.");
    const bytes = Uint8Array.from(Buffer.from(result.pdfBase64, "base64"));
    return new Response(bytes, { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${type}_${year}_${String(month).padStart(2, "0")}_SoftJ.pdf"`,
      "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Soft J nu a putut procesa declarația." }, { status: 409 });
  }
}

export const POST = accountingApi(POSTHandler);
