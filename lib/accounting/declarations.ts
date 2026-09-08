import { ready } from "./db";
import { getOfficialAnafForms } from "./anaf-official-forms";

export type DeclarationStatus = "DRAFT" | "REVIEW" | "APPROVED" | "FILED";
export type DeclarationType = "D300" | "D394" | "D390";
export type D390OperationCode = "L" | "T" | "A" | "P" | "S" | "R";

const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR", "GR",
  "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "SE", "SI", "SK",
]);

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function periodBounds(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("An fiscal invalid.");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("Lună fiscală invalidă.");
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { start, next };
}

function indicativeDueDate(year: number, month: number, day: number) {
  const dueYear = month === 12 ? year + 1 : year;
  const dueMonth = month === 12 ? 1 : month + 1;
  const maxDay = new Date(Date.UTC(dueYear, dueMonth, 0)).getUTCDate();
  return `${dueYear}-${String(dueMonth).padStart(2, "0")}-${String(Math.min(day, maxDay)).padStart(2, "0")}`;
}

type PartnerRow = {
  partnerName: string;
  partnerCif: string;
  countryCode: string;
  documentCount: number;
  taxableBase: number;
  vat: number;
  gross: number;
};

type D390Operation = PartnerRow & {
  sourceKey: string;
  direction: "SALE" | "PURCHASE";
  operationCode: D390OperationCode | "";
};

function normalizeEuCountry(countryCode: string) {
  const value = countryCode.toUpperCase();
  return value === "GR" ? "EL" : value;
}

function vatNumberWithoutCountry(value: string, countryCode: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const prefixes = new Set([countryCode, countryCode === "EL" ? "GR" : countryCode]);
  for (const prefix of prefixes) if (normalized.startsWith(prefix)) return normalized.slice(prefix.length);
  return normalized;
}

