import fs from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const FILES: Record<string, string> = {
  's1-elmont-stamp': 's1-elmont-stamp.png',
  's2-signature': 's2-signature.png',
  's3-signature': 's3-signature.png',
  's4-elmont-signed': 's4-elmont-signed.png',
  's5-verificator-stamp': 's5-verificator-stamp.png',
}

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const session = await auth()
  if (!(session as any)?.businessId) return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 })
  const { key } = await params
  const filename = FILES[key]
  if (!filename) return NextResponse.json({ error: 'Ștampilă inexistentă.' }, { status: 404 })
  const body = await fs.readFile(path.join(process.cwd(), 'assets', 'document-stamps', 'source', filename))
  return new Response(body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600' } })
}
