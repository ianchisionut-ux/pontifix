"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CloudUpload, Code2, RefreshCw, TriangleAlert } from "lucide-react";

type Validation = {
  valid: boolean;
  errors: string[];
  submission: null | { id: number; status: string; message: string; uploadId: string; submittedAt: string };
};

function statusMeta(status?: string) {
  if (status === "VALIDATED") return { color: "#16a34a", label: "Validată ANAF" };
  if (status === "REJECTED") return { color: "#dc2626", label: "Respinsă ANAF" };
  if (status === "ERROR") return { color: "#dc2626", label: "Eroare la trimitere" };
  if (status === "PROCESSING" || status === "UPLOADING") return { color: "#eab308", label: "În procesare ANAF" };
  return { color: "#eab308", label: "Netrimisă încă" };
}

export function EFacturaPanel({ invoiceId }: { invoiceId: number }) {
  const [data, setData] = useState<Validation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function load() {
    fetch(`/api/accounting/efactura/invoices/${invoiceId}/validate`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Statusul ANAF nu a putut fi încărcat.");
        setData({ ...result, errors: Array.isArray(result.errors) ? result.errors : [] });
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Statusul ANAF nu a putut fi încărcat."));
  }

  useEffect(load, [invoiceId]);

  async function send() {
    if (!confirm("Trimiți factura la ANAF în mediul configurat?")) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/accounting/efactura/invoices/${invoiceId}/send`, { method: "POST" });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) setError(result.error || "Transmiterea a eșuat.");
    load();
  }

  async function check() {
    if (!data?.submission) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/accounting/efactura/submissions/${data.submission.id}/status`, { method: "POST" });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) setError(result.error || "Verificarea a eșuat.");
    load();
  }

  const meta = statusMeta(data?.submission?.status);
  return (
    <div className="card ef-invoice-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="section-label">RO e-Factura</div>
          <div className="ef-validation">
            {data?.valid ? <><CheckCircle2 size={16}/> Verificarea preliminară a datelor a trecut</> : <><TriangleAlert size={16}/> Factura necesită completări</>}
          </div>
        </div>
        <span title={data?.submission?.message || meta.label} className="inline-flex items-center gap-2 text-xs font-semibold">
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: meta.color, boxShadow: `0 0 0 3px ${meta.color}22` }}/>
          {meta.label}
        </span>
      </div>
      {data && data.errors.length > 0 && <ul className="ef-errors">{data.errors.map((item) => <li key={item}>{item}</li>)}</ul>}
      {error && <div className="ref-error">{error}</div>}
      <p className="page-subtitle mt-3">Trimiterea este automată la emitere. Procesarea zilnică verifică răspunsurile și reîncearcă erorile temporare; butoanele rămân disponibile pentru control manual.</p>
      <div className="flex gap-2 flex-wrap mt-3">
        <a className="btn-secondary" href={`/api/accounting/efactura/invoices/${invoiceId}/xml`}><Code2 size={14}/>Descarcă XML</a>
        {(!data?.submission || ["REJECTED", "ERROR"].includes(data.submission.status)) && <button className="btn-primary" onClick={send} disabled={!data?.valid || busy}><CloudUpload size={14}/>{busy ? "Se procesează…" : "Retrimite la ANAF"}</button>}
        {data?.submission && ["PROCESSING", "UPLOADING"].includes(data.submission.status) && <button className="btn-secondary" onClick={check} disabled={busy}><RefreshCw size={14}/>Verifică status</button>}
      </div>
    </div>
  );
}