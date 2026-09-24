import { NextRequest,NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { getCashVatJournal } from "@/lib/accounting/cash-vat";
export const GET=accountingApi(async(req:NextRequest)=>{
  try{return NextResponse.json(await getCashVatJournal(Number(req.nextUrl.searchParams.get("year")),Number(req.nextUrl.searchParams.get("month"))),{headers:{"Cache-Control":"private, no-store"}});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Jurnalul nu a putut fi calculat."},{status:400});}
});
