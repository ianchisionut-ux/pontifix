"use client";

import { useEffect, useState } from "react";
import { Plus, Download, AlertTriangle } from "lucide-react";

type Client = {
  id: number;
  name: string;
  regCom: string;
  cif: string;
  address: string;
  judet: string;
  phone: string;
  email: string;
  flagged: number;
};

const emptyForm = { name: "", regCom: "", cif: "", address: "", judet: "", phone: "", email: "" };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    fetch("/api/accounting/clients")
      .then((r) => r.json())
      .then(setClients);
  }

  useEffect(load, []);

  async function submit() {
    if (!form.name.trim()) return;
    if (editingId) {
      await fetch(`/api/accounting/clients/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/accounting/clients", {
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

  function edit(c: Client) {
    setForm({ name: c.name, regCom: c.regCom, cif: c.cif, address: c.address, judet: c.judet, phone: c.phone, email: c.email });
    setEditingId(c.id);
    setShowForm(true);
  }

  async function remove(id: number) {
    if (!confirm("Stergi acest client?")) return;
    await fetch(`/api/accounting/clients/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleFlag(c: Client) {
    await fetch(`/api/accounting/clients/${c.id}/flag`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged: !c.flagged }),
    });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Registru</div>
          <h1 className="page-title">Clienti</h1>
          <p className="page-subtitle">{clients.length} firme inregistrate.</p>
        </div>
        <button
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setShowForm((s) => !s);
          }}
          className="btn-primary"
        >
          {showForm ? "Inchide" : <><Plus size={15} /> Client nou</>}
        </button>
      </div>

      <div className="flex justify-end mb-4">
        <a href="/api/accounting/export/clients" className="btn-secondary">
          <Download size={14} /> Export CSV
        </a>
      </div>

      {showForm && (
        <div className="card mb-6 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="field-label">Denumire firma / Nume</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Reg. com.</label>
            <input className="input" value={form.regCom} onChange={(e) => setForm({ ...form, regCom: e.target.value })} />
          </div>
          <div>
            <label className="field-label">CIF</label>
            <input className="input" value={form.cif} onChange={(e) => setForm({ ...form, cif: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="field-label">Adresa</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Judet</label>
            <input className="input" value={form.judet} onChange={(e) => setForm({ ...form, judet: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Telefon</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="field-label">Email</label>
            <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="col-span-2">
            <button onClick={submit} className="btn-primary">
              {editingId ? "Salveaza modificarile" : "Adauga client"}
            </button>
          </div>
        </div>
      )}

      <div className="card-table">
        <table>
          <thead>
            <tr>
              <th>Nume</th>
              <th>CIF</th>
              <th>Judet</th>
              <th>Telefon</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-row">
                  Niciun client inregistrat inca.
                </td>
              </tr>
            )}
            {clients.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="num">{c.cif}</td>
                <td>{c.judet}</td>
                <td className="num">{c.phone}</td>
                <td>
                  <button onClick={() => toggleFlag(c)} className={`badge ${c.flagged ? "badge-canceled" : "badge-paid"}`}>
                    {c.flagged ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <AlertTriangle size={11} /> neplatnic
                      </span>
                    ) : (
                      "in regula"
                    )}
                  </button>
                </td>
                <td className="text-right space-x-3">
                  <button onClick={() => edit(c)} className="link-action">
                    editeaza
                  </button>
                  <button onClick={() => remove(c.id)} className="link-danger">
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
