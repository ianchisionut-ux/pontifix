import { ready } from "./db";

type VatItem = { rate:number; base:number; vat:number; deductiblePercent:number };
type Settlement = { id:number; date:string; amount:number };
export type CashVatDocument = {
  id:number; direction:"SALE"|"PURCHASE"; reference:string; date:string; total:number; exchangeRate:number;
  partner:string; deferred:boolean; unsupported:boolean; items:VatItem[]; payments:Settlement[];
};
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100);
const money=(n:number)=>n/100;
export function cashVatBounds(year:number,month:number) {
  if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12)throw new Error("Perioadă TVA invalidă.");
  return {start:`${year}-${String(month).padStart(2,"0")}-01`,end:`${month===12?year+1:year}-${String(month===12?1:month+1).padStart(2,"0")}-01`};
}

// Differences of cumulative rounded allocations avoid losing a cent on each partial payment.
export function calculateCashVat(documents:CashVatDocument[],start:string,end:string) {
  const rows:Array<{direction:string;documentId:number;reference:string;partner:string;date:string;paymentId:number;rate:number;base:number;vat:number;deductibleVat:number}>=[];
  const balances:Array<{direction:string;documentId:number;reference:string;rate:number;openingVat:number;closingVat:number}>=[];
  const blockers:string[]=[];
  for(const doc of documents) {
    if(!doc.deferred||doc.date>=end)continue;
    if(doc.unsupported||!Number.isFinite(doc.total)||doc.total<=0||!Number.isFinite(doc.exchangeRate)||doc.exchangeRate<=0) {
      blockers.push(`${doc.reference}: storno, anulare, taxare inversă sau valori invalide — reconciliere separată.`);continue;
    }
    if(!doc.items.length||doc.items.some(i=>![i.base,i.vat,i.rate,i.deductiblePercent].every(Number.isFinite)||i.base<0||i.vat<0||i.deductiblePercent<0||i.deductiblePercent>100)||Math.abs(cents(doc.items.reduce((s,i)=>s+i.base+i.vat,0))-cents(doc.total))>1){
      blockers.push(`${doc.reference}: totalul pozițiilor nu corespunde facturii.`);continue;
    }
    const payments=[...doc.payments].filter(p=>p.date<end).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
    if(payments.some(p=>!Number.isFinite(p.amount)||p.amount<=0||p.date<doc.date)||cents(payments.reduce((s,p)=>s+p.amount,0))>cents(doc.total)) {
      blockers.push(`${doc.reference}: plată anticipată, restituire sau total plăți invalid — reconciliere separată.`);continue;
    }
    const groups=new Map<string,{rate:number;base:number;vat:number;deductible:number}>();
    for(const item of doc.items){
      const key=`${item.rate}:${item.deductiblePercent}`;
      const group=groups.get(key)||{rate:item.rate,base:0,vat:0,deductible:0};
      group.base+=cents(item.base*doc.exchangeRate);group.vat+=cents(item.vat*doc.exchangeRate);
      group.deductible+=cents(item.vat*doc.exchangeRate*item.deductiblePercent/100);groups.set(key,group);
    }
    const total=cents(doc.total), before=payments.filter(p=>p.date<start).reduce((s,p)=>s+cents(p.amount),0);
    const all=payments.reduce((s,p)=>s+cents(p.amount),0);
    for(const group of groups.values()) {
      balances.push({direction:doc.direction,documentId:doc.id,reference:doc.reference,rate:group.rate,
        openingVat:doc.date<start?money(group.vat-Math.round(group.vat*before/total)):0,closingVat:money(group.vat-Math.round(group.vat*all/total))});
      let paid=0;
      for(const payment of payments){
        const previous=paid;paid+=cents(payment.amount);
        if(payment.date<start)continue;
        const allocate=(amount:number)=>money(Math.round(amount*paid/total)-Math.round(amount*previous/total));
        rows.push({direction:doc.direction,documentId:doc.id,reference:doc.reference,partner:doc.partner,date:payment.date,paymentId:payment.id,rate:group.rate,base:allocate(group.base),vat:allocate(group.vat),deductibleVat:allocate(group.deductible)});
      }
    }
  }
  return {rows,balances,blockers:[...new Set(blockers)],outputVat:money(rows.filter(r=>r.direction==="SALE").reduce((s,r)=>s+cents(r.vat),0)),inputVat:money(rows.filter(r=>r.direction==="PURCHASE").reduce((s,r)=>s+cents(r.deductibleVat),0))};
}

