const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
let mode = 'snapshot';
const queries = [];
const pool = {
  async query(sql, args) {
    queries.push({ sql, args });
    if (sql.includes('SELECT "xmlSnapshot"')) return { rows: [{ xmlSnapshot: '<Invoice>ORIGINAL</Invoice>' }] };
    if (sql.includes('SELECT id,"uploadId",status')) return { rows: mode === 'NETWORK' ? [] : [{ id: 7, status: mode, uploadId: '' }] };
    if (sql.includes('SELECT "anafApprovedEnvironment"')) return {rows:[{anafApprovedEnvironment:'test'}]};
    if (sql.includes('SELECT * FROM anaf_connections')) return {rows:[{accessToken:'fake',expiresAt:'2099-01-01'}]};
    if (sql.includes('COALESCE(MAX')) return {rows:[{attempt:1}]};
    if (sql.includes('RETURNING id')) return {rows:[{id:8}]};
    if (sql.includes('COUNT(*) AS count FROM anaf_connections')) return { rows: [{count: 1}] };
    return { rows: [] };
  },
  async connect() { return { query: pool.query, release() {} }; }
};
const api = {};
const full = {invoice:{id:1,series:'TEST',number:1,invoiceType:'STANDARD',status:'issued',issueDate:'2026-09-04',dueDate:'2026-09-05',total:1,subtotal:1,vatTotal:0},company:{name:'Test',cif:'123',address:'Test 1',city:'Zalau',county:'SJ',vatPayer:0},client:{name:'Test',cif:'123',clientType:'PJ',address:'Test 2',city:'Zalau',judet:'SJ'},items:[{description:'Test',unitCode:'H87',qty:1,unitPrice:1,valoare:1,vatValue:0,vatRate:0,vatCategoryCode:'O',taxExemptionReason:'Nu face obiectul TVA'}]};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/accounting/efactura.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports: api, process: {env:{ANAF_ENVIRONMENT:'test',ANAF_CLIENT_ID:'test',ANAF_CLIENT_SECRET:'test'}}, console, Buffer, AbortSignal,
  fetch() { throw new Error('Network is forbidden in tests'); },
  require(id) {
    if(id.endsWith('/db')) return {ready:async()=>pool};
    if(id.endsWith('/repo')) return {getInvoiceFull:async()=>{if(mode==='NETWORK')return full;throw new Error('Snapshot must not be regenerated');}};
    if(id.endsWith('/crypto')) return {encrypt:String,decrypt:String};
    throw new Error(id);
  }
});
(async()=>{
  assert.equal(await api.invoiceDownloadXml(1), '<Invoice>ORIGINAL</Invoice>');
  for (mode of ['UNCERTAIN','UPLOADING','PROCESSING','VALIDATED']) {
    const result=await api.submitEFactura(1,'ignored','123');
    assert.equal(result.duplicatePrevented,true);
    assert.equal(result.status,mode);
  }
  queries.length=0;
  mode='NETWORK';
  await assert.rejects(()=>api.submitEFactura(1,'ignored','123'), /Network is forbidden/);
  const uncertain=queries.find(q=>q.sql.includes('status=$4,message=$1'));
  assert.equal(uncertain.args[3],'UNCERTAIN');
  assert.equal(uncertain.args[1],0);
  queries.length=0;
  await api.processAutomaticEFactura(30);
  const candidate=queries.find(q=>q.sql.includes('SELECT i.id FROM invoices i'));
  assert.ok(candidate.sql.includes('i."anafApprovedEnvironment"=$2'));
  assert.ok(candidate.sql.includes('i."anafSendAfter" <= now()'));
  assert.equal(candidate.args[1],'test');
  const abandoned=queries.find(q=>q.sql.includes("WHERE status='UPLOADING'"));
  assert.ok(abandoned.sql.includes("status='UNCERTAIN', retryable=0"));
  const cron=JSON.parse(fs.readFileSync('vercel.json','utf8')).crons.find(c=>c.path==='/api/cron/efactura');
  assert.equal(cron.schedule,'0 6 * * *');
  console.log('ANAF workflow tests passed: immutable XML, duplicate/uncertain guards, environment isolation, deferred eligibility, recurring queue. No network or real DB access.');
})().catch(error=>{console.error(error);process.exitCode=1;});
