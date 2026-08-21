import { accountingApi } from '@/lib/accounting/access'
import { listClients } from "@/lib/accounting/repo";
import { toCsv, csvResponse } from "@/lib/accounting/csv";

async function GETHandler() {
  const clients = await listClients();
  const csv = toCsv(
    ["Denumire", "Reg. Com.", "CIF", "Adresa", "Judet", "Telefon", "Email"],
    clients.map((c) => ({
      Denumire: c.name,
      "Reg. Com.": c.regCom,
      CIF: c.cif,
      Adresa: c.address,
      Judet: c.judet,
      Telefon: c.phone,
      Email: c.email,
    }))
  );
  return csvResponse("clienti.csv", csv);
}

export const GET = accountingApi(GETHandler)
