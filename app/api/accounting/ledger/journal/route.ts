import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { createManualJournalEntry, listJournal } from "@/lib/accounting/ledger";

async function GETHandler(req: NextRequest) {
  return NextResponse.json(await listJournal({
    from: req.nextUrl.searchParams.get("from") || undefined,
    to: req.nextUrl.searchParams.get("to") || undefined,
  }));
}

async function POSTHandler(req: NextRequest) {
  try {
    const id = await createManualJournalEntry(await req.json());
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Articolul nu a putut fi postat." }, { status: 400 });
  }
}

export const GET = accountingApi(GETHandler);
export const POST = accountingApi(POSTHandler);
