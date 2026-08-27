import { NextResponse } from "next/server";
import { processAutomaticEFactura } from "@/lib/accounting/efactura";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  }
  try {
    return NextResponse.json(await processAutomaticEFactura(30));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Procesarea automată e-Factura a eșuat." }, { status: 500 });
  }
}