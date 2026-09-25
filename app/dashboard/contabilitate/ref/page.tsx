"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { VAT_REGIME_LABELS, VAT_REGIME_OPTIONS, calculateIncludedVat, defaultVatRegimeReason, suggestVatRegime, vatRatesForDate, vatRegimeNeedsReason, type VatRegimeCode } from "@/lib/accounting/vat-regime";

type RefRow = {
  id: number; type: "INCOME" | "EXPENSE"; date: string; documentType: string; documentNumber: string;
  explanation: string; grossAmount: number; vatAmount: number; vatRate:number|null; vatCategoryCode:VatRegimeCode; taxExemptionReasonCode:string; taxExemptionReason:string; netAmount: number; fiscalCategory: string;
  deductibilityPercent: number; fiscalAmount: number; source: "MANUAL" | "AUTO_PAYMENT";
  partnerName: string; partnerCif: string; partnerCountryCode: string; partnerVatPayer:number;
  partnerRegCom:string; partnerAddress:string; partnerCounty:string; partnerCity:string; partnerPostalCode:string; partnerPhone:string; partnerRegistrationStatus:string; partnerInactive:number;
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
  const [anafLoading, setAnafLoading] = useState(false);
  const [anafNotice, setAnafNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ type: "EXPENSE" as "INCOME" | "EXPENSE", date: new Date().toISOString().slice(0, 10), documentType: "FACTURA", documentNumber: "", explanation: "", grossAmount: "", vatAmount: "0", vatRate:"21", vatCategoryOverride:"" as "" | VatRegimeCode, taxExemptionReasonCode:"", taxExemptionReason:"", fiscalCategory: "DEDUCTIBLE_EXPENSE", deductibilityPercent: "100", notes: "", partnerName: "", partnerCif: "", partnerCountryCode: "RO",partnerVatPayer:"1", partnerRegCom:"",partnerAddress:"",partnerCounty:"",partnerCity:"",partnerPostalCode:"",partnerPhone:"",partnerRegistrationStatus:"",partnerInactive:0 });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const response = await fetch(`/api/accounting/ref/transactions?year=${year}`);
    const data = await response.json();
    if (!response.ok) setError(data.error || "Registrul nu a putut fi încărcat.");
    else { setRows(data.transactions); setSummary(data.summary); setVatPayer(data.vatPayer); }
    setLoading(false);
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const domesticNonVatSupplier = form.type === "EXPENSE" && form.partnerCountryCode.toUpperCase() === "RO" && form.partnerVatPayer === "0";
  const availableVatRates = vatRatesForDate(form.date);
  const suggestedVatCategory = suggestVatRegime({ type: form.type, companyVatPayer: vatPayer, partnerVatPayer: domesticNonVatSupplier ? false : undefined, vatAmount: Number(form.vatAmount || 0), vatRate: Number(form.vatRate || 0) });
  const effectiveVatCategory = form.vatCategoryOverride || suggestedVatCategory;
  const effectiveVatReason = form.taxExemptionReason || defaultVatRegimeReason(effectiveVatCategory);

  function includedVat(grossAmount: string, vatRate: string) {
    return String(calculateIncludedVat(Number(grossAmount || 0), Number(vatRate || 0)));
  }

  function setGrossAmount(grossAmount: string) {
    setForm((value) => ({
      ...value,
      grossAmount,
      vatAmount: effectiveVatCategory === "S" ? includedVat(grossAmount, value.vatRate) : "0",
    }));
  }

  function setVatRate(vatRate: string) {
    setForm((value) => ({
      ...value,
      vatRate,
      vatAmount: effectiveVatCategory === "S" ? includedVat(value.grossAmount, vatRate) : "0",
    }));
  }

  function setDocumentDate(date: string) {
    setForm((value) => {
      const rates = vatRatesForDate(date);
      const vatRate = rates.includes(Number(value.vatRate)) ? value.vatRate : String(rates[0]);
      const nonVatSupplier = value.type === "EXPENSE" && value.partnerCountryCode.toUpperCase() === "RO" && value.partnerVatPayer === "0";
      const regime = value.vatCategoryOverride || suggestVatRegime({ type: value.type, companyVatPayer: vatPayer, partnerVatPayer: nonVatSupplier ? false : undefined, vatRate: Number(vatRate) });
      return { ...value, date, vatRate, vatAmount: regime === "S" ? includedVat(value.grossAmount, vatRate) : "0" };
    });
  }

  function setPartnerVatStatus(partnerVatPayer: string) {
    setForm((value) => {
      const nonVatSupplier = value.type === "EXPENSE" && value.partnerCountryCode.toUpperCase() === "RO" && partnerVatPayer === "0";
      return { ...value, partnerVatPayer, vatCategoryOverride: "", vatAmount: nonVatSupplier ? "0" : includedVat(value.grossAmount, value.vatRate) };
    });
  }

  const fiscalPreview = useMemo(() => {
    const gross = Number(form.grossAmount || 0), vat = Number(form.vatAmount || 0), base = vatPayer ? gross - vat : gross;
    if (form.type === "INCOME") return form.fiscalCategory === "TAXABLE_INCOME" ? Math.max(0, base) : 0;
    if (form.fiscalCategory === "NON_DEDUCTIBLE_EXPENSE") return 0;
    return Math.max(0, base) * (form.fiscalCategory === "PARTIAL_EXPENSE" ? Number(form.deductibilityPercent || 0) : 100) / 100;
  }, [form, vatPayer]);

  function setType(type: "INCOME" | "EXPENSE") {
    setForm((value) => ({ ...value, type, fiscalCategory: type === "INCOME" ? "TAXABLE_INCOME" : "DEDUCTIBLE_EXPENSE", deductibilityPercent: "100", vatCategoryOverride: "", taxExemptionReasonCode: "", taxExemptionReason: "" })); setAnafNotice(null);
  }
  async function lookupAnaf() {
    const cui = form.partnerCif.replace(/\D/g, "");
    if (!/^\d{2,10}$/.test(cui)) { setAnafNotice({ ok:false, text:"Introdu un CUI valid (2-10 cifre)." }); return; }
    setAnafLoading(true); setAnafNotice(null);
    try {
      const response = await fetch(`/api/accounting/anaf-company?cui=${encodeURIComponent(cui)}`);
      const data = await response.json();
      if (!response.ok) { setAnafNotice({ ok:false, text:data.error || "Firma nu a fost găsită." }); return; }
      const company = data.company;
      setForm((value) => { const countryCode=company.countryCode || "RO", partnerVatPayer=String(company.vatPayer ? 1 : 0), nonVatSupplier=value.type==="EXPENSE"&&countryCode.toUpperCase()==="RO"&&partnerVatPayer==="0"; return ({ ...value, partnerName:company.name || "", partnerCif:company.cif || cui, partnerRegCom:company.regCom || "", partnerAddress:company.address || "", partnerCounty:company.judet || "", partnerCity:company.city || "", partnerPostalCode:company.postalCode || "", partnerPhone:company.phone || "", partnerCountryCode:countryCode, partnerVatPayer, vatCategoryOverride:"", vatAmount:nonVatSupplier?"0":includedVat(value.grossAmount,value.vatRate), partnerRegistrationStatus:company.registrationStatus || "", partnerInactive:company.inactive ? 1 : 0 }); });
      setAnafNotice({ ok:!company.inactive, text:company.inactive ? "Firma a fost găsită, dar figurează inactivă fiscal." : "Datele partenerului au fost completate din registrul ANAF." });
    } catch { setAnafNotice({ ok:false, text:"Serviciul ANAF nu răspunde. Datele pot fi completate manual." }); }
    finally { setAnafLoading(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const response = await fetch("/api/accounting/ref/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({...form,vatCategoryCode:effectiveVatCategory,taxExemptionReason:effectiveVatReason,vatRate:Number(form.vatAmount)>0?Number(form.vatRate):null}) });
    const data = await response.json().catch(() => ({})); setSaving(false);
    if (!response.ok) { setError(data.error || "Poziția nu a putut fi salvată."); return; }
    setForm((value) => ({ ...value, documentNumber: "", explanation: "", grossAmount: "", vatAmount: "0", vatCategoryOverride:"", taxExemptionReasonCode:"", taxExemptionReason:"", notes: "", partnerName: "", partnerCif: "", partnerRegCom:"",partnerAddress:"",partnerCounty:"",partnerCity:"",partnerPostalCode:"",partnerPhone:"",partnerRegistrationStatus:"",partnerInactive:0 })); setAnafNotice(null);
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
        {loading ? <tr><td colSpan={7} className="empty-row">Se încarcă…</td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="empty-row">Nu există poziții pentru anul {year}.</td></tr> : rows.map((row) => <tr key={row.id}><td className="num">{row.date}</td><td><span className="doc-chip">{row.documentType} {row.documentNumber}</span>{row.source === "AUTO_PAYMENT" && <div className="ref-auto">automat din încasare</div>}</td><td>{row.explanation}{row.partnerName && <div className="ref-auto">{row.type === "EXPENSE" ? "Furnizor" : "Client"}: {row.partnerName}{row.partnerCif ? ` · ${row.partnerCif}` : ""}</div>}</td><td><span className="badge badge-partial">{categoryLabels[row.fiscalCategory]}</span><div className="ref-auto">TVA: {VAT_REGIME_LABELS[row.vatCategoryCode] || row.vatCategoryCode}</div>{row.fiscalCategory === "PARTIAL_EXPENSE" && <div className="ref-auto">{row.deductibilityPercent}%</div>}</td><td className="text-right num">{row.type === "INCOME" ? money(row.fiscalAmount) : "—"}</td><td className="text-right num">{row.type === "EXPENSE" ? money(row.fiscalAmount) : "—"}</td><td>{row.source === "MANUAL" && <button type="button" className="link-danger" title="Șterge" onClick={() => remove(row)}><Trash2 size={14}/></button>}</td></tr>)}
      </tbody></table></div></div>
      <form className="card ref-form" onSubmit={submit}><div className="section-label"><Plus size={13}/>Adaugă poziție manuală</div><div className="ref-type-toggle"><button type="button" className={form.type === "INCOME" ? "active" : ""} onClick={() => setType("INCOME")}>Venit</button><button type="button" className={form.type === "EXPENSE" ? "active" : ""} onClick={() => setType("EXPENSE")}>Cheltuială</button></div>
        <label className="field-label">Data încasării/plății<input className="input" type="date" required value={form.date} onChange={(e) => setDocumentDate(e.target.value)}/></label>
        <div className="ref-form-row"><label className="field-label">Document<select className="input" value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}><option value="FACTURA">Factură</option><option value="CHITANTA">Chitanță</option><option value="EXTRAS_BANCAR">Extras bancar</option><option value="BON_FISCAL">Bon fiscal</option><option value="ALTELE">Alt document</option></select></label><label className="field-label">Număr<input className="input" value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}/></label></div>
        <label className="field-label">Explicație<input className="input" required placeholder="Ex. servicii contabilitate" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })}/></label>
        <div className="ref-partner-box"><div className="section-label">{form.type === "EXPENSE" ? "Furnizor" : "Client / plătitor"}</div><label className="field-label">CUI / cod TVA<div className="ref-cui-lookup"><input className="input" placeholder="RO12345678" value={form.partnerCif} onChange={(e) => { setForm({ ...form, partnerCif: e.target.value.toUpperCase() }); setAnafNotice(null); }} onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();void lookupAnaf();}}}/><button type="button" className="btn-secondary" disabled={anafLoading} onClick={()=>void lookupAnaf()}>{anafLoading?<RefreshCw size={14} className="ef-spin"/>:<Search size={14}/>} {anafLoading?"Se caută":"Caută ANAF"}</button></div></label>{anafNotice&&<div className={anafNotice.ok?"ref-anaf-ok":"ref-error"}>{anafNotice.text}</div>}<label className="field-label">Denumire<input className="input" placeholder={form.type === "EXPENSE" ? "Denumire furnizor" : "Denumire client"} value={form.partnerName} onChange={(e) => setForm({ ...form, partnerName: e.target.value })}/></label><div className="ref-form-row"><label className="field-label">Nr. Registrul Comerțului<input className="input" value={form.partnerRegCom} onChange={(e)=>setForm({...form,partnerRegCom:e.target.value})}/></label><label className="field-label">Statut TVA<select className="input" value={form.partnerVatPayer} onChange={e=>setPartnerVatStatus(e.target.value)}><option value="1">Înregistrat TVA RO</option><option value="0">Neînregistrat TVA</option><option value="-1">Necunoscut</option></select></label></div><label className="field-label">Adresă<input className="input" value={form.partnerAddress} onChange={(e)=>setForm({...form,partnerAddress:e.target.value})}/></label><div className="ref-form-row"><label className="field-label">Județ<input className="input" value={form.partnerCounty} onChange={(e)=>setForm({...form,partnerCounty:e.target.value})}/></label><label className="field-label">Localitate<input className="input" value={form.partnerCity} onChange={(e)=>setForm({...form,partnerCity:e.target.value})}/></label></div><div className="ref-form-row"><label className="field-label">Cod poștal<input className="input" value={form.partnerPostalCode} onChange={(e)=>setForm({...form,partnerPostalCode:e.target.value})}/></label><label className="field-label">Țară<input className="input" maxLength={2} value={form.partnerCountryCode} onChange={(e) => setForm({ ...form, partnerCountryCode: e.target.value.toUpperCase() })}/></label></div><label className="field-label">Telefon<input className="input" value={form.partnerPhone} onChange={(e)=>setForm({...form,partnerPhone:e.target.value})}/></label>{form.partnerRegistrationStatus&&<div className="ref-auto">Stare ANAF: {form.partnerRegistrationStatus}</div>}</div>
        <div className="ref-form-row"><label className="field-label">Sumă brută (RON)<input className="input" type="number" min="0.01" step="0.01" required value={form.grossAmount} onChange={(e) => setGrossAmount(e.target.value)}/></label><label className="field-label">TVA inclus (RON)<input className="input" type="number" min="0" step="0.01" value={form.vatAmount} onChange={(e) => setForm({ ...form, vatAmount: e.target.value })}/></label></div>
        {effectiveVatCategory==="S"&&<label className="field-label">Cotă TVA<select className="input" value={form.vatRate} onChange={(e)=>setVatRate(e.target.value)}>{availableVatRates.map(rate=><option key={rate} value={rate}>{rate}%</option>)}</select><span className="ref-auto">TVA este calculat automat din suma brută; valoarea poate fi corectată manual.</span></label>}
        <label className="field-label">Regim TVA<select className="input" value={form.vatCategoryOverride} onChange={(e) => { const value=e.target.value as "" | VatRegimeCode; const nextCategory=value || suggestedVatCategory; setForm({...form,vatCategoryOverride:value,vatAmount:nextCategory==="S"?includedVat(form.grossAmount,form.vatRate):"0",taxExemptionReason:value?defaultVatRegimeReason(value):"",taxExemptionReasonCode:""}); }}><option value="">Automat · {VAT_REGIME_LABELS[suggestedVatCategory]}</option>{VAT_REGIME_OPTIONS.map(([code,label])=><option key={code} value={code} disabled={code==="S"&&domesticNonVatSupplier}>Manual · {label}</option>)}</select><span className="ref-auto">Aplicat: {VAT_REGIME_LABELS[effectiveVatCategory]}</span></label>
        {vatRegimeNeedsReason(effectiveVatCategory)&&<div className="ref-partner-box"><div className="ref-form-row"><label className="field-label">Cod motiv (opțional)<input className="input" value={form.taxExemptionReasonCode} onChange={(e)=>setForm({...form,taxExemptionReasonCode:e.target.value})}/></label><label className="field-label">Motiv TVA<input className="input" required value={effectiveVatReason} onChange={(e)=>setForm({...form,taxExemptionReason:e.target.value})}/></label></div></div>}
        <label className="field-label">Categorie fiscală<select className="input" value={form.fiscalCategory} onChange={(e) => setForm({ ...form, fiscalCategory: e.target.value, deductibilityPercent: e.target.value === "PARTIAL_EXPENSE" ? "50" : "100" })}>{form.type === "INCOME" ? <><option value="TAXABLE_INCOME">Venit impozabil</option><option value="NON_TAXABLE_INCOME">Venit neimpozabil</option></> : <><option value="DEDUCTIBLE_EXPENSE">Deductibilă integral</option><option value="PARTIAL_EXPENSE">Parțial deductibilă</option><option value="NON_DEDUCTIBLE_EXPENSE">Nedeductibilă</option></>}</select></label>
        {form.fiscalCategory === "PARTIAL_EXPENSE" && <label className="field-label">Procent deductibil<input className="input" type="number" min="0" max="100" step="1" value={form.deductibilityPercent} onChange={(e) => setForm({ ...form, deductibilityPercent: e.target.value })}/></label>}
        <div className="ref-preview"><span>Valoare fiscală calculată</span><strong>{money(fiscalPreview)} RON</strong></div><button className="btn-primary" disabled={saving} type="submit">{saving ? "Se salvează…" : "Adaugă în registru"}</button>
      </form>
    </div>
  </div>;
}
