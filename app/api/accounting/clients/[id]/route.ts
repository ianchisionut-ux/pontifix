import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { getClient, updateClient, deleteClient } from "@/lib/accounting/repo";
import { clientSchema, clientFieldErrors } from '@/lib/accounting/client-validation'

async function GETHandler(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(Number(id));
  if (!client) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(client);
}

async function PUTHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = clientSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Completează câmpurile obligatorii ale clientului.', fieldErrors: clientFieldErrors(parsed.error) }, { status: 400 });
  await updateClient(Number(id), parsed.data);
  return NextResponse.json({ ok: true });
}

async function DELETEHandler(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteClient(Number(id));
  return NextResponse.json({ ok: true });
}

export const GET = accountingApi(GETHandler)
export const PUT = accountingApi(PUTHandler)
export const DELETE = accountingApi(DELETEHandler)
