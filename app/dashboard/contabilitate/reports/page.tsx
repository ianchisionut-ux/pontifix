"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";

function fmt(n: number) {
  return (n ?? 0).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Tab = "sales-product" | "profit-product" | "sales-agent" | "overdue" | "outstanding";

const tabs: { key: Tab; label: string }[] = [
  { key: "sales-product", label: "Vanzari pe Produs" },
  { key: "profit-product", label: "Profit pe Produs" },
  { key: "sales-agent", label: "Vanzari pe Agent" },
  { key: "overdue", label: "Facturi restante" },
  { key: "outstanding", label: "Clienti cu sold" },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("sales-product");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [salesByProduct, setSalesByProduct] = useState<{ name: string; qty: number; total: number; vat: number }[]>([]);
  const [profitByProduct, setProfitByProduct] = useState<
    { name: string; qty: number; revenue: number; cost: number; profit: number }[]
  >([]);
  const [salesByAgent, setSalesByAgent] = useState<
    { name: string; invoiceCount: number; total: number; collected: number }[]
  >([]);
  const [overdue, setOverdue] = useState<
    { id: number; series: string; number: number; clientName: string; dueDate: string; total: number; paidAmount: number }[]
  >([]);
  const [outstanding, setOutstanding] = useState<
    { id: number; name: string; flagged: number; outstanding: number; invoiceCount: number }[]
  >([]);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const suffix = qs.toString() ? `?${qs}` : "";
    fetch(`/api/accounting/reports/sales-by-product${suffix}`).then((r) => r.json()).then(setSalesByProduct);
    fetch(`/api/accounting/reports/profit-by-product${suffix}`).then((r) => r.json()).then(setProfitByProduct);
    fetch(`/api/accounting/reports/sales-by-agent${suffix}`).then((r) => r.json()).then(setSalesByAgent);
    fetch("/api/accounting/reports/overdue").then((r) => r.json()).then(setOverdue);
    fetch("/api/accounting/reports/outstanding-by-client").then((r) => r.json()).then(setOutstanding);
  }, [from, to]);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Analiza</div>
          <h1 className="page-title">Rapoarte avansate</h1>
          <p className="page-subtitle">Gaseste clienti potentiali analizand comportamentul de consum.</p>
        </div>
        <a href="/api/accounting/export/invoices" className="btn-secondary">
          <Download size={14} /> Export facturi (CSV)
        </a>
      </div>

      <div className="card mb-5" style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
        <div>
          <label className="field-label">De la data</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Pana la data</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {(from || to) && (
          <button
            onClick={() => {
              setFrom("");
              setTo("");
            }}
            className="link-action"
          >
            reseteaza perioada
          </button>
        )}
        <p className="text-xs" style={{ color: "var(--text-faint)", marginLeft: "auto" }}>
          Perioada se aplica rapoartelor de vanzari si profit.
        </p>
      </div>

      <div className="flex gap-2 mb-5">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`pill ${tab === t.key ? "active" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "sales-product" && (
        <div className="card-table">
          <table>
            <thead>
              <tr>
                <th>Produs / Serviciu</th>
                <th className="text-right">Cantitate</th>
                <th className="text-right">Valoare (fara TVA)</th>
                <th className="text-right">TVA</th>
              </tr>
            </thead>
            <tbody>
              {salesByProduct.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    Nicio vanzare in aceasta perioada.
                  </td>
                </tr>
              )}
              {salesByProduct.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td className="text-right num">{p.qty}</td>
                  <td className="text-right num">{fmt(p.total)} RON</td>
                  <td className="text-right num">{fmt(p.vat)} RON</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "profit-product" && (
        <div>
          <div className="card-table mb-2">
            <table>
              <thead>
                <tr>
                  <th>Produs / Serviciu</th>
                  <th className="text-right">Cantitate</th>
                  <th className="text-right">Venit</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {profitByProduct.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-row">
                      Nicio vanzare in aceasta perioada.
                    </td>
                  </tr>
                )}
                {profitByProduct.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td className="text-right num">{p.qty}</td>
                    <td className="text-right num">{fmt(p.revenue)} RON</td>
                    <td className="text-right num">{fmt(p.cost)} RON</td>
                    <td className="text-right num" style={{ color: p.profit >= 0 ? "var(--emerald)" : "var(--red)" }}>
                      {fmt(p.profit)} RON
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            Profitul se calculeaza doar pentru liniile adaugate dintr-un produs din catalog cu cost de achizitie
            completat (in pagina Produse). Liniile introduse manual pe factura apar cu cost 0.
          </p>
        </div>
      )}

      {tab === "sales-agent" && (
        <div className="card-table">
          <table>
            <thead>
              <tr>
                <th>Agent / Utilizator</th>
                <th className="text-right">Facturi</th>
                <th className="text-right">Total facturat</th>
                <th className="text-right">Incasat</th>
              </tr>
            </thead>
            <tbody>
              {salesByAgent.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    Nicio factura in aceasta perioada.
                  </td>
                </tr>
              )}
              {salesByAgent.map((a) => (
                <tr key={a.name}>
                  <td>{a.name}</td>
                  <td className="text-right num">{a.invoiceCount}</td>
                  <td className="text-right num">{fmt(a.total)} RON</td>
                  <td className="text-right num">{fmt(a.collected)} RON</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "overdue" && (
        <div>
          <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>
            Facturi cu termen de plata depasit, neincasate integral. Seteaza data scadenta la emiterea facturii ca sa
            apara aici.
          </p>
          <div className="card-table">
            <table>
              <thead>
                <tr>
                  <th>Serie/Nr.</th>
                  <th>Client</th>
                  <th>Scadenta</th>
                  <th className="text-right">Rest de plata</th>
                </tr>
              </thead>
              <tbody>
                {overdue.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-row">
                      Nicio factura restanta. Bravo!
                    </td>
                  </tr>
                )}
                {overdue.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/dashboard/contabilitate/invoices/${i.id}`} className="doc-chip">
                        {i.series} {String(i.number).padStart(4, "0")}
                      </Link>
                    </td>
                    <td>{i.clientName}</td>
                    <td className="num" style={{ color: "var(--red)" }}>
                      {new Date(i.dueDate).toLocaleDateString("ro-RO")}
                    </td>
                    <td className="text-right num">{fmt(i.total - i.paidAmount)} RON</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "outstanding" && (
        <div>
          <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>
            Clientii cu sold neincasat, ordonati descrescator. Marcheaza-i pe cei problematici din pagina Clienti.
          </p>
          <div className="card-table">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="text-right">Facturi neincasate</th>
                  <th className="text-right">Sold</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {outstanding.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-row">
                      Niciun client cu sold restant.
                    </td>
                  </tr>
                )}
                {outstanding.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="text-right num">{c.invoiceCount}</td>
                    <td className="text-right num" style={{ color: "var(--amber)" }}>
                      {fmt(c.outstanding)} RON
                    </td>
                    <td className="text-right">{c.flagged ? <span className="badge badge-canceled">neplatnic</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
