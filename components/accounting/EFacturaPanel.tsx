"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CloudUpload, Code2, Download, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";

type Submission = {
  id: number;
  status: string;
  message: string;
  uploadId: string;
  downloadId: string;
  submittedAt: string | null;
  checkedAt: string | null;
  retryable: number;
  attemptNumber: number;
};

type Validation = {
  valid: boolean;
  errors: string[];
  environment: "test" | "production";
  autoEfactura: boolean;
  submission: Submission | null;
};

function statusMeta(status?: string) {
  if (status === 'UNCERTAIN') return { color: '#dc2626', label: 'Rezultat necunoscut — verifică SPV; retrimitere blocată' };
  if (status === "VALIDATED") return { color: "#16a34a", label: "Validată de ANAF" };
  if (status === "REJECTED") return { color: "#dc2626", label: "Respinsă de ANAF" };
  if (status === "ERROR") return { color: "#dc2626", label: "Eroare la trimitere" };
  if (status === "PROCESSING") return { color: "#eab308", label: "În verificare la ANAF" };
  if (status === "UPLOADING") return { color: "#eab308", label: "Se încarcă la ANAF" };
  return { color: "#eab308", label: "Netrimisă încă" };
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Bucharest" }).format(new Date(value));
}

export function EFacturaPanel({ invoiceId }: { invoiceId: number }) {
  const [data, setData] = useState<Validation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    try {
      const response = await fetch(`/api/accounting/efactura/invoices/${invoiceId}/validate`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Statusul ANAF nu a putut fi încărcat.");
      setData({ ...result, errors: Array.isArray(result.errors) ? result.errors : [] });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Statusul ANAF nu a putut fi încărcat.");
    }
  }

  useEffect(() => { load(); }, [invoiceId]);

  async function runAction(url: string, fallback: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(url, { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anafEnvironment: data?.environment }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || fallback);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!data || !confirm(`Trimiți factura în ANAF ${data.environment === 'production' ? 'PRODUCȚIE (transmitere reală)' : 'TEST'}?`)) return;
    await runAction(`/api/accounting/efactura/invoices/${invoiceId}/send`, "Transmiterea a eșuat.");
  }

  async function check() {
    if (!data?.submission) return;
    await runAction(`/api/accounting/efactura/submissions/${data.submission.id}/status`, "Verificarea a eșuat.");
  }

  async function reconcile() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/accounting/efactura/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Sincronizarea SPV a eșuat.");
      await load();
      setNotice("Mesajele SPV au fost sincronizate. Compară factura cu registrul ANAF înainte de orice retrimitere.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sincronizarea SPV a eșuat.");
    } finally {
      setBusy(false);
    }
  }

  const submission = data?.submission;
  const meta = statusMeta(submission?.status);
  const canSend = !submission || ["REJECTED", "ERROR"].includes(submission.status);
  const canCheck = submission && ["UPLOADING", "PROCESSING", "VALIDATED"].includes(submission.status);

  return (
    <div id="e-factura" className="card ef-invoice-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="section-label">RO e-Factura</div>
          <div className="ef-validation">
            {data?.valid
              ? <><CheckCircle2 size={16}/> Verificarea preliminară a datelor a trecut</>
              : <><TriangleAlert size={16}/> Factura necesită completări</>}
          </div>
        </div>
        <span title={submission?.message || meta.label} className="ef-status-badge" style={{ "--ef-color": meta.color } as React.CSSProperties}>
          <span aria-hidden="true" />
          {meta.label}
        </span>
      </div>

      {data?.environment === "test" && (
        <div className="ef-safety-warning">
          <TriangleAlert size={17}/>
          <span><strong>Mediul ANAF Test este activ.</strong> Factura nu produce o transmitere fiscală reală până când mediul este schimbat în Producție și conexiunea SPV este refăcută.</span>
        </div>
      )}

      <div className="ef-safety-line">
        <ShieldCheck size={17}/>
        <span>{data?.autoEfactura ? "Trimitere la emitere numai cu confirmare. Facturile noi amânate sunt preluate automat din ziua următoare; statusul transmiterilor este reverificat zilnic." : "Trimiterea automată nu este activă pentru această factură."}</span>
      </div>

      {data && data.errors.length > 0 && <ul className="ef-errors">{data.errors.map((item) => <li key={item}>{item}</li>)}</ul>}
      {error && <div className="ref-error">{error}</div>}
      {notice && <div className="ef-success">{notice}</div>}

      {submission && (
        <div className="ef-meta-grid">
          <div><span>Status tehnic</span><strong>{submission.status}</strong></div>
          <div><span>ID transmitere intern</span><strong>{submission.id}</strong></div>
          <div><span>ID încărcare ANAF</span><strong>{submission.uploadId || "În așteptare"}</strong></div>
          <div><span>ID descărcare ANAF</span><strong>{submission.downloadId || "—"}</strong></div>
          <div><span>Încercarea</span><strong>#{submission.attemptNumber || 1}{submission.retryable ? " · se reîncearcă automat" : ""}</strong></div>
          <div><span>Trimisă la</span><strong>{formatDate(submission.submittedAt)}</strong></div>
          <div><span>Ultima verificare</span><strong>{formatDate(submission.checkedAt)}</strong></div>
        </div>
      )}

      {submission?.message && (
        <details className="ef-response-details">
          <summary>Răspuns tehnic ANAF</summary>
          <pre>{submission.message}</pre>
        </details>
      )}

      <p className="page-subtitle mt-3">
        Facturile cu erori temporare sunt reîncercate automat. O respingere ANAF necesită corectarea documentului și retransmitere manuală.
      </p>
      <div className="flex gap-2 flex-wrap mt-3">
        <a className="btn-secondary" href={`/api/accounting/efactura/invoices/${invoiceId}/xml`}><Code2 size={14}/>Descarcă XML</a>
        {canSend && <button className="btn-primary" onClick={send} disabled={!data?.valid || busy}><CloudUpload size={14}/>{busy ? "Se procesează…" : submission ? "Retrimite manual" : "Trimite acum în SPV"}</button>}
        {canCheck && <button className="btn-secondary" onClick={check} disabled={busy}><RefreshCw className={busy ? "ef-spin" : ""} size={14}/>Reverifică statusul ANAF</button>}
        {submission?.status === "UNCERTAIN" && <button className="btn-secondary" onClick={reconcile} disabled={busy}><RefreshCw className={busy ? "ef-spin" : ""} size={14}/>{busy ? "Se sincronizează…" : "Sincronizează registrul SPV"}</button>}
        {submission?.downloadId && <a className="btn-secondary" href={`/api/accounting/efactura/messages/${submission.downloadId}/download`}><Download size={14}/>Descarcă răspunsul ANAF</a>}
      </div>
    </div>
  );
}
