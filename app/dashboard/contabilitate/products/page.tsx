"use client";

import { useEffect, useState } from "react";
import { Plus, Download } from "lucide-react";

type Product = { id: number; name: string; um: string; price: number; cost: number; vatRate: number; unitCode: string; vatCategoryCode: string; taxExemptionReasonCode: string; taxExemptionReason: string };
const emptyForm = { name: "", um: "buc", price: 0, cost: 0, vatRate: 21, unitCode: "H87", vatCategoryCode: "S", taxExemptionReasonCode: "", taxExemptionReason: "" };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    fetch("/api/accounting/products")
      .then((r) => r.json())
      .then(setProducts);
  }
  useEffect(load, []);

  async function submit() {
    if (!form.name.trim()) return;
    if (editingId) {
      await fetch(`/api/accounting/products/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/accounting/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    load();
  }

  function edit(p: Product) {
    setForm({ name: p.name, um: p.um, price: p.price, cost: p.cost, vatRate: p.vatRate, unitCode: p.unitCode || "H87", vatCategoryCode: p.vatCategoryCode || "S", taxExemptionReasonCode: p.taxExemptionReasonCode || "", taxExemptionReason: p.taxExemptionReason || "" });
    setEditingId(p.id);
    setShowForm(true);
  }

  async function remove(id: number) {
    if (!confirm("Stergi acest produs?")) return;
    await fetch(`/api/accounting/products/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Registru</div>
          <h1 className="page-title">Produse / Servicii</h1>
          <p className="page-subtitle">{products.length} produse in catalog.</p>
        </div>
        <button
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setShowForm((s) => !s);
          }}
          className="btn-primary"
        >
          {showForm ? "Inchide" : <><Plus size={15} /> Produs nou</>}
        </button>
      </div>

      <div className="flex justify-end mb-4">
        <a href="/api/accounting/export/products" className="btn-secondary">
          <Download size={14} /> Export CSV
        </a>
      </div>

      {showForm && (
        <div className="card mb-6 grid grid-cols-4 gap-3 items-end">
          <div className="col-span-2">
            <label className="field-label">Denumire</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="field-label">U.M.</label>
            <input className="input" value={form.um} onChange={(e) => setForm({ ...form, um: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Pret vanzare (fara TVA)</label>
            <input
              type="number"
              className="input"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="field-label">Cost achizitie</label>
            <input
              type="number"
              className="input"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="field-label">TVA %</label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              className="input"
              value={form.vatRate}
              onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="field-label">Cod U.M. UBL</label>
            <select className="input" value={form.unitCode} onChange={(e) => setForm({ ...form, unitCode: e.target.value })}>
              <option value="H87">H87 · bucată</option><option value="C62">C62 · unitate</option><option value="HUR">HUR · oră</option><option value="DAY">DAY · zi</option><option value="MTR">MTR · metru</option><option value="KGM">KGM · kilogram</option><option value="LTR">LTR · litru</option>
            </select>
          </div>
          <div>
            <label className="field-label">Categorie TVA UBL</label>
            <select className="input" value={form.vatCategoryCode} onChange={(e) => setForm({ ...form, vatCategoryCode: e.target.value })}>
              <option value="S">S · cotă standard</option><option value="Z">Z · cotă zero</option><option value="E">E · scutit</option><option value="AE">AE · taxare inversă</option><option value="O">O · în afara TVA</option>
            </select>
          </div>
          {form.vatCategoryCode !== "S" && <><div><label className="field-label">Cod motiv scutire</label><input className="input" value={form.taxExemptionReasonCode} onChange={(e)=>setForm({...form,taxExemptionReasonCode:e.target.value})}/></div><div><label className="field-label">Motiv scutire / regim TVA</label><input className="input" value={form.taxExemptionReason} onChange={(e)=>setForm({...form,taxExemptionReason:e.target.value})}/></div></>}
          <div className="col-span-4">
            <button onClick={submit} className="btn-primary">
              {editingId ? "Salveaza modificarile" : "Adauga produs"}
            </button>
          </div>
        </div>
      )}

      <div className="card-table">
        <table>
          <thead>
            <tr>
              <th>Denumire</th>
              <th>U.M. / UBL</th>
              <th className="text-right">Pret vanzare</th>
              <th className="text-right">Cost</th>
              <th className="text-right">TVA %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-row">
                  Niciun produs/serviciu inregistrat inca.
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.um}<div className="text-xs">{p.unitCode || "H87"} · TVA {p.vatCategoryCode || "S"}</div></td>
                <td className="text-right num">{p.price.toFixed(2)}</td>
                <td className="text-right num" style={{ color: "var(--text-faint)" }}>{p.cost.toFixed(2)}</td>
                <td className="text-right num">{p.vatRate}%</td>
                <td className="text-right space-x-3">
                  <button onClick={() => edit(p)} className="link-action">
                    editeaza
                  </button>
                  <button onClick={() => remove(p.id)} className="link-danger">
                    sterge
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
