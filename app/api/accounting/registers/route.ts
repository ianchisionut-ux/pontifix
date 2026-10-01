import { NextRequest,NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { getFinancialRegister } from "@/lib/accounting/registers";
async function GETHandler(req:NextRequest){const p=req.nextUrl.searchParams;
 try{return NextResponse.json(await getFinancialRegister({type:p.get("type")==="BANK"?"BANK":"CASH",from:p.get("from")||"",to:p.get("to")||"",accountCode:p.get("account")||""}));}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Registrul nu a putut fi încărcat."},{status:400});}
}
export const GET=accountingApi(GETHandler);
