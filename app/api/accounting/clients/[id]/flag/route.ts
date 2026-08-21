import { accountingApi } from '@/lib/accounting/access'
import { NextRequest, NextResponse } from "next/server";
import { setClientFlagged } from "@/lib/accounting/repo";

async function PUTHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await req.json();
  await setClientFlagged(Number(id), !!data.flagged);
  return NextResponse.json({ ok: true });
}

export const PUT = accountingApi(PUTHandler)
