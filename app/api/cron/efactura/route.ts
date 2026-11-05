import { NextResponse } from "next/server";
import { processAutomaticEFactura, recordAutomationFailure, syncAnafMessages, getAnafConnectionStatus } from "@/lib/accounting/efactura";
import { importReceivedBatch } from "@/lib/accounting/efactura-import";
import { getCompany } from "@/lib/accounting/repo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  try {
    const connection = await getAnafConnectionStatus();
    const company = await getCompany();
    let received;
    if (connection.configured && connection.connected && company.cif) {
      await syncAnafMessages(company.cif);
      received = await importReceivedBatch(20);
    }
    const sent = await processAutomaticEFactura(50);
    return NextResponse.json({ sent, received });
  } catch (error) {
    try { await recordAutomationFailure(error); } catch {}
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Procesarea automată e-Factura a eșuat." },
      { status: 500 }
    );
  }
}