export async function getDeclarationPeriod(year: number, month: number) {
  const { start, next } = periodBounds(year, month);
  const pool = await ready();
  const [companyResult, vatRowsResult, salesPartnersResult, d390SalesDocsResult, expensesResult, incomeResult, efResult, savedResult, settingsResult, classificationsResult] = await Promise.all([
    pool.query(`SELECT name,cif,address,phone,email,bank,iban,"vatPayer", "vatIncasare" FROM company WHERE id=1`),
    pool.query(
      `SELECT ii."vatRate" as "vatRate", COUNT(DISTINCT i.id)::int as "documentCount",
              COALESCE(SUM(ii.valoare * i."exchangeRate"),0) as "taxableBase",
              COALESCE(SUM(ii."vatValue" * i."exchangeRate"),0) as vat
         FROM invoices i JOIN invoice_items ii ON ii."invoiceId"=i.id
        WHERE i."issueDate"::date >= $1::date AND i."issueDate"::date < $2::date AND i.status<>'canceled'
        GROUP BY ii."vatRate" ORDER BY ii."vatRate" DESC`,
      [start, next]
    ),
    pool.query(
      `SELECT COALESCE(NULLIF(i."clientSnapshot"->>'name',''),c.name) as "partnerName",
              UPPER(COALESCE(NULLIF(i."clientSnapshot"->>'cif',''),c.cif,'')) as "partnerCif",
              UPPER(COALESCE(NULLIF(i."clientSnapshot"->>'countryCode',''),c."countryCode",'RO')) as "countryCode",
              COUNT(*)::int as "documentCount",
              COALESCE(SUM(i.subtotal*i."exchangeRate"),0) as "taxableBase",
              COALESCE(SUM(i."vatTotal"*i."exchangeRate"),0) as vat,
              COALESCE(SUM(i.total*i."exchangeRate"),0) as gross
         FROM invoices i JOIN clients c ON c.id=i."clientId"
        WHERE i."issueDate"::date >= $1::date AND i."issueDate"::date < $2::date AND i.status<>'canceled'
        GROUP BY 1,2,3 ORDER BY 1`,
      [start, next]
    ),
    pool.query(
      `SELECT i.id, COALESCE(NULLIF(i."clientSnapshot"->>'name',''),c.name) as "partnerName",
              UPPER(COALESCE(NULLIF(i."clientSnapshot"->>'cif',''),c.cif,'')) as "partnerCif",
              UPPER(COALESCE(NULLIF(i."clientSnapshot"->>'countryCode',''),c."countryCode",'RO')) as "countryCode",
              i.subtotal*i."exchangeRate" as "taxableBase", i."vatTotal"*i."exchangeRate" as vat,
              i.total*i."exchangeRate" as gross
         FROM invoices i JOIN clients c ON c.id=i."clientId"
        WHERE i."issueDate"::date >= $1::date AND i."issueDate"::date < $2::date AND i.status<>'canceled'
        ORDER BY i."issueDate",i.id`,
      [start, next]
    ),
    pool.query(
      `SELECT id, "partnerName", "partnerCif", UPPER("partnerCountryCode") as "partnerCountryCode",
              "documentType", "documentNumber", "grossAmount", "netAmount", "vatAmount",
              "deductibilityPercent", "fiscalCategory", "vatRate"
         FROM ref_transactions
        WHERE type='EXPENSE' AND date >= $1::date AND date < $2::date ORDER BY date,id`,
      [start, next]
    ),
    pool.query(
      `SELECT COALESCE(SUM("vatAmount"),0) as "collectedVat"
         FROM ref_transactions WHERE type='INCOME' AND date >= $1::date AND date < $2::date`,
      [start, next]
    ),
    pool.query(
      `SELECT COUNT(*)::int as total,
              COUNT(*) FILTER (WHERE latest.status='VALIDATED')::int as validated,
              COUNT(*) FILTER (WHERE latest.status IN ('REJECTED','ERROR'))::int as errors
         FROM invoices i
         LEFT JOIN LATERAL (SELECT status FROM efactura_submissions s WHERE s."invoiceId"=i.id ORDER BY s.id DESC LIMIT 1) latest ON true
        WHERE i."issueDate"::date >= $1::date AND i."issueDate"::date < $2::date
          AND i.status<>'canceled' AND i."autoEfactura"=1`,
      [start, next]
    ),
    pool.query(`SELECT * FROM tax_declaration_periods WHERE year=$1 AND month=$2`, [year, month]),
    pool.query(`SELECT * FROM tax_declaration_settings WHERE id=1`),
    pool.query(`SELECT "sourceKey","operationCode" FROM tax_declaration_classifications WHERE year=$1 AND month=$2 AND "declarationType"='D390'`, [year, month]),
  ]);

  const vatRows = vatRowsResult.rows.map((row) => ({
    vatRate: Number(row.vatRate), documentCount: Number(row.documentCount), taxableBase: round2(Number(row.taxableBase)), vat: round2(Number(row.vat)),
  }));
  const salesPartners: PartnerRow[] = salesPartnersResult.rows.map((row) => ({
    partnerName: String(row.partnerName || ""), partnerCif: String(row.partnerCif || ""), countryCode: String(row.countryCode || "RO"),
    documentCount: Number(row.documentCount), taxableBase: round2(Number(row.taxableBase)), vat: round2(Number(row.vat)), gross: round2(Number(row.gross)),
  }));
  const expenses = expensesResult.rows.map((row) => ({
    id: Number(row.id), partnerName: String(row.partnerName || ""), partnerCif: String(row.partnerCif || ""),
    countryCode: String(row.partnerCountryCode || "RO"), documentType: String(row.documentType), documentNumber: String(row.documentNumber || ""),
    gross: round2(Number(row.grossAmount)), net: round2(Number(row.netAmount)), vat: round2(Number(row.vatAmount)),
    vatRate: row.vatRate == null ? null : Number(row.vatRate),
    deductibleVat: row.fiscalCategory === "NON_DEDUCTIBLE_EXPENSE" ? 0 : round2(Number(row.vatAmount) * Number(row.deductibilityPercent) / 100),
  }));
  const domesticSales = salesPartners.filter((row) => row.countryCode === "RO");
  const intraEuSales = salesPartners.filter((row) => row.countryCode !== "RO" && EU_COUNTRIES.has(normalizeEuCountry(row.countryCode)));
  const domesticPurchases = expenses.filter((row) => row.countryCode === "RO" && row.documentType === "FACTURA");
  const classificationMap = new Map(classificationsResult.rows.map((row) => [String(row.sourceKey), String(row.operationCode)]));
  const d390Operations: D390Operation[] = [
    ...d390SalesDocsResult.rows.filter((row) => row.countryCode !== "RO" && EU_COUNTRIES.has(normalizeEuCountry(String(row.countryCode)))).map((row) => ({
      sourceKey: `INVOICE:${Number(row.id)}`, direction: "SALE" as const, partnerName: String(row.partnerName || ""), partnerCif: String(row.partnerCif || ""),
      countryCode: normalizeEuCountry(String(row.countryCode)), documentCount: 1, taxableBase: round2(Number(row.taxableBase)), vat: round2(Number(row.vat)), gross: round2(Number(row.gross)),
    })),
    ...expenses.filter((row) => row.documentType === "FACTURA" && row.countryCode !== "RO" && EU_COUNTRIES.has(normalizeEuCountry(row.countryCode))).map((row) => ({
      sourceKey: `REF:${row.id}`, direction: "PURCHASE" as const, partnerName: row.partnerName, partnerCif: row.partnerCif,
      countryCode: normalizeEuCountry(row.countryCode), documentCount: 1, taxableBase: row.net, vat: row.vat, gross: row.gross,
    })),
  ].map((row) => {
    const sourceKey = row.sourceKey;
    const operationCode = classificationMap.get(sourceKey) || "";
    return { ...row, sourceKey, operationCode: (["L","T","A","P","S","R"].includes(operationCode) ? operationCode : "") as D390OperationCode | "" };
  });
  const missingPurchasePartners = domesticPurchases.filter((row) => !row.partnerName || !row.partnerCif).length;
  const vatOnCashAccounting = Boolean(Number(companyResult.rows[0]?.vatIncasare || 0));
  const invoicedOutputVat = round2(vatRows.reduce((sum, row) => sum + row.vat, 0));
  const outputVat = vatOnCashAccounting ? round2(Number(incomeResult.rows[0]?.collectedVat || 0)) : invoicedOutputVat;
  const inputVat = round2(expenses.reduce((sum, row) => sum + row.deductibleVat, 0));
  const ef = efResult.rows[0] || { total: 0, validated: 0, errors: 0 };
  const warnings: string[] = [];
  if (!Number(companyResult.rows[0]?.vatPayer || 0)) warnings.push("Firma nu este marcată ca plătitoare de TVA.");
  if (vatOnCashAccounting) warnings.push("D300 folosește TVA din încasările înregistrate în REF, conform configurării TVA la încasare; verifică extrasele și numerarul perioadei.");
  if (missingPurchasePartners) warnings.push(`${missingPurchasePartners} achiziții interne nu au furnizorul sau CUI-ul completat.`);
  const settings = settingsResult.rows[0] || {};
  const missingDeclarant = [settings.declarantLastName, settings.declarantFirstName, settings.declarantFunction].filter((value) => !String(value || "").trim()).length;
  const unclassifiedD390 = d390Operations.filter((row) => !row.operationCode).length;
  const company = companyResult.rows[0] || {};
  const companyCui = String(company.cif || "").toUpperCase().replace(/^RO/, "").replace(/\D/g, "");
  const invalidD390Company = !/^[1-9]\d{1,9}$/.test(companyCui) || !String(company.name || "").trim() || !String(company.address || "").trim();
  const invalidD390Operations = d390Operations.filter((row) => !row.partnerName.trim() || Math.round(row.taxableBase) <= 0 || (row.direction === "SALE" && !vatNumberWithoutCountry(row.partnerCif, row.countryCode))).length;
  const d300Blockers: string[] = [];
  if (year < 2026) d300Blockers.push("XML D300 este implementat pe structura ANAF v12 numai pentru perioade din 2026.");
  if (!Number(company.vatPayer || 0)) d300Blockers.push("Firma nu este configurată ca plătitoare de TVA.");
  if (vatOnCashAccounting) d300Blockers.push("TVA la încasare necesită jurnalul de exigibilitate pe cote; XML-ul este blocat până la reconcilierea contabilă.");
  if (!String(settings.profileConfirmedAt || "")) d300Blockers.push("Profilul fiscal D300/D394 nu a fost confirmat.");
  if (!/^\d{4}$/.test(String(settings.caen || ""))) d300Blockers.push("Codul CAEN de 4 cifre lipsește.");
  const periodType=String(settings.fiscalPeriodType||"L");
  if((periodType==="T"&&![2,3,5,6,8,9,11,12].includes(month))||(periodType==="S"&&![6,12].includes(month))||(periodType==="A"&&month!==12)) d300Blockers.push("Luna selectată nu este final de perioadă pentru tipul de decont configurat.");
  if(Number(settings.proRata??100)!==100) d300Blockers.push("Pro-rata diferită de 100% necesită calculul contabil al ajustărilor înainte de generare.");
  if(Number(settings.priorVatPayable||0)>0&&Number(settings.priorVatRefundable||0)>0) d300Blockers.push("Soldurile precedente de plată și negativ nu pot fi ambele pozitive.");
  if (!String(company.bank || "").trim() || !String(company.iban || "").trim()) d300Blockers.push("Banca și contul IBAN sunt obligatorii.");
  if (missingDeclarant) d300Blockers.push("Datele declarantului sunt incomplete.");
  const unsupportedSales = salesPartners.filter((row) => row.countryCode !== "RO").length + vatRows.filter((row) => ![11,21].includes(row.vatRate)).reduce((sum,row)=>sum+row.documentCount,0);
  if (unsupportedSales) d300Blockers.push(`${unsupportedSales} facturi de vânzare necesită clasificare D300 (extern, scutit, taxare inversă sau cotă tranzitorie).`);
  const unsupportedPurchases = expenses.filter((row) => row.countryCode !== "RO" || row.documentType !== "FACTURA" || row.vat <= 0 || ![11,21].includes(Number(row.vatRate))).length;
  if (unsupportedPurchases) d300Blockers.push(`${unsupportedPurchases} achiziții necesită cotă TVA și clasificare D300 completă.`);
  if (unclassifiedD390) warnings.push(`${unclassifiedD390} operațiuni intracomunitare trebuie clasificate înainte de generarea XML D390.`);
  if (d390Operations.length && missingDeclarant) warnings.push("Datele persoanei care întocmește declarația sunt incomplete.");
  if (d390Operations.length && invalidD390Company) warnings.push("Denumirea, adresa sau CUI-ul firmei nu sunt valide pentru XML D390.");
  if (invalidD390Operations) warnings.push(`${invalidD390Operations} operațiuni D390 au partenerul, codul TVA sau baza impozabilă invalidă.`);
  if (Number(ef.total) > Number(ef.validated)) warnings.push(`${Number(ef.total) - Number(ef.validated)} facturi ale perioadei nu sunt încă validate în RO e-Factura.`);

  const saved = savedResult.rows[0];
  return {
    period: { year, month, start, endExclusive: next },
    officialForms: getOfficialAnafForms(year, month),
    declarationSettings: {
      declarantLastName: String(settings.declarantLastName || ""),
      declarantFirstName: String(settings.declarantFirstName || ""),
      declarantFunction: String(settings.declarantFunction || ""),
      caen: String(settings.caen || ""), fiscalPeriodType: String(settings.fiscalPeriodType || "L"), proRata: Number(settings.proRata ?? 100),
      preparerType: Number(settings.preparerType || 0), preparerName: String(settings.preparerName || ""), preparerCif: String(settings.preparerCif || ""), preparerCapacity: String(settings.preparerCapacity || ""),
      consultOption: Number(settings.consultOption || 0), affiliatedTransactions: Number(settings.affiliatedTransactions || 0),
      priorVatPayable: Number(settings.priorVatPayable || 0), priorVatRefundable: Number(settings.priorVatRefundable || 0),
      inspectionVatPayable: Number(settings.inspectionVatPayable || 0), inspectionVatRefundable: Number(settings.inspectionVatRefundable || 0),
      deductibleAdjustments: Number(settings.deductibleAdjustments || 0), refundedForeignVat: Number(settings.refundedForeignVat || 0),
      requestRefund: Number(settings.requestRefund || 0), profileConfirmedAt: settings.profileConfirmedAt || null,
      invoiceSeries: String(settings.invoiceSeries || ""), allocatedInvoiceFrom: Number(settings.allocatedInvoiceFrom || 0), allocatedInvoiceTo: Number(settings.allocatedInvoiceTo || 0),
    },
    workflow: {
      status: (saved?.status || "DRAFT") as DeclarationStatus,
      notes: String(saved?.notes || ""), receiptNumber: String(saved?.receiptNumber || ""), updatedAt: saved?.updatedAt || null,
    },
    basis: { vatPayer: Boolean(Number(companyResult.rows[0]?.vatPayer || 0)), vatOnCashAccounting },
    d300: {
      dueDate: indicativeDueDate(year, month, 25), outputVat, invoicedOutputVat, inputVat,
      vatPayable: Math.max(0, round2(outputVat - inputVat)), vatRefundable: Math.max(0, round2(inputVat - outputVat)), vatRows,
      ready: d300Blockers.length === 0,
      blockers: d300Blockers,
    },
    d394: {
      dueDate: indicativeDueDate(year, month, 30), sales: domesticSales, purchases: domesticPurchases,
      ready: missingPurchasePartners === 0,
    },
    d390: {
      dueDate: indicativeDueDate(year, month, 25), sales: intraEuSales, operations: d390Operations,
      required: d390Operations.length > 0,
      ready: d390Operations.length > 0 && unclassifiedD390 === 0 && missingDeclarant === 0 && !invalidD390Company && invalidD390Operations === 0,
      blockers: [
        ...(d390Operations.length ? [] : ["Nu există operațiuni intracomunitare declarabile în perioada selectată."]),
        ...(unclassifiedD390 ? [`${unclassifiedD390} operațiuni fără tip D390.`] : []),
        ...(missingDeclarant ? ["Datele declarantului sunt incomplete."] : []),
        ...(invalidD390Company ? ["Datele de identificare ale firmei sunt incomplete sau invalide."] : []),
        ...(invalidD390Operations ? [`${invalidD390Operations} operațiuni au date fiscale invalide.`] : []),
      ],
    },
    eFactura: { total: Number(ef.total), validated: Number(ef.validated), errors: Number(ef.errors) },
    warnings,
  };
}

