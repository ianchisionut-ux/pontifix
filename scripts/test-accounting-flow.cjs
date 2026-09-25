const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, dependencies) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(id => dependencies[id] || require(id), module, module.exports);
  return module.exports;
}
async function main() {
  const entries=[], calls=[];
  let closed=false, paymentAmount=121;
  const client={release(){},async query(sql,args=[]) {
    calls.push(sql);
    if(sql.includes('SELECT p.*,p."issueDate"::text'))return {rows:[{issueDate:'2026-09-24',exchangeRate:1,total:121,analyticAccount:'401',supplierId:1,documentNumber:'F1'}]};
    if(sql.includes('SELECT * FROM purchase_invoice_items'))return {rows:[{netAmount:100,vatAmount:21,deductibilityPercent:100,expenseAccount:'628'}]};
    if(sql.includes('SELECT sp.*,sp.date::text'))return {rows:[{date:'2026-09-25',amount:121,exchangeRate:1,analyticAccount:'401',supplierId:1,method:'BANK'}]};
    if(sql.includes('SELECT p.*,i.series'))return {rows:[{date:'2026-09-25',amount:paymentAmount,exchangeRate:1,clientId:1,method:'BANK'}]};
    if(sql.includes('SELECT status FROM accounting_periods'))return {rows:[{status:closed?'CLOSED':'OPEN'}]};
    if(sql.includes('SELECT code,active'))return {rows:args[0].map(code=>({code,active:1,allowPosting:1}))};
    if(sql.includes('RETURNING "lastNumber"'))return {rows:[{lastNumber:1}]};
    if(sql.includes('RETURNING id'))return {rows:[{id:1}]};
    if(sql.includes('INSERT INTO journal_lines'))entries.push({account:args[2],debit:args[3],credit:args[4]});
    return {rows:[]};
  }};
  const ledger=load('lib/accounting/ledger.ts',{'./db':{ready:async()=>({connect:async()=>client})}});
  await ledger.postPurchaseInvoiceToLedger(1,client);
  assert.deepEqual(entries.map(x=>[x.account,x.debit,x.credit]),[['628',100,0],['4426',21,0],['401',0,121]]);
  entries.length=0;await ledger.postSupplierPaymentToLedger(1,client);
  assert.deepEqual(entries.map(x=>[x.account,x.debit,x.credit]),[['401',121,0],['5121',0,121]]);
  entries.length=0;paymentAmount=-121;await ledger.postPaymentToLedger(1,client);
  assert.deepEqual(entries.map(x=>[x.account,x.debit,x.credit]),[['4111',121,0],['5121',0,121]]);
  closed=true;await assert.rejects(()=>ledger.postSupplierPaymentToLedger(1,client),/închisă/);
  calls.length=0;await ledger.setPeriodStatus(2026,9,'CLOSED');
  assert.ok(calls.indexOf('BEGIN')<calls.findIndex(x=>x.includes('pg_advisory_xact_lock')));
  assert.ok(calls.findIndex(x=>x.includes('pg_advisory_xact_lock'))<calls.findIndex(x=>x.includes('INSERT INTO accounting_periods')));
  assert.ok(calls.includes('COMMIT'));

  const amounts=[];
  const vatRegime=load('lib/accounting/vat-regime.ts',{});
  assert.equal(vatRegime.calculateIncludedVat(500,21),86.78);
  assert.equal(vatRegime.calculateIncludedVat(111,11),11);
  assert.equal(vatRegime.calculateIncludedVat(0,21),0);
  const ref=load('lib/accounting/ref.ts',{'@/lib/accounting/db':{},'@/lib/accounting/vat-regime':vatRegime});
  const refClient={async query(sql,args=[]) {
    if(sql.includes('SELECT "exchangeRate"'))return {rows:[{exchangeRate:5}]};
    if(sql.includes('SELECT "vatPayer"'))return {rows:[{vatPayer:1}]};
    if(sql.includes('SELECT c.*'))return {rows:[{}]};
    if(sql.includes('INSERT INTO ref_transactions'))amounts.push(args.slice(3,7));
    return {rows:[]};
  }};
  for(const amount of [121,-121])await ref.createRefIncomeForPayment({invoiceId:1,paymentId:1,amount,invoiceTotal:121,invoiceSubtotal:100,date:'2026-09-24'},refClient);
  assert.deepEqual(amounts,[[605,105,500,500],[-605,-105,-500,-500]]);

  let paid=100, savedAmount, status;
  const refundClient={release(){},async query(sql,args=[]) {
    if(sql.includes('SELECT * FROM invoices'))return {rows:[{id:1,status:'stornoed',invoiceType:'STANDARD',total:121,clientId:1,currency:'RON',clientSnapshot:{}}]};
    if(sql.includes('SELECT "issueDate"'))return {rows:[{issueDate:'2026-09-24'}]};
    if(sql.includes('SUM(amount)'))return {rows:[{amount:paid}]};
    if(sql.includes('INSERT INTO payments')){savedAmount=args[1];return {rows:[{id:1}]};}
    if(sql.includes('SELECT * FROM clients'))return {rows:[{}]};
    if(sql.includes('UPDATE invoices SET "paidAmount"')){paid=args[0];status=args[1];}
    return {rows:[]};
  }};
  const repo=load('lib/accounting/repo.ts',{'./db':{ready:async()=>({connect:async()=>refundClient})},'./ref':{createRefIncomeForPayment:async()=>{}},'./ledger':{postPaymentToLedger:async()=>{}},'./date':{bucharestDate:()=> '2026-09-24'}});
  await assert.rejects(()=>repo.addPayment(1,.001,'2026-09-24','bank','',true),/0,01/);
  await repo.addPayment(1,40,'2026-09-24','bank','',true);
  assert.equal(savedAmount,-40);assert.equal(paid,60);assert.equal(status,'stornoed');
  await assert.rejects(()=>repo.addPayment(1,61,'2026-09-24','bank','',true),/depășește/);
  await repo.addPayment(1,60,'2026-09-24','bank','',true);assert.equal(paid,0);
  await assert.rejects(()=>repo.addPayment(1,1,'2026-09-24','bank','',true));
  const declarationQueries=[];
  const declarations=load('lib/accounting/declarations.ts',{'./db':{ready:async()=>({async query(sql){
    declarationQueries.push(sql);
    if(sql.includes('SELECT name,cif,address'))return {rows:[{name:'TEST',cif:'123456',vatPayer:1,vatIncasare:0}]};
    if(sql.includes('FROM ref_transactions r'))return {rows:[{id:-1,partnerName:'Furnizor',partnerCif:'12345',partnerCountryCode:'RO',documentType:'FACTURA',documentNumber:'F1',grossAmount:121,netAmount:100,vatAmount:21,vatRate:21,deductibilityPercent:100,reverseCharge:0,vatOnCollection:0}]};
    return {rows:[]};
  }})},'./anaf-official-forms':{getOfficialAnafForms:()=>({})}});
  const report=await declarations.getDeclarationPeriod(2026,9);
  assert.equal(report.d300.inputVat,21);
  assert.equal(report.d394.purchases.length,1);
  assert.equal(report.d394.purchases[0].net,100);
  assert.ok(declarationQueries.some(sql=>sql.includes('UNION ALL')&&sql.includes('purchase_invoice_items')&&sql.includes('NOT EXISTS')));
  assert.equal(report.d394.ready,false);
  assert.ok(report.d394.blockers.some(x=>x.includes('Profilul fiscal')));

  let fiscalType='T', eu=false;
  const ranges=[];
  const settings={profileConfirmedAt:'2026-09-01',caen:'6201',declarantLastName:'Test',declarantFirstName:'Ana',declarantFunction:'Administrator',preparerName:'Test',preparerCif:'123456',preparerCapacity:'Contabil',proRata:100};
  const detailed=load('lib/accounting/declarations.ts',{'./db':{ready:async()=>({async query(sql,args=[]){
    ranges.push({sql,args});
    if(sql.includes('SELECT * FROM tax_declaration_settings'))return {rows:[{...settings,fiscalPeriodType:fiscalType}]};
    if(sql.includes('SELECT name,cif,address'))return {rows:[{name:'TEST',cif:'123456',address:'Adresa',bank:'Banca',iban:'ROTEST',vatPayer:1,vatIncasare:0}]};
    if(sql.includes('GROUP BY ii."vatRate"'))return {rows:[{vatRate:21,documentCount:1,taxableBase:100,vat:21},{vatRate:11,documentCount:1,taxableBase:100,vat:11}]};
    if(sql.includes('GROUP BY 1,2,3'))return {rows:[{partnerName:'Client',partnerCif:'123456',countryCode:'RO',documentCount:1,taxableBase:200,vat:32,gross:232}]};
    if(sql.includes('FROM ref_transactions r'))return {rows:(eu?[1,2,3]:[1,2]).map(id=>({id:-id,documentKey:'PURCHASE:10',documentDate:id===1?'2026-07-20':'2026-09-20',partnerName:'Furnizor',partnerCif:eu?'DE12345':'12345',partnerCountryCode:eu?'DE':'RO',documentType:'FACTURA',documentNumber:'F1',netAmount:eu?12.4:12.01,vatAmount:2.52,grossAmount:eu?14.92:14.53,vatRate:21,deductibilityPercent:100}))};
    if(sql.includes('FROM tax_declaration_classifications'))return {rows:[{sourceKey:'REF:-2',operationCode:'A'},{sourceKey:'REF:-3',operationCode:'A'}]};
    return {rows:[]};
  }})},'./anaf-official-forms':{getOfficialAnafForms:()=>({})}});
  const quarter=await detailed.getDeclarationPeriod(2026,9);
  assert.equal(quarter.period.fiscalStart,'2026-07-01');
  assert.equal(quarter.d394.purchaseDocumentCount,1);
  assert.equal(quarter.d394.purchases.reduce((n,r)=>n+r.documentCount,0),1);
  assert.equal(quarter.d300.documentCount,1);
  assert.equal(quarter.d300.ready,true);
  assert.equal(quarter.d394.ready,true);
  assert.ok(ranges.filter(x=>x.sql.includes('GROUP BY ii.')||x.sql.includes('FROM ref_transactions r')||x.sql.includes('GROUP BY 1,2,3')).every(x=>x.args[0]==='2026-07-01'));
  assert.ok(ranges.filter(x=>x.sql.includes('SELECT i.id,')||x.sql.includes('LEFT JOIN LATERAL')).every(x=>x.args[0]==='2026-09-01'));
  const d300=await detailed.generateOfficialD300Xml(2026,9);
  assert.ok(d300.includes('R22_1="24"')&&d300.includes('R22_2="5"'),'Round after aggregating purchase lines');
  assert.ok(d300.includes('nr_facturi="1"')&&d300.includes('nr_facturi_primite="1"'),'Count documents, not rates or lines');
  assert.equal((await detailed.getDeclarationPeriod(2026,8)).d300.ready,false);
  fiscalType='S';assert.equal((await detailed.getDeclarationPeriod(2026,12)).period.fiscalStart,'2026-07-01');
  fiscalType='A';assert.equal((await detailed.getDeclarationPeriod(2026,12)).period.fiscalStart,'2026-01-01');
  fiscalType='T';eu=true;
  const euReport=await detailed.getDeclarationPeriod(2026,9);
  assert.equal(euReport.d390.operations.length,2,'D390 excludes purchases in earlier months of the quarter');
  const d390=await detailed.generateOfficialD390Xml(2026,9);
  assert.ok(d390.includes('baza="25"'),'D390 rounds after grouping partner operations');
  const csv=await detailed.exportDeclarationWorkingPaper('D390',2026,9);
  assert.ok(csv.includes('PURCHASE')&&csv.includes('DE12345')&&csv.includes('REF:-2'));
  assert.ok(!csv.includes('REF:-1'));
  await assert.rejects(()=>detailed.updateDeclarationSettings({...settings,invoiceSeries:'F',allocatedInvoiceFrom:1,allocatedInvoiceTo:Infinity}),/numere întregi/);
  await assert.rejects(()=>detailed.updateDeclarationSettings({...settings,invoiceSeries:'F',allocatedInvoiceFrom:1.2,allocatedInvoiceTo:10}),/numere întregi/);
  const purchaseQueries=[];
  const purchases=load('lib/accounting/purchases.ts',{'./db':{ready:async()=>({query:async(sql,args)=>{purchaseQueries.push({sql,args});return {rows:[]};},connect:async()=>{throw new Error('Invalid input reached database');}})},'./ledger':{},'./vat-regime':vatRegime});
  for(const amount of [NaN,Infinity,-1,0,.001])await assert.rejects(()=>purchases.addSupplierPayment(1,{date:'2026-09-25',amount}),/suma plății/);
  await assert.rejects(()=>purchases.addSupplierPayment(1,{date:'2026-02-30',amount:10}),/Data/);
  await assert.rejects(()=>purchases.addSupplierPayment(1,{date:'2026-09-25',amount:10,method:'INVALID'}),/Metoda/);
  await assert.rejects(()=>purchases.supplierSituation('2026-02-30'),/Data/);
  await purchases.supplierSituation('2026-09-01');
  assert.ok(purchaseQueries[0].sql.includes('sp.date<=COALESCE'));
  assert.ok(purchaseQueries[0].sql.includes('LEFT JOIN LATERAL'));
  assert.ok(!purchaseQueries[0].sql.includes('p."paidAmount"'));
  assert.equal(purchaseQueries[0].args[0],'2026-09-01');
  const receiptRepo=load('lib/accounting/repo.ts',{'./db':{ready:async()=>({connect:async()=>({release(){},async query(sql){
    if(sql.includes('SELECT * FROM invoices'))return {rows:[{id:1,status:'issued',invoiceType:'STANDARD',currency:'RON'}]};
    if(sql.includes('SUM(amount)'))return {rows:[{amount:sql.includes('FROM payments')?10:0}]};
    if(sql.includes('INSERT'))throw new Error('Zero receipt reached INSERT');
    return {rows:[]};
  }})})},'./ref':{},'./ledger':{},'./date':{}});
  await assert.rejects(()=>receiptRepo.createReceipt(1,'2026-09-25',.001),/0,01/);
  console.log('Accounting flow regression tests passed: purchases, payments, refunds, FX REF and period locking. No real database writes.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
