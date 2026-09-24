"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarClock, FileUp, Landmark, ListTree, Plus, Scale } from "lucide-react";

type Tab = "journal" | "balance" | "account" | "accounts" | "periods";
type Account = { code: string; name: string; nature: string; allowPosting: number; active: number; system: number; used: boolean };
type JournalLine = { id: number; accountCode: string; accountName: string; debit: string; credit: string; explanation: string };
type JournalEntry = { id: number; entryNumber: number; date: string; description: string; documentNumber: string; sourceType: string; debit: string; credit: string; lines: JournalLine[] };
type BalanceRow = { code: string; name: string; initialDebit: string; initialCredit: string; debit: string; credit: string; totalDebit: string; totalCredit: string; finalDebit: string; finalCredit: string };
type LedgerRow = { date: string; entryNumber: number; description: string; documentNumber: string; sourceType: string; debit: string; credit: string; balance: string };
type Period = { month: number; status: "OPEN" | "CLOSED"; closedAt: string | null; closedBy: string; notes: string };
type DraftLine = { accountCode: string; debit: string; credit: string; explanation: string };
type SagaPreview = { total:number; errors:string[]; entries:Array<{date:string;documentNumber:string;description:string;lines:Array<{accountCode:string;debit:number;credit:number}>}> };

const today = new Date().toISOString().slice(0, 10);
const yearStart = `${today.slice(0, 4)}-01-01`;
const money = (value: number | string) => Number(value || 0).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthNames = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];

