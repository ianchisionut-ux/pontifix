"use client";

import { useEffect, useState } from "react";

type Company = {
  name: string;
  regCom: string;
  cif: string;
  address: string;
  iban: string;
  iban2: string;
  iban3: string;
  bank: string;
  phone: string;
  email: string;
  vatIncasare: number;
  vatPayer: number;
  countryCode: string;
  county: string;
  city: string;
  postalCode: string;
};

const empty: Company = {
  name: "",
  regCom: "",
  cif: "",
  address: "",
  iban: "",
  iban2: "",
  iban3: "",
  bank: "",
  phone: "",
  email: "",
  vatIncasare: 1,
  vatPayer: 1,
  countryCode: "RO",
  county: "Salaj",
  city: "Zalau",
  postalCode: "",
};

export default function CompanyPage() {
  const [data, setData] = useState<Company>(empty);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/accounting/company")
      .then((r) => r.json())
      .then(setData);
  }, []);

  async function save() {
    await fetch("/api/accounting/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function set<K extends keyof Company>(key: K, value: Company[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Setari</div>
          <h1 className="page-title">Firma mea</h1>
          <p className="page-subtitle">Aceste date apar ca Furnizor pe toate facturile si chitantele emise.</p>
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="field-label">Denumire firma</label>
          <input className="input" value={data.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Reg. com.</label>
            <input className="input" value={data.regCom} onChange={(e) => set("regCom", e.target.value)} />
          </div>
          <div>
            <label className="field-label">CIF</label>
            <input className="input" value={data.cif} onChange={(e) => set("cif", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="field-label">Adresa</label>
          <textarea className="input" rows={2} value={data.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div><label className="field-label">Țară (cod ISO)</label><input className="input" maxLength={2} value={data.countryCode || "RO"} onChange={(e) => set("countryCode", e.target.value.toUpperCase())} /></div>
          <div><label className="field-label">Județ</label><input className="input" value={data.county || ""} onChange={(e) => set("county", e.target.value)} /></div>
          <div><label className="field-label">Localitate</label><input className="input" value={data.city || ""} onChange={(e) => set("city", e.target.value)} /></div>
          <div><label className="field-label">Cod poștal</label><input className="input" value={data.postalCode || ""} onChange={(e) => set("postalCode", e.target.value)} /></div>
        </div>
        <div>
          <label className="field-label">Banca</label>
          <input className="input" value={data.bank} onChange={(e) => set("bank", e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="field-label">IBAN 1</label>
            <input className="input" value={data.iban || ""} onChange={(e) => set("iban", e.target.value)} />
          </div>
          <div>
            <label className="field-label">IBAN 2</label>
            <input className="input" value={data.iban2 || ""} onChange={(e) => set("iban2", e.target.value)} />
          </div>
          <div>
            <label className="field-label">IBAN 3</label>
            <input className="input" value={data.iban3 || ""} onChange={(e) => set("iban3", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Telefon</label>
            <input className="input" value={data.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input className="input" value={data.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-dim)" }}>
          <input type="checkbox" checked={!!data.vatPayer} onChange={(e) => set("vatPayer", e.target.checked ? 1 : 0)} />
          Firmă înregistrată în scopuri de TVA
        </label>
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-dim)" }}>
          <input
            type="checkbox"
            checked={!!data.vatIncasare}
            onChange={(e) => set("vatIncasare", e.target.checked ? 1 : 0)}
          />
          Aplic sistemul TVA la incasare
        </label>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={save} className="btn-primary">
            Salveaza
          </button>
          {saved && <span className="text-sm" style={{ color: "var(--emerald)" }}>Salvat.</span>}
        </div>
      </div>
    </div>
  );
}
