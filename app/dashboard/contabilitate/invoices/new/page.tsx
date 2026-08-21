"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENT_USER_KEY } from "@/components/accounting/CurrentUserBox";
import { Plus, X } from "lucide-react";

type Client = { id: number; name: string };
type Product = { id: number; name: string; um: string; price: number; vatRate: number };
type UserT = { id: number; name: string; ci: string; cnp: string };

type Item = {
  key: number;
  productId: number | null;
  description: string;
  um: string;
  qty: number;
  unitPrice: number;
  vatRate: number;
};

let keySeq = 1;
function newItem(): Item {
  return { key: keySeq++, productId: null, description: "", um: "buc", qty: 1, unitPrice: 0, vatRate: 21 };
}

function fmt(n: number) {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<UserT[]>([]);
  const [clientId, setClientId] = useState<number | "">("");
  const [userId, setUserId] = useState<number | "">("");
  const [series, setSeries] = useState("FAC");
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [currency, setCurrency] = useState("RON");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [delegateName, setDelegateName] = useState("");
  const [delegateCI, setDelegateCI] = useState("");
  const [delegateCNP, setDelegateCNP] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/accounting/clients").then((r) => r.json()).then(setClients);
    fetch("/api/accounting/products").then((r) => r.json()).then(setProducts);
    fetch("/api/accounting/users").then((r) => r.json()).then((list: UserT[]) => {
      setUsers(list);
      const saved = localStorage.getItem(CURRENT_USER_KEY);
      const match = list.find((u) => String(u.id) === saved) ?? list[0];
      if (match) applyUser(match);
    });
  }, []);

  useEffect(() => {
    fetch(`/api/accounting/invoices/next-number?series=${series}`)
      .then((r) => r.json())
      .then((d) => setNextNumber(d.number));
  }, [series]);

  function applyUser(u: UserT) {
    setUserId(u.id);
    setDelegateName(u.name);
    setDelegateCI(u.ci);
    setDelegateCNP(u.cnp);
  }

  function onUserChange(id: string) {
    const u = users.find((x) => String(x.id) === id);
    if (u) applyUser(u);
  }

  function updateItem(key: number, patch: Partial<Item>) {
    setItems((its) => its.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((its) => [...its, newItem()]);
  }

  function removeItem(key: number) {
    setItems((its) => (its.length > 1 ? its.filter((it) => it.key !== key) : its));
  }

  function pickProduct(key: number, productId: number) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    updateItem(key, { productId: p.id, description: p.name, um: p.um, unitPrice: p.price, vatRate: p.vatRate });
  }

  const rawSubtotal = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
  const discountFactor = 1 - (discountPercent || 0) / 100;
  const subtotal = rawSubtotal * discountFactor;
  const vatTotal = items.reduce((s, it) => s + (it.qty * it.unitPrice * discountFactor * it.vatRate) / 100, 0);
  const total = subtotal + vatTotal;
  const discountAmount = rawSubtotal - subtotal;

  async function submit() {
    if (!clientId) {
      alert("Selecteaza un client.");
      return;
    }
    if (items.some((it) => !it.description.trim())) {
      alert("Completeaza denumirea pentru fiecare produs/serviciu.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/accounting/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        series,
        clientId,
        userId: userId || null,
        issueDate,
        dueDate: dueDate || undefined,
        discountPercent,
        currency,
        exchangeRate: currency === "RON" ? 1 : exchangeRate,
        delegateName,
        delegateCI,
        delegateCNP,
        vehiclePlate,
        deliveryDate,
        deliveryTime,
        notes,
        items: items.map((it) => ({
          productId: it.productId,
          description: it.description,
          um: it.um,
          qty: it.qty,
          unitPrice: it.unitPrice,
          vatRate: it.vatRate,
        })),
      }),
    });
    const data = await res.json();
    setSaving(false);
    router.push(`/dashboard/contabilitate/invoices/${data.id}`);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Registru</div>
          <h1 className="page-title">Factura noua</h1>
        </div>
      </div>

      <div className="card mb-4" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 16 }}>
        <div>
          <label className="field-label">Client</label>
          <select className="input" value={clientId} onChange={(e) => setClientId(Number(e.target.value))}>
            <option value="">-- selecteaza --</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {clients.length === 0 && (
            <p className="text-xs mt-1" style={{ color: "var(--amber)" }}>
              Nu ai niciun client inregistrat. <a href="/dashboard/contabilitate/clients" className="link-action">Adauga unul</a>.
            </p>
          )}
        </div>
        <div>
          <label className="field-label">Serie</label>
          <input className="input" value={series} onChange={(e) => setSeries(e.target.value.toUpperCase())} />
          <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
            Numar urmator: {nextNumber !== null ? String(nextNumber).padStart(4, "0") : "..."}
          </p>
        </div>
        <div>
          <label className="field-label">Data emiterii</label>
          <input type="date" className="input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
      </div>

      <div className="card mb-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
        <div>
          <label className="field-label">Data scadenta (optional)</label>
          <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Discount (%)</label>
          <input
            type="number"
            className="input"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="field-label">Moneda</label>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="RON">RON</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div>
          <label className="field-label">Curs de schimb (1 {currency} = ? RON)</label>
          <input
            type="number"
            step="0.0001"
            className="input"
            value={exchangeRate}
            disabled={currency === "RON"}
            onChange={(e) => setExchangeRate(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="card mb-6">
        <label className="field-label">Intocmit de (utilizator)</label>
        <select className="input" value={userId} onChange={(e) => onUserChange(e.target.value)}>
          <option value="">-- fara utilizator --</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        {users.length === 0 && (
          <p className="text-xs mt-1" style={{ color: "var(--amber)" }}>
            Nu ai niciun utilizator inregistrat. <a href="/dashboard/contabilitate/users" className="link-action">Adauga unul</a>.
          </p>
        )}
      </div>

      <div className="card-table mb-2">
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }}>Nr.</th>
              <th>Produs/Serviciu</th>
              <th style={{ width: 80 }}>U.M.</th>
              <th className="text-right" style={{ width: 90 }}>Cant.</th>
              <th className="text-right" style={{ width: 110 }}>Pret unitar</th>
              <th className="text-right" style={{ width: 90 }}>TVA %</th>
              <th className="text-right" style={{ width: 100 }}>Valoare</th>
              <th style={{ width: 32 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.key}>
                <td style={{ color: "var(--text-faint)" }}>{idx + 1}</td>
                <td>
                  <input
                    list="product-list"
                    className="input"
                    value={it.description}
                    onChange={(e) => {
                      const match = products.find((p) => p.name === e.target.value);
                      if (match) pickProduct(it.key, match.id);
                      else updateItem(it.key, { description: e.target.value, productId: null });
                    }}
                    placeholder="Denumire produs/serviciu"
                  />
                </td>
                <td>
                  <input className="input" value={it.um} onChange={(e) => updateItem(it.key, { um: e.target.value })} />
                </td>
                <td>
                  <input
                    type="number"
                    className="input text-right num"
                    value={it.qty}
                    onChange={(e) => updateItem(it.key, { qty: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="input text-right num"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(it.key, { unitPrice: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className="input text-right num"
                    value={it.vatRate}
                    onChange={(e) => updateItem(it.key, { vatRate: Number(e.target.value) })}
                  />
                </td>
                <td className="text-right num" style={{ padding: "0 16px" }}>
                  {fmt(it.qty * it.unitPrice)}
                </td>
                <td className="text-right">
                  <button onClick={() => removeItem(it.key)} className="link-danger">
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="product-list">
          {products.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
      </div>
      <button onClick={addItem} className="link-action mb-6" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Plus size={13} /> adauga linie
      </button>

      <div className="flex justify-end mb-8">
        <div style={{ width: 260 }} className="text-sm space-y-1">
          <div className="flex justify-between" style={{ color: "var(--text-dim)" }}>
            <span>Subtotal</span>
            <span className="num">{fmt(rawSubtotal)} {currency}</span>
          </div>
          {discountPercent > 0 && (
            <div className="flex justify-between" style={{ color: "var(--amber)" }}>
              <span>Discount ({discountPercent}%)</span>
              <span className="num">-{fmt(discountAmount)} {currency}</span>
            </div>
          )}
          <div className="flex justify-between" style={{ color: "var(--text-dim)" }}>
            <span>TVA</span>
            <span className="num">{fmt(vatTotal)} {currency}</span>
          </div>
          <div
            className="flex justify-between font-bold pt-2"
            style={{ borderTop: "1px solid var(--border-soft)", fontSize: 16 }}
          >
            <span>Total plata</span>
            <span className="num" style={{ color: "var(--cyan-strong)" }}>
              {fmt(total)} {currency}
            </span>
          </div>
          {currency !== "RON" && exchangeRate > 0 && (
            <div className="flex justify-between text-xs" style={{ color: "var(--text-faint)" }}>
              <span>Echivalent</span>
              <span className="num">{fmt(total * exchangeRate)} RON</span>
            </div>
          )}
        </div>
      </div>

      <details className="mb-6">
        <summary className="cursor-pointer section-label" style={{ display: "inline-block" }}>
          Detalii expeditie / delegat (optional)
        </summary>
        <div className="grid grid-cols-3 gap-4 mt-3">
          <div>
            <label className="field-label">Nume delegat</label>
            <input className="input" value={delegateName} onChange={(e) => setDelegateName(e.target.value)} />
          </div>
          <div>
            <label className="field-label">CI delegat</label>
            <input className="input" value={delegateCI} onChange={(e) => setDelegateCI(e.target.value)} />
          </div>
          <div>
            <label className="field-label">CNP delegat</label>
            <input className="input" value={delegateCNP} onChange={(e) => setDelegateCNP(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Nr. auto transport</label>
            <input className="input" value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Data expedierii</label>
            <input type="date" className="input" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Ora expedierii</label>
            <input className="input" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} placeholder="16:30" />
          </div>
        </div>
      </details>

      <div className="mb-6">
        <label className="field-label">Observatii (optional)</label>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <button onClick={submit} disabled={saving} className="btn-primary" style={{ padding: "11px 22px" }}>
        {saving ? "Se salveaza..." : "Emite factura"}
      </button>
    </div>
  );
}