export async function getCashVatJournal(year:number,month:number) {
  const {start,end}=cashVatBounds(year,month),pool=await ready();
  const company=(await pool.query(`SELECT "vatIncasare" FROM company WHERE id=1`)).rows[0];
  const companyCash=Boolean(Number(company?.vatIncasare));
  const [sales,purchases]=await Promise.all([
    pool.query(`SELECT i.id,'SALE' AS direction,i.series||' '||i.number AS reference,i."issueDate" AS date,i.total,i."exchangeRate",
      COALESCE(i."clientSnapshot"->>'name',c.name) AS partner,
      (i.status IN ('stornoed','canceled') OR i."invoiceType"='STORNO'
       OR COALESCE(i."clientSnapshot"->>'countryCode',c."countryCode",'RO')<>'RO'
       OR EXISTS (SELECT 1 FROM invoice_items x WHERE x."invoiceId"=i.id AND x."vatCategoryCode"<>'S')) AS unsupported,
      COALESCE((SELECT json_agg(json_build_object('rate',ii."vatRate",'base',ii.valoare,'vat',ii."vatValue",'deductiblePercent',100)) FROM invoice_items ii WHERE ii."invoiceId"=i.id),'[]') AS items,
      COALESCE((SELECT json_agg(json_build_object('id',p.id,'date',p.date,'amount',p.amount)) FROM payments p WHERE p."invoiceId"=i.id AND p.date<$1),'[]') AS payments
      FROM invoices i JOIN clients c ON c.id=i."clientId" WHERE i."issueDate"<$1 AND i."vatTotal"<>0 AND $2::boolean`,[end,companyCash]),
    pool.query(`SELECT p.id,'PURCHASE' AS direction,p."documentNumber" AS reference,p."issueDate"::text AS date,p.total,p."exchangeRate",s.name AS partner,
      (p.status='CANCELED' OR p."reverseCharge"=1) AS unsupported,
      COALESCE((SELECT json_agg(json_build_object('rate',ii."vatRate",'base',ii."netAmount",'vat',ii."vatAmount",'deductiblePercent',ii."deductibilityPercent")) FROM purchase_invoice_items ii WHERE ii."purchaseInvoiceId"=p.id),'[]') AS items,
      COALESCE((SELECT json_agg(json_build_object('id',sp.id,'date',sp.date::text,'amount',sp.amount)) FROM supplier_payments sp WHERE sp."purchaseInvoiceId"=p.id AND sp.date<$1::date),'[]') AS payments
      FROM purchase_invoices p JOIN suppliers s ON s.id=p."supplierId" WHERE p."issueDate"<$1::date AND p."vatTotal"<>0 AND ($2::boolean OR p."vatOnCollection"=1)`,[end,companyCash]),
  ]);
  const documents=[...sales.rows,...purchases.rows].map(row=>({...row,total:Number(row.total),exchangeRate:Number(row.exchangeRate),deferred:true})) as CashVatDocument[];
  return {period:{start,end},...calculateCashVat(documents,start,end),warning:"Jurnal de control pe baza regimului fiscal configurat acum. Verificați istoricul regimului TVA, soldurile inițiale/importate și reconcilierea cu 4428; raportul nu modifică articolele contabile și nu deblochează automat declarațiile."};
}
