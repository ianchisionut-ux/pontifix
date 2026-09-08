"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/accounting/StatusBadge";
import { EFacturaPanel } from "@/components/accounting/EFacturaPanel";
import { InvoiceCorrection } from "@/components/accounting/InvoiceCorrection";
import { ArrowLeft, Download, Trash2, Receipt as ReceiptIcon, RotateCcw } from "lucide-react";
import { bucharestDate } from "@/lib/accounting/date";

type FullInvoice = {
  invoice: {
    id: number;
    series: string;
    number: number;
    issueDate: string;
    status: string;
    total: number;
    subtotal: number;
    vatTotal: number;
    paidAmount: number;
    invoiceType: "STANDARD" | "STORNO";
    originalInvoiceId: number | null;
    stornoReason: string;
  };
  items: { id: number; description: string; um: string; qty: number; unitPrice: number; vatRate: number; valoare: number; vatValue: number }[];
  client: { id: number; name: string; cif: string };
  company: { name: string };
  user: { id: number; name: string; role: string } | null;
  receipts: { id: number; series: string; number: number; issueDate: string; amount: number }[];
  payments: { id: number; amount: number; date: string; method: string }[];
  eFacturaSubmission: null | { status: string; uploadId: string };
};

function fmt(n: number) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<FullInvoice | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState(bucharestDate());
  const [payMethod, setPayMethod] = useState("numerar");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);

  function load() {
    fetch(`/api/accounting/invoices/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setPayAmount(Math.max(0, d.invoice.total - d.invoice.paidAmount));
      });
  }
  useEffect(load, [id]);

  async function addPayment() {
    setPaymentBusy(true);
    try {
      const response = await fetch(`/api/accounting/invoices/${id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: payAmount, date: payDate, method: payMethod }),
      });
      const result = await response.json();
      if (!response.ok) return alert(result.error || "Plata nu a putut fi înregistrată.");
      load();
    } finally {
      setPaymentBusy(false);
    }
  }

  async function generateReceipt() {
    if (!data) return;
    const cashPaid = data.payments
      .filter((payment) => payment.method.toLowerCase() === "numerar" || payment.method.toLowerCase() === "cash")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const receipted = data.receipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0);
    const amount = Math.round((cashPaid - receipted) * 100) / 100;
    if (amount <= 0) return alert("Înregistrează mai întâi o plată în numerar. Chitanța se emite numai pentru suma încasată.");
    setReceiptBusy(true);
    try {
      const response = await fetch(`/api/accounting/invoices/${id}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, issueDate: payDate }),
      });
      const result = await response.json();
      if (!response.ok) return alert(result.error || "Chitanța nu a putut fi emisă.");
      load();
    } finally {
      setReceiptBusy(false);
    }
  }

  async function removeInvoice() {
    if (!data) return;
    const relationWarning = data.invoice.invoiceType === "STORNO"
      ? " Factura inițială va redeveni activă."
      : data.invoice.status === "stornoed" ? " Se va șterge și factura storno legată." : "";
    if (!confirm(`Ștergi definitiv această factură?${relationWarning}`)) return;
    const response = await fetch(`/api/accounting/invoices/${id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) return alert(result.error || "Factura nu a putut fi ștearsă.");
    router.push("/dashboard/contabilitate/invoices");
  }

  if (!data) return <div style={{ color: "var(--text-faint)" }}>Se incarca...</div>;
  const { invoice, items, client, user, receipts, payments } = data;
  const rest = invoice.total - invoice.paidAmount;
  const cashPaid = payments
    .filter((payment) => payment.method.toLowerCase() === "numerar" || payment.method.toLowerCase() === "cash")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const receiptedAmount = receipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0);
  const receiptAvailable = Math.max(0, Math.round((cashPaid - receiptedAmount) * 100) / 100);
  const paymentDisabledReason = rest <= 0 ? "Factura este achitată integral." : payAmount <= 0 ? "Introdu o sumă mai mare decât 0." : "";
  const receiptDisabledReason = receiptAvailable <= 0 ? "Nu există o plată în numerar fără chitanță." : "";
  const financialLocked = invoice.invoiceType === "STORNO" || ["storno", "stornoed", "canceled"].includes(invoice.status);
  const canStorno = invoice.invoiceType !== "STORNO" && !financialLocked;
  const anafLocked = Boolean(data.eFacturaSubmission && (data.eFacturaSubmission.uploadId || ["UPLOADING", "PROCESSING", "VALIDATED", "REJECTED"].includes(data.eFacturaSubmission.status)));

  return (
    <div>
      <Link href="/dashboard/contabilitate/invoices" className="btn-secondary mb-4 inline-flex items-center gap-2">
        <ArrowLeft size={16} /> Înapoi la facturi
      </Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">Factura</div>
          <h1 className="page-title">
            <span className="doc-chip" style={{ fontSize: 18, padding: "5px 12px" }}>
              {invoice.series} {String(invoice.number).padStart(4, "0")}
            </span>
          </h1>
          <p className="page-subtitle">
            {client.name} &middot; {new Date(invoice.issueDate).toLocaleDateString("ro-RO")}
            {user && <> &middot; intocmita de {user.name}</>}
          </p>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <div className="flex gap-3 mb-6">
        <a href={`/api/accounting/invoices/${id}/pdf`} download className="btn-primary">
          <Download size={15} /> Descarca factura (PDF)
        </a>
        {canStorno && <a href={`/dashboard/contabilitate/invoices/storno?invoice=${id}`} className="btn-secondary">
          <RotateCcw size={14} /> Stornează factura
        </a>}
        {!anafLocked && <button onClick={removeInvoice} className="btn-danger">
          <Trash2 size={14} /> Sterge factura
        </button>}
        {anafLocked && <span className="ef-delete-lock">Protejată ANAF · corecțiile se fac prin storno</span>}
      </div>

      <EFacturaPanel invoiceId={Number(id)} />
      {!financialLocked && <InvoiceCorrection invoiceId={Number(id)} />}

      <div className="card-table mb-6">
        <table>
          <thead>
            <tr>
              <th>Denumire</th>
              <th>U.M.</th>
              <th className="text-right">Cant.</th>
              <th className="text-right">Pret</th>
              <th className="text-right">TVA%</th>
              <th className="text-right">Valoare</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td>{it.description}</td>
                <td>{it.um}</td>
                <td className="text-right num">{it.qty}</td>
                <td className="text-right num">{fmt(it.unitPrice)}</td>
                <td className="text-right num">{it.vatRate}%</td>
                <td className="text-right num">{fmt(it.valoare)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-8">
        <div style={{ width: 260 }} className="text-sm space-y-1">
          <div className="flex justify-between" style={{ color: "var(--text-dim)" }}>
            <span>Subtotal</span>
            <span className="num">{fmt(invoice.subtotal)} RON</span>
          </div>
          <div className="flex justify-between" style={{ color: "var(--text-dim)" }}>
            <span>TVA</span>
            <span className="num">{fmt(invoice.vatTotal)} RON</span>
          </div>
          <div
            className="flex justify-between font-bold pt-2"
            style={{ borderTop: "1px solid var(--border-soft)", fontSize: 16 }}
          >
            <span>Total</span>
            <span className="num" style={{ color: "var(--cyan-strong)" }}>
              {fmt(invoice.total)} RON
            </span>
          </div>
          <div className="flex justify-between" style={{ color: "var(--text-dim)" }}>
            <span>Incasat</span>
            <span className="num">{fmt(invoice.paidAmount)} RON</span>
          </div>
          <div className="flex justify-between font-semibold" style={{ color: "var(--amber)" }}>
            <span>Rest de plata</span>
            <span className="num">{financialLocked ? "—" : `${fmt(Math.max(0, rest))} RON`}</span>
          </div>
        </div>
      </div>

      {financialLocked && <div className="card mb-6"><div className="section-label">Document fără încasare</div><p className="text-sm text-slate-500">{invoice.invoiceType === "STORNO" ? `Aceasta este factura storno pentru documentul inițial. ${invoice.stornoReason || ""}` : "Factura a fost stornată; încasările și chitanțele sunt blocate."}</p></div>}
      {!financialLocked && <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="section-label">Inregistreaza o plata</div>
          <div className="space-y-2">
            <div>
              <label className="field-label">Suma</label>
              <input type="number" min="0.01" max={Math.max(0, rest)} step="0.01" className="input" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
            </div>
            <div>
              <label className="field-label">Data</label>
              <input type="date" className="input" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Metoda</label>
              <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="numerar">Numerar</option>
                <option value="card">Card</option>
                <option value="transfer">Transfer bancar</option>
              </select>
            </div>
            <button title={paymentDisabledReason} onClick={addPayment} disabled={Boolean(paymentDisabledReason) || paymentBusy} className="btn-primary mt-2 disabled:cursor-not-allowed disabled:opacity-50">
              {paymentBusy ? "Se înregistrează…" : "Adaugă plata"}
            </button>
            {paymentDisabledReason && <p className="text-xs" style={{ color: "var(--text-faint)" }}>{paymentDisabledReason}</p>}
          </div>
          {payments.length > 0 && (
            <div className="mt-4 text-xs space-y-1">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between pt-1"
                  style={{ borderTop: "1px solid var(--border-soft)", color: "var(--text-dim)" }}
                >
                  <span>
                    {new Date(p.date).toLocaleDateString("ro-RO")} &middot; {p.method}
                  </span>
                  <span className="num">{fmt(p.amount)} RON</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-label">Chitante</div>
          <button title={receiptDisabledReason} onClick={generateReceipt} disabled={Boolean(receiptDisabledReason) || receiptBusy} className="btn-primary mb-2 disabled:cursor-not-allowed disabled:opacity-50">
            <ReceiptIcon size={14} /> {receiptBusy ? "Se generează…" : `Generează chitanță · ${fmt(receiptAvailable)} RON`}
          </button>
          {receiptDisabledReason && <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>{receiptDisabledReason}</p>}
          <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>Chitanța acoperă numai plățile în numerar deja înregistrate și nu poate fi emisă de două ori pentru aceeași sumă.</p>
          <div className="space-y-2">
            {receipts.length === 0 && <p className="text-xs" style={{ color: "var(--text-faint)" }}>Nicio chitanta emisa inca.</p>}
            {receipts.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between text-sm pt-2"
                style={{ borderTop: "1px solid var(--border-soft)" }}
              >
                <span className="doc-chip">
                  {r.series} {String(r.number).padStart(4, "0")}
                </span>
                <span className="num">{fmt(r.amount)} RON</span>
                <a href={`/api/accounting/receipts/${r.id}/pdf`} download className="link-action">
                  descarca PDF
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>}
    </div>
  );
}
