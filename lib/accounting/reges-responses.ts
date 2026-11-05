import type { Pool } from 'pg'
import { parseRegesMessage, regesResultLabel, type RegesEnvironment } from './reges-protocol'

export async function limitedResponse(response:Response, maximum=10_000_000) {
  const reader=response.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks:Uint8Array[]=[]
  let size=0
  try {
    for (;;) {
      const next=await reader.read()
      if (next.done) break
      size+=next.value.length
      if (size>maximum) { await reader.cancel(); throw new Error('Răspunsul instituției depășește limita permisă.') }
      chunks.push(next.value)
    }
  } finally { reader.releaseLock() }
  return Buffer.concat(chunks)
}

export async function collectRegesResponse(pool:Pool, environment:RegesEnvironment, consumerId:string, request:(action:'ReadMessage'|'CommitRead')=>Promise<Response>) {
  const client=await pool.connect()
  const lock=`reges-queue:${consumerId}:${environment}`
  let locked=false
  try {
    const acquired=await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',[lock])
    locked=acquired.rows[0].acquired===true
    if (!locked) throw new Error('O citire REGES este deja în curs pentru această firmă.')
    await client.query(`INSERT INTO institution_reges_queue (environment,state) VALUES ($1,'idle') ON CONFLICT DO NOTHING`,[environment])
    const state=await client.query('SELECT state FROM institution_reges_queue WHERE environment=$1',[environment])
    if (state.rows[0].state!=='idle') throw new Error('Confirmarea citirii anterioare este incertă. Nu reluăm automat confirmarea, pentru a evita omiterea unui răspuns. Verifică arhiva și poziția consumatorului REGES cu suportul tehnic.')
    const response=await request('ReadMessage')
    const bytes=await limitedResponse(response)
    const contentType=response.headers.get('content-type') || 'application/octet-stream'
    const metadata=response.ok ? parseRegesMessage(bytes.toString('utf8')) : null
    const archived=await client.query(`INSERT INTO institution_exchanges (service,environment,action,"httpStatus","contentType",response,metadata)
      VALUES ('REGES',$1,'read',$2,$3,$4,$5::jsonb) RETURNING id`,[environment,response.status,contentType,bytes.toString('base64'),JSON.stringify(metadata)])
    const id=archived.rows[0].id
    let message=response.ok && metadata ? regesResultLabel(metadata) : response.ok && (!bytes.length || bytes.toString('utf8').trim()==='null') ? 'Nu există răspunsuri noi.' : 'Răspuns arhivat. Formatul nu permite confirmarea automată a citirii.'
    let acknowledged=false
    if (response.ok && metadata?.kind==='result' && metadata.messageId) {
      // Persist the attempt before CommitRead. A timeout/crash must not cause a
      // blind retry, since CommitRead has no message ID / idempotency parameter.
      await client.query(`UPDATE institution_reges_queue SET state='committing',"exchangeId"=$2 WHERE environment=$1`,[environment,id])
      try {
        const confirmation=await request('CommitRead')
        const confirmationBytes=await limitedResponse(confirmation)
        await client.query(`INSERT INTO institution_exchanges (service,environment,action,"httpStatus","contentType",response)
          VALUES ('REGES',$1,'commit',$2,$3,$4)`,[environment,confirmation.status,confirmation.headers.get('content-type') || 'text/plain',confirmationBytes.toString('base64')])
        if (!confirmation.ok) throw new Error('REGES nu a confirmat avansarea cozii.')
        await client.query(`UPDATE institution_reges_queue SET state='idle',"exchangeId"=NULL WHERE environment=$1`,[environment])
        acknowledged=true
      } catch {
        // Leave the durable committing state in place, including when the
        // HTTP request succeeded but recording its outcome failed.
        message+=' Răspunsul este salvat; confirmarea cozii trebuie verificată manual înaintea unei noi citiri.'
      }
    }
    return {id,httpStatus:response.status,accepted:response.ok && !(metadata?.kind==='result' && (!acknowledged || metadata.code==='FAIL' || metadata.codeType==='ERROR')),message,metadata,acknowledged,preview:bytes.toString('utf8').slice(0,20000)}
  } finally {
    if (locked) {
      try { await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock]) }
      catch { client.release(true); throw new Error('Conexiunea de sincronizare REGES a fost întreruptă.') }
    }
    client.release()
  }
}
