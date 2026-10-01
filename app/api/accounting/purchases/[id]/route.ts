import { NextRequest,NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { getPurchase,updatePurchase } from "@/lib/accounting/purchases";
async function GETHandler(_:NextRequest,{params}:{params:Promise<{id:string}>}){try{return NextResponse.json(await getPurchase(Number((await params).id)));}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Documentul nu a fost găsit."},{status:404});}}
async function PATCHHandler(req:NextRequest,{params}:{params:Promise<{id:string}>}){try{await updatePurchase(Number((await params).id),await req.json());return NextResponse.json({ok:true});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Documentul nu a putut fi actualizat."},{status:400});}}
export const GET=accountingApi(GETHandler);
export const PATCH=accountingApi(PATCHHandler);