"use client";

import { useState } from "react";
import { Download, ShieldCheck } from "lucide-react";

type Code = "D300" | "D390" | "D394";
type Props = { year: number; month: number; ready: Record<Code, boolean> };

export function SoftJActions({ year, month, ready }: Props) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState(false);
  const [d394Confirmed, setD394Confirmed] = useState(false);

  async function run(type: Code, mode: "validate" | "pdf") {
    setBusy(`${type}-${mode}`);
    setMessage("");
    setFailure(false);
    try {
      const response = await fetch("/api/accounting/declarations/softj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, mode, year, month, confirmed: type === "D394" && d394Confirmed }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Validarea Soft J a eșuat.");
      }
      if (mode === "validate") {
        const result = await response.json();
        setMessage(`${type}: ${result.message}`);
      } else {
        const blob = await response.blob();
        if (blob.type !== "application/pdf") throw new Error("Serverul nu a returnat un PDF.");
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${type}_${year}_${String(month).padStart(2, "0")}_SoftJ.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setMessage(`${type}: PDF-ul validat a fost descărcat pe acest PC.`);
      }
    } catch (error) {
      setFailure(true);
      setMessage(error instanceof Error ? error.message : "Soft J nu a putut procesa declarația.");
    } finally {
      setBusy("");
    }
  }

  return <section className="card p-4 mb-5" aria-label="Validare Soft J ANAF">
    <h3 className="font-bold">Soft J ANAF</h3>
    <p>Validează XML-ul și descarcă PDF-ul oficial pe acest calculator. Declarația nu este semnată sau depusă prin acest pas.</p>
    {(["D300", "D390", "D394"] as const).map(type => <div key={type} className="flex flex-wrap items-center gap-2 py-2 border-b border-slate-100 last:border-0">
      <strong className="min-w-14">{type}</strong>
      <button className="btn-secondary" disabled={!ready[type] || Boolean(busy) || (type === "D394" && !d394Confirmed)} onClick={() => run(type, "validate")}><ShieldCheck size={14} />{busy === `${type}-validate` ? "Se validează…" : "Validează"}</button>
      <button className="btn-secondary" disabled={!ready[type] || Boolean(busy) || (type === "D394" && !d394Confirmed)} onClick={() => run(type, "pdf")}><Download size={14} />{busy === `${type}-pdf` ? "Se generează…" : "PDF oficial"}</button>
      {!ready[type] && <span className="text-sm text-slate-500">Rezolvă verificările declarației pentru a activa Soft J.</span>}
    </div>)}
    <label className="field-label flex items-center gap-2 mt-2"><input type="checkbox" checked={d394Confirmed} onChange={event => setD394Confirmed(event.target.checked)} />Confirm domeniul limitat de export D394 afișat în această pagină.</label>
    {message && <div className={failure ? "ref-error" : "ref-notice"} role="status">{message}</div>}
  </section>;
}
