import { NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { updateDeclarationSettings } from "@/lib/accounting/declarations";

async function PUTHandler(req: Request) {
  try { return NextResponse.json(await updateDeclarationSettings(await req.json())); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Datele declarantului nu au putut fi salvate." }, { status: 400 }); }
}

export const PUT = accountingApi(PUTHandler);
