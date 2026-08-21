import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { listProducts, createProduct } from "@/lib/accounting/repo";

async function GETHandler() {
  return NextResponse.json(await listProducts());
}

async function POSTHandler(req: NextRequest) {
  const data = await req.json();
  const id = await createProduct(data);
  return NextResponse.json({ id });
}

export const GET = accountingApi(GETHandler)
export const POST = accountingApi(POSTHandler)