export function LedgerWorkspace({ stats }: { stats: { accounts: number; entries: number; monthDebit: number; closedPeriods: number } }) {
  const [tab, setTab] = useState<Tab>("journal");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [balance, setBalance] = useState<BalanceRow[]>([]);
  const [ledger, setLedger] = useState<{ account: Account; opening: number; rows: LedgerRow[] } | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [from, setFrom] = useState(yearStart);
  const [to, setTo] = useState(today);
  const [accountCode, setAccountCode] = useState("4111");
  const [periodYear, setPeriodYear] = useState(Number(today.slice(0, 4)));
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice,setNotice]=useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sagaFile,setSagaFile]=useState<File|null>(null);
  const [sagaPreview,setSagaPreview]=useState<SagaPreview|null>(null);
  const [sagaBusy,setSagaBusy]=useState(false);
  const [analytic, setAnalytic] = useState({ parentCode: "4111", code: "4111.001", name: "" });
  const [entry, setEntry] = useState({ date: today, description: "", documentNumber: "", lines: [
    { accountCode: "", debit: "", credit: "", explanation: "" },
    { accountCode: "", debit: "", credit: "", explanation: "" },
  ] as DraftLine[] });

  const postableAccounts = useMemo(() => allAccounts.filter((account) => account.allowPosting && account.active), [allAccounts]);
  const loadAllAccounts = useCallback(async () => {
    const response = await fetch("/api/accounting/ledger/accounts");
    setAllAccounts(await response.json());
  }, []);
  const loadAccounts = useCallback(async () => {
    const response = await fetch(`/api/accounting/ledger/accounts?q=${encodeURIComponent(search)}`);
    setAccounts(await response.json());
  }, [search]);
  const loadJournal = useCallback(async () => {
    const response = await fetch(`/api/accounting/ledger/journal?from=${from}&to=${to}`);
    setJournal(await response.json());
  }, [from, to]);
  const loadBalance = useCallback(async () => {
    const response = await fetch(`/api/accounting/ledger/trial-balance?from=${from}&to=${to}`);
    setBalance(await response.json());
  }, [from, to]);
  const loadLedger = useCallback(async () => {
    const response = await fetch(`/api/accounting/ledger/account?code=${encodeURIComponent(accountCode)}&from=${from}&to=${to}`);
    const data = await response.json();
    if (!response.ok) setError(data.error || "Fișa contului nu a putut fi încărcată."); else setLedger(data);
  }, [accountCode, from, to]);
  const loadPeriods = useCallback(async () => {
    const response = await fetch(`/api/accounting/ledger/periods?year=${periodYear}`);
    setPeriods(await response.json());
  }, [periodYear]);

  useEffect(() => { void loadAccounts(); }, [loadAccounts]);
  useEffect(() => { void loadAllAccounts(); }, [loadAllAccounts]);
  useEffect(() => { if (tab === "journal") void loadJournal(); if (tab === "balance") void loadBalance(); if (tab === "account") void loadLedger(); if (tab === "periods") void loadPeriods(); }, [tab, loadJournal, loadBalance, loadLedger, loadPeriods]);

  async function postEntry(event: React.FormEvent) {
    event.preventDefault(); setError("");
    const response = await fetch("/api/accounting/ledger/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...entry, lines: entry.lines.map((line) => ({ ...line, debit: Number(line.debit || 0), credit: Number(line.credit || 0) })) }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.error || "Articolul nu a putut fi postat.");
    setEntry({ date: today, description: "", documentNumber: "", lines: [{ accountCode: "", debit: "", credit: "", explanation: "" }, { accountCode: "", debit: "", credit: "", explanation: "" }] });
    await loadJournal();
  }

  async function importSaga(commit=false){
    if(!sagaFile)return setError("Selectează fișierul registrului-jurnal exportat din SAGA.");
    setSagaBusy(true);setError("");setNotice("");const form=new FormData();form.set("file",sagaFile);if(commit)form.set("commit","1");
    const response=await fetch("/api/accounting/ledger/saga-import",{method:"POST",body:form});const data=await response.json().catch(()=>({}));setSagaBusy(false);
    if(!response.ok)return setError(data.error||"Importul SAGA a eșuat.");
    if(commit){setSagaPreview(null);setSagaFile(null);setNotice(`Import SAGA finalizat: ${data.created} articole create, ${data.skipped} deja existente.`);await loadJournal();}else setSagaPreview(data);
  }

  async function createAnalytic(event: React.FormEvent) {
    event.preventDefault(); setError("");
    const response = await fetch("/api/accounting/ledger/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(analytic) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.error || "Contul nu a putut fi creat.");
    setAnalytic({ ...analytic, name: "" }); await Promise.all([loadAccounts(), loadAllAccounts()]);
  }

  async function toggleAccount(account: Account) {
    setError("");
    const response = await fetch("/api/accounting/ledger/accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: account.code, active: !account.active }) });
    if (!response.ok) { const data = await response.json(); return setError(data.error || "Contul nu a putut fi actualizat."); }
    await Promise.all([loadAccounts(), loadAllAccounts()]);
  }

  async function togglePeriod(period: Period) {
    setError("");
    const response = await fetch("/api/accounting/ledger/periods", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year: periodYear, month: period.month, status: period.status === "OPEN" ? "CLOSED" : "OPEN" }) });
    if (!response.ok) { const data = await response.json(); return setError(data.error || "Perioada nu a putut fi actualizată."); }
    await loadPeriods();
  }

  const tabs: { key: Tab; label: string; icon: typeof BookOpen }[] = [
    { key: "journal", label: "Registru-jurnal", icon: BookOpen },
    { key: "balance", label: "Balanță", icon: Scale },
    { key: "account", label: "Fișă cont", icon: Landmark },
    { key: "accounts", label: "Plan de conturi", icon: ListTree },
    { key: "periods", label: "Perioade", icon: CalendarClock },
  ];

  return <div>
    <div className="page-head"><div><div className="eyebrow">Partidă dublă</div><h2 className="page-title">Contabilitate financiară</h2><p className="page-subtitle">Facturile și încasările sunt contate automat; articolele manuale folosesc același registru.</p></div></div>
    <div className="stat-grid ledger-stats">
      {[['Conturi active', stats.accounts], ['Articole contabile', stats.entries], ['Rulaj debit luna curentă', `${money(stats.monthDebit)} RON`], ['Perioade închise', stats.closedPeriods]].map(([label, value]) => <div className="stat-card" key={String(label)}><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div>)}
    </div>
    <div className="ledger-tabs">{tabs.map(({ key, label, icon: Icon }) => <button key={key} className={tab === key ? "active" : ""} onClick={() => { setError(""); setTab(key); }}><Icon size={15}/>{label}</button>)}</div>
    {error && <div className="ref-error mb-4">{error}</div>}
    {notice && <div className="ref-notice mb-4">{notice}</div>}

    {(tab === "journal" || tab === "balance" || tab === "account") && <div className="card ledger-filters"><label className="field-label">De la<input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)}/></label><label className="field-label">Până la<input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)}/></label>{tab === "journal" && <button className="btn-secondary" onClick={() => void loadJournal()}>Aplică</button>}{tab === "balance" && <button className="btn-secondary" onClick={() => void loadBalance()}>Generează</button>}</div>}

    {tab === "journal" && <div className="ledger-two-columns"><div><div className="section-label">Articole postate</div><div className="card-table"><table><thead><tr><th>Nr.</th><th>Data</th><th>Document / explicație</th><th>Sursă</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead><tbody>{journal.length === 0 ? <tr><td colSpan={6} className="empty-row">Nu există articole în perioada selectată.</td></tr> : journal.map((row) => <FragmentRow key={row.id} row={row} expanded={expanded === row.id} toggle={() => setExpanded(expanded === row.id ? null : row.id)}/>)}</tbody></table></div></div>
      <div className="grid gap-4"><section className="card ledger-entry-form"><div className="section-label"><FileUp size={14}/>Import registru SAGA</div><p className="page-subtitle">XLSX, CSV sau TXT cu Data, Document, Explicație, Cont debitor, Cont creditor și Sumă. Reimportarea aceluiași fișier nu dublează articolele.</p><label className="field-label">Fișier registru-jurnal<input className="input" type="file" accept=".xlsx,.csv,.txt" onChange={event=>{setSagaFile(event.target.files?.[0]||null);setSagaPreview(null)}}/></label><button type="button" className="btn-secondary" disabled={!sagaFile||sagaBusy} onClick={()=>void importSaga(false)}>{sagaBusy?'Se verifică…':'Previzualizează importul'}</button>{sagaPreview&&<div className="ref-notice"><strong>{sagaPreview.total} articole identificate</strong>{sagaPreview.errors.length>0?<ul>{sagaPreview.errors.slice(0,10).map(error=><li key={error}>{error}</li>)}</ul>:<p>Fișier echilibrat și pregătit pentru import.</p>}<button type="button" className="btn-primary" disabled={sagaBusy||sagaPreview.errors.length>0} onClick={()=>void importSaga(true)}>Confirmă importul</button></div>}</section>
      <form className="card ledger-entry-form" onSubmit={postEntry}><div className="section-label"><Plus size={14}/>Articol manual</div><div className="ledger-form-row"><label className="field-label">Data<input className="input" type="date" required value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })}/></label><label className="field-label">Document<input className="input" value={entry.documentNumber} onChange={(e) => setEntry({ ...entry, documentNumber: e.target.value })}/></label></div><label className="field-label">Explicație<input className="input" required value={entry.description} onChange={(e) => setEntry({ ...entry, description: e.target.value })}/></label>
      {entry.lines.map((line, index) => <div className="ledger-line" key={index}><select className="input" required value={line.accountCode} onChange={(e) => setEntry({ ...entry, lines: entry.lines.map((item, i) => i === index ? { ...item, accountCode: e.target.value } : item) })}><option value="">Cont</option>{postableAccounts.map((account) => <option key={account.code} value={account.code}>{account.code} · {account.name}</option>)}</select><input className="input" type="number" min="0" step="0.01" placeholder="Debit" value={line.debit} onChange={(e) => setEntry({ ...entry, lines: entry.lines.map((item, i) => i === index ? { ...item, debit: e.target.value, credit: e.target.value ? "" : item.credit } : item) })}/><input className="input" type="number" min="0" step="0.01" placeholder="Credit" value={line.credit} onChange={(e) => setEntry({ ...entry, lines: entry.lines.map((item, i) => i === index ? { ...item, credit: e.target.value, debit: e.target.value ? "" : item.debit } : item) })}/>{entry.lines.length > 2 && <button type="button" className="link-danger" onClick={() => setEntry({ ...entry, lines: entry.lines.filter((_, i) => i !== index) })}>×</button>}</div>)}
      <div className="ledger-entry-actions"><button type="button" className="btn-secondary" onClick={() => setEntry({ ...entry, lines: [...entry.lines, { accountCode: "", debit: "", credit: "", explanation: "" }] })}>+ linie</button><button className="btn-primary" type="submit">Postează articolul</button></div></form></div></div>}

    {tab === "balance" && <div className="card-table ledger-wide"><table><thead><tr><th rowSpan={2}>Cont</th><th rowSpan={2}>Denumire</th><th colSpan={2}>Sold inițial</th><th colSpan={2}>Rulaje perioadă</th><th colSpan={2}>Total sume</th><th colSpan={2}>Sold final</th></tr><tr>{["D","C","D","C","D","C","D","C"].map((label, index) => <th className="text-right" key={index}>{label}</th>)}</tr></thead><tbody>{balance.map((row) => <tr key={row.code}><td className="num">{row.code}</td><td>{row.name}</td>{[row.initialDebit,row.initialCredit,row.debit,row.credit,row.totalDebit,row.totalCredit,row.finalDebit,row.finalCredit].map((value,index) => <td className="text-right num" key={index}>{Number(value) ? money(value) : "-"}</td>)}</tr>)}</tbody></table></div>}

    {tab === "account" && <div><div className="card ledger-account-select"><label className="field-label">Cont<select className="input" value={accountCode} onChange={(e) => setAccountCode(e.target.value)}>{postableAccounts.map((account) => <option key={account.code} value={account.code}>{account.code} · {account.name}</option>)}</select></label><button className="btn-primary" onClick={() => void loadLedger()}>Generează fișa</button></div>{ledger && <><div className="ref-notice"><strong>{ledger.account.code} · {ledger.account.name}</strong> — sold inițial: {money(Math.abs(ledger.opening))} RON {ledger.opening >= 0 ? "D" : "C"}</div><div className="card-table"><table><thead><tr><th>Data / articol</th><th>Document</th><th>Explicație</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Sold</th></tr></thead><tbody>{ledger.rows.map((row, index) => <tr key={`${row.entryNumber}-${index}`}><td className="num">{String(row.date).slice(0,10)} · {row.entryNumber}</td><td>{row.documentNumber}</td><td>{row.description}</td><td className="text-right num">{Number(row.debit) ? money(row.debit) : "-"}</td><td className="text-right num">{Number(row.credit) ? money(row.credit) : "-"}</td><td className="text-right num">{money(Math.abs(Number(row.balance)))} {Number(row.balance) >= 0 ? "D" : "C"}</td></tr>)}</tbody></table></div></>}</div>}

    {tab === "accounts" && <div className="ledger-two-columns"><div><div className="card ledger-search"><input className="input" placeholder="Caută după cod sau denumire" value={search} onChange={(e) => setSearch(e.target.value)}/></div><div className="card-table"><table><thead><tr><th>Cod</th><th>Denumire</th><th>Natură</th><th>Postare</th><th>Status</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.code}><td className="num">{account.code}</td><td>{account.name}</td><td>{account.nature}</td><td>{account.allowPosting ? "Da" : "Grup"}</td><td>{account.allowPosting && <button className={account.active ? "badge badge-paid" : "badge badge-canceled"} onClick={() => void toggleAccount(account)}>{account.active ? "activ" : "inactiv"}</button>}</td></tr>)}</tbody></table></div></div><form className="card ledger-entry-form" onSubmit={createAnalytic}><div className="section-label">Cont analitic nou</div><label className="field-label">Cont părinte<input className="input" required value={analytic.parentCode} onChange={(e) => setAnalytic({ ...analytic, parentCode: e.target.value })}/></label><label className="field-label">Cod analitic<input className="input" required value={analytic.code} onChange={(e) => setAnalytic({ ...analytic, code: e.target.value })}/></label><label className="field-label">Denumire<input className="input" required value={analytic.name} onChange={(e) => setAnalytic({ ...analytic, name: e.target.value })}/></label><button className="btn-primary">Creează cont</button></form></div>}

    {tab === "periods" && <div><div className="card ledger-period-year"><label className="field-label">An<input className="input" type="number" min="2000" max="2100" value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))}/></label></div><div className="period-grid">{periods.map((period) => <div className={`card period-card ${period.status === "CLOSED" ? "closed" : ""}`} key={period.month}><div><strong>{monthNames[period.month - 1]}</strong><span>{period.status === "CLOSED" ? "Închisă" : "Deschisă"}</span></div><button className={period.status === "CLOSED" ? "btn-secondary" : "btn-primary"} onClick={() => void togglePeriod(period)}>{period.status === "CLOSED" ? "Redeschide" : "Închide perioada"}</button></div>)}</div></div>}
  </div>;
}

function FragmentRow({ row, expanded, toggle }: { row: JournalEntry; expanded: boolean; toggle: () => void }) {
  return <><tr className="ledger-entry-row" onClick={toggle}><td className="num">{row.entryNumber}</td><td className="num">{String(row.date).slice(0,10)}</td><td><strong>{row.documentNumber || "-"}</strong><div className="text-xs">{row.description}</div></td><td><span className="badge badge-partial">{row.sourceType}</span></td><td className="text-right num">{money(row.debit)}</td><td className="text-right num">{money(row.credit)}</td></tr>{expanded && <tr className="ledger-lines-row"><td colSpan={6}><table><tbody>{row.lines.map((line) => <tr key={line.id}><td>{line.accountCode} · {line.accountName}</td><td>{line.explanation}</td><td className="text-right num">{Number(line.debit) ? money(line.debit) + " D" : money(line.credit) + " C"}</td></tr>)}</tbody></table></td></tr>}</>;
}
