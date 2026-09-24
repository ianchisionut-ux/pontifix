import { NextRequest,NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { getD394Export } from "@/lib/accounting/d394";
export const GET=accountingApi(async(req:NextRequest)=>{
  try{
    const {xml,...preview}=await getD394Export(Number(req.nextUrl.searchParams.get('year')),Number(req.nextUrl.searchParams.get('month')),req.nextUrl.searchParams.get('confirmed')==='1');
    return NextResponse.json(preview,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Prevalidarea D394 a eșuat.'},{status:400});}
});
