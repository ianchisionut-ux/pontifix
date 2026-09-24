import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { generateOfficialD300Xml, generateOfficialD390Xml } from "@/lib/accounting/declarations";
import { getD394Export } from "@/lib/accounting/d394";

async function GETHandler(req: NextRequest) {
  try {
    const type = String(req.nextUrl.searchParams.get("type") || "");
    if (!["D300","D390","D394"].includes(type)) throw new Error("Tip de declarație invalid.");
    const year = Number(req.nextUrl.searchParams.get("year"));
    const month = Number(req.nextUrl.searchParams.get("month"));
    const rectified = req.nextUrl.searchParams.get("rectified") === "1";
    let xml:string;
    if(type==='D394'){
      const result=await getD394Export(year,month,req.nextUrl.searchParams.get('confirmed')==='1');
      if(!result.xml)throw new Error(`XML D394 blocat: ${result.blockers.join(' ')}`);
      xml=result.xml;
    }else xml = type==="D300" ? await generateOfficialD300Xml(year,month) : await generateOfficialD390Xml(year, month, rectified);
    return new NextResponse(xml, { headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Content-Disposition": `attachment; filename="${type}_${year}_${String(month).padStart(2,"0")}${type==="D390"&&rectified ? "_rectificativa" : ""}.xml"`,
      "Cache-Control": "private, no-store, max-age=0",
    } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "XML-ul oficial nu a putut fi generat." }, { status: 409 }); }
}

export const GET = accountingApi(GETHandler);
