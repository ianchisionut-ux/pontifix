import { NextRequest, NextResponse } from 'next/server'
import { accountingApi } from '@/lib/accounting/access'
import { disconnectReges, downloadInstitutionResponse, exchangeWithInstitution, integrationOverview, readRegesNomenclature, saveRegesConnection, syncRegesNomenclature } from '@/lib/accounting/institution-integrations'

export const maxDuration = 90

export const GET = accountingApi(async (req: NextRequest) => {
  if (req.nextUrl.searchParams.has('catalog')) {
    try { return NextResponse.json(await readRegesNomenclature({kind:req.nextUrl.searchParams.get('catalog'),environment:req.nextUrl.searchParams.get('environment'),query:req.nextUrl.searchParams.get('q') || ''}),{headers:{'Cache-Control':'private, no-store'}}) }
    catch { return NextResponse.json({error:'Nomenclator sau mediu invalid.'},{status:400}) }
  }
  const id = req.nextUrl.searchParams.get('download')
  if (id) {
    if (!/^\d+$/.test(id)) return NextResponse.json({ error:'Identificator invalid.' }, { status:400 })
    const result = await downloadInstitutionResponse(Number(id))
    if (!result) return NextResponse.json({ error:'Răspuns inexistent.' }, { status:404 })
    const extension = /zip/.test(result.contentType) ? 'zip' : /json/.test(result.contentType) ? 'json' : /xml/.test(result.contentType) ? 'xml' : /pdf/.test(result.contentType) ? 'pdf' : 'bin'
    return new NextResponse(new Uint8Array(result.bytes), { headers:{ 'Content-Type':'application/octet-stream', 'Content-Disposition':`attachment; filename="raspuns-${id}.${extension}"`, 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' } })
  }
  return NextResponse.json(await integrationOverview(), { headers:{ 'Cache-Control':'private, no-store' } })
})
export const POST = accountingApi(async (req: NextRequest) => {
  try {
    if (Number(req.headers.get('content-length')) > 2_100_000) return NextResponse.json({ error:'Fișier prea mare.' }, { status:413 })
    const body = await req.json()
    if (body.operation === 'syncRegesNomenclature') return NextResponse.json(await syncRegesNomenclature(body))
    if (body.operation === 'configureReges') { await saveRegesConnection(body.credentials); return NextResponse.json({ message:'Conexiunea REGES a fost salvată pentru Elmont.' }) }
    if (body.operation === 'disconnectReges') { await disconnectReges(); return NextResponse.json({ message:'Conexiunea REGES a fost eliminată.' }) }
    return NextResponse.json(await exchangeWithInstitution(body))
  } catch (error) { return NextResponse.json({ error: error instanceof Error && error.name !== 'ZodError' ? error.message : 'Date invalide pentru integrare.' }, { status:400 }) }
})
