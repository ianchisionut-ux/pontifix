import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { addPayment, getInvoiceFull } from "@/lib/accounting/repo";

async function POSTHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await req.json();
    await addPayment(Number(id), Number(data.amount), data.date, data.method ?? "numerar", data.notes ?? "");
    return NextResponse.json(await getInvoiceFull(Number(id)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Plata nu a putut fi înregistrată." }, { status: 400 });
  }
}

export const POST = accountingApi(POSTHandler)
