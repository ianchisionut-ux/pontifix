"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENT_USER_KEY } from "@/components/accounting/CurrentUserBox";
import { Plus, X, Cable, RefreshCw, FileText } from "lucide-react";

type Client = { id: number; name: string; clientType: "PF" | "PJ"; cif: string; cnp: string; address: string; phone: string; sourceNib: string };
type ConnectionBeneficiary = { id: string; nib: string; beneficiary: string; identifier: string; address: string; phone: string };
type AccountingOffer = {
  id: string; offerNumber: string; customerName: string; customerPhone: string; customerEmail: string;
  workLocation: string; serviceType: string; connectionType: "MONOFAZAT" | "TRIFAZAT" | "NESPECIFICAT";
  executionNet: number; projectNet: number; panelIncluded: boolean; panelDescription: string;
  panelNet: number; vatRate: number; hasExecution: boolean; hasProject: boolean; hasPanel: boolean;
};
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
  const [connections, setConnections] = useState<ConnectionBeneficiary[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [importing, setImporting] = useState(false);
  const [offers, setOffers] = useState<AccountingOffer[]>([]);
  const [offerId, setOfferId] = useState("");
  const [offerImporting, setOfferImporting] = useState(false);
  const [offerParts, setOfferParts] = useState({ execution: true, project: true, panel: true });

  useEffect(() => {
    fetch("/api/accounting/clients").then((r) => r.json()).then(setClients);
    fetch("/api/accounting/connection-beneficiaries").then((r) => r.json()).then(setConnections);
    fetch("/api/accounting/offer-invoice-data").then((r) => r.json()).then(setOffers);
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

  async function importConnectionBeneficiary() {
    if (!connectionId) return;
    setImporting(true);
    const response = await fetch("/api/accounting/connection-beneficiaries", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setImporting(false);
      return alert(data.error || "Beneficiarul nu a putut fi preluat.");
    }
    const updated = await fetch("/api/accounting/clients").then((r) => r.json()) as Client[];
    setClients(updated);
    setClientId(data.clientId);
    setImporting(false);
  }

  function chooseOffer(id: string) {
    setOfferId(id);
    const offer = offers.find((item) => item.id === id);
    setOfferParts({
      execution: Boolean(offer?.hasExecution),
      project: Boolean(offer?.hasProject),
      panel: Boolean(offer?.hasPanel),
    });
  }

  async function importOfferItems() {
    const selected = offers.find((item) => item.id === offerId);
    if (!selected) return;
    const selectedValues = [
      offerParts.execution && selected.executionNet > 0,
      offerParts.project && selected.projectNet > 0,
      offerParts.panel && selected.panelIncluded && selected.panelNet > 0,
    ];
    if (!selectedValues.some(Boolean)) return alert("Selectează cel puțin o poziție cu valoare din ofertă.");
    setOfferImporting(true);
    const response = await fetch("/api/accounting/offer-invoice-data", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setOfferImporting(false);
      return alert(data.error || "Oferta nu a putut fi preluată.");
    }
    const updated = await fetch("/api/accounting/clients").then((r) => r.json()) as Client[];
    setClients(updated);
    setClientId(data.clientId);
    const typeLabel = selected.connectionType === "NESPECIFICAT" ? "" : ` · branșament ${selected.connectionType.toLowerCase()}`;
    const serviceLabel = selected.serviceType ? ` · ${selected.serviceType}` : "";
    const imported: Item[] = [];
    if (offerParts.execution && selected.executionNet > 0) imported.push({
      ...newItem(), description: `Execuție branșament${typeLabel}${serviceLabel}`, um: "lucrare",
      unitPrice: selected.executionNet, vatRate: selected.vatRate,
    });
    if (offerParts.project && selected.projectNet > 0) imported.push({
      ...newItem(), description: `Proiect / documentație${typeLabel}${serviceLabel}`, um: "serv.",
      unitPrice: selected.projectNet, vatRate: selected.vatRate,
    });
    if (offerParts.panel && selected.panelIncluded && selected.panelNet > 0) imported.push({
      ...newItem(), description: `${selected.panelDescription || "Tablou electric"}${typeLabel}`, um: "buc",
      unitPrice: selected.panelNet, vatRate: selected.vatRate,
    });
    setItems((current) => current.length === 1 && !current[0].description && current[0].unitPrice === 0 ? imported : [...current, ...imported]);
    setNotes((current) => current.includes(selected.offerNumber) ? current : [current, `Poziții preluate din oferta ${selected.offerNumber}.`].filter(Boolean).join("\n"));
    setCurrency("RON");
    setExchangeRate(1);
    setOfferImporting(false);
  }

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
  const selectedClient = clients.find((client) => client.id === clientId);
  const selectedOffer = offers.find((offer) => offer.id === offerId);

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

      <div className="card mb-4" style={{ background: "linear-gradient(135deg,#eef7fc,#fff)" }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="settings-icon"><Cable size={18}/></span>
          <div><div className="font-bold">Beneficiar din Branșamente</div><p className="page-subtitle">Preia automat datele dosarului și selectează clientul pentru factură.</p></div>
        </div>
        <div className="flex gap-3">
          <select className="input" value={connectionId} onChange={(e) => setConnectionId(e.target.value)}>
            <option value="">— selectează branșamentul —</option>
            {connections.map((item) => <option key={item.id} value={item.id}>{item.nib} · {item.beneficiary || "Beneficiar necompletat"} · {item.identifier || "fără CNP/CIF"}</option>)}
          </select>
          <button type="button" className="btn-secondary" onClick={importConnectionBeneficiary} disabled={!connectionId || importing}>
            <RefreshCw size={14}/>{importing ? "Se preia..." : "Preia beneficiarul"}
          </button>
        </div>
      </div>

      <div className="card mb-4" style={{ background: "linear-gradient(135deg,#f0f7ff,#fff)" }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="settings-icon"><FileText size={18}/></span>
          <div><div className="font-bold">Poziții din Oferte</div><p className="page-subtitle">Selectează oferta și exact serviciile care trebuie facturate.</p></div>
        </div>
        <div className="flex gap-3">
          <select className="input" value={offerId} onChange={(e) => chooseOffer(e.target.value)}>
            <option value="">— selectează oferta —</option>
            {offers.map((offer) => <option key={offer.id} value={offer.id}>{offer.offerNumber} · {offer.customerName || "Beneficiar necompletat"} · {offer.connectionType.toLowerCase()}</option>)}
          </select>
          <button type="button" className="btn-secondary" onClick={importOfferItems} disabled={!offerId || offerImporting}>
            <RefreshCw size={14}/>{offerImporting ? "Se preia..." : "Preia în factură"}
          </button>
        </div>
        {selectedOffer && (
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              { key: "execution" as const, label: "Execuție branșament", value: selectedOffer.executionNet, available: selectedOffer.hasExecution },
              { key: "project" as const, label: "Proiect / documentație", value: selectedOffer.projectNet, available: selectedOffer.hasProject },
              { key: "panel" as const, label: "Tablou electric (opțional)", value: selectedOffer.panelNet, available: selectedOffer.hasPanel },
            ].map((part) => (
              <label key={part.key} className="rounded-xl border border-[#cfe2ed] bg-white px-3 py-3 flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={offerParts[part.key] && part.available} disabled={!part.available}
                  onChange={(e) => setOfferParts((current) => ({ ...current, [part.key]: e.target.checked }))}/>
                <span className="flex-1"><span className="block font-semibold text-sm">{part.label}</span><span className="text-xs text-slate-500">{part.available ? `${fmt(part.value)} lei + TVA` : "Fără valoare în ofertă"}</span></span>
              </label>
            ))}
          </div>
        )}
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
          {selectedClient && (
            <div className="mt-2 rounded-xl border border-[#cfe2ed] bg-[#f4f9fc] px-3 py-2 text-xs">
              <div className="font-bold text-[#082b4d]">{selectedClient.clientType === "PF" ? `CNP ${selectedClient.cnp || "necompletat"}` : `CIF ${selectedClient.cif || "necompletat"}`}</div>
              <div className="mt-1 text-slate-500">{selectedClient.address || "Adresă necompletată"} · {selectedClient.phone || "telefon necompletat"}</div>
              {selectedClient.sourceNib && <div className="mt-1 font-semibold text-[#197fb5]">Preluat din {selectedClient.sourceNib}</div>}
            </div>
          )}
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
