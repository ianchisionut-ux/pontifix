import React from 'react'
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensurePayrollSchema } from '@/lib/payroll-storage'
import { PayslipPdf } from '@/components/payroll/PayslipPdf'

export async function GET(req:NextRequest){
  const session=await auth()
  const businessId=(session as any)?.businessId as string|undefined
  if(!businessId||(session as any)?.role==='STAFF')return NextResponse.json({error:'Neautorizat'},{status:401})
  const lineId=req.nextUrl.searchParams.get('lineId')||''
  await ensurePayrollSchema()
  const line=await prisma.payrollLine.findFirst({where:{id:lineId,payrollRun:{businessId,status:'FINALIZED'}},include:{employee:true,payrollRun:{include:{business:true}}}})
  if(!line)return NextResponse.json({error:'Fluturașul există numai pentru un stat finalizat.'},{status:404})
  const element=React.createElement(PayslipPdf,{business:{name:line.payrollRun.business.name,address:line.payrollRun.business.address},employee:line.employee,run:{month:line.payrollRun.month},line})
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer=await renderToBuffer(element as any)
  const employee=`${line.employee.lastName}_${line.employee.firstName}`.replace(/[^a-zA-Z0-9_-]/g,'_')
  return new NextResponse(buffer as unknown as BodyInit,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="Fluturas_${employee}_${line.payrollRun.month}.pdf"`,'Cache-Control':'private, no-store'}})
}