type DeclarationSettingsInput = {
  declarantLastName?:string; declarantFirstName?:string; declarantFunction?:string; caen?:string; fiscalPeriodType?:string; proRata?:number;
  preparerType?:number; preparerName?:string; preparerCif?:string; preparerCapacity?:string; consultOption?:number; affiliatedTransactions?:number;
  priorVatPayable?:number; priorVatRefundable?:number; inspectionVatPayable?:number; inspectionVatRefundable?:number;
  deductibleAdjustments?:number; refundedForeignVat?:number; requestRefund?:number;
  invoiceSeries?:string; allocatedInvoiceFrom?:number; allocatedInvoiceTo?:number;
};

export async function updateDeclarationSettings(input: DeclarationSettingsInput) {
  const values = [input.declarantLastName, input.declarantFirstName, input.declarantFunction].map((value) => String(value || "").trim());
  if (!values[0] || !values[1] || !values[2]) throw new Error("Numele, prenumele și funcția declarantului sunt obligatorii.");
  if (values[0].length > 75 || values[1].length > 75 || values[2].length > 50) throw new Error("Datele declarantului depășesc lungimea acceptată de ANAF.");
  const caen=String(input.caen||"").trim();
  const fiscalPeriodType=String(input.fiscalPeriodType||"L").trim().toUpperCase();
  const preparerName=String(input.preparerName||"").trim(), preparerCif=String(input.preparerCif||"").replace(/\D/g,""), preparerCapacity=String(input.preparerCapacity||"").trim();
  if (!/^\d{4}$/.test(caen)) throw new Error("Codul CAEN trebuie să conțină exact 4 cifre.");
  if (!["L","T","S","A"].includes(fiscalPeriodType)) throw new Error("Perioada fiscală este invalidă.");
  if (!preparerName || !/^\d{2,13}$/.test(preparerCif) || !preparerCapacity) throw new Error("Datele persoanei/organizației care întocmește D394 sunt incomplete.");
  const numeric=(value:unknown,min=0,max=99999999999999)=>{const number=Number(value??0);if(!Number.isFinite(number)||number<min||number>max)throw new Error("O valoare din profilul fiscal este invalidă.");return round2(number);};
  const proRata=numeric(input.proRata,0,100);
  const moneyValues=[input.priorVatPayable,input.priorVatRefundable,input.inspectionVatPayable,input.inspectionVatRefundable,input.deductibleAdjustments,input.refundedForeignVat].map(value=>numeric(value));
  const preparerType=Number(input.preparerType||0), consultOption=Number(input.consultOption||0), affiliatedTransactions=Number(input.affiliatedTransactions||0), requestRefund=Number(input.requestRefund||0);
  if (![0,1].includes(preparerType)||![0,1].includes(consultOption)||![0,1].includes(affiliatedTransactions)||![0,1].includes(requestRefund)) throw new Error("O opțiune fiscală are o valoare invalidă.");
  const invoiceSeries=String(input.invoiceSeries||"").trim().toUpperCase(), allocatedInvoiceFrom=Math.trunc(Number(input.allocatedInvoiceFrom||0)), allocatedInvoiceTo=Math.trunc(Number(input.allocatedInvoiceTo||0));
  if(invoiceSeries && (!/^[A-Z0-9._/-]{1,20}$/.test(invoiceSeries)||allocatedInvoiceFrom<1||allocatedInvoiceTo<allocatedInvoiceFrom)) throw new Error("Plaja anuală de facturi pentru D394 este invalidă.");
  const pool = await ready();
  await pool.query(
    `UPDATE tax_declaration_settings SET "declarantLastName"=$1,"declarantFirstName"=$2,"declarantFunction"=$3,caen=$4,
      "fiscalPeriodType"=$5,"proRata"=$6,"preparerType"=$7,"preparerName"=$8,"preparerCif"=$9,"preparerCapacity"=$10,
      "consultOption"=$11,"affiliatedTransactions"=$12,"priorVatPayable"=$13,"priorVatRefundable"=$14,
      "inspectionVatPayable"=$15,"inspectionVatRefundable"=$16,"deductibleAdjustments"=$17,"refundedForeignVat"=$18,
      "requestRefund"=$19,"invoiceSeries"=$20,"allocatedInvoiceFrom"=$21,"allocatedInvoiceTo"=$22,"profileConfirmedAt"=now(),"updatedAt"=now() WHERE id=1`,
    [...values,caen,fiscalPeriodType,proRata,preparerType,preparerName,preparerCif,preparerCapacity,consultOption,affiliatedTransactions,...moneyValues,requestRefund,invoiceSeries,allocatedInvoiceFrom,allocatedInvoiceTo]
  );
  return getDeclarationPeriod(new Date().getUTCFullYear(),new Date().getUTCMonth()+1);
}

