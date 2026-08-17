import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureInternalChatStorage } from '@/lib/ensure-internal-chat-storage'

const schema=z.object({displayName:z.string().trim().min(2).max(60)})
export async function PUT(request:NextRequest){
  const session=await auth();const businessId=(session as any)?.businessId as string|undefined;const userId=(session as any)?.userId as string|undefined
  if(!businessId||!userId)return NextResponse.json({error:'Neautorizat.'},{status:401})
  const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:'Numele trebuie să aibă între 2 și 60 de caractere.'},{status:400})
  await ensureInternalChatStorage()
  await prisma.$executeRaw`INSERT INTO "InternalChatProfile" ("userId","businessId","displayName","updatedAt") VALUES (${userId},${businessId},${parsed.data.displayName},CURRENT_TIMESTAMP) ON CONFLICT ("userId") DO UPDATE SET "displayName"=EXCLUDED."displayName","updatedAt"=CURRENT_TIMESTAMP WHERE "InternalChatProfile"."businessId"=${businessId}`
  return NextResponse.json({success:true,displayName:parsed.data.displayName})
}