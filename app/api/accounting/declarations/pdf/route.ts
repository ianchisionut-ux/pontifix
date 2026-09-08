import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { getCompany } from "@/lib/accounting/repo";
import { getDeclarationPeriod, type DeclarationType } from "@/lib/accounting/declarations";
import { DeclarationPdf } from "@/components/accounting/DeclarationPdf";

async function GETHandler(req: NextRequest) {
  try {
    const type = String(req.nextUrl.searchParams.get("type") || "") as DeclarationType;
    if (!["D300","D394","D390"].includes(type)) throw new Error("Tip de declaratie invalid.");
    const year=Number(req.nextUrl.searchParams.get("year")), month=Number(req.nextUrl.searchParams.get("month"));
    const [company,report]=await Promise.all([getCompany(),getDeclarationPeriod(year,month)]);
    const element=React.createElement(DeclarationPdf,{company,report,type});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer=await renderToBuffer(element as any);
    return new NextResponse(buffer as unknown as BodyInit,{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${type}_${year}_${String(month).padStart(2,"0")}_fisa_lucru.pdf"`,"Cache-Control":"no-store"}});
  } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:"PDF-ul nu a putut fi generat."},{status:400}); }
}
export const GET=accountingApi(GETHandler);
