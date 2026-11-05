"use client";
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { filterAccounts, type AccountOption } from '@/lib/accounting/account-search';

export function AccountPicker({ accounts, value, onChange, label = 'Cont', required = false }: {
  accounts: AccountOption[]; value: string; onChange: (code: string) => void; label?: string; required?: boolean;
}) {
  const id = useId(), input = useRef<HTMLInputElement>(null), list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(0);
  const [position, setPosition] = useState<{left:number;top?:number;bottom?:number;width:number;maxHeight:number}>({ left: 0, top: 0, width: 0, maxHeight: 280 });
  const matches = filterAccounts(accounts, query), selected = accounts.find(account => account.code === value);
  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = input.current?.getBoundingClientRect(); if (!rect) return;
      const below = window.innerHeight - rect.bottom - 12, above = rect.top - 12;
      const height = Math.min(280, Math.max(below, above));
      const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 24);
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: below >= Math.min(280, above) ? rect.bottom + 4 : undefined, bottom: below >= Math.min(280, above) ? undefined : window.innerHeight - rect.top + 4, width, maxHeight: height });
    }
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  useEffect(() => { if (open) list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active, open, query]);
  function choose(code: string) { onChange(code); setOpen(false); setQuery(''); }
  return <>
    <input ref={input} className="input" role="combobox" aria-label={label} aria-expanded={open} aria-controls={open ? id : undefined} aria-autocomplete="list" aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
      autoComplete="off" required={required} placeholder="Caută cont după cod sau denumire…" value={open ? query : selected ? `${selected.code} · ${selected.name}` : value}
      onFocus={() => { setOpen(true); setQuery(''); setActive(Math.max(0, accounts.findIndex(account => account.code === value))); }}
      onClick={() => { if (!open) { setOpen(true); setQuery(''); setActive(0); } }}
      onBlur={() => { setOpen(false); setQuery(''); }}
      onChange={event => { setOpen(true); setQuery(event.target.value); setActive(0); }}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(index => Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))); }
        else if (event.key === 'Enter' && open) { event.preventDefault(); if (matches[active]) choose(matches[active].code); }
        else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setQuery(''); }
      }}/>
    {open && createPortal(<div ref={list} id={id} role="listbox" aria-label={`${label} — rezultate`} style={{ position: 'fixed', zIndex: 1000, ...position, overflowY: 'auto', background: '#fff', border: '1px solid #aebccc', borderRadius: 10, boxShadow: '0 10px 30px #10203526', padding: 4 }}>
      {matches.length ? matches.map((account, index) => <button key={account.code} id={`${id}-${index}`} type="button" role="option" aria-selected={index === active} tabIndex={-1}
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(account.code)}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 6, background: index === active ? '#e8eef5' : '#fff', color: '#102035', fontSize: 13 }}>
        <strong>{account.code}</strong> · {account.name}
      </button>) : <div className="p-3 text-sm text-slate-500">Niciun cont găsit. Încearcă alt cod sau denumire.</div>}
    </div>, document.body)}
  </>;
}
