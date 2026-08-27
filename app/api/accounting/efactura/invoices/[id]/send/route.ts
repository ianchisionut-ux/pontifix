import { NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { sendInvoiceToAnaf } from "@/lib/accounting/efactura";

async function POSTHandler(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await sendInvoiceToAnaf(Number(id)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Transmiterea a eșuat." }, { status: 400 });
  }
}

export const POST = accountingApi(POSTHandler);