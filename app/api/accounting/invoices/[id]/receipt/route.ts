import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { createReceipt, getInvoice, getInvoiceFull } from "@/lib/accounting/repo";

async function POSTHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await req.json();
    const invoice = await getInvoice(Number(id));
    if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });
    const amount = Number(data.amount ?? invoice.total);
    const issueDate = data.issueDate ?? invoice.issueDate;
    await createReceipt(Number(id), issueDate, amount, data.cashier ?? "");
    return NextResponse.json(await getInvoiceFull(Number(id)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Chitanța nu a putut fi emisă." }, { status: 400 });
  }
}

export const POST = accountingApi(POSTHandler)
