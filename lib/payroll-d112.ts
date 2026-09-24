import { prisma } from './prisma'
import { ensurePayrollSchema } from './payroll-storage'
import { ready } from './accounting/db'

function validCnp(value:string){
  if(!/^\d{13}$/.test(value))return false
  const control='279146358279';let sum=0;for(let index=0;index<12;index++)sum+=Number(value[index])*Number(control[index])
  const digit=sum%11===10?1:sum%11
  return digit===Number(value[12])
}

export async function getD112WorkingPaper(businessId:string,month:string){
  await ensurePayrollSchema()
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Luna D112 nu este validă.')
  const pool=await ready()
  const [run,companyResult,settingsResult]=await Promise.all([
    prisma.payrollRun.findUnique({where:{businessId_month:{businessId,month}},include:{lines:{include:{employee:true},orderBy:{employee:{lastName:'asc'}}}}}),
    pool.query(`SELECT name,cif,address FROM company WHERE id=1`),
    pool.query(`SELECT "declarantLastName","declarantFirstName","declarantFunction",caen FROM tax_declaration_settings WHERE id=1`),
  ])
  const company=companyResult.rows[0]||{},settings=settingsResult.rows[0]||{}
  const blockers:string[]=[]
  if(!run)blockers.push('Statul de salarii nu a fost generat.')
  else if(run.status!=='FINALIZED')blockers.push('Statul de salarii nu este finalizat.')
  if(month<'2026-07')blockers.push('Structura D112 disponibilă în aplicație este documentată pentru perioade începând cu 07/2026.')
  const cif=String(company.cif||'').replace(/^RO/i,'').replace(/\D/g,'')
  if(!/^\d{2,10}$/.test(cif)||!String(company.name||'').trim())blockers.push('Denumirea sau CUI-ul firmei sunt incomplete în configurarea contabilă.')
  if(!/^\d{4}$/.test(String(settings.caen||'')))blockers.push('Codul CAEN de 4 cifre lipsește din profilul fiscal.')
  if(!String(settings.declarantLastName||'').trim()||!String(settings.declarantFirstName||'').trim()||!String(settings.declarantFunction||'').trim())blockers.push('Datele declarantului sunt incomplete în Declarații fiscale.')
  for(const line of run?.lines||[]){
    const name=`${line.employee.lastName} ${line.employee.firstName}`
    if(!validCnp(line.employee.cnp||''))blockers.push(`${name}: CNP lipsă sau invalid.`)
    if(!line.employee.contractNumber||!line.employee.contractDate)blockers.push(`${name}: numărul sau data contractului lipsesc.`)
    if(line.medicalDays>0)blockers.push(`${name}: concediul medical necesită certificatul și defalcarea indemnizației înainte de D112.`)
    if(line.grossIncome<=0)blockers.push(`${name}: venitul brut este zero.`)
  }
  const rows=(run?.lines||[]).map(line=>({
    employee:`${line.employee.lastName} ${line.employee.firstName}`,cnp:line.employee.cnp||'',contractNumber:line.employee.contractNumber||'',
    contractDate:line.employee.contractDate?.toISOString().slice(0,10)||'',workedDays:line.workedDays,vacationDays:line.vacationDays,medicalDays:line.medicalDays,
    grossIncome:line.grossIncome,cas:line.cas,cass:line.cass,incomeTax:line.incomeTax,netSalary:line.netSalary,cam:line.cam,
  }))
  return {month,officialVersion:month>='2026-07'?'D112_A7.2.6-v7-07/2026':'NEIMPLEMENTAT',company:{name:String(company.name||''),cif,caen:String(settings.caen||'')},ready:blockers.length===0,blockers,rows}
}

export function d112WorkingPaperCsv(report:Awaited<ReturnType<typeof getD112WorkingPaper>>){
  const quote=(value:unknown)=>`"${String(value??'').replace(/"/g,'""')}"`
  const lines=[['STARE',report.ready?'PREGATIT PENTRU VALIDARE SOFT J':'BLOCAT'],['PERIOADA',report.month],['VERSIUNE_REFERINTA',report.officialVersion],['FIRMA',report.company.name],['CUI',report.company.cif],['CAEN',report.company.caen],...report.blockers.map(item=>['BLOCAJ',item]),[],['Salariat','CNP','Contract','Data contract','Zile lucrate','CO','CM','Brut','CAS','CASS','Impozit','Net','CAM'],...report.rows.map(row=>[row.employee,row.cnp,row.contractNumber,row.contractDate,row.workedDays,row.vacationDays,row.medicalDays,row.grossIncome,row.cas,row.cass,row.incomeTax,row.netSalary,row.cam])]
  return '\uFEFF'+lines.map(row=>row.map(quote).join(';')).join('\r\n')
}
