import { z } from 'zod'
import { XMLValidator } from 'fast-xml-parser'
import { ready } from './db'
import { encrypt, decrypt } from '../crypto'
import { accessToken, getAnafPublicConfig, getAnafConnectionStatus } from './efactura'
import { parseNomenclature, parseRegesMessage, regesEndpoints, regesEntities, regesNomenclatures, regesUploadPath } from './reges-protocol'
import { collectRegesResponse, limitedResponse } from './reges-responses'

export const regesConnectionSchema = z.object({
  environment: z.enum(['test', 'production']),
  username: z.string().trim().min(1), password: z.string().min(1),
  clientId: z.string().trim().min(1), clientSecret: z.string().min(1),
})
export const exchangeSchema = z.object({
  service: z.enum(['ETRANSPORT', 'REGES']),
  action: z.enum(['list', 'status', 'download', 'upload', 'profile', 'read']),
  reference: z.string().regex(/^[A-Za-z0-9-]{1,100}$/).optional(),
  days: z.number().int().min(1).max(60).default(30),
  entity: z.enum(regesEntities).optional(),
  xml: z.string().max(2_000_000).optional(),
  requestId: z.string().uuid().optional(),
}).superRefine((value, context) => {
  if (value.action === 'upload' && !value.requestId) context.addIssue({code:'custom',path:['requestId'],message:'Identificatorul unic al transmiterii lipsește.'})
})
async function storage() {
  const pool = await ready()
  await pool.query(`CREATE TABLE IF NOT EXISTS institution_connections (
    service TEXT PRIMARY KEY, environment TEXT NOT NULL, credentials TEXT NOT NULL, "updatedAt" timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS institution_exchanges (
    id SERIAL PRIMARY KEY, service TEXT NOT NULL, environment TEXT NOT NULL, action TEXT NOT NULL,
    "httpStatus" INTEGER NOT NULL, "contentType" TEXT NOT NULL, response TEXT NOT NULL, "requestId" TEXT UNIQUE,
    "createdAt" timestamptz NOT NULL DEFAULT now());
    ALTER TABLE institution_exchanges ADD COLUMN IF NOT EXISTS metadata jsonb;
    CREATE TABLE IF NOT EXISTS institution_reges_queue (
      environment TEXT PRIMARY KEY, state TEXT NOT NULL, "exchangeId" INTEGER);
    CREATE TABLE IF NOT EXISTS institution_reges_nomenclatures (
      environment TEXT NOT NULL, kind TEXT NOT NULL, entries jsonb NOT NULL,
      "updatedAt" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (environment,kind));`)
  return pool
}

export async function integrationOverview() {
  const pool = await storage()
  const [connections, exchanges, anaf, company, queue] = await Promise.all([
    pool.query('SELECT service, environment, "updatedAt" FROM institution_connections'),
    pool.query(`SELECT e.id,e.service,e.environment,e.action,e."httpStatus",e."createdAt",e.metadata,
      CASE WHEN e.action='upload' AND e.service='REGES' THEN
        (SELECT jsonb_agg(jsonb_build_object('id',r.id,'metadata',r.metadata) ORDER BY r.id) FROM institution_exchanges r
         WHERE r.service='REGES' AND r.action='read' AND r.environment=e.environment
         AND r.metadata->>'responseId'=e.metadata->>'responseId') END AS results
      FROM institution_exchanges e ORDER BY e.id DESC LIMIT 30`),
    getAnafConnectionStatus(),
    pool.query('SELECT name,cif FROM company WHERE id=1'),
    pool.query('SELECT environment,state,"exchangeId" FROM institution_reges_queue'),
  ])
  return { anaf: { configured:anaf.configured, connected:anaf.connected, environment:anaf.environment },
    firm: { name:String(company.rows[0]?.name || 'Elmont S.A.'), cif:String(company.rows[0]?.cif || '') }, connections: connections.rows, exchanges: exchanges.rows, queue:queue.rows }
}

export async function saveRegesConnection(input: z.infer<typeof regesConnectionSchema>) {
  const data = regesConnectionSchema.parse(input)
  await (await storage()).query(`INSERT INTO institution_connections (service, environment, credentials)
    VALUES ('REGES',$1,$2) ON CONFLICT (service) DO UPDATE SET environment=$1, credentials=$2,"updatedAt"=now()`,
  [data.environment, encrypt(JSON.stringify(data))])
}

