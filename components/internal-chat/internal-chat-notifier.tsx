'use client'

import { useEffect, useRef } from 'react'
import { playInternalChatSound } from '@/components/internal-chat/internal-chat-manager'

export function InternalChatNotifier() {
  const since=useRef(new Date().toISOString())
  useEffect(()=>{
    let cancelled=false
    async function poll(){
      try{
        const response=await fetch(`/api/internal-chat/notifications?since=${encodeURIComponent(since.current)}`,{cache:'no-store'})
        if(!response.ok)return
        const data=await response.json() as {items:Array<{id:string;senderEmail:string;text:string}>;serverTime:string;unreadCount:number}
        if(cancelled)return
        since.current=data.serverTime
        window.dispatchEvent(new CustomEvent('internal-chat-unread',{detail:data.unreadCount}))
        if(!data.items.length)return
        const shouldNotify=!location.pathname.startsWith('/dashboard/chat-intern')||document.hidden
        if(shouldNotify&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
          for(const item of data.items){new Notification(`Mesaj nou de la ${item.senderEmail}`,{body:item.text.length>140?`${item.text.slice(0,137)}…`:item.text,icon:'/icon.png',tag:`internal-chat-${item.id}`})}
          playInternalChatSound()
        }
      }catch{/* reîncercăm la următoarea verificare */}
    }
    const timer=setInterval(poll,5000); return()=>{cancelled=true;clearInterval(timer)}
  },[])
  return null
}