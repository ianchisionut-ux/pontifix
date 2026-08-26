"use client";

import { useEffect, useState } from "react";
import { Plus, Download, AlertTriangle, Cable, RefreshCw, Search, CheckCircle2 } from "lucide-react";

type Client = {
  id: number; name: string; clientType: "PF" | "PJ"; regCom: string; cif: string; cnp: string;
  address: string; judet: string; city: string; phone: string; email: string;
  vatPayer: number; countryCode: string; postalCode: string;
  ciSeries: string; ciNumber: string; sourceConnectionId: string | null; sourceNib: string; flagged: number;
};
type ConnectionBeneficiary = {
  id: string; nib: string; beneficiary: string; identifier: string; phone: string;
  address: string; judet: string; city: string; ciSeries: string; ciNumber: string;
};
const emptyForm = {
  name: "", clientType: "PJ" as "PF" | "PJ", regCom: "", cif: "", cnp: "", address: "",
  judet: "", city: "", phone: "", email: "", vatPayer: 0, countryCode: "RO", postalCode: "", ciSeries: "", ciNumber: "",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [connections, setConnections] = useState<ConnectionBeneficiary[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [connectionId, setConnectionId] = useState("");
  const [importing, setImporting] = useState(false);
  const [anafLoading, setAnafLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [anafNotice, setAnafNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function lookupAnaf() {
    const cui = form.cif.replace(/\D/g, "");
    if (cui.length < 2) return setAnafNotice({ ok: false, text: "Introdu mai întâi CUI-ul firmei." });
    setAnafLoading(true); setAnafNotice(null);
    try {
      const response = await fetch(`/api/accounting/anaf-company?cui=${encodeURIComponent(cui)}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Firma nu a putut fi căutată.");
      const company = body.company;
      setForm((current) => ({ ...current, clientType: "PJ", name: company.name || current.name,
        cif: company.cif || cui, regCom: company.regCom || current.regCom,
        address: company.address || current.address, judet: company.judet || current.judet,
        city: company.city || current.city, phone: company.phone || current.phone,
        postalCode: company.postalCode || current.postalCode, countryCode: company.countryCode || "RO",
        vatPayer: company.vatPayer ? 1 : 0 }));
      setAnafNotice({ ok: !company.inactive, text: company.inactive ? "Firma a fost găsită, dar figurează inactivă fiscal." : "Datele firmei au fost completate din ANAF. Verifică-le înainte de salvare." });
    } catch (error) {
      setAnafNotice({ ok: false, text: error instanceof Error ? error.message : "Completează datele manual." });
    } finally { setAnafLoading(false); }
  }

  function load() {
    fetch("/api/accounting/clients").then((r) => r.json()).then(setClients);
  }
  function loadConnections() {
    fetch("/api/accounting/connection-beneficiaries").then((r) => r.json()).then(setConnections);
  }
  useEffect(() => { load(); loadConnections(); }, []);

  async function importConnection() {
    if (!connectionId) return;
    setImporting(true);
    const response = await fetch("/api/accounting/connection-beneficiaries", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId }),
    });
    const data = await response.json();
    setImporting(false);
    if (!response.ok) return alert(data.error || "Beneficiarul nu a putut fi preluat.");
    setConnectionId("");
    load();
  }

  async function submit() {
    if (!form.name.trim()) return;
    const response = await fetch(editingId ? `/api/accounting/clients/${editingId}` : "/api/accounting/clients", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!response.ok) return alert("Datele clientului nu au putut fi salvate.");
    setForm(emptyForm); setEditingId(null); setShowForm(false); load();
  }

  function edit(c: Client) {
    setForm({
      name: c.name, clientType: c.clientType || "PJ", regCom: c.regCom, cif: c.cif, cnp: c.cnp,
      address: c.address, judet: c.judet, city: c.city, phone: c.phone, email: c.email,
      vatPayer: c.vatPayer || 0, countryCode: c.countryCode || "RO", postalCode: c.postalCode || "",
      ciSeries: c.ciSeries, ciNumber: c.ciNumber,
    });
    setEditingId(c.id); setAnafNotice(null); setShowForm(true);
  }

  async function remove(id: number) {
    if (!confirm("Ștergi acest client?")) return;
    const response = await fetch(`/api/accounting/clients/${id}`, { method: "DELETE" });
    if (!response.ok) return alert("Clientul este folosit într-o factură și nu poate fi șters.");
    load();
  }

  async function toggleFlag(c: Client) {
    await fetch(`/api/accounting/clients/${c.id}/flag`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ flagged: !c.flagged }),
    });
    load();
  }

  const normalizedClientSearch = clientSearch.trim().toLocaleLowerCase("ro-RO");
  const visibleClients = normalizedClientSearch
    ? clients.filter((client) => `${client.name} ${client.cif} ${client.cnp} ${client.regCom}`.toLocaleLowerCase("ro-RO").includes(normalizedClientSearch))
    : clients;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Registru beneficiari</div>
          <h1 className="page-title">Clienți</h1>
          <p className="page-subtitle">{clients.length} beneficiari disponibili pentru facturare.</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditingId(null); setAnafNotice(null); setShowForm((s) => !s); }} className="btn-primary">
          {showForm ? "Închide" : <><Plus size={15}/> Client nou</>}
        </button>
      </div>

      <div className="card mb-5" style={{ background: "linear-gradient(135deg,#f1f8fc,#fff)" }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="settings-icon"><Cable size={18}/></span>
          <div><div className="font-bold">Preia beneficiar din Branșamente</div><p className="page-subtitle">CNP/CIF, adresa, telefonul și datele CI se sincronizează automat. Reimportarea actualizează același client.</p></div>
        </div>
        <div className="flex gap-3">
          <select className="input" value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
            <option value="">— selectează branșamentul —</option>
            {connections.map((item) => <option key={item.id} value={item.id}>{item.nib} · {item.beneficiary || "Beneficiar necompletat"} · {item.identifier || "fără CNP/CIF"}</option>)}
          </select>
          <button className="btn-secondary" disabled={!connectionId || importing} onClick={importConnection}>
            <RefreshCw size={14}/>{importing ? "Se preia..." : "Preia / actualizează"}
          </button>
        </div>
      </div>

      <div className="flex justify-end mb-4"><a href="/api/accounting/export/clients" className="btn-secondary"><Download size={14}/> Export CSV</a></div>

      {showForm && (
        <div className="card mb-6 grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="field-label">Tip beneficiar</label>
            <div className="flex gap-2">
              {(["PF","PJ"] as const).map((type) => <button key={type} type="button" className={`btn-secondary ${form.clientType === type ? "accounting-choice-active" : ""}`} onClick={() => setForm({...form,clientType:type})}>{type === "PF" ? "Persoană fizică" : "Persoană juridică"}</button>)}
            </div>
          </div>
          <div className="col-span-2"><label className="field-label">Denumire firmă / Nume și prenume</label><input className="input" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></div>
          {form.clientType === "PJ" ? <>
            <div><label className="field-label">CIF / CUI</label><div className="flex gap-2"><input className="input" value={form.cif} onChange={(e)=>{setForm({...form,cif:e.target.value});setAnafNotice(null)}} onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();lookupAnaf()}}} placeholder="Ex. RO9710508"/><button type="button" className="btn-secondary shrink-0" disabled={anafLoading} onClick={lookupAnaf}>{anafLoading?<RefreshCw size={14} className="animate-spin"/>:<Search size={14}/>} {anafLoading?"Se caută...":"Caută ANAF"}</button></div></div>
            <div><label className="field-label">Nr. Registrul Comerțului</label><input className="input" value={form.regCom} onChange={(e)=>setForm({...form,regCom:e.target.value})}/></div>
          </> : <>
            <div><label className="field-label">CNP</label><input className="input" value={form.cnp} onChange={(e)=>setForm({...form,cnp:e.target.value})}/></div>
            <div className="grid grid-cols-2 gap-2"><div><label className="field-label">Serie CI</label><input className="input" value={form.ciSeries} onChange={(e)=>setForm({...form,ciSeries:e.target.value})}/></div><div><label className="field-label">Număr CI</label><input className="input" value={form.ciNumber} onChange={(e)=>setForm({...form,ciNumber:e.target.value})}/></div></div>
          </>}
          {form.clientType === "PJ" && anafNotice && <div className={`col-span-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${anafNotice.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{anafNotice.ok?<CheckCircle2 size={16}/>:<AlertTriangle size={16}/>} {anafNotice.text}</div>}
          <div className="col-span-2"><label className="field-label">Adresă completă</label><input className="input" value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})}/></div>
          <div><label className="field-label">Județ</label><input className="input" value={form.judet} onChange={(e)=>setForm({...form,judet:e.target.value})}/></div>
          <div><label className="field-label">Localitate</label><input className="input" value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})}/></div>
          <div><label className="field-label">Țară (cod ISO)</label><input className="input" maxLength={2} value={form.countryCode} onChange={(e)=>setForm({...form,countryCode:e.target.value.toUpperCase()})}/></div>
          <div><label className="field-label">Cod poștal</label><input className="input" value={form.postalCode} onChange={(e)=>setForm({...form,postalCode:e.target.value})}/></div>
          {form.clientType === "PJ" && <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.vatPayer} onChange={(e)=>setForm({...form,vatPayer:e.target.checked?1:0})}/> Client înregistrat în scopuri de TVA</label>}
          <div><label className="field-label">Telefon</label><input className="input" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></div>
          <div><label className="field-label">E-mail</label><input type="email" className="input" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></div>
          <div className="col-span-2"><button onClick={submit} className="btn-primary">{editingId ? "Salvează modificările" : "Adaugă client"}</button></div>
        </div>
      )}

      <div className="card mb-4"><label className="field-label">Caută client după nume, CUI sau CNP</label><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{color:"var(--text-faint)"}}/><input className="input pl-9" value={clientSearch} onChange={(event)=>setClientSearch(event.target.value)} placeholder="Ex. beneficiar, 9710508 sau CNP"/></div></div>

      <div className="card-table"><table><thead><tr><th>Beneficiar</th><th>Identificare</th><th>Adresă</th><th>Contact</th><th>Status</th><th></th></tr></thead>
        <tbody>{visibleClients.length===0&&<tr><td colSpan={6} className="empty-row">Niciun client înregistrat încă.</td></tr>}
          {visibleClients.map((c)=><tr key={c.id}>
            <td><strong>{c.name}</strong>{c.sourceNib&&<div className="text-xs mt-1" style={{color:"var(--cyan-strong)"}}>din {c.sourceNib}</div>}</td>
            <td><span className="doc-chip">{c.clientType || "PJ"}</span><div className="num mt-1">{c.clientType==="PF" ? c.cnp : c.cif}</div>{c.regCom&&<div className="text-xs">{c.regCom}</div>}</td>
            <td>{c.address || "—"}{(c.city||c.judet)&&<div className="text-xs mt-1" style={{color:"var(--text-faint)"}}>{[c.city,c.judet].filter(Boolean).join(", ")}</div>}</td>
            <td>{c.phone||"—"}<div className="text-xs">{c.email}</div></td>
            <td><button onClick={()=>toggleFlag(c)} className={`badge ${c.flagged?"badge-canceled":"badge-paid"}`}>{c.flagged?<span className="inline-flex items-center gap-1"><AlertTriangle size={11}/> neplatnic</span>:"în regulă"}</button></td>
            <td className="text-right space-x-3"><button onClick={()=>edit(c)} className="link-action">editează</button><button onClick={()=>remove(c.id)} className="link-danger">șterge</button></td>
          </tr>)}
        </tbody></table></div>
    </div>
  );
}
