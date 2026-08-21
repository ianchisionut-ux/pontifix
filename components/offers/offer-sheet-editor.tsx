'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Mail, MessageCircle, Printer, Save, X } from 'lucide-react'
import { defaultOfferSheet, formatLei, offerTotals, type AtrOcrData, type OfferSheetData } from '@/lib/offer-sheet'

type SheetOffer = {
  id: string; name: string; phone: string; email: string; location: string | null; serviceType: string; message: string | null; createdAt: string
  atrOcrData: AtrOcrData | null; offerData: OfferSheetData | null
}

export function OfferSheetEditor({ offer, onClose, onSaved }: { offer: SheetOffer; onClose: () => void; onSaved: (data: OfferSheetData, sent?: boolean) => void }) {
  const [data, setData] = useState<OfferSheetData>(() => offer.offerData || defaultOfferSheet(offer, offer.atrOcrData))
  const [busy, setBusy] = useState<'save' | 'email' | 'whatsapp' | null>(null)
  const [notice, setNotice] = useState('')
  const totals = useMemo(() => offerTotals(data), [data])
  useEffect(() => () => { document.body.classList.remove('offer-printing'); document.getElementById('offer-page-orientation')?.remove() }, [])
  function update<K extends keyof OfferSheetData>(key: K, value: OfferSheetData[K]) { setData((current) => ({ ...current, [key]: value })) }

  async function call(action: 'sheet' | 'send-email' | 'send-whatsapp') {
    const mode = action === 'sheet' ? 'save' : action === 'send-email' ? 'email' : 'whatsapp'
    setBusy(mode); setNotice('')
    try {
      const response = await fetch(`/api/offers/${offer.id}/${action}`, { method: action === 'sheet' ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Operațiunea nu a reușit.')
      if (result.offerData) setData(result.offerData)
      if (action === 'send-whatsapp' && !result.sent && result.fallbackUrl) {
        window.open(result.fallbackUrl, '_blank', 'noopener,noreferrer')
        setNotice('Am deschis WhatsApp cu oferta completată. Verifică și apasă Trimite.')
      } else setNotice(action === 'sheet' ? 'Fișa a fost salvată.' : action === 'send-email' ? 'Oferta a fost trimisă prin e-mail.' : 'Oferta a fost trimisă prin WhatsApp.')
      onSaved(result.offerData || data, action !== 'sheet' && !!result.sent)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Operațiunea nu a reușit.') }
    finally { setBusy(null) }
  }

  function printOffer() {
    document.getElementById('offer-page-orientation')?.remove()
    const style = document.createElement('style')
    style.id = 'offer-page-orientation'
    style.textContent = '@page { size: A4; margin: 0; }'
    document.head.appendChild(style)
    document.body.classList.add('offer-printing')
    const cleanup = () => {
      document.body.classList.remove('offer-printing')
      document.getElementById('offer-page-orientation')?.remove()
    }
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
    window.setTimeout(cleanup, 3000)
  }

  return <div className="offer-editor-overlay" role="dialog" aria-modal="true">
    <div className="offer-editor-shell">
      <header className="offer-editor-toolbar no-print"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#197fb5]">Fișa ofertei</p><h2 className="text-xl font-bold text-[#082b4d]">{data.customerName || offer.name}</h2></div><div className="flex flex-wrap items-center justify-end gap-2"><button className="btn-secondary" onClick={() => call('sheet')} disabled={!!busy}>{busy === 'save' ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvează</button><button className="btn-secondary" onClick={printOffer}><Printer size={16}/> Print / PDF</button><button className="btn-secondary text-emerald-700" onClick={() => call('send-whatsapp')} disabled={!!busy}>{busy === 'whatsapp' ? <Loader2 size={16} className="animate-spin"/> : <MessageCircle size={16}/>} WhatsApp</button><button className="btn-primary" onClick={() => call('send-email')} disabled={!!busy}>{busy === 'email' ? <Loader2 size={16} className="animate-spin"/> : <Mail size={16}/>} E-mail</button><button className="round-action" onClick={onClose} aria-label="Închide"><X size={18}/></button></div></header>
      {notice && <div className="no-print mx-5 mt-3 flex items-center gap-2 rounded-xl bg-[#edf7fc] px-4 py-3 text-sm font-semibold text-[#0f679b]"><Check size={16}/>{notice}</div>}
      <div className="offer-editor-grid">
        <section className="offer-fields no-print">
          {offer.atrOcrData && <div className="rounded-2xl border border-[#b8dded] bg-[#edf7fc] p-4 text-xs leading-5 text-[#0f679b]"><strong>Date precompletate din ATR</strong><br/>OCR local · încredere {Math.round(offer.atrOcrData.confidence * 100)}%. Verifică toate câmpurile.</div>}
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Număr ofertă" value={data.offerNumber} onChange={(v) => update('offerNumber', v)}/><Field label="Data" type="date" value={data.offerDate} onChange={(v) => update('offerDate', v)}/><Field label="Beneficiar" value={data.customerName} onChange={(v) => update('customerName', v)}/><Field label="Telefon" value={data.customerPhone} onChange={(v) => update('customerPhone', v)}/><Field label="E-mail" value={data.customerEmail} onChange={(v) => update('customerEmail', v)}/><Field label="Locul lucrării" value={data.workLocation} onChange={(v) => update('workLocation', v)}/></div>
          <label className="offer-field">Tip branșament<select value={data.connectionType} onChange={(e) => update('connectionType', e.target.value as OfferSheetData['connectionType'])}><option value="NESPECIFICAT">Nespecificat</option><option value="MONOFAZAT">Monofazat</option><option value="TRIFAZAT">Trifazat</option></select></label>
          <h3 className="offer-fields-title">Valori fără TVA</h3><div className="grid gap-3 sm:grid-cols-2"><NumberField label="Execuție branșament" value={data.executionNet} onChange={(v) => update('executionNet', v)}/><Field label="Ramburs estimat" value={data.reimbursement} onChange={(v) => update('reimbursement', v)} placeholder="ex. 2.430 lei"/><NumberField label="Proiect / documentație" value={data.projectNet} onChange={(v) => update('projectNet', v)}/><NumberField label="TVA (%)" value={data.vatRate} onChange={(v) => update('vatRate', v)}/></div>
          <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={data.panelIncluded} onChange={(e) => update('panelIncluded', e.target.checked)} className="accent-[#197fb5]"/> Include tablou electric opțional</label>{data.panelIncluded && <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_150px]"><Field label="Descriere tablou" value={data.panelDescription} onChange={(v) => update('panelDescription', v)}/><NumberField label="Valoare" value={data.panelNet} onChange={(v) => update('panelNet', v)}/></div>}
          <h3 className="offer-fields-title">Condiții și detalii</h3><Field label="Valabilitatea ofertei" value={data.validity} onChange={(v) => update('validity', v)}/><Field label="Termen de execuție" value={data.executionTerm} onChange={(v) => update('executionTerm', v)}/><Field label="Condiții de plată" value={data.paymentTerms} onChange={(v) => update('paymentTerms', v)}/><Area label="Detalii primite de la beneficiar" value={data.customerDetails} onChange={(v) => update('customerDetails', v)}/><Area label="Observații incluse în ofertă" value={data.offerNotes} onChange={(v) => update('offerNotes', v)}/>
        </section>
        <OfferPaper data={data} totals={totals}/>
      </div>
    </div>
  </div>
}

function OfferPaper({ data, totals }: { data: OfferSheetData; totals: ReturnType<typeof offerTotals> }) {
  const type = data.connectionType === 'NESPECIFICAT' ? '' : ` ${data.connectionType.toLowerCase()}`
  return <article className="offer-print-sheet">
    <header className="offer-paper-header"><img src="/elmont-logo.png" alt="Elmont"/><div><strong>ELMONT S.A.</strong><span>Proiectare și execuție instalații electrice</span><small>CUI 9710508 · J1997000155315</small></div><div className="text-right"><b>OFERTĂ</b><span>Nr. {data.offerNumber}</span><small>{new Date(data.offerDate).toLocaleDateString('ro-RO')}</small></div></header>
    <div className="offer-paper-band"><h1>{data.serviceType}{type}</h1><p>Fișă tehnico-economică pentru beneficiar</p></div>
    <section className="offer-paper-client"><div><small>BENEFICIAR</small><strong>{data.customerName || '—'}</strong><span>{data.customerPhone || '—'} · {data.customerEmail || '—'}</span></div><div><small>LOCUL LUCRĂRII</small><strong>{data.workLocation || '—'}</strong></div></section>
    <section><h2>Obiectul ofertei</h2><p>Elmont S.A. propune realizarea serviciilor de proiectare și/sau execuție pentru obiectivul descris mai jos, pe baza datelor furnizate de beneficiar și a documentației ATR disponibile.</p>{data.customerDetails && <div className="offer-paper-note">{data.customerDetails}</div>}</section>
    <section><h2>Structura ofertei</h2><table className="offer-paper-table"><thead><tr><th>Nr.</th><th>Serviciu / lucrare</th><th>Valoare fără TVA</th><th>TVA</th><th>Total</th></tr></thead><tbody>{data.executionNet > 0 && <PriceRow nr="1" label="Execuție branșament electric" value={data.executionNet} vat={data.vatRate}/>} {data.projectNet > 0 && <PriceRow nr="2" label="Proiect pentru obținerea autorizației de execuție a branșamentului" value={data.projectNet} vat={data.vatRate}/>} {data.panelIncluded && data.panelNet > 0 && <PriceRow nr="3" label={`Opțional: ${data.panelDescription}`} value={data.panelNet} vat={data.vatRate}/>} {!totals.net && <tr><td>—</td><td>Valorile se completează de ofertant</td><td>—</td><td>{data.vatRate}%</td><td>—</td></tr>}</tbody><tfoot><tr><td colSpan={2}>TOTAL OFERTĂ</td><td>{formatLei(totals.net)}</td><td>{formatLei(totals.vat)}</td><td>{formatLei(totals.gross)}</td></tr></tfoot></table>{data.reimbursement && <p className="offer-paper-reimbursement"><strong>Ramburs estimat:</strong> {data.reimbursement}</p>}</section>
    <section className="offer-paper-conditions"><h2>Condiții comerciale</h2><div><p><small>VALABILITATE</small>{data.validity}</p><p><small>TERMEN DE EXECUȚIE</small>{data.executionTerm}</p><p><small>CONDIȚII DE PLATĂ</small>{data.paymentTerms}</p></div></section>
    {data.offerNotes && <section><h2>Observații</h2><div className="offer-paper-note">{data.offerNotes}</div></section>}
    <footer className="offer-paper-footer"><div><strong>ELMONT S.A.</strong><span>Str. 22 Decembrie 1989, nr. 113, Zalău, Sălaj</span><span>Lucrări de construcții pentru electricitate și telecomunicații</span></div><div><span>Întocmit,</span><strong>________________________</strong></div><div><span>Acceptat beneficiar,</span><strong>________________________</strong></div></footer>
  </article>
}

function PriceRow({ nr, label, value, vat }: { nr: string; label: string; value: number; vat: number }) { const tax = value * vat / 100; return <tr><td>{nr}</td><td>{label}</td><td>{formatLei(value)}</td><td>{formatLei(tax)}</td><td>{formatLei(value + tax)}</td></tr> }
function Field({ label, value, onChange, type = 'text', placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) { return <label className="offer-field">{label}<input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}/></label> }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="offer-field">{label}<input type="number" min="0" step="10" value={value || ''} onChange={(e) => onChange(Number(e.target.value) || 0)}/></label> }
function Area({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="offer-field">{label}<textarea value={value} onChange={(e) => onChange(e.target.value)}/></label> }

