import { ready } from "./db";
import { getDeclarationPeriod } from "./declarations";

export type D394Line={documentKey:string;type:"L"|"A";partnerName:string;partnerCif:string;country:string;vatPayer:number;rate:number;base:number;vat:number;unsupported:boolean};
export type D394Issued={id:number;series:string;number:number};
type Profile=Record<string,unknown>;
const clean=(value:unknown)=>String(value??"").trim();
const cui=(value:unknown)=>clean(value).toUpperCase().replace(/^RO/,"");
const esc=(value:unknown)=>clean(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const attrs=(values:Record<string,unknown>)=>Object.entries(values).map(([key,value])=>`${key}="${esc(value)}"`).join(' ');
const tag=(name:string,values:Record<string,unknown>)=>`  <${name} ${attrs(values)}/>`;

/** Deliberately bounded exporter. Unsupported data blocks the entire export, never a subset. */
export function buildD394(input:{year:number;month:number;company:Profile;settings:Profile;lines:D394Line[];issued:D394Issued[];blockers:string[];confirmed:boolean}) {
  const {company,settings,lines,issued,year,month}=input,blockers=[...input.blockers];
  if(year<2025||(year===2025&&month<8))blockers.push("Structura D394 implementată este valabilă începând cu august 2025.");
  if(!input.confirmed)blockers.push("Confirmă că perioada conține exclusiv facturi interne standard B2B, fără operațiuni suplimentare sau regimuri speciale.");
  if(Number(company.vatIncasare))blockers.push("D394 pentru TVA la încasare necesită reconcilierea jurnalului și a istoricului fiscal; exportul nu este încă disponibil pentru acest regim.");
  if(!Number(company.vatPayer))blockers.push("Firma nu este plătitoare de TVA.");
  if(!/^[1-9]\d{1,9}$/.test(cui(company.cif)))blockers.push("CUI firmă invalid.");
  for(const [key,label,max] of [['name','Denumire firmă',200],['address','Adresă firmă',1000],['phone','Telefon firmă',15]] as const){if(!clean(company[key])||clean(company[key]).length>max)blockers.push(`${label}: câmp obligatoriu sau lungime invalidă.`);}
  if(Number(settings.preparerType)!==0)blockers.push("Exportul curent acceptă întocmitor persoană juridică; pentru persoană fizică este necesară validarea CNP/NIF.");
  if(Number(settings.requestRefund))blockers.push("Solicitarea rambursării necesită completarea secțiunilor detaliate D394, neimplementate în acest export.");
  if(!settings.profileConfirmedAt)blockers.push("Profilul fiscal trebuie confirmat.");
  if(!/^\d{4}$/.test(clean(settings.caen)))blockers.push("CAEN invalid.");
  if(!/^[1-9]\d{1,9}$/.test(cui(settings.preparerCif)))blockers.push("CIF întocmitor invalid.");
  if(!clean(settings.preparerName)||clean(settings.preparerName).length>75||!clean(settings.preparerCapacity)||clean(settings.preparerCapacity).length>75)blockers.push("Datele întocmitorului lipsesc sau depășesc lungimea permisă.");
  for(const line of lines){
    if(line.unsupported||line.country!=='RO'||line.vatPayer!==1||![11,21].includes(line.rate)||![line.base,line.vat].every(Number.isFinite)||line.base<0||line.vat<0||!clean(line.partnerName)||clean(line.partnerName).length>200||!/^[1-9]\d{1,9}$/.test(cui(line.partnerCif)))
      blockers.push(`${line.documentKey}: exportul acceptă numai facturi standard interne cu partener plătitor TVA și cote 11%/21%.`);
  }
  const allocatedSeries=clean(settings.invoiceSeries),first=Number(settings.allocatedInvoiceFrom),last=Number(settings.allocatedInvoiceTo);
  if(issued.length&&(!allocatedSeries||allocatedSeries.length>20||!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||first<1||last<first))blockers.push("Completează seria și plaja anuală alocată de facturi.");
  if(issued.some(i=>i.series!==allocatedSeries||!Number.isSafeInteger(i.number)||i.number<first||i.number>last))blockers.push("Există facturi în afara plajei alocate sau în alte serii. Exportul curent acceptă o singură serie alocată.");
  const uniqueBlockers=[...new Set(blockers)];
  if(uniqueBlockers.length)return {ready:false,blockers:uniqueBlockers,xml:null,operationCount:0};
  const groups=new Map<string,{tip:string;cuiP:string;denP:string;cota:number;baseCents:number;vatCents:number;documents:Set<string>}>();
  for(const line of lines){
    const key=`${line.type}:${cui(line.partnerCif)}:${line.rate}`,row=groups.get(key)||{tip:line.type,cuiP:cui(line.partnerCif),denP:line.partnerName,cota:line.rate,baseCents:0,vatCents:0,documents:new Set<string>()};
    row.baseCents+=Math.round(line.base*100);row.vatCents+=Math.round(line.vat*100);row.documents.add(line.documentKey);groups.set(key,row);
  }
  const operations=[...groups.values()].map(g=>({tip:g.tip,tip_partener:1,cota:g.cota,cuiP:g.cuiP,denP:g.denP,nrFact:g.documents.size,baza:Math.round(g.baseCents/100),tva:Math.round(g.vatCents/100)}));
  const rates=[...new Set(operations.map(r=>r.cota))].sort((a,b)=>b-a);
  const summaries=rates.map(rate=>{
    const sum=(type:string,field:'nrFact'|'baza'|'tva')=>operations.filter(r=>r.cota===rate&&r.tip===type).reduce((s,r)=>s+r[field],0);
    return {cota:rate,facturiL:sum('L','nrFact'),bazaL:sum('L','baza'),tvaL:sum('L','tva'),facturiA:sum('A','nrFact'),bazaA:sum('A','baza'),tvaA:sum('A','tva'),facturiAI:0,bazaAI:0,tvaAI:0};
  });
  const nrCui=new Set(operations.map(r=>r.cuiP)).size;
  const info:Record<string,number>={nrCui1:nrCui,nrCui2:0,nrCui3:0,nrCui4:0,nr_BF_i1:0,incasari_i1:0,incasari_i2:0,nrFacturi_terti:0,nrFacturi_benef:0,nrFacturi:new Set(issued.map(i=>i.id)).size,nrFacturiL_PF:0,nrFacturiLS_PF:0,val_LS_PF:0,solicit:0};
  for(const rate of [24,20,19,9,5,21,11])info[`tvaDedAI${rate}`]=0;
  const body=[tag('informatii',info),...summaries.map(s=>tag('rezumat1',{tip_partener:1,...s})),...summaries.map(s=>tag('rezumat2',{
    cota:s.cota,bazaFSLcod:0,TVAFSLcod:0,bazaFSL:0,TVAFSL:0,bazaFSA:0,TVAFSA:0,bazaFSAI:0,TVAFSAI:0,bazaBFAI:0,TVABFAI:0,
    nrFacturiL:s.facturiL,bazaL:s.bazaL,tvaL:s.tvaL,nrFacturiA:s.facturiA,bazaA:s.bazaA,tvaA:s.tvaA,nrFacturiAI:0,bazaAI:0,tvaAI:0,baza_incasari_i1:0,tva_incasari_i1:0,baza_incasari_i2:0,tva_incasari_i2:0,bazaL_PF:0,tvaL_PF:0,
  }))];
  if(issued.length){
    body.push(tag('serieFacturi',{tip:1,serieI:allocatedSeries,nrI:first,nrF:last}));
    // Individual numbers preserve gaps without declaring nonexistent invoices as issued.
    for(const invoice of [...issued].sort((a,b)=>a.number-b.number))body.push(tag('serieFacturi',{tip:2,serieI:invoice.series,nrI:invoice.number,nrF:invoice.number}));
  }
  body.push(...operations.map(row=>tag('op1',row)));
  const root={xmlns:'mfp:anaf:dgti:d394:declaratie:v5',luna:month,an:year,tip_D394:settings.fiscalPeriodType||'L',sistemTVA:0,op_efectuate:operations.length?1:0,
    cui:cui(company.cif),caen:settings.caen,den:company.name,adresa:company.address,telefon:company.phone,
    totalPlata_A:nrCui+summaries.reduce((s,r)=>s+r.bazaL+r.bazaA,0),denR:'',functie_reprez:'',adresaR:'',tip_intocmit:0,den_intocmit:settings.preparerName,cif_intocmit:cui(settings.preparerCif),calitate_intocmit:settings.preparerCapacity,optiune:Number(settings.consultOption||0),prsAfiliat:Number(settings.affiliatedTransactions||0)};
  return {ready:true,blockers:[],operationCount:operations.length,xml:`<?xml version="1.0" encoding="UTF-8"?>\n<declaratie394 ${attrs(root)}>\n${body.join('\n')}\n</declaratie394>\n`};
}

export async function getD394Export(year:number,month:number,confirmed=false){
  const report=await getDeclarationPeriod(year,month),pool=await ready(),{fiscalStart:start,endExclusive:end}=report.period;
  const [company,sales,purchases,manual]=await Promise.all([
    pool.query(`SELECT * FROM company WHERE id=1`),
    pool.query(`SELECT i.id,i.series,i.number,i.status,i."invoiceType",i."exchangeRate",i.total,i.subtotal,i."vatTotal",
      COALESCE(i."clientSnapshot"->>'name',c.name) AS "partnerName",COALESCE(i."clientSnapshot"->>'cif',c.cif) AS "partnerCif",
      COALESCE(i."clientSnapshot"->>'countryCode',c."countryCode") AS country,COALESCE(i."clientSnapshot"->>'vatPayer',c."vatPayer"::text) AS "vatPayer",
      COALESCE((SELECT json_agg(ii) FROM invoice_items ii WHERE ii."invoiceId"=i.id),'[]') AS items
      FROM invoices i JOIN clients c ON c.id=i."clientId" WHERE i."issueDate">=$1 AND i."issueDate"<$2`,[start,end]),
    pool.query(`SELECT p.*,s.name AS "partnerName",s.cif AS "partnerCif",s."countryCode" AS country,s."vatPayer",
      COALESCE((SELECT json_agg(ii) FROM purchase_invoice_items ii WHERE ii."purchaseInvoiceId"=p.id),'[]') AS items
      FROM purchase_invoices p JOIN suppliers s ON s.id=p."supplierId" WHERE p."issueDate">=$1::date AND p."issueDate"<$2::date`,[start,end]),
    pool.query(`SELECT id FROM ref_transactions WHERE date>=$1::date AND date<$2::date AND source<>'AUTO_PAYMENT'`,[start,end]),
  ]);
  const blockers=[...report.d394.blockers],lines:D394Line[]=[];
  if(manual.rows.length)blockers.push("Există poziții manuale în registrul fiscal. Clasifică/reconciliază separat documentele înainte de XML D394; nu sunt omise automat.");
  for(const [type,docs] of [['L',sales.rows],['A',purchases.rows]] as const){
    for(const doc of docs){
      const key=`${type==='L'?'INVOICE':'PURCHASE'}:${doc.id}`;
      if(!doc.items.length)blockers.push(`${key}: document fără poziții.`);
      const base=doc.items.reduce((sum:number,item:Record<string,unknown>)=>sum+Number(type==='L'?item.valoare:item.netAmount),0);
      const vat=doc.items.reduce((sum:number,item:Record<string,unknown>)=>sum+Number(type==='L'?item.vatValue:item.vatAmount),0);
      if(!Number.isFinite(base)||!Number.isFinite(vat)||Math.abs(base-Number(doc.subtotal))>0.011||Math.abs(vat-Number(doc.vatTotal))>0.011||Math.abs(base+vat-Number(doc.total))>0.011)blockers.push(`${key}: totalurile documentului nu corespund pozițiilor.`);
      if(!Number.isFinite(Number(doc.exchangeRate))||Number(doc.exchangeRate)<=0)blockers.push(`${key}: curs valutar invalid.`);
      for(const item of doc.items){
        lines.push({documentKey:key,type,partnerName:clean(doc.partnerName),partnerCif:clean(doc.partnerCif),country:clean(doc.country).toUpperCase(),vatPayer:Number(doc.vatPayer),rate:Number(item.vatRate),
          base:Number(type==='L'?item.valoare:item.netAmount)*Number(doc.exchangeRate),vat:Number(type==='L'?item.vatValue:item.vatAmount)*Number(doc.exchangeRate),
          unsupported:type==='L' ? doc.status==='canceled'||doc.status==='stornoed'||doc.invoiceType==='STORNO'||item.vatCategoryCode!=='S' : doc.status==='CANCELED'||Boolean(Number(doc.reverseCharge))||Boolean(Number(doc.vatOnCollection))||doc.documentType!=='FACTURA'});
      }
    }
  }
  return buildD394({year,month,company:company.rows[0]||{},settings:report.declarationSettings,lines,issued:sales.rows.map(i=>({id:Number(i.id),series:i.series,number:Number(i.number)})),blockers,confirmed});
}
