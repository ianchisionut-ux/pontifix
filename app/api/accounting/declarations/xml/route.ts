import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { generateOfficialD300Xml, generateOfficialD390Xml } from "@/lib/accounting/declarations";

async function GETHandler(req: NextRequest) {
  try {
    const type = String(req.nextUrl.searchParams.get("type") || "");
    if (!["D300","D390"].includes(type)) throw new Error("Generatorul XML oficial D394 rămâne blocat până la clasificarea completă a partenerilor și seriilor de facturi.");
    const year = Number(req.nextUrl.searchParams.get("year"));
    const month = Number(req.nextUrl.searchParams.get("month"));
    const rectified = req.nextUrl.searchParams.get("rectified") === "1";
    const xml = type==="D300" ? await generateOfficialD300Xml(year,month) : await generateOfficialD390Xml(year, month, rectified);
    return new NextResponse(xml, { headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Content-Disposition": `attachment; filename="${type}_${year}_${String(month).padStart(2,"0")}${type==="D390"&&rectified ? "_rectificativa" : ""}.xml"`,
      "Cache-Control": "private, no-store, max-age=0",
    } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "XML-ul oficial nu a putut fi generat." }, { status: 409 }); }
}

export const GET = accountingApi(GETHandler);
