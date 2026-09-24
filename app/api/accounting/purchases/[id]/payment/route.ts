import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { addSupplierPayment } from "@/lib/accounting/purchases";

async function POSTHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; return NextResponse.json({ id: await addSupplierPayment(Number(id), await req.json()) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Plata nu a putut fi înregistrată." }, { status: 400 }); }
}
export const POST = accountingApi(POSTHandler);
