"use client";
import { useRef, useState } from 'react';
type Choice = { sendToAnafNow: boolean; anafEnvironment: string };
export function useAnafChoice() {
  const [environment, setEnvironment] = useState<string | null>(null);
  const resolve = useRef<((choice: Choice | null) => void) | null>(null);
  async function ask(): Promise<Choice | null> {
    try {
      const response = await fetch('/api/accounting/efactura/status');
      const config = await response.json();
      if (!response.ok || !['test','production'].includes(config.environment)) throw new Error();
      setEnvironment(config.environment);
      return await new Promise(done => { resolve.current = done; });
    } catch { alert('Nu am putut verifica mediul ANAF. Factura nu a fost emisă. Reîncearcă.'); return null; }
  }
  function finish(send: boolean | null) {
    resolve.current?.(send === null ? null : { sendToAnafNow: send, anafEnvironment: environment! });
    resolve.current = null; setEnvironment(null);
  }
  const dialog = environment && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="anaf-choice-title">
    <div className="bg-white rounded-xl p-6 max-w-lg shadow-xl">
      <h2 id="anaf-choice-title" className="font-bold text-lg">Trimiți factura acum în ANAF/SPV?</h2>
      <p className="my-3">Mediu: <strong>{environment === 'production' ? 'PRODUCȚIE — transmitere reală' : 'TEST — fără transmitere fiscală în Producție'}</strong></p>
      <p className="text-sm mb-4">Dacă amâni, factura devine eligibilă mâine la 09:00 vara / 08:00 iarna. Planul Vercel actual permite o rulare zilnică; un volum mare sau indisponibilitatea ANAF poate întârzia procesarea. Erorile de validare blochează transmiterea.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => finish(true)}>Emite și trimite acum</button>
        <button type="button" className="btn-secondary" onClick={() => finish(false)}>Emite, verific până mâine</button>
        <button type="button" className="btn-secondary" onClick={() => finish(null)}>Renunță la emitere</button>
      </div>
    </div>
  </div>;
  return { ask, dialog };
}
