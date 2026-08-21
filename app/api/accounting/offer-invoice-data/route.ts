import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accountingApi } from "@/lib/accounting/access";
import { ensureQuoteStorage } from "@/lib/ensure-quote-storage";
import { getOfferAccess } from "@/lib/offer-access";
import { normalizeOfferSheet, type AtrOcrData } from "@/lib/offer-sheet";
import { syncClientFromOffer } from "@/lib/accounting/repo";

type QuoteRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  serviceType: string;
  location: string | null;
  message: string | null;
  atrOcrData: AtrOcrData | null;
  offerData: unknown;
  createdAt: Date;
};

function publicOffer(row: QuoteRow) {
  const offer = normalizeOfferSheet(row.offerData, row, row.atrOcrData);
  return {
    id: row.id,
    ...offer,
    customerIdentifier: row.atrOcrData?.customerId || "",
    hasExecution: offer.executionNet > 0,
    hasProject: offer.projectNet > 0,
    hasPanel: offer.panelIncluded && offer.panelNet > 0,
  };
}

async function rowsForBusiness(businessId: string) {
  await ensureQuoteStorage();
  return prisma.$queryRaw<QuoteRow[]>`
    SELECT "id", "name", "email", "phone", "serviceType", "location", "message",
           "atrOcrData", "offerData", "createdAt"
    FROM "QuoteRequest"
    WHERE "businessId"=${businessId} OR "businessId" IS NULL
    ORDER BY "createdAt" DESC
  `;
}

async function GETHandler() {
  const access = await getOfferAccess();
  if (!access) return NextResponse.json({ error: "Contextul organizației lipsește." }, { status: 400 });
  const rows = await rowsForBusiness(access.businessId);
  return NextResponse.json(rows.map(publicOffer));
}

async function POSTHandler(req: NextRequest) {
  const access = await getOfferAccess();
  if (!access) return NextResponse.json({ error: "Contextul organizației lipsește." }, { status: 400 });
  const body = await req.json();
  const offerId = String(body.offerId || "");
  const row = (await rowsForBusiness(access.businessId)).find((item) => item.id === offerId);
  if (!row) return NextResponse.json({ error: "Oferta nu a fost găsită." }, { status: 404 });
  const offer = publicOffer(row);
  if (!offer.customerName.trim()) {
    return NextResponse.json({ error: "Oferta nu are beneficiarul completat." }, { status: 400 });
  }
  const clientId = await syncClientFromOffer({
    offerId: row.id,
    name: offer.customerName,
    identifier: offer.customerIdentifier,
    address: offer.workLocation,
    phone: offer.customerPhone,
    email: offer.customerEmail,
  });
  return NextResponse.json({ clientId, offer });
}

export const GET = accountingApi(GETHandler);
export const POST = accountingApi(POSTHandler);
