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
  return navigator.serviceWorker.register('/internal-chat-sw.js',{scope:'/'})
}

export async function showInternalChatNotification(title:string,body:string,tag:string){
  if(typeof Notification==='undefined'||Notification.permission!=='granted')return false
  try{
    const registration=await registerInternalChatWorker()
    if(registration){await registration.showNotification(title,{body,icon:'/icon.png',badge:'/icon.png',tag,data:{url:'/dashboard/chat-intern'}});return true}
    new Notification(title,{body,icon:'/icon.png',tag});return true
  }catch{
    try{new Notification(title,{body,icon:'/icon.png',tag});return true}catch{return false}
  }
}