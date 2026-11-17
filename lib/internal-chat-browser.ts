export function playInternalChatSound() {
  try {
    const AudioContextClass=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext
    if(!AudioContextClass)return
    const context=new AudioContextClass();const oscillator=context.createOscillator();const gain=context.createGain()
    oscillator.type='sine';oscillator.frequency.setValueAtTime(740,context.currentTime);oscillator.frequency.exponentialRampToValueAtTime(980,context.currentTime+.12)
    gain.gain.setValueAtTime(.0001,context.currentTime);gain.gain.exponentialRampToValueAtTime(.16,context.currentTime+.02);gain.gain.exponentialRampToValueAtTime(.0001,context.currentTime+.28)
    oscillator.connect(gain);gain.connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+.3);oscillator.addEventListener('ended',()=>context.close().catch(()=>undefined))
  }catch{/* sunetul poate fi blocat până la prima interacțiune */}
}

export async function registerInternalChatWorker(){
  if(!('serviceWorker'in navigator))return null
  const worker=window.location.hostname==='chat.elmont.ro'?'/chat-sw.js':'/internal-chat-sw.js'
  return navigator.serviceWorker.register(worker,{scope:window.location.hostname==='chat.elmont.ro'?'/chat':'/'})
}

function decodeVapid(value:string){
  const base64=(value+'='.repeat((4-value.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/')
  return Uint8Array.from(atob(base64),(character)=>character.charCodeAt(0))
}

export async function registerInternalChatPush(){
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||typeof Notification==='undefined'||Notification.permission!=='granted')return false
  const response=await fetch('/api/internal-chat/push',{cache:'no-store'})
  if(!response.ok)throw new Error('Nu am putut verifica notificările chatului.')
  const data=await response.json() as {publicKey:string|null}
  if(!data.publicKey)throw new Error('Notificările push nu sunt configurate.')
  const worker=await registerInternalChatWorker()
  if(!worker)return false
  const subscription=await worker.pushManager.getSubscription()||await worker.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapid(data.publicKey)})
  const saved=await fetch('/api/internal-chat/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(subscription)})
  if(!saved.ok)throw new Error('Nu am putut activa notificările pe acest dispozitiv.')
  window.dispatchEvent(new Event('internal-chat-push-enabled'))
  return true
}

export async function unregisterInternalChatPush(){
  if(!('serviceWorker'in navigator))return
  const worker=await registerInternalChatWorker()
  const subscription=await worker?.pushManager?.getSubscription()
  if(!subscription)return
  await fetch('/api/internal-chat/push',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})}).catch(()=>undefined)
  if(window.location.hostname==='chat.elmont.ro')await subscription.unsubscribe().catch(()=>undefined)
}

export async function showInternalChatNotification(title:string,body:string,tag:string){
  if(typeof Notification==='undefined'||Notification.permission!=='granted')return false
  try{
    const registration=await registerInternalChatWorker()
    const standalone=window.location.hostname==='chat.elmont.ro'
    const icon=standalone?'/chat-icon-192.png':'/icon.png'
    if(registration){await registration.showNotification(title,{body,icon,badge:icon,tag,requireInteraction:true,data:{url:standalone?'/chat':'/dashboard/chat-intern'}});return true}
    new Notification(title,{body,icon:'/icon.png',tag});return true
  }catch{
    try{new Notification(title,{body,icon:'/icon.png',tag});return true}catch{return false}
  }
}
