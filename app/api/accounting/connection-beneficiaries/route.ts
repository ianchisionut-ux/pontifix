import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accountingApi } from "@/lib/accounting/access";
import { getConnectionAccess } from "@/lib/connection-access";
import { connectionFieldsSchema } from "@/lib/connection-fields";
import { ensureConnectionStorage } from "@/lib/ensure-connection-storage";
import { syncClientFromConnection } from "@/lib/accounting/repo";

type ConnectionRow = { id: string; nib: string; fields: unknown; createdAt: Date };

function composeAddress(fields: ReturnType<typeof connectionFieldsSchema.parse>) {
  if (fields.CiDomiciliu?.trim()) return fields.CiDomiciliu.trim();
  if (fields.Amplasament?.trim()) return fields.Amplasament.trim();
  return [
    fields.Judet && `Jud. ${fields.Judet}`,
    (fields.Sat || fields.Oras) && `Loc. ${fields.Sat || fields.Oras}`,
    fields.Strada && `Str. ${fields.Strada}`,
    fields.Nr && `nr. ${fields.Nr}`,
    fields.Bloc && `bl. ${fields.Bloc}`,
    fields.Ap && `ap. ${fields.Ap}`,
  ].filter(Boolean).join(", ");
}

async function rowsForBusiness(businessId: string) {
  await ensureConnectionStorage();
  return prisma.$queryRaw<ConnectionRow[]>`
    SELECT "id", "nib", "fields", "createdAt"
    FROM "ConnectionCase"
    WHERE "businessId"=${businessId}
    ORDER BY "createdAt" DESC, "sequenceNumber" DESC
  `;
}

async function GETHandler() {
  const access = await getConnectionAccess();
  if (!access) return NextResponse.json({ error: "Contextul organizației lipsește." }, { status: 400 });
  const rows = await rowsForBusiness(access.businessId);
  return NextResponse.json(rows.map((row) => {
    const fields = connectionFieldsSchema.parse(row.fields);
    return {
      id: row.id,
      nib: row.nib,
      beneficiary: fields.Beneficiar,
      identifier: fields.CnpCif,
      phone: fields.Telefon,
      address: composeAddress(fields),
      judet: fields.Judet,
      city: fields.Sat || fields.Oras,
      ciSeries: fields.CiSerie,
      ciNumber: fields.CiNumar,
    };
  }));
}

async function POSTHandler(req: NextRequest) {
  const access = await getConnectionAccess();
  if (!access) return NextResponse.json({ error: "Contextul organizației lipsește." }, { status: 400 });
  const body = await req.json();
  const connectionId = String(body.connectionId || "");
  const row = (await rowsForBusiness(access.businessId)).find((item) => item.id === connectionId);
  if (!row) return NextResponse.json({ error: "Branșamentul nu a fost găsit." }, { status: 404 });
  const fields = connectionFieldsSchema.parse(row.fields);
  if (!fields.Beneficiar.trim()) {
    return NextResponse.json({ error: "Branșamentul nu are beneficiarul completat." }, { status: 400 });
  }
  const clientId = await syncClientFromConnection({
    connectionId: row.id,
    nib: row.nib,
    name: fields.Beneficiar,
    identifier: fields.CnpCif,
    address: composeAddress(fields),
    judet: fields.Judet,
    city: fields.Sat || fields.Oras,
    phone: fields.Telefon,
    ciSeries: fields.CiSerie,
    ciNumber: fields.CiNumar,
  });
  return NextResponse.json({ clientId });
}

export const GET = accountingApi(GETHandler);
export const POST = accountingApi(POSTHandler);