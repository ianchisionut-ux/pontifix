const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, dependencies) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const sharedMocks = {
    './payroll-ref': { syncPaidPayrollToRef: async () => {} },
    './saga-journal-import': { sagaJournalEntrySourceKeys: () => [] },
    './ref': { syncSupplierPaymentsToRef: async () => [] },
    './date': { bucharestDate: () => '2026-09-25' },
    '@/lib/auth': { auth: async () => null },
  };
  new Function('require','module','exports',code)(id => dependencies[id] || sharedMocks[id] || require(id), module, module.exports);
  return module.exports;
}
async function main() {
  const entries=[], calls=[];
  let closed=false, paymentAmount=121, reversePurchase=false;
  const client={release(){},async query(sql,args=[]) {
    calls.push(sql);
    if(sql.includes('SELECT p.*,p."issueDate"::text'))return {rows:[{issueDate:'2026-09-24',exchangeRate:1,total:reversePurchase?100:121,reverseCharge:reversePurchase?1:0,analyticAccount:'401',supplierId:1,documentNumber:'F1'}]};
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
  entries.length=0;reversePurchase=true;await ledger.postPurchaseInvoiceToLedger(1,client);
  assert.deepEqual(entries.map(x=>[x.account,x.debit,x.credit]),[['628',100,0],['4426',21,0],['4427',0,21],['401',0,100]],'Reverse charge self-assesses VAT without increasing supplier debt');
  reversePurchase=false;
  entries.length=0;await ledger.postSupplierPaymentToLedger(1,client);
  assert.deepEqual(entries.map(x=>[x.account,x.debit,x.credit]),[['401',121,0],['5121',0,121]]);
  entries.length=0;paymentAmount=-121;await ledger.postPaymentToLedger(1,client);
  assert.deepEqual(entries.map(x=>[x.account,x.debit,x.credit]),[['4111',121,0],['5121',0,121]]);
  const movedPeriodClient={async query(sql,args=[]){
    if(sql.includes('SELECT p.*,p."issueDate"::text'))return {rows:[{issueDate:'2026-09-24',exchangeRate:1,total:121,analyticAccount:'401',supplierId:1,documentNumber:'F1'}]};
    if(sql.includes('SELECT * FROM purchase_invoice_items'))return {rows:[{netAmount:100,vatAmount:21,deductibilityPercent:100,expenseAccount:'628'}]};
    if(sql.includes('SELECT date::text AS date FROM journal_entries'))return {rows:[{date:'2026-08-31'}]};
    if(sql.includes('SELECT status FROM accounting_periods'))return {rows:[{status:Number(args[1])===8?'CLOSED':'OPEN'}]};
    return {rows:[]};
  }};
  await assert.rejects(()=>ledger.postPurchaseInvoiceToLedger(1,movedPeriodClient),/08\/2026 este închisă/,'Reposting also protects the original accounting period');
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
  assert.equal(vatRegime.suggestVatRegime({type:'EXPENSE',vatAmount:0,vatRate:21}),'S');
  assert.equal(vatRegime.suggestVatRegime({type:'EXPENSE',partnerVatPayer:false,vatRate:21}),'Z');
  assert.deepEqual(vatRegime.vatRatesForDate('2026-09-25'),[21,11]);
  assert.deepEqual(vatRegime.vatRatesForDate('2026-07-31'),[21,11,9]);
  assert.deepEqual(vatRegime.vatRatesForDate('2025-07-31'),[19,9,5]);
  assert.deepEqual(vatRegime.vatRatesForDate('2016-06-01'),[20,9,5]);
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
  let supplierRefArgs,supplierManualMatchSql;
  const supplierRefClient={async query(sql,args=[]){
    if(sql.includes('FROM supplier_payments sp'))return {rows:[{id:8,date:'2026-09-25',amount:60.5,documentType:'FACTURA',documentNumber:'A1',total:121,exchangeRate:1,reverseCharge:0,partnerName:'Furnizor',partnerCif:'123',partnerCountryCode:'RO',partnerVatPayer:1,invoiceVat:21,expenseBase:100,minimumVatRate:21,maximumVatRate:21}]};
    if(sql.includes("source='MANUAL'")){supplierManualMatchSql=sql;return {rows:[]};}
    if(sql.includes('INSERT INTO ref_transactions')){supplierRefArgs=args;return {rows:[{id:80}],rowCount:1};}
    return {rows:[]};
  }};
  const supplierRefResult=await ref.createRefExpenseForSupplierPayment(8,supplierRefClient);
  assert.deepEqual(supplierRefArgs.slice(4,8),[60.5,10.5,50,50],'Supplier payment is copied proportionally into REF');
  assert.equal(supplierRefArgs[8],'[supplier-payment:8]');
  assert.equal(supplierRefArgs[22],8);
  assert.equal(supplierRefResult.status,'CREATED');
  assert.ok(supplierManualMatchSql.includes('SELECT id,"partnerCif","partnerName","documentNumber"'),'Manual candidates retain the fields needed for strict supplier/document matching');
  assert.equal(ref.isEquivalentSupplierPaymentRefCandidate({partnerCif:'999',partnerName:'Alt furnizor',documentNumber:'A1'},{partnerCif:'123',partnerName:'Furnizor',documentNumber:'A1'}),false,'The same number and amount from another supplier is not auto-linked');
  assert.equal(ref.isEquivalentSupplierPaymentRefCandidate({partnerCif:'RO123',partnerName:'Alt nume',documentNumber:'A1'},{partnerCif:'123',partnerName:'Furnizor',documentNumber:'A1'}),true,'A normalized CIF and document identify the same supplier payment');
  assert.equal(ref.isWeakSupplierPaymentRefCandidate({partnerCif:'',partnerName:'',documentNumber:'A1'},{partnerCif:'123',partnerName:'Furnizor',documentNumber:'A1'}),true,'A matching document with missing manual partner identity is detected but not trusted for auto-linking');
  assert.equal(ref.isWeakSupplierPaymentRefCandidate({partnerCif:'',partnerName:'Furnizor',documentNumber:'A1'},{partnerCif:'123',partnerName:'Furnizor',documentNumber:'A1'}),true,'A missing manual CIF with a matching name/document remains an unresolved weak duplicate');
  assert.equal(ref.isWeakSupplierPaymentRefCandidate({partnerCif:'RO123',partnerName:'Furnizor',documentNumber:''},{partnerCif:'123',partnerName:'Furnizor',documentNumber:'A1'}),true,'A missing manual document with compatible supplier identity remains an unresolved weak duplicate');
  assert.equal(ref.isWeakSupplierPaymentRefCandidate({partnerCif:'999',partnerName:'Furnizor',documentNumber:'A1'},{partnerCif:'123',partnerName:'Furnizor',documentNumber:'A1'}),false,'An explicit CIF conflict excludes a weak match');
  assert.equal(ref.isWeakSupplierPaymentRefCandidate({partnerCif:'',partnerName:'Alt furnizor',documentNumber:'A1'},{partnerCif:'123',partnerName:'Furnizor',documentNumber:'A1'}),false,'An explicit supplier-name conflict excludes a weak match when CIF is missing');
  let reverseSupplierRefArgs;
  const reverseSupplierRefClient={async query(sql,args=[]){
    if(sql.includes('FROM supplier_payments sp'))return {rows:[{id:9,date:'2026-09-25',amount:100,documentType:'FACTURA',documentNumber:'RC1',total:100,exchangeRate:1,reverseCharge:1,partnerName:'Furnizor UE',partnerCif:'DE123',partnerCountryCode:'DE',partnerVatPayer:1,invoiceVat:21,expenseBase:100,minimumVatRate:21,maximumVatRate:21}]};
    if(sql.includes('INSERT INTO ref_transactions')){reverseSupplierRefArgs=args;return {rows:[{id:90}],rowCount:1};}
    return {rows:[]};
  }};
  await ref.createRefExpenseForSupplierPayment(9,reverseSupplierRefClient);
  assert.deepEqual(reverseSupplierRefArgs.slice(4,8),[100,0,100,100],'Reverse-charge REF keeps the cash payment as net and does not embed self-assessed VAT');
  assert.equal(reverseSupplierRefArgs[20],'AE');
  let linkedManualArgs,linkedManualSql,linkedManualInsert=false;
  const linkedManualClient={async query(sql,args=[]){
    if(sql.includes('FROM supplier_payments sp'))return {rows:[{id:10,date:'2026-09-25',amount:121,documentType:'FACTURA',documentNumber:'A2',total:121,exchangeRate:1,reverseCharge:0,partnerName:'Furnizor',partnerCif:'RO123',partnerCountryCode:'RO',partnerVatPayer:1,invoiceVat:21,expenseBase:100,minimumVatRate:21,maximumVatRate:21}]};
    if(sql.includes('UPDATE ref_transactions')){linkedManualSql=sql;linkedManualArgs=args;return {rows:[],rowCount:1};}
    if(sql.includes("source='MANUAL'"))return {rows:[{id:55,partnerCif:'123',partnerName:'Furnizor',documentNumber:'A2',vatAmount:0}]};
    if(sql.includes('INSERT INTO ref_transactions'))linkedManualInsert=true;
    return {rows:[]};
  }};
  const linkedManual=await ref.createRefExpenseForSupplierPayment(10,linkedManualClient);
  assert.equal(linkedManual.status,'LINKED_MANUAL','A single equivalent manual REF row is adopted instead of duplicated');
  assert.deepEqual(linkedManualArgs.slice(0,3),[10,'[supplier-payment:10]',55]);
  assert.deepEqual(linkedManualArgs.slice(7,11),[121,21,100,100],'An adopted zero-VAT manual row is normalized to the purchase gross, VAT, net and fiscal values');
  assert.deepEqual(linkedManualArgs.slice(21,24),[21,'S',''],'The canonical VAT rate and category replace stale manual fiscal data');
  assert.ok(linkedManualSql.includes("source='AUTO_SUPPLIER_PAYMENT'"),'An adopted manual row becomes an automatic supplier-payment row');
  assert.ok(linkedManualSql.includes('[notă manuală anterioară]'),'Original manual notes remain in the canonical row as an audit trail');
  assert.equal(linkedManualInsert,false);
  let lostRaceInserted=false;
  const lostRaceClient={async query(sql,args=[]){
    if(sql.includes('FROM supplier_payments sp'))return {rows:[{id:12,date:'2026-09-25',amount:121,documentType:'FACTURA',documentNumber:'A4',total:121,exchangeRate:1,reverseCharge:0,partnerName:'Furnizor',partnerCif:'123',partnerCountryCode:'RO',partnerVatPayer:1,invoiceVat:21,expenseBase:100,minimumVatRate:21,maximumVatRate:21}]};
    if(sql.includes('UPDATE ref_transactions'))return {rows:[],rowCount:0};
    if(sql.includes("source='MANUAL'"))return {rows:[{id:58,partnerCif:'123',partnerName:'Furnizor',documentNumber:'A4'}]};
    if(sql.includes('INSERT INTO ref_transactions')){lostRaceInserted=true;return {rows:[],rowCount:0};}
    return {rows:[]};
  }};
  const lostRace=await ref.createRefExpenseForSupplierPayment(12,lostRaceClient);
  assert.equal(lostRace.status,'EXISTING');
  assert.equal(lostRaceInserted,true,'If the manual-row link loses a race, the idempotent insert path verifies/creates the automatic link');
  let weakIdentityUpdated=false,weakIdentityInserted=false;
  const weakIdentityClient={async query(sql,args=[]){
    if(sql.includes('FROM supplier_payments sp'))return {rows:[{id:13,date:'2026-09-25',amount:121,documentType:'FACTURA',documentNumber:'A5',total:121,exchangeRate:1,reverseCharge:0,partnerName:'Furnizor',partnerCif:'123',partnerCountryCode:'RO',partnerVatPayer:1,invoiceVat:21,expenseBase:100,minimumVatRate:21,maximumVatRate:21}]};
    if(sql.includes('UPDATE ref_transactions')){weakIdentityUpdated=true;return {rows:[],rowCount:1};}
    if(sql.includes("source='MANUAL'"))return {rows:[{id:59,partnerCif:'',partnerName:'',documentNumber:'A5'}]};
    if(sql.includes('INSERT INTO ref_transactions')){weakIdentityInserted=true;return {rows:[{id:93}],rowCount:1};}
    return {rows:[]};
  }};
  const weakIdentity=await ref.createRefExpenseForSupplierPayment(13,weakIdentityClient);
  assert.equal(weakIdentity.status,'UNRESOLVED');
  assert.equal(weakIdentity.weakManualMatches,1);
  assert.equal(weakIdentityUpdated,false,'A manual row without supplier identity is never adopted automatically');
  assert.equal(weakIdentityInserted,true,'The authoritative automatic payment row is still created while the weak duplicate remains flagged');
  let ambiguousInserted=false;
  const ambiguousManualClient={async query(sql,args=[]){
    if(sql.includes('FROM supplier_payments sp'))return {rows:[{id:11,date:'2026-09-25',amount:121,documentType:'FACTURA',documentNumber:'A3',total:121,exchangeRate:1,reverseCharge:0,partnerName:'Furnizor',partnerCif:'123',partnerCountryCode:'RO',partnerVatPayer:1,invoiceVat:21,expenseBase:100,minimumVatRate:21,maximumVatRate:21}]};
    if(sql.includes("source='MANUAL'"))return {rows:[{id:56,partnerCif:'123',partnerName:'Furnizor',documentNumber:'A3'},{id:57,partnerCif:'RO123',partnerName:'Furnizor',documentNumber:'A3'}]};
    if(sql.includes('INSERT INTO ref_transactions')){ambiguousInserted=true;return {rows:[{id:91}],rowCount:1};}
    return {rows:[]};
  }};
  const ambiguousManual=await ref.createRefExpenseForSupplierPayment(11,ambiguousManualClient);
  assert.equal(ambiguousManual.manualMatches,2);
  assert.equal(ambiguousInserted,true,'Ambiguous manual matches are preserved and the authoritative automatic row is still created');
  const supplierSyncQueries=[];
  const emptySupplierSync=await ref.syncSupplierPaymentsToRef({async query(sql,args=[]){supplierSyncQueries.push({sql,args});return {rows:[]};}},{year:2026});
  assert.deepEqual(emptySupplierSync,[]);
  assert.ok(supplierSyncQueries[0].sql.includes('EXTRACT(YEAR FROM sp.date)=$1')&&supplierSyncQueries[0].sql.includes('NOT EXISTS (SELECT 1 FROM ref_transactions'));
  assert.ok(supplierSyncQueries[1].sql.includes('JOIN ref_transactions linked'),'Already-linked payments are checked for unresolved duplicates in one batch, not one round trip per payment');
  assert.ok(supplierSyncQueries.every(query=>query.args[0]===2026));
  let batchWarningCalls=0;
  const batchWarnings=await ref.syncSupplierPaymentsToRef({async query(sql){batchWarningCalls++;return sql.includes('NOT EXISTS (SELECT 1 FROM ref_transactions')?{rows:[]}:{rows:[{paymentId:88,date:'2026-09-25',grossAmount:121,partnerName:'Furnizor',partnerCif:'123',documentNumber:'F88',manualId:188,manualPartnerName:'Furnizor',manualPartnerCif:'RO123',manualDocumentNumber:'F88'}]};}},{year:2026});
  assert.equal(batchWarningCalls,2);
  assert.deepEqual(batchWarnings,[{paymentId:88,date:'2026-09-25',status:'UNRESOLVED',manualMatches:1,weakManualMatches:0,duplicateManualWithAutomatic:true}]);
  const refDbSource=fs.readFileSync('lib/accounting/db.ts','utf8');
  assert.ok(refDbSource.includes('ref_transactions_supplierPaymentId_key')&&refDbSource.includes("'[supplier-payment:'"),'Supplier REF migration is idempotently keyed by payment id');
  assert.ok(refDbSource.includes('ACCOUNTING_SCHEMA_VERSION = 21'),'A live database still on schema v20 must execute the supplier-payment REF migration');
  let deleteSql='';
  const protectedLinkedRef=load('lib/accounting/ref.ts',{'@/lib/accounting/db':{ready:async()=>({async query(sql){deleteSql=sql;return {rows:[],rowCount:0};}})},'@/lib/accounting/vat-regime':vatRegime});
  await assert.rejects(()=>protectedLinkedRef.deleteRefTransaction(55),/generate automat/);
  assert.ok(deleteSql.includes('"supplierPaymentId" IS NULL'),'A supplier-linked REF row cannot be deleted through the manual-row endpoint');
  const guardedRef=load('lib/accounting/ref.ts',{'@/lib/accounting/db':{ready:async()=>({async query(sql){if(sql.includes('SELECT "vatPayer"'))return {rows:[{vatPayer:1}]};if(sql.includes('INSERT INTO ref_transactions'))return {rows:[{id:77}]};throw new Error('Unexpected REF query');}})},'@/lib/accounting/vat-regime':vatRegime});
  const refInput={type:'EXPENSE',date:'2026-09-25',documentType:'FACTURA',explanation:'Test',grossAmount:121,vatAmount:21,vatRate:21,vatCategoryCode:'S',fiscalCategory:'DEDUCTIBLE_EXPENSE',partnerCountryCode:'RO',partnerVatPayer:0};
  assert.equal(await guardedRef.createRefTransaction(refInput),77,'Manual S remains available after an ANAF non-VAT suggestion');
  const manualAeInput={...refInput,grossAmount:100,vatAmount:0,vatRate:21,vatCategoryCode:'AE',taxExemptionReason:'Taxare inversă conform Codului fiscal.',partnerCountryCode:'DE',partnerVatPayer:1};
  assert.equal(await guardedRef.createRefTransaction(manualAeInput),77,'Manual AE preserves the self-assessment VAT rate while supplier VAT remains zero');
  await assert.rejects(()=>guardedRef.createRefTransaction({...manualAeInput,vatRate:null}),/Cota TVA este obligatorie/);
  await assert.rejects(()=>guardedRef.createRefTransaction({...refInput,partnerVatPayer:1,vatRate:24}),/nu este valabilă/);
  await assert.rejects(()=>guardedRef.createRefTransaction({...refInput,grossAmount:121000,vatAmount:20200,partnerVatPayer:1}),/nu corespunde/,'Large VAT discrepancies are not accepted as rounding');

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
  const repo=load('lib/accounting/repo.ts',{'./db':{ready:async()=>({connect:async()=>refundClient})},'./ref':{createRefIncomeForPayment:async()=>{}},'./ledger':{postPaymentToLedger:async()=>{}},'./date':{bucharestDate:()=> '2026-09-24'},'./vat-regime':vatRegime});
  await assert.rejects(()=>repo.createInvoice({series:'F',clientId:1,issueDate:'2026-09-25',items:[{description:'Test',um:'buc',qty:1,unitPrice:100,vatRate:24}]}),/nu este valabilă/,'Standard invoices enforce the historical VAT rates');
  const stornoClient={release(){},async query(sql){if(sql==='BEGIN'||sql==='ROLLBACK')return {rows:[]};if(sql.includes('SELECT * FROM invoices'))return {rows:[{id:1,issueDate:'2026-09-25',invoiceType:'STANDARD',status:'issued'}]};return {rows:[]};}};
  const stornoRepo=load('lib/accounting/repo.ts',{'./db':{ready:async()=>({connect:async()=>stornoClient})},'./ref':{},'./ledger':{},'./date':{bucharestDate:()=> '2026-09-24'},'./vat-regime':vatRegime});
  await assert.rejects(()=>stornoRepo.createStornoInvoice({originalInvoiceId:1,issueDate:'2026-09-24',reason:'Corecție'}),/anterioară facturii originale/);
  await assert.rejects(()=>repo.addPayment(1,.001,'2026-09-24','bank','',true),/0,01/);
  await repo.addPayment(1,40,'2026-09-24','bank','',true);
  assert.equal(savedAmount,-40);assert.equal(paid,60);assert.equal(status,'stornoed');
  await assert.rejects(()=>repo.addPayment(1,61,'2026-09-24','bank','',true),/depășește/);
  await repo.addPayment(1,60,'2026-09-24','bank','',true);assert.equal(paid,0);
  await assert.rejects(()=>repo.addPayment(1,1,'2026-09-24','bank','',true));
  const declarationQueries=[];
  let declarationSyncYear=0;
  const declarations=load('lib/accounting/declarations.ts',{'./db':{ready:async()=>({async query(sql){
    declarationQueries.push(sql);
    if(sql.includes('SELECT name,cif,address'))return {rows:[{name:'TEST',cif:'123456',vatPayer:1,vatIncasare:0}]};
    if(sql.includes('FROM ref_transactions r'))return {rows:[{id:-1,partnerName:'Furnizor',partnerCif:'12345',partnerCountryCode:'RO',documentType:'FACTURA',documentNumber:'F1',grossAmount:121,netAmount:100,vatAmount:21,vatRate:21,deductibilityPercent:100,reverseCharge:0,vatOnCollection:0}]};
    return {rows:[]};
  }})},'./anaf-official-forms':{getOfficialAnafForms:()=>({})},'./vat-regime':vatRegime,'./ref':{syncSupplierPaymentsToRef:async(_pool,options)=>{declarationSyncYear=options.year;return [{paymentId:77,date:'2026-09-20',status:'EXISTING',manualMatches:1,duplicateManualWithAutomatic:true},{paymentId:78,date:'2026-09-20',status:'LINKED_MANUAL',manualMatches:1,duplicateManualWithAutomatic:false},{paymentId:79,date:'2026-01-20',status:'EXISTING',manualMatches:2,duplicateManualWithAutomatic:true}];}}});
  const report=await declarations.getDeclarationPeriod(2026,9);
  assert.equal(declarationSyncYear,2026,'Declaration reconciliation backfills supplier-payment REF links even if REF was never opened');
  assert.equal(report.d300.inputVat,21);
  assert.equal(report.d394.purchases.length,1);
  assert.equal(report.d394.purchases[0].net,100);
  assert.ok(report.d300.blockers.some(x=>x.includes('Plata furnizorului #77'))&&report.d394.blockers.some(x=>x.includes('Plata furnizorului #77')),'Unresolved supplier REF duplicates block both declarations');
  assert.ok(!report.d300.blockers.some(x=>x.includes('#78'))&&!report.d394.blockers.some(x=>x.includes('#78')),'A uniquely linked manual row is reconciled and does not block declarations');
  assert.ok(!report.d300.blockers.some(x=>x.includes('#79'))&&!report.d394.blockers.some(x=>x.includes('#79')),'A duplicate supplier REF payment outside the fiscal period does not block the selected declaration');
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
    if(sql.includes('FROM tax_declaration_classifications'))return {rows:[{sourceKey:'PURCHASE:10',operationCode:'A'}]};
    return {rows:[]};
  }})},'./anaf-official-forms':{getOfficialAnafForms:()=>({})},'./vat-regime':vatRegime});
  const quarter=await detailed.getDeclarationPeriod(2026,9);
  assert.equal(quarter.period.fiscalStart,'2026-07-01');
  assert.equal(quarter.d394.purchaseDocumentCount,1);
  assert.equal(quarter.d394.purchases.reduce((n,r)=>n+r.documentCount,0),1);
  assert.equal(quarter.d300.documentCount,1);
  assert.equal(quarter.d300.ready,true);
  assert.equal(quarter.d394.ready,true);
  const zeroVatDeclarations=load('lib/accounting/declarations.ts',{'./db':{ready:async()=>({async query(sql){
    if(sql.includes('SELECT * FROM tax_declaration_settings'))return {rows:[{...settings,fiscalPeriodType:'L'}]};
    if(sql.includes('SELECT name,cif,address'))return {rows:[{name:'TEST',cif:'123456',address:'Adresa',bank:'Banca',iban:'ROTEST',vatPayer:1,vatIncasare:0}]};
    if(sql.includes('FROM ref_transactions r'))return {rows:[{id:1,documentKey:'REF:1',documentDate:'2026-09-25',partnerName:'Salariat',partnerCif:'123456',partnerCountryCode:'RO',documentType:'SALARII',documentNumber:'PL-1',grossAmount:100,netAmount:100,vatAmount:0,vatRate:0,deductibilityPercent:100,reverseCharge:0,vatOnCollection:0,fiscalCategory:'DEDUCTIBLE_EXPENSE'}]};
    return {rows:[]};
  }})},'./anaf-official-forms':{getOfficialAnafForms:()=>({})},'./vat-regime':vatRegime});
  assert.equal((await zeroVatDeclarations.getDeclarationPeriod(2026,9)).d300.ready,true,'Zero-VAT payroll/expenses do not block D300');
  const externalZeroVatDeclarations=load('lib/accounting/declarations.ts',{'./db':{ready:async()=>({async query(sql){
    if(sql.includes('SELECT * FROM tax_declaration_settings'))return {rows:[{...settings,fiscalPeriodType:'L'}]};
    if(sql.includes('SELECT name,cif,address'))return {rows:[{name:'TEST',cif:'123456',address:'Adresa',bank:'Banca',iban:'ROTEST',vatPayer:1,vatIncasare:0}]};
    if(sql.includes('FROM ref_transactions r'))return {rows:[{id:-22,documentKey:'PURCHASE:22',documentDate:'2026-09-25',partnerName:'Furnizor UE',partnerCif:'DE123456',partnerCountryCode:'DE',documentType:'FACTURA',documentNumber:'EU-22',grossAmount:100,netAmount:100,vatAmount:0,vatRate:0,deductibilityPercent:100,reverseCharge:0,vatOnCollection:0,fiscalCategory:'DEDUCTIBLE_EXPENSE'}]};
    return {rows:[]};
  }})},'./anaf-official-forms':{getOfficialAnafForms:()=>({})},'./vat-regime':vatRegime});
  const externalZeroVatReport=await externalZeroVatDeclarations.getDeclarationPeriod(2026,9);
  assert.equal(externalZeroVatReport.d300.ready,false,'An unclassified foreign zero-VAT purchase must not silently omit reverse-charge VAT from D300');
  assert.ok(externalZeroVatReport.d300.blockers.some(x=>x.includes('achiziții externe cu TVA zero')));
  let manualAeRate=21;
  const manualAeDeclarations=load('lib/accounting/declarations.ts',{'./db':{ready:async()=>({async query(sql){
    if(sql.includes('SELECT * FROM tax_declaration_settings'))return {rows:[{...settings,fiscalPeriodType:'L'}]};
    if(sql.includes('SELECT name,cif,address'))return {rows:[{name:'TEST',cif:'123456',address:'Adresa',bank:'Banca',iban:'ROTEST',vatPayer:1,vatIncasare:0}]};
    if(sql.includes('FROM ref_transactions r'))return {rows:[{id:23,documentKey:'REF:23',documentDate:'2026-09-25',partnerName:'Furnizor UE',partnerCif:'DE123456',partnerCountryCode:'DE',documentType:'FACTURA',documentNumber:'AE-23',grossAmount:100,netAmount:100,vatAmount:0,vatRate:manualAeRate,deductibilityPercent:100,reverseCharge:1,vatOnCollection:0,fiscalCategory:'DEDUCTIBLE_EXPENSE'}]};
    return {rows:[]};
  }})},'./anaf-official-forms':{getOfficialAnafForms:()=>({})},'./vat-regime':vatRegime});
  const manualAeReport=await manualAeDeclarations.getDeclarationPeriod(2026,9);
  assert.equal(manualAeReport.d300.outputVat,21,'AE adds self-assessed VAT to collected VAT');
  assert.equal(manualAeReport.d300.inputVat,21,'Fully deductible AE adds the same self-assessed VAT to deductible VAT');
  manualAeRate=null;
  const missingAeRateReport=await manualAeDeclarations.getDeclarationPeriod(2026,9);
  assert.ok(missingAeRateReport.d300.blockers.some(x=>x.includes('nu au o cotă TVA valabilă')),'Legacy AE without a rate is explicitly blocked instead of omitted');
  const declarationsSource=fs.readFileSync('lib/accounting/declarations.ts','utf8');
  assert.ok(declarationsSource.includes("source NOT IN ('AUTO_PAYROLL','AUTO_SUPPLIER_PAYMENT')"));
  assert.ok(declarationsSource.includes('source NOT IN (\'AUTO_PAYROLL\',\'AUTO_SUPPLIER_PAYMENT\') AND "supplierPaymentId" IS NULL'),'A payment in a later tax period cannot redeclare the original purchase document');
  assert.ok(fs.readFileSync('lib/accounting/d394.ts','utf8').includes("source='MANUAL'"),'Automatic payroll does not block D394');
  assert.ok(fs.readFileSync('lib/accounting/d394.ts','utf8').includes('"supplierPaymentId" IS NULL'),'Supplier-linked legacy manual rows are excluded defensively from D394');
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
  assert.equal(euReport.d390.operations.length,1,'D390 groups purchase lines under one stable document key and excludes earlier months');
  assert.equal(euReport.d390.operations[0].sourceKey,'PURCHASE:10');
  const d390=await detailed.generateOfficialD390Xml(2026,9);
  assert.ok(d390.includes('baza="25"'),'D390 rounds after grouping partner operations');
  const csv=await detailed.exportDeclarationWorkingPaper('D390',2026,9);
  assert.ok(csv.includes('PURCHASE:10')&&csv.includes('DE12345'));
  assert.ok(!csv.includes('REF:-1'));
  await assert.rejects(()=>detailed.updateDeclarationSettings({...settings,invoiceSeries:'F',allocatedInvoiceFrom:1,allocatedInvoiceTo:Infinity}),/numere întregi/);
  await assert.rejects(()=>detailed.updateDeclarationSettings({...settings,invoiceSeries:'F',allocatedInvoiceFrom:1.2,allocatedInvoiceTo:10}),/numere întregi/);
  const purchaseQueries=[];
  const purchases=load('lib/accounting/purchases.ts',{'./db':{ready:async()=>({query:async(sql,args)=>{purchaseQueries.push({sql,args});if(sql.includes('SELECT "vatPayer" FROM company'))return {rows:[{vatPayer:1}]};if(sql.includes('SELECT blocked,"vatPayer"'))return {rows:[{blocked:0,vatPayer:0,countryCode:'RO'}]};return {rows:[]};},connect:async()=>{throw new Error('Invalid input reached database');}})},'./ledger':{},'./ref':{createRefExpenseForSupplierPayment:async()=>{}},'./vat-regime':vatRegime});
  for(const amount of [NaN,Infinity,-1,0,.001])await assert.rejects(()=>purchases.addSupplierPayment(1,{date:'2026-09-25',amount}),/suma plății/);
  await assert.rejects(()=>purchases.addSupplierPayment(1,{date:'2026-02-30',amount:10}),/Data/);
  await assert.rejects(()=>purchases.addSupplierPayment(1,{date:'2026-09-25',amount:10,method:'INVALID'}),/Metoda/);
  await assert.rejects(()=>purchases.supplierSituation('2026-02-30'),/Data/);
  await purchases.supplierSituation('2026-09-01');
  const situationQuery=purchaseQueries.find(call=>call.sql.includes('LEFT JOIN LATERAL'));
  assert.ok(situationQuery.sql.includes('sp.date<=COALESCE'));
  assert.ok(!situationQuery.sql.includes('p."paidAmount"'));
  assert.equal(situationQuery.args[0],'2026-09-01');
  await assert.rejects(()=>purchases.createPurchase({supplierId:1,documentNumber:'F1',issueDate:'2026-09-25',dueDate:'2026-09-24',items:[{description:'Servicii',quantity:1,unitPrice:100,vatRate:21,vatCategoryCode:'S'}]}),/Scadența/);
  await assert.rejects(()=>purchases.createPurchase({supplierId:1,documentNumber:'F1',issueDate:'2026-09-25',dueDate:'2026-09-25',items:[{description:'Servicii',quantity:1,unitPrice:100,vatRate:21,vatCategoryCode:'S'}]}),/Invalid input reached database/,'Manual S passes validation and reaches persistence');
  let reverseItemArgs;
  const reverseClient={release(){},async query(sql,args=[]){
    if(sql.includes('SELECT blocked,"vatPayer"'))return {rows:[{blocked:0,vatPayer:1,countryCode:'RO'}]};
    if(sql.includes('SELECT code FROM accounting_accounts'))return {rows:[{code:'628'}],rowCount:1};
    if(sql.includes('SELECT COALESCE(MAX'))return {rows:[{next:1}]};
    if(sql.includes('INSERT INTO purchase_invoices'))return {rows:[{id:91}]};
    if(sql.includes('INSERT INTO purchase_invoice_items'))reverseItemArgs=args;
    return {rows:[],rowCount:0};
  }};
  const reversePurchases=load('lib/accounting/purchases.ts',{'./db':{ready:async()=>({query:async(sql)=>sql.includes('SELECT "vatPayer" FROM company')?{rows:[{vatPayer:1}]}:{rows:[{blocked:0,vatPayer:1,countryCode:'RO'}]},connect:async()=>reverseClient})},'./ledger':{postPurchaseInvoiceToLedger:async()=>{}},'./ref':{createRefExpenseForSupplierPayment:async()=>{}},'./vat-regime':vatRegime});
  await reversePurchases.createPurchase({supplierId:1,documentNumber:'RC1',issueDate:'2026-09-25',dueDate:'2026-09-25',reverseCharge:true,items:[{description:'Servicii UE',quantity:1,unitPrice:100,vatRate:21}]});
  assert.deepEqual([reverseItemArgs[6],reverseItemArgs[8],reverseItemArgs[10]],[21,21,'AE'],'Reverse charge persists the self-assessed VAT rate and amount');
  const editable={supplierId:1,documentNumber:'F1',issueDate:'2026-09-25',dueDate:'2026-09-25',items:[{description:'Servicii',quantity:1,unitPrice:100,vatRate:21,vatCategoryCode:'S'}]};
  await assert.rejects(()=>purchases.updatePurchase(1,{...editable,items:[{...editable.items[0],vatCategoryCode:'BAD'}]}),/Regimul TVA/);
  await assert.rejects(()=>purchases.updatePurchase(1,{...editable,items:[{...editable.items[0],vatRate:24}]}),/nu este valabilă/);
  const paidQueries=[];
  const paidPurchaseClient={release(){},async query(sql,args=[]){
    paidQueries.push({sql,args});
    if(sql.includes('SELECT * FROM purchase_invoices'))return {rows:[{id:1,status:'PAID',supplierId:1,documentType:'FACTURA',issueDate:'2026-09-25',currency:'RON',exchangeRate:1,subtotal:100,vatTotal:21,total:121,reverseCharge:0,vatOnCollection:0}]};
    if(sql.includes('SELECT blocked FROM suppliers'))return {rows:[{blocked:0}]};
    if(sql.includes('SELECT COUNT(*) count'))return {rows:[{count:1}]};
    if(sql.includes('SELECT * FROM purchase_invoice_items'))return {rows:[{id:11,description:'Servicii',expenseAccount:'628',unit:'buc',quantity:1,unitPrice:100,vatRate:21,netAmount:100,vatAmount:21,deductibilityPercent:100,vatCategoryCode:'S',taxExemptionReasonCode:'',taxExemptionReason:''}]};
    return {rows:[],rowCount:1};
  }};
  const paidPurchases=load('lib/accounting/purchases.ts',{'./db':{ready:async()=>({query:async(sql)=>sql.includes('SELECT "vatPayer" FROM company')?{rows:[{vatPayer:1}]}:{rows:[{blocked:0,vatPayer:1,countryCode:'RO'}]},connect:async()=>paidPurchaseClient})},'./ledger':{postPurchaseInvoiceToLedger:async()=>{throw new Error('Paid invoice was reposted');}},'./ref':{createRefExpenseForSupplierPayment:async()=>{}},'./vat-regime':vatRegime});
  await assert.rejects(()=>paidPurchases.updatePurchase(1,{...editable,items:[{...editable.items[0],expenseAccount:'601'}]}),/nu mai poate fi modificat/,'A paid purchase cannot be reclassified while keeping the same total');
  await assert.rejects(()=>paidPurchases.updatePurchase(1,{...editable,documentNumber:'F2'}),/storno\/corecție/,'Even metadata changes are blocked after payment so ledger and REF references cannot diverge');
  assert.ok(!paidQueries.some(call=>call.sql.includes('UPDATE purchase_invoices')));
  const repoSource=fs.readFileSync('lib/accounting/repo.ts','utf8');
  assert.ok(repoSource.includes('const today = bucharestDate()')&&repoSource.includes('const thisMonth = today.slice(0, 7)'));
  assert.ok(repoSource.includes('SUM(total * "exchangeRate")'));
  assert.ok(repoSource.includes("ai.status NOT IN ('canceled','stornoed')"),'Canceled and replaced originals do not inflate ANAF problem KPIs');
  const billingSource=fs.readFileSync('components/accounting/BillingDashboard.tsx','utf8');
  assert.ok(billingSource.includes('inv.status !== "canceled"'));
  assert.ok(billingSource.includes('!["canceled", "stornoed"].includes(inv.status)'));
  const refUiSource=fs.readFileSync('app/dashboard/contabilitate/ref/page.tsx','utf8');
  assert.ok(refUiSource.includes('Alege cota TVA')&&refUiSource.includes('effectiveVatCategory==="S"||effectiveVatCategory==="AE"'),'REF requires an explicit valid VAT rate for both standard and reverse-charge entries');
  const receiptRepo=load('lib/accounting/repo.ts',{'./db':{ready:async()=>({connect:async()=>({release(){},async query(sql){
    if(sql.includes('SELECT * FROM invoices'))return {rows:[{id:1,status:'issued',invoiceType:'STANDARD',currency:'RON'}]};
    if(sql.includes('SUM(amount)'))return {rows:[{amount:sql.includes('FROM payments')?10:0}]};
    if(sql.includes('INSERT'))throw new Error('Zero receipt reached INSERT');
    return {rows:[]};
  }})})},'./ref':{},'./ledger':{},'./date':{},'./vat-regime':vatRegime});
  await assert.rejects(()=>receiptRepo.createReceipt(1,'2026-09-25',.001),/0,01/);
  console.log('Accounting flow regression tests passed: purchases, payments, refunds, FX REF and period locking. No real database writes.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
