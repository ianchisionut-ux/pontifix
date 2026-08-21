import { accountingApi } from '@/lib/accounting/access'
import { listProducts } from "@/lib/accounting/repo";
import { toCsv, csvResponse } from "@/lib/accounting/csv";

async function GETHandler() {
  const products = await listProducts();
  const csv = toCsv(
    ["Denumire", "U.M.", "Pret vanzare", "Cost achizitie", "TVA %"],
    products.map((p) => ({
      Denumire: p.name,
      "U.M.": p.um,
      "Pret vanzare": p.price.toFixed(2),
      "Cost achizitie": p.cost.toFixed(2),
      "TVA %": p.vatRate,
    }))
  );
  return csvResponse("produse.csv", csv);
}

export const GET = accountingApi(GETHandler)
