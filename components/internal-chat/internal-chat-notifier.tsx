'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { playInternalChatSound, registerInternalChatWorker, showInternalChatNotification } from '@/lib/internal-chat-browser'

export function InternalChatNotifier(){
  const since=useRef(new Date().toISOString());const [toast,setToast]=useState<{sender:string;text:string}|null>(null)
  useEffect(()=>{
    if(typeof Notification!=='undefined'&&Notification.permission==='granted')registerInternalChatWorker().catch(()=>undefined)
    let cancelled=false;let toastTimer:ReturnType<typeof setTimeout>|null=null
    async function poll(){try{const response=await fetch(`/api/internal-chat/notifications?since=${encodeURIComponent(since.current)}`,{cache:'no-store'});if(!response.ok)return;const data=await response.json() as {items:Array<{id:string;senderEmail:string;senderName:string;text:string}>;serverTime:string;unreadCount:number};if(cancelled)return;since.current=data.serverTime;window.dispatchEvent(new CustomEvent('internal-chat-unread',{detail:data.unreadCount}));if(!data.items.length)return;const latest=data.items[data.items.length-1];setToast({sender:latest.senderName,text:latest.text});if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(()=>setToast(null),7000);playInternalChatSound();for(const item of data.items)await showInternalChatNotification(`Mesaj nou de la ${item.senderName}`,item.text.length>140?`${item.text.slice(0,137)}…`:item.text,`internal-chat-${item.id}`)}catch{/* reîncercăm */}}
    poll();const timer=setInterval(poll,10000);return()=>{cancelled=true;clearInterval(timer);if(toastTimer)clearTimeout(toastTimer)}
  },[])
  if(!toast)return null
  return <button onClick={()=>window.dispatchEvent(new Event('open-internal-chat'))} className="fixed right-5 top-5 z-[95] flex max-w-sm items-start gap-3 rounded-2xl border border-blue-200 bg-white p-4 text-left shadow-2xl"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#197fb5] text-white"><MessageCircle size={20}/></span><span className="min-w-0 flex-1"><strong className="block text-sm text-[#082b4d]">Mesaj nou de la {toast.sender}</strong><span className="mt-1 block truncate text-xs text-slate-600">{toast.text}</span></span><X size={15} className="text-slate-400" onClick={(event)=>{event.stopPropagation();setToast(null)}}/></button>
}
