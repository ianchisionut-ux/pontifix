import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { getInvoiceFull, deleteInvoice, correctUnsentInvoice } from "@/lib/accounting/repo";
import { latestSubmission } from "@/lib/accounting/efactura";

async function GETHandler(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const full = await getInvoiceFull(Number(id));
  if (!full) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ...full, eFacturaSubmission: await latestSubmission(Number(id)) });
}

async function DELETEHandler(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteInvoice(Number(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Factura nu a putut fi ștearsă." }, { status: 400 });
  }
}

export const GET = accountingApi(GETHandler)
export const DELETE = accountingApi(DELETEHandler)
export const PATCH = accountingApi(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    await correctUnsentInvoice(Number(id), await req.json());
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Corecția a eșuat." }, { status: 400 }); }
});