export async function disconnectReges() {
  await (await storage()).query("DELETE FROM institution_connections WHERE service='REGES'")
}

export function checkedXml(value?: string) {
  if (!value?.trim() || /<!DOCTYPE|<!ENTITY/i.test(value) || XMLValidator.validate(value) !== true) throw new Error('Fișierul XML este invalid sau conține declarații externe nepermise.')
  return value
}

export function institutionHeaders(service: 'REGES' | 'ETRANSPORT', hasBody: boolean, download: boolean) {
  const format = service === 'REGES' ? 'text/xml' : 'application/xml'
  return { Accept: download ? 'application/octet-stream' : service === 'REGES' ? 'text/xml' : 'application/json',
    ...(hasBody ? { 'Content-Type':format } : {}) }
}

export function transportPath(input: z.infer<typeof exchangeSchema>, cif: string) {
  if (!/^\d{2,10}$/.test(cif)) throw new Error('Completează CUI-ul firmei active.')
  switch (input.action) {
    case 'list': return `/lista/${input.days}/${cif}`
    case 'status': if (input.reference && /^\d+$/.test(input.reference)) return `/stareMesaj/${input.reference}`; break
    case 'download': if (input.reference && /^\d+$/.test(input.reference)) return `/descarcare/${input.reference}`; break
    case 'upload': return `/upload/ETRANSPORT/${cif}`
  }
  throw new Error('Operațiune e-Transport invalidă sau identificator lipsă.')
}

