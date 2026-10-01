import { NextRequest,NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { suggestAccounts } from "@/lib/accounting/account-suggestions";
async function GETHandler(req:NextRequest){
 const q=req.nextUrl.searchParams.get("q")||"",direction=req.nextUrl.searchParams.get("direction")==="EXPENSE"?"EXPENSE":"INCOME";
 try{return NextResponse.json(await suggestAccounts(q,direction));}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Contul nu a putut fi sugerat."},{status:400});}
}
export const GET=accountingApi(GETHandler);
