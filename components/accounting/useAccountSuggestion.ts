"use client";
import { useEffect, useRef, useState } from "react";

/** Per-form requests: discard stale descriptions, removed lines and manual overrides. */
export function useAccountSuggestion(direction: "INCOME" | "EXPENSE") {
  const [suggestions,setSuggestions]=useState(new Map<number,{code:string;name:string;confidence:number}[]>());
  const requests = useRef(new Map<number, { timer?: ReturnType<typeof setTimeout>; controller: AbortController }>());
  const manual = useRef(new Map<number, string>());
  const descriptions = useRef(new Map<number, string>());
  function cancel(key: number) {
    const current = requests.current.get(key);
    if (current) { clearTimeout(current.timer); current.controller.abort(); requests.current.delete(key); }
  }
  function reset() {
    for (const key of requests.current.keys()) cancel(key);
    manual.current.clear(); descriptions.current.clear();setSuggestions(new Map());
  }
  useEffect(() => reset, []);
  function chooseManually(key: number) { cancel(key); manual.current.set(key, descriptions.current.get(key) || ""); }
  function suggest(key: number, description: string, apply: (code: string) => void) {
    cancel(key);
    setSuggestions(current=>{const next=new Map(current);next.delete(key);return next});
    const normalized=description.trim().toLocaleLowerCase("ro-RO");
    if (manual.current.has(key) && manual.current.get(key) !== normalized) manual.current.delete(key);
    descriptions.current.set(key,normalized);
    if (manual.current.has(key) || normalized.length < 3) return;
    const request = { controller: new AbortController(), timer: undefined as ReturnType<typeof setTimeout> | undefined };
    requests.current.set(key, request);
    request.timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/accounting/account-suggestions?direction=${direction}&q=${encodeURIComponent(description)}`, { signal: request.controller.signal });
        if (!response.ok) return;
        const rows = await response.json();
        if (requests.current.get(key) !== request || manual.current.has(key)) return;
        setSuggestions(current=>new Map(current).set(key,rows.filter((row:{confidence:number})=>row.confidence>=60)));
        if (rows[0]?.confidence >= 70) apply(rows[0].code);
      } catch { /* Keep the selected account when suggestions are unavailable. */ }
      finally { if (requests.current.get(key) === request) requests.current.delete(key); }
    }, 280);
  }
  return { suggest, chooseManually, cancel, reset, suggestions };
}
