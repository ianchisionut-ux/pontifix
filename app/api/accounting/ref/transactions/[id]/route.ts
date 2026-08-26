import { NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { deleteRefTransaction } from "@/lib/accounting/ref";

async function DELETEHandler(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; await deleteRefTransaction(Number(id)); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Poziția nu a putut fi ștearsă." }, { status: 400 }); }
}
export const DELETE = accountingApi(DELETEHandler);