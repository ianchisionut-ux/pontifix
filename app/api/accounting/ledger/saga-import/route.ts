import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { accountingApi } from '@/lib/accounting/access'
import { importSagaJournalEntries,validateSagaJournalEntries } from '@/lib/accounting/ledger'
import { parseSagaJournalFile } from '@/lib/accounting/saga-journal-import'

async function POSTHandler(req:NextRequest){
  try{
    const form=await req.formData();const file=form.get('file');if(!(file instanceof File))return NextResponse.json({error:'Selectează fișierul exportat din SAGA.'},{status:400})
    if(file.size>10*1024*1024)return NextResponse.json({error:'Fișierul depășește limita de 10 MB.'},{status:400})
    const bytes=await file.arrayBuffer();const clone=new File([bytes],file.name,{type:file.type});const parsed=await parseSagaJournalFile(clone)
    const ledgerValidation=parsed.errors.length?{errors:[],duplicates:0}:await validateSagaJournalEntries(parsed.entries)
    const preview={total:parsed.entries.length,duplicates:ledgerValidation.duplicates,errors:[...parsed.errors,...ledgerValidation.errors],entries:parsed.entries.slice(0,50)}
    if(form.get('commit')!=='1')return NextResponse.json(preview)
    if(preview.errors.length)return NextResponse.json({error:'Corectează erorile din previzualizare înainte de import.',...preview},{status:400})
    const session=await auth();const result=await importSagaJournalEntries(parsed.entries,createHash('sha256').update(Buffer.from(bytes)).digest('hex'),session?.user?.email||'')
    return NextResponse.json({...result,errors:[]},{status:201})
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Importul SAGA a eșuat.'},{status:400})}
}
export const POST=accountingApi(POSTHandler)
