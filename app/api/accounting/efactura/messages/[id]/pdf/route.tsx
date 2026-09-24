import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { accountingApi } from "@/lib/accounting/access";
import { downloadAnafMessage } from "@/lib/accounting/efactura";
import { parseAnafInvoiceArchive } from "@/lib/accounting/anaf-invoice-document";
import { AnafInvoicePdf } from "@/components/accounting/AnafInvoicePdf";
export const runtime="nodejs";
const safe=(v:string)=>v.replace(/[^a-zA-Z0-9._-]+/g,"_").slice(0,80)||"ANAF";
async function GETHandler(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const{id}=await params;
    const file=await downloadAnafMessage(id);
    const document=parseAnafInvoiceArchive(file.buffer);
    const element=React.createElement(AnafInvoicePdf,{document,downloadId:id});
    // @ts-expect-error React PDF narrows this to DocumentProps internally.
    const buffer=await renderToBuffer(element as React.ReactElement);
    const disposition=req.nextUrl.searchParams.get("download")==="1"?"attachment":"inline";
    return new NextResponse(buffer as unknown as BodyInit,{headers:{"Content-Type":"application/pdf","Content-Disposition":`${disposition}; filename="eFactura_ANAF_${safe(document.id||id)}.pdf"`,"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"PDF-ul ANAF nu a putut fi generat."},{status:400})}
}
export const GET=accountingApi(GETHandler);
