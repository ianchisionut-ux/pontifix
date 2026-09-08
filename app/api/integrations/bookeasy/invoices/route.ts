import { NextRequest, NextResponse } from "next/server";
import { authorizeBillingIntegration } from "@/lib/accounting/integration-auth";
import {
  createInvoice,
  getInvoiceByIntegrationReference,
  upsertIntegrationClient,
  type ClientInput,
  type InvoiceItemInput,
} from "@/lib/accounting/repo";
import { bucharestDate } from "@/lib/accounting/date";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdf } from "@/components/accounting/InvoicePdf";
import React from "react";

export const dynamic = "force-dynamic";

type BookeasyInvoiceRequest = {
  externalId?: unknown;
  issueDate?: unknown;
  dueDate?: unknown;
  currency?: unknown;
  notes?: unknown;
  customer?: Record<string, unknown>;
  items?: unknown;
};

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function invoiceResponse(
  full: NonNullable<Awaited<ReturnType<typeof getInvoiceByIntegrationReference>>>,
  duplicate: boolean,
) {
  const invoice = full.invoice;
  return NextResponse.json({
    id: invoice.id,
    reference: `${invoice.series} ${String(invoice.number).padStart(4, "0")}`,
    externalId: invoice.externalId,
    status: invoice.status,
    total: invoice.total,
    currency: invoice.currency,
    duplicate,
    eFactura: "DEFERRED",
    pdfUrl: `/api/integrations/bookeasy/invoices?externalId=${encodeURIComponent(invoice.externalId || "")}&format=pdf`,
  }, { status: duplicate ? 200 : 201 });
}

export async function GET(request: NextRequest) {
  if (!authorizeBillingIntegration(request, "bookeasy"))
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });
  const rate = rateLimit(`${getClientIp(request)}:bookeasy-invoice-download`, 120, 60_000);
  if (!rate.allowed)
    return NextResponse.json({ error: "Prea multe solicitări. Reîncearcă peste un minut." }, { status: 429 });
  const externalId = cleanText(request.nextUrl.searchParams.get("externalId"), 160);
  if (!externalId)
    return NextResponse.json({ error: "externalId este obligatoriu." }, { status: 400 });
  const full = await getInvoiceByIntegrationReference("bookeasy", externalId);
  if (!full || !full.client)
    return NextResponse.json({ error: "Factura nu există." }, { status: 404 });
  if (request.nextUrl.searchParams.get("format") !== "pdf") return invoiceResponse(full, true);

  const element = React.createElement(InvoicePdf, {
    invoice: full.invoice,
    items: full.items,
    client: full.client,
    company: full.company,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  const number = String(full.invoice.number).padStart(4, "0");
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Factura_${full.invoice.series}${number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  if (!authorizeBillingIntegration(request, "bookeasy"))
    return NextResponse.json({ error: "Neautorizat." }, { status: 401 });

  const rate = rateLimit(`${getClientIp(request)}:bookeasy-invoices`, 60, 60_000);
  if (!rate.allowed)
    return NextResponse.json({ error: "Prea multe solicitări. Reîncearcă peste un minut." }, { status: 429 });

  try {
    const body = await request.json() as BookeasyInvoiceRequest;
    const externalId = cleanText(body.externalId, 160);
    if (!externalId)
      return NextResponse.json({ error: "externalId este obligatoriu." }, { status: 400 });

    const existing = await getInvoiceByIntegrationReference("bookeasy", externalId);
    if (existing) return invoiceResponse(existing, true);

    const customer = body.customer || {};
    const customerExternalId = cleanText(customer.externalId, 160);
    if (!customerExternalId)
      return NextResponse.json({ error: "customer.externalId este obligatoriu." }, { status: 400 });
    const clientType = cleanText(customer.type, 2).toUpperCase() === "PJ" ? "PJ" : "PF";
    const client: ClientInput = {
      name: cleanText(customer.name, 200),
      clientType,
      regCom: cleanText(customer.regCom, 100),
      cif: cleanText(customer.cif, 40),
      cnp: cleanText(customer.cnp, 20),
      address: cleanText(customer.address, 500),
      judet: cleanText(customer.county, 100),
      city: cleanText(customer.city, 100),
      phone: cleanText(customer.phone, 50),
      email: cleanText(customer.email, 200).toLowerCase(),
      vatPayer: customer.vatPayer === true ? 1 : 0,
      countryCode: cleanText(customer.countryCode, 2).toUpperCase() || "RO",
      postalCode: cleanText(customer.postalCode, 20),
      ciSeries: "",
      ciNumber: "",
    };
    if (!client.name || !client.address || !client.judet || !client.city)
      return NextResponse.json({ error: "Completează numele și adresa completă a clientului." }, { status: 400 });
    if (clientType === "PJ" && !client.cif)
      return NextResponse.json({ error: "CIF-ul clientului persoană juridică este obligatoriu." }, { status: 400 });

    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100)
      return NextResponse.json({ error: "Factura trebuie să conțină între 1 și 100 de poziții." }, { status: 400 });
    const items: InvoiceItemInput[] = body.items.map((raw) => {
      const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        description: cleanText(item.description, 500),
        um: cleanText(item.um, 20) || "buc",
        qty: Number(item.qty ?? 1),
        unitPrice: Number(item.unitPrice),
        vatRate: Number(item.vatRate),
        unitCode: cleanText(item.unitCode, 10).toUpperCase() || "H87",
        vatCategoryCode: cleanText(item.vatCategoryCode, 3).toUpperCase(),
        taxExemptionReasonCode: cleanText(item.taxExemptionReasonCode, 100),
        taxExemptionReason: cleanText(item.taxExemptionReason, 300),
      };
    });

    const clientId = await upsertIntegrationClient("bookeasy", customerExternalId, client);
    let invoiceId: number;
    try {
      invoiceId = await createInvoice({
        series: "BKE",
        clientId,
        issueDate: cleanText(body.issueDate, 10) || bucharestDate(),
        dueDate: cleanText(body.dueDate, 10) || undefined,
        currency: cleanText(body.currency, 3).toUpperCase() || "RON",
        notes: cleanText(body.notes, 2000),
        buyerReference: `Bookeasy ${externalId}`,
        paymentMeansCode: "30",
        paymentTerms: cleanText(body.dueDate, 10)
          ? "Plată până la data scadenței."
          : "Plată prin transfer bancar sau online.",
        items,
        integrationSource: "bookeasy",
        externalId,
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        const concurrent = await getInvoiceByIntegrationReference("bookeasy", externalId);
        if (concurrent) return invoiceResponse(concurrent, true);
      }
      throw error;
    }
    const created = await getInvoiceByIntegrationReference("bookeasy", externalId);
    if (!created || created.invoice.id !== invoiceId)
      throw new Error("Factura a fost emisă, dar răspunsul nu a putut fi încărcat.");
    return invoiceResponse(created, false);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Factura Bookeasy nu a putut fi emisă." },
      { status: 400 },
    );
  }
}