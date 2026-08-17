'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, BellRing, Loader2, MessageCircle, Send, Users } from 'lucide-react'

export type InternalChatUser = { id:string; email:string; role:string }
export type InternalChatMessage = { id:string; senderId:string; senderEmail:string; recipientId:string|null; recipientEmail:string|null; text:string; createdAt:string; isUnread:boolean }

type ChatPayload = { currentUserId:string; users:InternalChatUser[]; messages:InternalChatMessage[] }

function initials(email:string) { return email.split('@')[0].split(/[._-]/).map((part)=>part[0]).join('').slice(0,2).toUpperCase() || 'U' }

export function playInternalChatSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(740, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + .12)
    gain.gain.setValueAtTime(.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(.16, context.currentTime + .02)
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .28)
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .3)
    oscillator.addEventListener('ended', () => context.close().catch(() => undefined))
  } catch { /* browserul poate bloca sunetul înainte de prima interacțiune */ }
}

export function InternalChatManager({ initialData }: { initialData:ChatPayload }) {
  const [data,setData]=useState(initialData)
  const [selected,setSelected]=useState<string>('group')
  const [text,setText]=useState('')
  const [sending,setSending]=useState(false)
  const [notificationPermission,setNotificationPermission]=useState<NotificationPermission>(() => typeof Notification === 'undefined' ? 'denied' : Notification.permission)
  const bottomRef=useRef<HTMLDivElement>(null)

  const conversations=useMemo(()=>data.users.filter((user)=>user.id!==data.currentUserId),[data.users,data.currentUserId])
  const visible=useMemo(()=>data.messages.filter((message)=>selected==='group'
    ? message.recipientId===null
    : message.recipientId!==null && ((message.senderId===data.currentUserId&&message.recipientId===selected)||(message.senderId===selected&&message.recipientId===data.currentUserId))),[data.messages,selected,data.currentUserId])
  const unreadByConversation=useMemo(()=>data.messages.reduce<Record<string,number>>((result,message)=>{
    if(!message.isUnread)return result
    const key=message.recipientId===null?'group':message.senderId
    result[key]=(result[key]||0)+1
    return result
  },{}),[data.messages])

  async function refresh() {
    const response=await fetch('/api/internal-chat',{cache:'no-store'})
    if(!response.ok)return
    const next=await response.json() as ChatPayload
    setData(next)
  }

  useEffect(()=>{const timer=setInterval(refresh,4000);return()=>clearInterval(timer)},[])
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[visible.length,selected])
  useEffect(()=>{
    const ids=visible.filter((message)=>message.isUnread).map((message)=>message.id)
    if(!ids.length)return
    fetch('/api/internal-chat',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({messageIds:ids})}).then(()=>setData((current)=>({...current,messages:current.messages.map((message)=>ids.includes(message.id)?{...message,isUnread:false}:message)}))).catch(()=>undefined)
  },[selected,visible.length])

  async function send(event:FormEvent) {
    event.preventDefault(); const value=text.trim(); if(!value||sending)return
    setSending(true)
    const response=await fetch('/api/internal-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:value,recipientId:selected==='group'?null:selected})})
    setSending(false)
    if(!response.ok){const body=await response.json().catch(()=>({}));return alert(body.error||'Mesajul nu a putut fi trimis.')}
    setText(''); await refresh()
  }

  async function enableNotifications() {
    if(typeof Notification==='undefined')return alert('Browserul nu permite notificări desktop.')
    const permission=await Notification.requestPermission(); setNotificationPermission(permission)
    if(permission==='granted'){
      localStorage.setItem('elmont-internal-chat-notifications','enabled')
      playInternalChatSound()
      new Notification('Chat intern Elmont',{body:'Notificările Windows și sunetul sunt activate.',icon:'/icon.png'})
    }
  }

  return <div>
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><span className="text-xs font-black uppercase tracking-[.16em] text-[#197fb5]">Comunicare echipă</span><h1 className="mt-1 text-3xl font-bold text-[#082b4d]">Chat intern</h1><p className="mt-1 text-sm text-slate-500">Mesaje pentru toată echipa sau conversații directe între utilizatori.</p></div><button onClick={enableNotifications} className={notificationPermission==='granted'?'btn-secondary inline-flex items-center gap-2 text-emerald-700':'btn-primary inline-flex items-center gap-2'}>{notificationPermission==='granted'?<BellRing size={17}/>:<Bell size={17}/>} {notificationPermission==='granted'?'Notificări Windows active':'Activează notificările Windows'}</button></header>
    <div className="grid min-h-[680px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm lg:grid-cols-[290px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-[#f3f8fc] p-4 lg:border-b-0 lg:border-r"><p className="mb-3 px-2 text-xs font-black uppercase tracking-[.12em] text-slate-500">Conversații</p><button onClick={()=>setSelected('group')} className={`mb-2 flex w-full items-center gap-3 rounded-2xl p-3 text-left ${selected==='group'?'bg-white shadow-sm ring-1 ring-[#9bd0e8]':'hover:bg-white/70'}`}><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#197fb5] text-white"><Users size={19}/></span><span className="min-w-0 flex-1"><strong className="block text-sm text-[#082b4d]">Toată echipa</strong><small className="text-slate-500">Canal general</small></span>{!!unreadByConversation.group&&<b className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{unreadByConversation.group}</b>}</button>
        <div className="space-y-1">{conversations.map((user)=><button key={user.id} onClick={()=>setSelected(user.id)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${selected===user.id?'bg-white shadow-sm ring-1 ring-[#9bd0e8]':'hover:bg-white/70'}`}><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-xs font-black text-[#0d5d8b]">{initials(user.email)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#082b4d]">{user.email.split('@')[0]}</strong><small className="block truncate text-slate-500">{user.role==='SUPER_ADMIN'?'Super Admin':user.role==='OWNER'?'Administrator':'Angajat'}</small></span>{!!unreadByConversation[user.id]&&<b className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{unreadByConversation[user.id]}</b>}</button>)}</div>
      </aside>
      <section className="flex min-w-0 flex-col"><div className="border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-3"><MessageCircle className="text-[#197fb5]" size={21}/><div><h2 className="font-bold text-[#082b4d]">{selected==='group'?'Toată echipa':data.users.find((user)=>user.id===selected)?.email||'Conversație'}</h2><p className="text-xs text-slate-500">Actualizare automată la câteva secunde</p></div></div></div>
        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 p-5">{visible.map((message)=>{const mine=message.senderId===data.currentUserId;return <div key={message.id} className={`flex ${mine?'justify-end':'justify-start'}`}><div className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${mine?'rounded-br-md bg-[#197fb5] text-white':'rounded-bl-md border border-slate-200 bg-white text-slate-700'}`}><p className={`mb-1 text-[11px] font-bold ${mine?'text-blue-100':'text-[#0d5d8b]'}`}>{mine?'Tu':message.senderEmail}</p><p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p><p className={`mt-1 text-right text-[10px] ${mine?'text-blue-100':'text-slate-400'}`}>{new Date(message.createdAt).toLocaleString('ro-RO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</p></div></div>})}{!visible.length&&<div className="flex h-full min-h-[420px] flex-col items-center justify-center text-center text-slate-400"><MessageCircle size={42} strokeWidth={1.4}/><p className="mt-3 text-sm">Nu există mesaje aici. Începe conversația.</p></div>}<div ref={bottomRef}/></div>
        <form onSubmit={send} className="flex items-end gap-2 border-t border-slate-200 bg-white p-4"><textarea value={text} onChange={(event)=>setText(event.target.value)} onKeyDown={(event)=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();event.currentTarget.form?.requestSubmit()}}} placeholder="Scrie un mesaj…" maxLength={4000} className="input-field min-h-[46px] flex-1 resize-none bg-white"/><button type="submit" disabled={sending||!text.trim()} className="btn-primary flex h-[46px] items-center gap-2">{sending?<Loader2 size={17} className="animate-spin"/>:<Send size={17}/>} Trimite</button></form>
      </section>
    </div>
  </div>
}