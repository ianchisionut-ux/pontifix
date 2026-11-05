import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { listClients, createClient } from "@/lib/accounting/repo";
import { clientSchema, clientFieldErrors } from '@/lib/accounting/client-validation'

async function GETHandler() {
  return NextResponse.json(await listClients());
}

async function POSTHandler(req: NextRequest) {
  const parsed = clientSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Completează câmpurile obligatorii ale clientului.', fieldErrors: clientFieldErrors(parsed.error) }, { status: 400 });
  const id = await createClient(parsed.data);
  return NextResponse.json({ id });
}

export const GET = accountingApi(GETHandler)
export const POST = accountingApi(POSTHandler)
