import { NextRequest, NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";

const ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";

function bucharestDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

async function GETHandler(request: NextRequest) {
  const digits = (request.nextUrl.searchParams.get("cui") || "").replace(/\D/g, "");
  if (!/^\d{2,10}$/.test(digits)) {
    return NextResponse.json({ error: "Introdu un CUI valid, fără RO." }, { status: 400 });
  }

  try {
    const response = await fetch(ANAF_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify([{ cui: Number(digits), data: bucharestDate() }]),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`ANAF a răspuns cu status ${response.status}.`);
    const payload = await response.json() as { found?: Array<Record<string, any>>; notFound?: unknown[] };
    const item = payload.found?.[0];
    if (!item) return NextResponse.json({ error: "CUI-ul nu a fost găsit la ANAF. Completează datele manual." }, { status: 404 });

    const general = item.date_generale || {};
    const social = item.adresa_sediu_social || {};
    return NextResponse.json({
      source: "ANAF",
      company: {
        name: String(general.denumire || "").trim(),
        cif: String(general.cui || digits),
        regCom: String(general.nrRegCom || "").trim(),
        address: String(general.adresa || "").trim(),
        judet: String(social.sdenumire_Judet || "").trim(),
        city: String(social.sdenumire_Localitate || "").trim(),
        phone: String(general.telefon || "").trim(),
        postalCode: String(general.codPostal || social.scod_Postal || "").trim(),
        countryCode: "RO",
        vatPayer: item.inregistrare_scop_Tva?.scpTVA ? 1 : 0,
        inactive: Boolean(item.stare_inactiv?.statusInactivi),
        registrationStatus: String(general.stare_inregistrare || "").trim(),
      },
    });
  } catch (error) {
    console.error("ANAF company lookup failed:", error);
    return NextResponse.json({ error: "Serviciul ANAF nu răspunde momentan. Poți completa datele manual." }, { status: 503 });
  }
}

export const GET = accountingApi(GETHandler);
