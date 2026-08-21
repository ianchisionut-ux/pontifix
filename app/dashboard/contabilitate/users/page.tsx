"use client";

import { useEffect, useState } from "react";

type User = { id: number; name: string; ci: string; cnp: string; role: string; active: number };
const emptyForm = { name: "", ci: "", cnp: "", role: "" };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    fetch("/api/accounting/users?all=1")
      .then((r) => r.json())
      .then(setUsers);
  }
  useEffect(load, []);

  async function submit() {
    if (!form.name.trim()) return;
    if (editingId) {
      const existing = users.find((u) => u.id === editingId);
      await fetch(`/api/accounting/users/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, active: existing?.active ?? 1 }),
      });
    } else {
      await fetch("/api/accounting/users", {
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

  function edit(u: User) {
    setForm({ name: u.name, ci: u.ci, cnp: u.cnp, role: u.role });
    setEditingId(u.id);
    setShowForm(true);
  }

  async function toggleActive(u: User) {
    await fetch(`/api/accounting/users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: u.name, ci: u.ci, cnp: u.cnp, role: u.role, active: u.active ? 0 : 1 }),
    });
    load();
  }

  async function remove(id: number) {
    if (!confirm("Stergi definitiv acest utilizator? Facturile emise de el raman neschimbate.")) return;
    await fetch(`/api/accounting/users/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Utilizatori</h1>
          <p className="page-subtitle">Persoanele care intocmesc facturi in numele firmei tale.</p>
        </div>
        <button
          onClick={() => {
            setForm(emptyForm);
            setEditingId(null);
            setShowForm((s) => !s);
          }}
          className="btn-primary"
        >
          {showForm ? "Inchide" : "+ Utilizator nou"}
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 grid grid-cols-2 gap-4">
          <Field label="Nume complet">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Rol / functie">
            <input
              className="input"
              placeholder="ex: Vanzari, Administrator"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            />
          </Field>
          <Field label="Serie si numar CI">
            <input className="input" value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value })} />
          </Field>
          <Field label="CNP">
            <input className="input" value={form.cnp} onChange={(e) => setForm({ ...form, cnp: e.target.value })} />
          </Field>
          <div className="col-span-2">
            <button onClick={submit} className="btn-primary">
              {editingId ? "Salveaza modificarile" : "Adauga utilizator"}
            </button>
          </div>
        </div>
      )}

      <div className="card-table">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Nume</th>
              <th className="text-left">Rol</th>
              <th className="text-left">CI</th>
              <th className="text-left">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  Niciun utilizator adaugat inca. Acestia apar ca &quot;Intocmit de&quot; pe facturi.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td>{u.name}</td>
                <td>{u.role}</td>
                <td>{u.ci}</td>
                <td>
                  <button onClick={() => toggleActive(u)} className={`badge ${u.active ? "badge-paid" : "badge-issued"}`}>
                    {u.active ? "Activ" : "Inactiv"}
                  </button>
                </td>
                <td className="text-right space-x-3">
                  <button onClick={() => edit(u)} className="link-action">
                    editeaza
                  </button>
                  <button onClick={() => remove(u.id)} className="link-danger">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
