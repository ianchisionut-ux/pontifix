import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { addPayment, getInvoiceFull } from "@/lib/accounting/repo";

async function POSTHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await req.json();
  await addPayment(Number(id), Number(data.amount), data.date, data.method ?? "numerar", data.notes ?? "");
  return NextResponse.json(await getInvoiceFull(Number(id)));
}

export const POST = accountingApi(POSTHandler)
