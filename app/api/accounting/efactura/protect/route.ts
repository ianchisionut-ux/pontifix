import { NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { processAutomaticEFactura } from "@/lib/accounting/efactura";
export const maxDuration = 300;

async function POSTHandler() {
  try {
    return NextResponse.json(await processAutomaticEFactura(50));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Protecția automată e-Factura nu a putut fi rulată." },
      { status: 500 }
    );
  }
}

export const POST = accountingApi(POSTHandler);
