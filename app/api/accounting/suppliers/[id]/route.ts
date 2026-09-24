import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { updateSupplier } from "@/lib/accounting/purchases";

async function PUTHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; await updateSupplier(Number(id), await req.json()); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Furnizorul nu a putut fi actualizat." }, { status: 400 }); }
}
export const PUT = accountingApi(PUTHandler);
