import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { updateUser, deleteUser } from "@/lib/accounting/repo";

async function PUTHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await req.json();
  await updateUser(Number(id), data);
  return NextResponse.json({ ok: true });
}

async function DELETEHandler(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteUser(Number(id));
  return NextResponse.json({ ok: true });
}

export const PUT = accountingApi(PUTHandler)
export const DELETE = accountingApi(DELETEHandler)
