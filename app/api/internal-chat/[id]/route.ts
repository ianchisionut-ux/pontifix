import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureInternalChatStorage } from '@/lib/ensure-internal-chat-storage'

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){
  const session=await auth();const businessId=(session as any)?.businessId as string|undefined;const userId=(session as any)?.userId as string|undefined;const role=(session as any)?.role as string|undefined
  if(!businessId||!userId)return NextResponse.json({error:'Neautorizat.'},{status:401})
  await ensureInternalChatStorage();const {id}=await params
  const changed=role==='SUPER_ADMIN'
    ? Number(await prisma.$executeRaw`DELETE FROM "InternalChatMessage" WHERE "id"=${id} AND "businessId"=${businessId}`)
    : Number(await prisma.$executeRaw`DELETE FROM "InternalChatMessage" WHERE "id"=${id} AND "businessId"=${businessId} AND "senderId"=${userId}`)
  if(!changed)return NextResponse.json({error:'Mesaj inexistent sau nu ai dreptul să îl ștergi.'},{status:404})
  return NextResponse.json({success:true})
}