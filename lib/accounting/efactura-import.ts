import { ready } from './db';
import { getCompany } from './repo';
import { createPurchase, createSupplier, type PurchaseInput } from './purchases';
import { parseAnafInvoiceArchive, type AnafInvoiceDocument } from './anaf-invoice-document';
import { downloadAnafMessage, getAnafPublicConfig } from './efactura';
import { suggestAccounts } from './account-suggestions';

const cif = (value:string) => value.trim().replace(/^RO\s*/i,'').replace(/^0+/,'');
const round = (value:number) => Math.round((value+Number.EPSILON)*100)/100;
export function validateReceivedDocument(document:AnafInvoiceDocument, companyCif:string) {
  if (!companyCif || !cif(document.customer.companyId || document.customer.vatId) || cif(document.customer.companyId || document.customer.vatId)!==cif(companyCif)) throw new Error('CUI-ul cumpărătorului din XML nu corespunde firmei active.');
  if (!document.id || !document.supplier.name || !cif(document.supplier.companyId || document.supplier.vatId)) throw new Error('XML-ul nu conține identificarea completă a facturii și furnizorului.');
}
export function checkReceivedTotals(document:AnafInvoiceDocument, input:PurchaseInput) {
  if(document.kind!=='invoice') throw new Error('Nota de credit/storno necesită înregistrare manuală. XML-ul original rămâne disponibil.');
  const lines=input.items||[];
  if(lines.some(line=>line.vatCategoryCode==='AE'))throw new Error('Taxarea inversă din XML necesită înregistrare manuală cu verificarea cotei TVA.');
  if(!lines.length || lines.some(line=>!line.description||!line.expenseAccount||!Number.isFinite(line.quantity)||Number(line.quantity)<=0||!Number.isFinite(line.unitPrice)||Number(line.unitPrice)<0)) throw new Error('Completează conturile și valorile tuturor pozițiilor.');
  const subtotal=round(lines.reduce((sum,line)=>sum+round(Number(line.quantity)*Number(line.unitPrice)),0));
  const vat=round(lines.reduce((sum,line)=>sum+round(Number(line.quantity)*Number(line.unitPrice)*Number(line.vatRate||0)/100),0));
  if(Math.abs(subtotal-document.subtotal)>0.001||Math.abs(vat-document.vatTotal)>0.001||Math.abs(round(subtotal+vat)-document.total)>0.001) throw new Error('Totalurile calculate diferă de XML. Verifică reducerile, taxele și rotunjirile înainte de înregistrare manuală.');
  if(input.currency!=='RON' && (!Number.isFinite(input.exchangeRate)||Number(input.exchangeRate)<=0)) throw new Error('Completează cursul valutar pentru data facturii.');
}
export async function prepareReceived(document:AnafInvoiceDocument) {
  const company=await getCompany(); validateReceivedDocument(document,company.cif);
  if(document.lines.length>200)throw new Error("Factura depășește 200 de poziții; descarcă XML-ul pentru prelucrare manuală.");
  const issues:string[]=[];
  const items=await Promise.all(document.lines.map(async line=>{
    const suggestions=await suggestAccounts(line.name,'EXPENSE');
    const account=suggestions[0]?.confidence>=70?suggestions[0].code:'';
    if(!account)issues.push(`Alege contul pentru „${line.name}”.`);
    if(account==='6022')issues.push('Verifică deductibilitatea combustibilului înainte de contare.');
    const category=line.vatCategoryCode|| (line.vatRate>0?'S':'Z');
    if(category==='AE')issues.push('Taxarea inversă necesită verificarea cotei și înregistrare manuală.');
    return {description:line.name,expenseAccount:account,unit:line.unitCode,quantity:line.quantity,unitPrice:line.quantity>0?line.lineAmount/line.quantity:line.unitPrice,vatRate:line.vatRate,vatCategoryCode:category as 'S',taxExemptionReason:line.taxExemptionReason,taxExemptionReasonCode:line.taxExemptionReasonCode,deductibilityPercent:company.vatPayer?100:0};
  }));
  const payload:PurchaseInput={documentNumber:document.id,issueDate:document.issueDate,dueDate:document.dueDate||document.issueDate,currency:document.currency,exchangeRate:document.currency==='RON'?1:0,notes:`Import e-Factura SPV. ${document.notes.join(' ')}`,vatOnCollection:/tva\s+la\s+[iî]ncasare/i.test(document.notes.join(' ')),items};
  if(document.currency!=='RON')issues.push('Completează cursul valutar.');
  if(Math.abs(document.payable-document.total)>0.001)issues.push('Factura conține avansuri sau ajustări ale sumei de plată. Verifică plățile separat.');
  try{checkReceivedTotals(document,{...payload,items:items.map(line=>({...line,expenseAccount:line.expenseAccount||'628'})),exchangeRate:payload.exchangeRate||1})}catch(error){issues.push((error as Error).message)}
  return {payload,issues};
}
export async function importReceivedMessage(messageId:string, reviewed?:PurchaseInput) {
  const pool=await ready(), environment=getAnafPublicConfig().environment, lock=await pool.connect();
  const key=`efactura-import:elmont:${environment}:${messageId}`;
  try{
    await lock.query('SELECT pg_advisory_lock(hashtext($1))',[key]);
    const message=(await lock.query('SELECT * FROM efactura_messages WHERE environment=$1 AND "messageId"=$2 AND direction=\'RECEIVED\'',[environment,messageId])).rows[0];
    if(!message)throw new Error('Factura primită nu există în dosarul firmei active.');
    let staged=(await lock.query('SELECT * FROM efactura_imports WHERE environment=$1 AND "messageId"=$2',[environment,messageId])).rows[0];
    if(staged?.purchaseId)return staged;
    if(!staged?.document){
      const file=await downloadAnafMessage(message.downloadId);
      const document=parseAnafInvoiceArchive(file.buffer), prepared=await prepareReceived(document);
      staged=(await lock.query(`INSERT INTO efactura_imports(environment,"messageId",document,payload,issues) VALUES($1,$2,$3,$4,$5) ON CONFLICT(environment,"messageId") DO UPDATE SET document=$3,payload=$4,issues=$5,status='REVIEW',"updatedAt"=now() RETURNING *`,[environment,messageId,JSON.stringify(document),JSON.stringify(prepared.payload),JSON.stringify(prepared.issues)])).rows[0];
    }
    if(environment==='test'){
      if(reviewed)throw new Error('Facturile SPV din Test nu se contează în dosarul fiscal. Configurează mediul Producție pentru importul operațional.');
      const issues=[...staged.issues,'Mediul ANAF Test: documentul este păstrat pentru verificare, fără contare fiscală.'];
      await lock.query('UPDATE efactura_imports SET issues=$3 WHERE environment=$1 AND "messageId"=$2',[environment,messageId,JSON.stringify(issues)]);
      return {...staged,issues};
    }
    if(!reviewed && staged.issues.length)return staged;
    const document=staged.document as AnafInvoiceDocument, company=await getCompany();validateReceivedDocument(document,company.cif);
    // XML identity and amounts remain authoritative; only account, VAT deduction and FX may be reviewed.
    const payload={...staged.payload,exchangeRate:reviewed?.exchangeRate??staged.payload.exchangeRate,items:staged.payload.items.map((line:NonNullable<PurchaseInput['items']>[number],index:number)=>({...line,expenseAccount:reviewed?.items?.[index]?.expenseAccount??line.expenseAccount,deductibilityPercent:reviewed?.items?.[index]?.deductibilityPercent??line.deductibilityPercent}))} as PurchaseInput;
    checkReceivedTotals(document,payload);
    let supplier=(await pool.query('SELECT * FROM suppliers WHERE UPPER(REGEXP_REPLACE(cif,\'^RO\',\'\',\'i\'))=$1',[cif(document.supplier.companyId||document.supplier.vatId)])).rows[0];
    if(!supplier){
      try{const id=await createSupplier({name:document.supplier.name,cif:document.supplier.companyId||document.supplier.vatId,address:document.supplier.address,city:document.supplier.city,county:document.supplier.county,countryCode:document.supplier.countryCode||'RO',postalCode:document.supplier.postalCode,phone:document.supplier.phone,email:document.supplier.email,vatPayer:document.lines.some(line=>line.vatRate>0)||/^RO/i.test(document.supplier.vatId),bankAccount:document.paymentAccount});supplier={id}}
      catch(error){supplier=(await pool.query('SELECT * FROM suppliers WHERE cif=$1',[cif(document.supplier.companyId||document.supplier.vatId)])).rows[0];if(!supplier)throw error}
    }
    payload.supplierId=supplier.id;
    let existing=(await pool.query('SELECT id,total,subtotal,"vatTotal",currency,status FROM purchase_invoices WHERE "supplierId"=$1 AND UPPER("documentNumber")=UPPER($2) AND "issueDate"=$3 AND status<>\'CANCELED\'',[supplier.id,document.id,document.issueDate])).rows[0];
    let purchaseId:number,status='POSTED';
    if(existing){if(Number(existing.total)!==document.total||Number(existing.subtotal)!==document.subtotal||Number(existing.vatTotal)!==document.vatTotal||existing.currency!==document.currency)throw new Error('Există o factură cu aceeași identitate și alte valori. Verifică documentele.');purchaseId=existing.id;status='DUPLICATE'}
    else{
      try{purchaseId=await createPurchase(payload)}catch(error){
        existing=(await pool.query('SELECT id,total,subtotal,"vatTotal",currency FROM purchase_invoices WHERE "supplierId"=$1 AND UPPER("documentNumber")=UPPER($2) AND "issueDate"=$3 AND status<>\'CANCELED\'',[supplier.id,document.id,document.issueDate])).rows[0];
        if(!existing||Number(existing.total)!==document.total||Number(existing.subtotal)!==document.subtotal||Number(existing.vatTotal)!==document.vatTotal||existing.currency!==document.currency)throw error;purchaseId=existing.id;status='DUPLICATE';
      }
    }
    return (await lock.query('UPDATE efactura_imports SET status=$3,"purchaseId"=$4,payload=$5,issues=\'[]\',"updatedAt"=now() WHERE environment=$1 AND "messageId"=$2 RETURNING *',[environment,messageId,status,purchaseId,JSON.stringify(payload)])).rows[0];
  }catch(error){
    const issue=error instanceof Error?error.message:'Importul a eșuat.';
    await lock.query(`INSERT INTO efactura_imports(environment,"messageId",status,issues) VALUES($1,$2,'ERROR',$3) ON CONFLICT(environment,"messageId") DO UPDATE SET issues=$3,status=CASE WHEN efactura_imports.document IS NULL THEN 'ERROR' ELSE 'REVIEW' END,"updatedAt"=now()`,[environment,messageId,JSON.stringify([issue])]);
    if(reviewed)throw error;
    return {status:'ERROR',issues:[issue]};
  }finally{try{await lock.query('SELECT pg_advisory_unlock(hashtext($1))',[key])}finally{lock.release()}}
}
export async function importReceivedBatch(limit=20,timeBudget=100000) {
  const pool=await ready(), environment=getAnafPublicConfig().environment;
  const messages=(await pool.query(`SELECT m."messageId" FROM efactura_messages m LEFT JOIN efactura_imports i ON i.environment=m.environment AND i."messageId"=m."messageId" WHERE m.environment=$1 AND m.direction='RECEIVED' AND (i."messageId" IS NULL OR i.status='ERROR') ORDER BY COALESCE(i."updatedAt",m."createdAt") ASC LIMIT $2`,[environment,Math.min(50,Math.max(1,limit))])).rows;
  const counts={posted:0,review:0,failed:0,duplicate:0};
  const started=Date.now();
  for(const message of messages){if(Date.now()-started>=timeBudget)break;const result=await importReceivedMessage(message.messageId);counts[result.status==='POSTED'?'posted':result.status==='DUPLICATE'?'duplicate':result.status==='REVIEW'?'review':'failed']++}
  return counts;
}
