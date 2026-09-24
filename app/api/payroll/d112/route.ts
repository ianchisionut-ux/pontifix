import { NextRequest,NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { d112WorkingPaperCsv,getD112WorkingPaper } from '@/lib/payroll-d112'
import { canAccessAccounting } from '@/lib/accounting/permissions'

export async function GET(req:NextRequest){
  const session=await auth();const businessId=(session as any)?.businessId as string|undefined
  if(!businessId||!canAccessAccounting(session))return NextResponse.json({error:'Nu ai acces la datele fiscale Elmont.'},{status:403})
  try{
    const month=req.nextUrl.searchParams.get('month')||'';const report=await getD112WorkingPaper(businessId,month)
    if(req.nextUrl.searchParams.get('view')==='1')return NextResponse.json(report)
    return new NextResponse(d112WorkingPaperCsv(report),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="D112_verificare_${month}.csv"`,'Cache-Control':'private, no-store'}})
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Fișa D112 nu a putut fi generată.'},{status:400})}
}
