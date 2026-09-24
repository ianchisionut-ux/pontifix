import { NextResponse } from "next/server";
import { accountingApi } from "@/lib/accounting/access";
import { ready } from "@/lib/accounting/db";
export const GET = accountingApi(async () => {
  const pool = await ready();
  const { rows } = await pool.query(`SELECT i.id,i.series,i.number,c.name AS "clientName",i.currency,
    COALESCE(SUM(p.amount),0)::float8 AS remaining
    FROM invoices i JOIN clients c ON c.id=i."clientId" JOIN payments p ON p."invoiceId"=i.id
    WHERE i.status='stornoed' GROUP BY i.id,c.name HAVING SUM(p.amount)>0.009 ORDER BY i.id`);
  return NextResponse.json(rows);
});
