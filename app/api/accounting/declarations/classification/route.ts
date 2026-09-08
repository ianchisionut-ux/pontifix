import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { updateD390Classification } from "@/lib/accounting/declarations";

async function PUTHandler(req: NextRequest) {
  try {
    const year = Number(req.nextUrl.searchParams.get("year"));
    const month = Number(req.nextUrl.searchParams.get("month"));
    return NextResponse.json(await updateD390Classification(year, month, await req.json()));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Clasificarea nu a putut fi salvată." }, { status: 400 }); }
}

export const PUT = accountingApi(PUTHandler);
