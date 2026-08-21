import { accountingApi } from "@/lib/accounting/access";
import { listClients } from "@/lib/accounting/repo";
import { toCsv, csvResponse } from "@/lib/accounting/csv";

async function GETHandler() {
  const clients = await listClients();
  const csv = toCsv(
    ["Denumire", "Tip", "Reg. Com.", "CIF", "CNP", "Adresa", "Localitate", "Judet", "Telefon", "Email", "NIB"],
    clients.map((c) => ({
      Denumire: c.name,
      Tip: c.clientType === "PF" ? "Persoana fizica" : "Persoana juridica",
      "Reg. Com.": c.regCom,
      CIF: c.cif,
      CNP: c.cnp,
      Adresa: c.address,
      Localitate: c.city,
      Judet: c.judet,
      Telefon: c.phone,
      Email: c.email,
      NIB: c.sourceNib,
    }))
  );
  return csvResponse("clienti.csv", csv);
}

export const GET = accountingApi(GETHandler);