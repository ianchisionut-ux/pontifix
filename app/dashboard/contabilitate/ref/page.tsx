"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";

type RefRow = {
  id: number; type: "INCOME" | "EXPENSE"; date: string; documentType: string; documentNumber: string;
  explanation: string; grossAmount: number; vatAmount: number; netAmount: number; fiscalCategory: string;
  deductibilityPercent: number; fiscalAmount: number; source: "MANUAL" | "AUTO_PAYMENT";
};
type Summary = { totalIncome: number; taxableIncome: number; totalExpenses: number; deductibleExpenses: number; fiscalResult: number };
const emptySummary: Summary = { totalIncome: 0, taxableIncome: 0, totalExpenses: 0, deductibleExpenses: 0, fiscalResult: 0 };
const currentYear = new Date().getFullYear();
const money = (value: number) => value.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const categoryLabels: Record<string, string> = { TAXABLE_INCOME: "Venit impozabil", NON_TAXABLE_INCOME: "Venit neimpozabil", DEDUCTIBLE_EXPENSE: "Deductibilă integral", PARTIAL_EXPENSE: "Parțial deductibilă", NON_DEDUCTIBLE_EXPENSE: "Nedeductibilă" };

export default function RefPage() {
  const [year, setYear] = useState(currentYear);
  const [rows, setRows] = useState<RefRow[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [vatPayer, setVatPayer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ type: "EXPENSE", date: new Date().toISOString().slice(0, 10), documentType: "FACTURA", documentNumber: "", explanation: "", grossAmount: "", vatAmount: "0", fiscalCategory: "DEDUCTIBLE_EXPENSE", deductibilityPercent: "100", notes: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const response = await fetch(`/api/accounting/ref/transactions?year=${year}`);
    const data = await response.json();
    if (!response.ok) setError(data.error || "Registrul nu a putut fi încărcat.");
    else { setRows(data.transactions); setSummary(data.summary); setVatPayer(data.vatPayer); }
    setLoading(false);
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const fiscalPreview = useMemo(() => {
    const gross = Number(form.grossAmount || 0), vat = Number(form.vatAmount || 0), base = vatPayer ? gross - vat : gross;
    if (form.type === "INCOME") return form.fiscalCategory === "TAXABLE_INCOME" ? Math.max(0, base) : 0;
    if (form.fiscalCategory === "NON_DEDUCTIBLE_EXPENSE") return 0;
    return Math.max(0, base) * (form.fiscalCategory === "PARTIAL_EXPENSE" ? Number(form.deductibilityPercent || 0) : 100) / 100;
  }, [form, vatPayer]);

  function setType(type: "INCOME" | "EXPENSE") {
    setForm((value) => ({ ...value, type, fiscalCategory: type === "INCOME" ? "TAXABLE_INCOME" : "DEDUCTIBLE_EXPENSE", deductibilityPercent: "100" }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const response = await fetch("/api/accounting/ref/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json().catch(() => ({})); setSaving(false);
    if (!response.ok) { setError(data.error || "Poziția nu a putut fi salvată."); return; }
    setForm((value) => ({ ...value, documentNumber: "", explanation: "", grossAmount: "", vatAmount: "0", notes: "" }));
    await load();
  }
  async function remove(row: RefRow) {
    if (row.source !== "MANUAL" || !confirm("Ștergi această poziție din REF?")) return;
    const response = await fetch(`/api/accounting/ref/transactions/${row.id}`, { method: "DELETE" });
    if (!response.ok) { const data = await response.json().catch(() => ({})); setError(data.error || "Poziția nu a putut fi ștearsă."); return; }
    await load();
  }

  return <div>
    <div className="page-head">
      <div><div className="eyebrow">ANAF · evidență în sistem real</div><h2 className="page-title">Registrul de evidență fiscală</h2><p className="page-subtitle">Încasări și plăți efective, clasificate fiscal pentru anul selectat.</p></div>
      <div className="ref-actions"><select className="input ref-year" value={year} onChange={(event) => setYear(Number(event.target.value))}>{Array.from({ length: 7 }, (_, index) => currentYear - 5 + index).reverse().map((value) => <option key={value}>{value}</option>)}</select><a className="btn-secondary" href={`/api/accounting/ref/export/pdf?year=${year}`}><Download size={15}/>Export PDF</a></div>
    </div>
    <div className="ref-notice"><strong>Regulă de calcul:</strong> veniturile automate apar la data încasării, nu la emiterea facturii. {vatPayer ? "Firma este marcată plătitoare de TVA; baza fiscală exclude TVA." : "Firma este marcată neplătitoare de TVA; baza fiscală folosește suma brută."}</div>
    {error && <div className="ref-error">{error}</div>}
    <div className="ref-summary-grid">
      {[['Venituri încasate', summary.totalIncome, 'var(--cyan)'], ['Venituri impozabile', summary.taxableIncome, 'var(--emerald)'], ['Cheltuieli efectuate', summary.totalExpenses, 'var(--amber)'], ['Cheltuieli deductibile', summary.deductibleExpenses, 'var(--purple)'], ['Rezultat fiscal', summary.fiscalResult, summary.fiscalResult >= 0 ? 'var(--emerald)' : 'var(--red)']].map(([label, value, color]) => <div className="stat-card" style={{ '--accent': color } as React.CSSProperties} key={String(label)}><div className="stat-label">{label}</div><div className="stat-value">{money(Number(value))} RON</div></div>)}
    </div>
    <div className="ref-layout">
      <div><div className="section-label">Poziții REF · {year}</div><div className="card-table"><table className="ref-table"><thead><tr><th>Data</th><th>Document</th><th>Explicație</th><th>Categorie</th><th className="text-right">Venit fiscal</th><th className="text-right">Cheltuială fiscală</th><th></th></tr></thead><tbody>
        {loading ? <tr><td colSpan={7} className="empty-row">Se încarcă…</td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="empty-row">Nu există poziții pentru anul {year}.</td></tr> : rows.map((row) => <tr key={row.id}><td className="num">{row.date}</td><td><span className="doc-chip">{row.documentType} {row.documentNumber}</span>{row.source === "AUTO_PAYMENT" && <div className="ref-auto">automat din încasare</div>}</td><td>{row.explanation}</td><td><span className="badge badge-partial">{categoryLabels[row.fiscalCategory]}</span>{row.fiscalCategory === "PARTIAL_EXPENSE" && <div className="ref-auto">{row.deductibilityPercent}%</div>}</td><td className="text-right num">{row.type === "INCOME" ? money(row.fiscalAmount) : "—"}</td><td className="text-right num">{row.type === "EXPENSE" ? money(row.fiscalAmount) : "—"}</td><td>{row.source === "MANUAL" && <button type="button" className="link-danger" title="Șterge" onClick={() => remove(row)}><Trash2 size={14}/></button>}</td></tr>)}
      </tbody></table></div></div>
      <form className="card ref-form" onSubmit={submit}><div className="section-label"><Plus size={13}/>Adaugă poziție manuală</div><div className="ref-type-toggle"><button type="button" className={form.type === "INCOME" ? "active" : ""} onClick={() => setType("INCOME")}>Venit</button><button type="button" className={form.type === "EXPENSE" ? "active" : ""} onClick={() => setType("EXPENSE")}>Cheltuială</button></div>
        <label className="field-label">Data încasării/plății<input className="input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}/></label>
        <div className="ref-form-row"><label className="field-label">Document<select className="input" value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}><option value="FACTURA">Factură</option><option value="CHITANTA">Chitanță</option><option value="EXTRAS_BANCAR">Extras bancar</option><option value="BON_FISCAL">Bon fiscal</option><option value="ALTELE">Alt document</option></select></label><label className="field-label">Număr<input className="input" value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}/></label></div>
        <label className="field-label">Explicație<input className="input" required placeholder="Ex. servicii contabilitate" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })}/></label>
        <div className="ref-form-row"><label className="field-label">Sumă brută (RON)<input className="input" type="number" min="0.01" step="0.01" required value={form.grossAmount} onChange={(e) => setForm({ ...form, grossAmount: e.target.value })}/></label><label className="field-label">TVA inclus (RON)<input className="input" type="number" min="0" step="0.01" value={form.vatAmount} onChange={(e) => setForm({ ...form, vatAmount: e.target.value })}/></label></div>
        <label className="field-label">Categorie fiscală<select className="input" value={form.fiscalCategory} onChange={(e) => setForm({ ...form, fiscalCategory: e.target.value, deductibilityPercent: e.target.value === "PARTIAL_EXPENSE" ? "50" : "100" })}>{form.type === "INCOME" ? <><option value="TAXABLE_INCOME">Venit impozabil</option><option value="NON_TAXABLE_INCOME">Venit neimpozabil</option></> : <><option value="DEDUCTIBLE_EXPENSE">Deductibilă integral</option><option value="PARTIAL_EXPENSE">Parțial deductibilă</option><option value="NON_DEDUCTIBLE_EXPENSE">Nedeductibilă</option></>}</select></label>
        {form.fiscalCategory === "PARTIAL_EXPENSE" && <label className="field-label">Procent deductibil<input className="input" type="number" min="0" max="100" step="1" value={form.deductibilityPercent} onChange={(e) => setForm({ ...form, deductibilityPercent: e.target.value })}/></label>}
        <div className="ref-preview"><span>Valoare fiscală calculată</span><strong>{money(fiscalPreview)} RON</strong></div><button className="btn-primary" disabled={saving} type="submit">{saving ? "Se salvează…" : "Adaugă în registru"}</button>
      </form>
    </div>
  </div>;
}