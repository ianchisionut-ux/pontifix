import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { createStornoInvoice } from "@/lib/accounting/repo";

async function POSTHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await req.json();
    const reason = String(data.reason || "").trim();
    if (!reason) return NextResponse.json({ error: "Completează motivul stornării." }, { status: 400 });
    const stornoId = await createStornoInvoice({
      originalInvoiceId: Number(id),
      series: String(data.series || "STO"),
      issueDate: String(data.issueDate || new Date().toISOString().slice(0, 10)),
      reason,
    });
    return NextResponse.json({ id: stornoId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Factura nu a putut fi stornată." }, { status: 400 });
  }
}

export const POST = accountingApi(POSTHandler);
