import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { exportDeclarationWorkingPaper, type DeclarationType } from "@/lib/accounting/declarations";

async function GETHandler(req: NextRequest) {
  try {
    const type = String(req.nextUrl.searchParams.get("type") || "") as DeclarationType;
    if (!["D300", "D394", "D390"].includes(type)) throw new Error("Tip de declarație invalid.");
    const year = Number(req.nextUrl.searchParams.get("year")), month = Number(req.nextUrl.searchParams.get("month"));
    const csv = await exportDeclarationWorkingPaper(type, year, month);
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv;charset=UTF-8", "Content-Disposition": `attachment; filename="${type}_${year}_${String(month).padStart(2, "0")}_fisa_lucru.csv"`, "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Exportul nu a putut fi generat." }, { status: 400 }); }
}
export const GET = accountingApi(GETHandler);
