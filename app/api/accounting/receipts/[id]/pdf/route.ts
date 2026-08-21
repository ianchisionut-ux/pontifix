import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getReceipt, getClient, getCompany, getInvoice } from "@/lib/accounting/repo";
import { ReceiptPdf } from "@/components/accounting/ReceiptPdf";
import React from "react";

async function GETHandler(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const receipt = await getReceipt(Number(id));
  if (!receipt) return NextResponse.json({ error: "not found" }, { status: 404 });

  const invoice = await getInvoice(receipt.invoiceId);
  if (!invoice) return NextResponse.json({ error: "invoice not found" }, { status: 404 });
  const client = await getClient(invoice.clientId);
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });
  const company = await getCompany();

  const element = React.createElement(ReceiptPdf, { receipt, invoice, client, company });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  const numStr = String(receipt.number).padStart(4, "0");
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Chitanta_${receipt.series}${numStr}.pdf"`,
    },
  });
}

export const GET = accountingApi(GETHandler)
