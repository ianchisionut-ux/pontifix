import type { Pool, PoolClient } from 'pg'

// Only recorded payments with their matching posted journal entry are copied.
// Finalizing a payroll run alone never creates cash expenses in REF.
export async function syncPaidPayrollToRef(executor:Pool|PoolClient, businessId:string, filter:{paymentId?:string;year?:number}={}) {
  if (!businessId) throw new Error('Firma plății salariale lipsește.')
  return executor.query(`INSERT INTO ref_transactions
    (type,date,"documentType","documentNumber",explanation,"grossAmount","vatAmount","netAmount",
     "fiscalCategory","deductibilityPercent","fiscalAmount",source,"payrollPaymentId",
     "vatCategoryCode","taxExemptionReason",notes)
    SELECT 'EXPENSE',p."paidAt",'SALARII',e."documentNumber",e.description,
      ROUND(p.amount::numeric,2),0,ROUND(p.amount::numeric,2),'DEDUCTIBLE_EXPENSE',100,ROUND(p.amount::numeric,2),
      'AUTO_PAYROLL',p.id,'O','Plată salarială în afara sferei TVA.',
      'Plată salarială confirmată; stat ' || r.month
    FROM public."PayrollPayment" p JOIN public."PayrollRun" r ON r.id=p."payrollRunId"
    JOIN journal_entries e ON e.id=p."journalEntryId" AND e."sourceType"='PAYROLL_PAYMENT'
      AND e."sourceKey"=r.id || ':' || p.type::text AND e.status='POSTED'
    WHERE r."businessId"=$1 AND r.status='FINALIZED' AND p.amount>0
      AND ($2::text IS NULL OR p.id=$2)
      AND ($3::int IS NULL OR EXTRACT(YEAR FROM p."paidAt")=$3)
      AND NOT EXISTS (SELECT 1 FROM ref_transactions m WHERE m.source='MANUAL' AND m.type='EXPENSE'
        AND m."documentNumber"=e."documentNumber" AND m."documentType"='SALARII'
        AND m.date=p."paidAt" AND m."grossAmount"=ROUND(p.amount::numeric,2))
    ON CONFLICT ("payrollPaymentId") WHERE "payrollPaymentId" IS NOT NULL DO NOTHING`,
    [businessId,filter.paymentId || null,filter.year ?? null])
}