export async function updateD390Classification(year: number, month: number, input: { sourceKey?: string; operationCode?: string }) {
  periodBounds(year, month);
  const sourceKey = String(input.sourceKey || "").trim();
  const operationCode = String(input.operationCode || "").trim().toUpperCase();
  if (!sourceKey || sourceKey.length > 500) throw new Error("Operațiune D390 invalidă.");
  if (!["L","T","A","P","S","R"].includes(operationCode)) throw new Error("Tipul operațiunii D390 este invalid.");
  if (!sourceKey.startsWith("INVOICE:") && !sourceKey.startsWith("REF:")) throw new Error("Sursa operațiunii D390 este invalidă.");
  const report = await getDeclarationPeriod(year, month);
  const operation = report.d390.operations.find((row) => row.sourceKey === sourceKey);
  if (!operation) throw new Error("Operațiunea nu aparține perioadei D390 selectate.");
  if (operation.direction === "SALE" && !["L","T","P","R"].includes(operationCode)) throw new Error("Tipul selectat nu este permis pentru o livrare.");
  if (operation.direction === "PURCHASE" && !["A","S"].includes(operationCode)) throw new Error("Tipul selectat nu este permis pentru o achiziție.");
  const pool = await ready();
  await pool.query(
    `INSERT INTO tax_declaration_classifications (year,month,"declarationType","sourceKey","operationCode","updatedAt")
     VALUES ($1,$2,'D390',$3,$4,now()) ON CONFLICT (year,month,"declarationType","sourceKey")
     DO UPDATE SET "operationCode"=EXCLUDED."operationCode","updatedAt"=now()`,
    [year, month, sourceKey, operationCode]
  );
  return getDeclarationPeriod(year, month);
}

