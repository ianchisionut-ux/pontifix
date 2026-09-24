import { backfillAccountingDocuments, getLedgerStats } from "@/lib/accounting/ledger";
import { LedgerWorkspace } from "@/components/accounting/LedgerWorkspace";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  await backfillAccountingDocuments();
  const raw = await getLedgerStats();
  const stats = {
    accounts: Number(raw.accounts || 0),
    entries: Number(raw.entries || 0),
    monthDebit: Number(raw.monthDebit || 0),
    closedPeriods: Number(raw.closedPeriods || 0),
  };
  return <LedgerWorkspace stats={stats} />;
}