export async function exchangeWithInstitution(raw: z.input<typeof exchangeSchema>) {
  const input = exchangeSchema.parse(raw)
  const pool = await storage()
  let url: string, token: string, environment: 'test' | 'production', method = 'GET'
  let body: string | undefined
  if (input.action === 'upload') { body = checkedXml(input.xml); method = 'POST' }
  if (input.service === 'ETRANSPORT') {
    environment = getAnafPublicConfig().environment
    const { rows } = await pool.query('SELECT cif FROM company WHERE id=1')
    const cif = String(rows[0]?.cif || '').replace(/^RO/i, '').trim()
    url = `https://api.anaf.ro/${environment === 'production' ? 'prod' : 'test'}/ETRANSPORT/ws/v1${transportPath(input, cif)}`
    token = await accessToken()
  } else {
    const { rows } = await pool.query("SELECT credentials FROM institution_connections WHERE service='REGES'")
    if (!rows[0]) throw new Error('Configurează conexiunea REGES pentru Elmont.')
    const credentials = regesConnectionSchema.parse(JSON.parse(decrypt(rows[0].credentials)))
    environment = credentials.environment
    const endpoint = regesEndpoints[environment]
    const response = await fetch(endpoint.auth, { method:'POST', redirect:'error', cache:'no-store', signal:AbortSignal.timeout(20000),
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body:new URLSearchParams({ grant_type:'password', client_id:credentials.clientId, client_secret:credentials.clientSecret, username:credentials.username, password:credentials.password }) })
    const authentication = await response.json().catch(() => ({}))
    if (!response.ok || !authentication.access_token) throw new Error('Autentificarea REGES a eșuat. Verifică mediul și credențialele firmei.')
    token = authentication.access_token
    if (input.action === 'profile') url = `${endpoint.api}/api/Profile`
    else if (input.action === 'read') {
      const consumerId='pontifix-elmont'
      return collectRegesResponse(pool,environment,consumerId,action => fetch(`${endpoint.api}/api/Status/${action}?consumerId=${encodeURIComponent(consumerId)}`, {
        method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${token}`,...institutionHeaders('REGES',false,false)} }))
    }
    else if (input.action === 'upload' && input.entity) url = `${endpoint.api}${regesUploadPath(input.entity)}`
    else throw new Error('Operațiune REGES invalidă.')
  }
  let pendingId: number | undefined
  if (input.action === 'upload') {
    const pending = await pool.query(`INSERT INTO institution_exchanges (service,environment,action,"httpStatus","contentType",response,"requestId")
      VALUES ($1,$2,$3,0,'text/plain','',$4) ON CONFLICT ("requestId") DO NOTHING RETURNING id`, [input.service,environment,input.action,input.requestId])
    if (!pending.rows[0]) throw new Error('Această transmitere a fost deja inițiată. Verifică istoricul și starea la instituție înainte de o nouă transmitere.')
    pendingId = pending.rows[0].id
  }
  const response = await fetch(url, { method, body, redirect:'error', cache:'no-store', signal:AbortSignal.timeout(25000),
    headers:{ Authorization:`Bearer ${token}`, ...institutionHeaders(input.service, Boolean(body), input.action === 'download') } })
  const bytes = await limitedResponse(response)
  const contentType = response.headers.get('content-type') || 'application/octet-stream'
  const metadata=input.service==='REGES' ? parseRegesMessage(bytes.toString('utf8')) : null
  const result = pendingId ? await pool.query(`UPDATE institution_exchanges SET "httpStatus"=$1,"contentType"=$2,response=$3,metadata=$5::jsonb WHERE id=$4 RETURNING id`, [response.status,contentType,bytes.toString('base64'),pendingId,JSON.stringify(metadata)]) : await pool.query(`INSERT INTO institution_exchanges (service,environment,action,"httpStatus","contentType",response)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [input.service, environment, input.action, response.status, contentType, bytes.toString('base64')])
  return { id:result.rows[0].id, httpStatus:response.status, accepted:response.ok, metadata,
    message: input.action === 'upload' ? 'Răspuns primit. Verifică rezultatul procesării; acceptarea cererii nu confirmă validarea finală.' : 'Răspuns primit.',
    preview: /json|xml|text/.test(contentType) ? bytes.toString('utf8').slice(0, 20000) : 'Fișier disponibil pentru descărcare.' }
}

export const regesNomenclatureSchema=z.object({ environment:z.enum(['test','production']),kind:z.enum(regesNomenclatures),query:z.string().trim().max(100).default('') })

export async function syncRegesNomenclature(raw:unknown) {
  const input=regesNomenclatureSchema.parse(raw)
  const response=await fetch(`${regesEndpoints[input.environment].api}/api/Nomenclator?tip=${input.kind}`,{headers:{Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(25000)})
  if (!response.ok) throw new Error(`Nomenclatorul REGES nu a putut fi preluat. HTTP ${response.status}.`)
  const bytes=await limitedResponse(response,20_000_000)
  const entries=parseNomenclature(JSON.parse(bytes.toString('utf8')))
  if (!entries.length) throw new Error('Lista REGES este goală. Nomenclatorul salvat a fost păstrat.')
  await (await storage()).query(`INSERT INTO institution_reges_nomenclatures (environment,kind,entries)
    VALUES ($1,$2,$3::jsonb) ON CONFLICT (environment,kind) DO UPDATE SET entries=EXCLUDED.entries,"updatedAt"=now()`,[input.environment,input.kind,JSON.stringify(entries)])
  return {message:`Nomenclatorul ${input.kind} a fost sincronizat: ${entries.length} înregistrări.`}
}

export async function readRegesNomenclature(raw:unknown) {
  const input=regesNomenclatureSchema.parse(raw)
  const {rows}=await (await storage()).query('SELECT entries,"updatedAt" FROM institution_reges_nomenclatures WHERE environment=$1 AND kind=$2',[input.environment,input.kind])
  const all=(rows[0]?.entries || []) as Array<Record<string,unknown>>
  const matches=all.filter(value => !input.query || JSON.stringify(value).toLocaleLowerCase('ro-RO').includes(input.query.toLocaleLowerCase('ro-RO')))
  return {total:all.length,matched:matches.length,updatedAt:rows[0]?.updatedAt || null,entries:matches.slice(0,50)}
}

export async function downloadInstitutionResponse(id: number) {
  const { rows } = await (await storage()).query('SELECT response,"contentType" FROM institution_exchanges WHERE id=$1', [id])
  if (!rows[0]) return null
  return { bytes:Buffer.from(rows[0].response, 'base64'), contentType:rows[0].contentType as string }
}