function xmlEscape(value: unknown) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export async function generateOfficialD390Xml(year: number, month: number, rectified = false) {
  const report = await getDeclarationPeriod(year, month);
  if (!report.d390.required) throw new Error("D390 nu este datorată pentru perioada selectată.");
  if (!report.d390.ready) throw new Error(`XML D390 blocat: ${report.d390.blockers.join(" ")}`);
  const company = await (await ready()).query(`SELECT name,cif,address,phone,email FROM company WHERE id=1`);
  const entity = company.rows[0] || {};
  const cui = String(entity.cif || "").toUpperCase().replace(/^RO/, "").replace(/\D/g, "");
  if (!/^[1-9]\d{1,9}$/.test(cui)) throw new Error("CUI-ul firmei nu este valid pentru D390.");
  if (!String(entity.name || "").trim() || !String(entity.address || "").trim()) throw new Error("Denumirea și adresa firmei sunt obligatorii pentru D390.");
  const rawOperations = report.d390.operations.map((row) => ({
    ...row,
    baza: Math.round(row.taxableBase),
    codO: vatNumberWithoutCountry(row.partnerCif, row.countryCode),
  }));
  for (const row of rawOperations) {
    if (row.baza <= 0) throw new Error(`Baza D390 pentru ${row.partnerName} trebuie să fie pozitivă.`);
    if (!row.partnerName.trim()) throw new Error("Există o operațiune D390 fără denumirea partenerului.");
    if (["L","T","P","R"].includes(row.operationCode) && !row.codO) throw new Error(`Codul TVA al partenerului ${row.partnerName} este obligatoriu.`);
  }
  const grouped = new Map<string, (typeof rawOperations)[number]>();
  for (const row of rawOperations) {
    const key = `${row.operationCode}:${row.countryCode}:${row.codO}:${row.partnerName.trim().toUpperCase()}`;
    const current = grouped.get(key);
    if (current) current.baza += row.baza;
    else grouped.set(key, { ...row });
  }
  const operations = Array.from(grouped.values());
  const bases = { L:0,T:0,A:0,P:0,S:0,R:0 } as Record<D390OperationCode, number>;
  for (const row of operations) bases[row.operationCode as D390OperationCode] += row.baza;
  const totalBase = Object.values(bases).reduce((sum, value) => sum + value, 0);
  const totalControl = operations.length + totalBase;
  const attrs = [
    `luna="${month}"`, `an="${year}"`, `d_rec="${rectified ? 1 : 0}"`,
    `nume_declar="${xmlEscape(report.declarationSettings.declarantLastName)}"`,
    `prenume_declar="${xmlEscape(report.declarationSettings.declarantFirstName)}"`,
    `functie_declar="${xmlEscape(report.declarationSettings.declarantFunction)}"`,
    `cui="${cui}"`, `den="${xmlEscape(entity.name)}"`, `adresa="${xmlEscape(entity.address)}"`,
    ...(entity.phone ? [`telefon="${xmlEscape(String(entity.phone).slice(0,15))}"`] : []),
    ...(entity.email ? [`mail="${xmlEscape(entity.email)}"`] : []),
    `totalPlata_A="${totalControl}"`,
  ].join(" ");
  const operationXml = operations.map((row) => `  <operatie tip="${row.operationCode}" tara="${row.countryCode}"${row.codO ? ` codO="${xmlEscape(row.codO)}"` : ""} denO="${xmlEscape(row.partnerName)}" baza="${row.baza}"/>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<declaratie390 xmlns="mfp:anaf:dgti:d390:declaratie:v3" ${attrs}>\n  <rezumat nr_pag="${Math.max(1,Math.ceil(operations.length/20))}" nrOPI="${operations.length}" bazaL="${bases.L}" bazaT="${bases.T}" bazaA="${bases.A}" bazaP="${bases.P}" bazaS="${bases.S}" bazaR="${bases.R}" total_baza="${totalBase}"/>\n${operationXml}\n</declaratie390>\n`;
}

function d300EvidenceNumber(year:number,month:number,periodType:string) {
  const code=periodType==="L"?"301":periodType==="T"?"302":periodType==="S"?"303":"304";
  const dueYear=month===12?year+1:year, dueMonth=month===12?1:month+1;
  const base=`10${code}01${String(month).padStart(2,"0")}${String(year).slice(-2)}25${String(dueMonth).padStart(2,"0")}${String(dueYear).slice(-2)}0000`;
  const checksum=String([...base].reduce((sum,digit)=>sum+Number(digit),0)%100).padStart(2,"0");
  return `${base}${checksum}`;
}

export async function generateOfficialD300Xml(year:number,month:number) {
  const report=await getDeclarationPeriod(year,month);
  if(!report.d300.ready) throw new Error(`XML D300 blocat: ${report.d300.blockers.join(" ")}`);
  const pool=await ready();
  const companyResult=await pool.query(`SELECT name,cif,address,phone,email,bank,iban FROM company WHERE id=1`);
  const company=companyResult.rows[0]||{}, settings=report.declarationSettings;
  const cui=String(company.cif||"").toUpperCase().replace(/^RO/,"").replace(/\D/g,"");
  if(!/^[1-9]\d{1,9}$/.test(cui)) throw new Error("CUI-ul firmei nu este valid pentru D300.");
  const sales=new Map(report.d300.vatRows.map(row=>[Number(row.vatRate),{base:Math.round(row.taxableBase),vat:Math.round(row.vat),count:row.documentCount}]));
  const purchases=report.d394.purchases as Array<{net:number;vat:number;vatRate:number|null;deductibleVat:number}>;
  const purchaseRate=(rate:number)=>purchases.filter(row=>Number(row.vatRate)===rate).reduce((acc,row)=>({base:acc.base+Math.round(row.net),vat:acc.vat+Math.round(row.vat),deductible:acc.deductible+Math.round(row.deductibleVat)}),{base:0,vat:0,deductible:0});
  const p21=purchaseRate(21),p11=purchaseRate(11);
  const s21=sales.get(21)||{base:0,vat:0,count:0},s11=sales.get(11)||{base:0,vat:0,count:0};
  const collectedBase=s21.base+s11.base, collectedVat=s21.vat+s11.vat;
  const purchaseBase=p21.base+p11.base, deductibleVat=p21.vat+p11.vat;
  const taxDeducted=p21.deductible+p11.deductible;
  const adjustedDeducted=taxDeducted+Math.round(settings.refundedForeignVat)+Math.round(settings.deductibleAdjustments);
  const negativePeriod=Math.max(adjustedDeducted-collectedVat,0), payablePeriod=Math.max(collectedVat-adjustedDeducted,0);
  const payableCumulative=payablePeriod+Math.round(settings.priorVatPayable)+Math.round(settings.inspectionVatPayable);
  const negativeCumulative=negativePeriod+Math.round(settings.priorVatRefundable)+Math.round(settings.inspectionVatRefundable);
  const finalPayable=Math.max(payableCumulative-negativeCumulative,0), finalRefundable=Math.max(negativeCumulative-payableCumulative,0);
  const fields:Record<string,number>={
    R9_1:s21.base,R9_2:s21.vat,R10_1:s11.base,R10_2:s11.vat,R17_1:collectedBase,R17_2:collectedVat,
    R22_1:p21.base,R22_2:p21.vat,R23_1:p11.base,R23_2:p11.vat,
    R27_1:purchaseBase,R27_2:deductibleVat,R28_2:taxDeducted,R29_2:Math.round(settings.refundedForeignVat),R31_2:Math.round(settings.deductibleAdjustments),R32_2:adjustedDeducted,
    R33_2:negativePeriod,R34_2:payablePeriod,R35_2:Math.round(settings.priorVatPayable),R36_2:Math.round(settings.inspectionVatPayable),R37_2:payableCumulative,
    R38_2:Math.round(settings.priorVatRefundable),R39_2:Math.round(settings.inspectionVatRefundable),R40_2:negativeCumulative,R41_2:finalPayable,R42_2:finalRefundable,
    nr_facturi:report.d300.vatRows.reduce((sum,row)=>sum+row.documentCount,0),baza:collectedBase,tva:collectedVat,nr_facturi_primite:purchases.length,baza_primite:purchaseBase,tva_primite:deductibleVat,
  };
  const numericAttrs=Object.entries(fields).filter(([,value])=>value!==0).map(([key,value])=>`${key}="${value}"`);
  const totalControl=Object.entries(fields).filter(([key])=>!["baza_primite","tva_primite"].includes(key)).reduce((sum,[,value])=>sum+value,0);
  const attrs=[
    `xmlns="mfp:anaf:dgti:d300:declaratie:v12"`,`xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,`xsi:schemaLocation="mfp:anaf:dgti:d300:declaratie:v12 D300.xsd"`,
    `luna="${month}"`,`an="${year}"`,`depusReprezentant="0"`,`bifa_interne="0"`,`temei="0"`,
    `nume_declar="${xmlEscape(settings.declarantLastName)}"`,`prenume_declar="${xmlEscape(settings.declarantFirstName)}"`,`functie_declar="${xmlEscape(settings.declarantFunction)}"`,
    `cui="${cui}"`,`den="${xmlEscape(company.name)}"`,`adresa="${xmlEscape(company.address)}"`,
    ...(company.phone?[`telefon="${xmlEscape(String(company.phone).slice(0,15))}"`]:[]),...(company.email?[`mail="${xmlEscape(company.email)}"`]:[]),
    `banca="${xmlEscape(company.bank)}"`,`cont="${xmlEscape(company.iban)}"`,`caen="${settings.caen}"`,`tip_decont="${settings.fiscalPeriodType}"`,`pro_rata="${settings.proRata}"`,
    `bifa_cereale="N"`,`bifa_mob="N"`,`bifa_disp="N"`,`bifa_cons="N"`,`solicit_ramb="${settings.requestRefund?"D":"N"}"`,
    `nr_evid="${d300EvidenceNumber(year,month,settings.fiscalPeriodType)}"`,`totalPlata_A="${totalControl}"`,...numericAttrs,
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<declaratie300 ${attrs.join(" ")}/>\n`;
}

export async function updateDeclarationPeriod(year: number, month: number, input: { status: DeclarationStatus; notes?: string; receiptNumber?: string }) {
  periodBounds(year, month);
  if (!["DRAFT", "REVIEW", "APPROVED", "FILED"].includes(input.status)) throw new Error("Status fiscal invalid.");
  if (input.status === "FILED" && !input.receiptNumber?.trim()) throw new Error("Numărul recipisei este obligatoriu pentru marcarea perioadei ca depusă.");
  const snapshot = input.status === "APPROVED" || input.status === "FILED" ? await getDeclarationPeriod(year, month) : {};
  const pool = await ready();
  await pool.query(
    `INSERT INTO tax_declaration_periods (year,month,status,notes,"receiptNumber","snapshot","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,now())
     ON CONFLICT (year,month) DO UPDATE SET status=EXCLUDED.status,notes=EXCLUDED.notes,
       "receiptNumber"=EXCLUDED."receiptNumber","snapshot"=EXCLUDED."snapshot","updatedAt"=now()`,
    [year, month, input.status, input.notes?.trim() || "", input.receiptNumber?.trim() || "", JSON.stringify(snapshot)]
  );
  return getDeclarationPeriod(year, month);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function exportDeclarationWorkingPaper(type: DeclarationType, year: number, month: number) {
  const report = await getDeclarationPeriod(year, month);
  let rows: unknown[][];
  if (type === "D300") {
    rows = [["Cota TVA", "Bază impozabilă RON", "TVA colectată RON", "Documente"], ...report.d300.vatRows.map((row) => [row.vatRate, row.taxableBase, row.vat, row.documentCount]), [], ["TVA deductibilă", report.d300.inputVat], ["TVA de plată", report.d300.vatPayable], ["TVA de recuperat", report.d300.vatRefundable]];
  } else if (type === "D394") {
    rows = [["Tip", "Partener", "CUI", "Țară", "Documente", "Bază RON", "TVA RON", "Total RON"],
      ...report.d394.sales.map((row) => ["LIVRARE", row.partnerName, row.partnerCif, row.countryCode, row.documentCount, row.taxableBase, row.vat, row.gross]),
      ...report.d394.purchases.map((row) => ["ACHIZIȚIE", row.partnerName, row.partnerCif, row.countryCode, 1, row.net, row.vat, row.gross])];
  } else {
    rows = [["Partener", "Cod TVA", "Țară", "Documente", "Bază RON"], ...report.d390.sales.map((row) => [row.partnerName, row.partnerCif, row.countryCode, row.documentCount, row.taxableBase])];
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

export type DeclarationReport = Awaited<ReturnType<typeof getDeclarationPeriod>>;
