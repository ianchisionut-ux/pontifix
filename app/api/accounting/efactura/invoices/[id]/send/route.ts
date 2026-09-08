import { NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { sendInvoiceToAnaf } from "@/lib/accounting/efactura";

async function POSTHandler(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await _request.json();
    if (body.anafEnvironment !== (process.env.ANAF_ENVIRONMENT === 'production' ? 'production' : 'test')) return NextResponse.json({ error: 'Confirmă mediul ANAF actual înainte de transmitere.' }, { status: 409 });
    return NextResponse.json(await sendInvoiceToAnaf(Number(id), true));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transmiterea a eșuat." },
      { status: 400 }
    );
  }
}

export const POST = accountingApi(POSTHandler);
