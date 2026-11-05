import { NextResponse } from 'next/server';
import { accountingApi } from '@/lib/accounting/access';
import { importReceivedMessage } from '@/lib/accounting/efactura-import';
export const maxDuration=120;
async function POSTHandler(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    const body=await request.json().catch(()=>({}));
    return NextResponse.json(await importReceivedMessage(id,body.reviewed));
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Importul a eșuat.'},{status:400})}
}
export const POST=accountingApi(POSTHandler);
