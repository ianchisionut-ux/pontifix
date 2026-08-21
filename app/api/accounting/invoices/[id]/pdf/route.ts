import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getInvoiceFull } from "@/lib/accounting/repo";
import { InvoicePdf } from "@/components/accounting/InvoicePdf";
import React from "react";

async function GETHandler(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const full = await getInvoiceFull(Number(id));
  if (!full || !full.client) return NextResponse.json({ error: "not found" }, { status: 404 });

  const element = React.createElement(InvoicePdf, {
    invoice: full.invoice,
    items: full.items,
    client: full.client,
    company: full.company,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);

  const numStr = String(full.invoice.number).padStart(4, "0");
  const filePrefix = full.invoice.invoiceType === "STORNO" ? "Factura_Storno" : "Factura";
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filePrefix}_${full.invoice.series}${numStr}.pdf"`,
    },
  });
}

export const GET = accountingApi(GETHandler)
