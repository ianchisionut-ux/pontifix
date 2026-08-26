import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { getCompany } from "@/lib/accounting/repo";
import { getRefReport } from "@/lib/accounting/ref";
import { RefPdf } from "@/components/accounting/RefPdf";
async function GETHandler(req: NextRequest) {
  const year = Number(req.nextUrl.searchParams.get("year") || new Date().getFullYear());
  const [company, report] = await Promise.all([getCompany(), getRefReport(year)]);
  const element = React.createElement(RefPdf, { company, year, ...report });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  return new NextResponse(buffer as unknown as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="REF_${year}.pdf"` } });
}
export const GET = accountingApi(GETHandler);