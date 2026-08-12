import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { z } from 'zod'

const patchSchema = z.object({
  status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED']).optional(),
  reply: z.string().max(2000).optional(),
})

async function requireSuperAdmin() {
  const session = await auth()
  if (!session || !(session as any).isSuperAdmin) return null
  return session
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperAdmin()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })

  const data: any = { ...parsed.data }
  if (parsed.data.reply) data.repliedAt = new Date()

  const ticket = await prisma.supportTicket.update({ where: { id }, data })
  return NextResponse.json({ ticket })
}
