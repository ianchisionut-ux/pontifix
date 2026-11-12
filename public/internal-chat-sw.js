self.addEventListener('install',(event)=>{
  self.skipWaiting()
})
self.addEventListener('activate',(event)=>{
  event.waitUntil(clients.claim())
})
self.addEventListener('fetch',()=>{})
self.addEventListener('push',(event)=>{
  let payload={}
  try{payload=event.data?event.data.json():{}}catch{}
  if(payload.type!=='sonerie')return
  event.waitUntil(self.registration.showNotification(payload.title||'Directorul te cheamă',{
    body:payload.body||'Te rog să vii la birou.',
    icon:'/sonerie-icon-192.png',badge:'/sonerie-icon-192.png',
    tag:`sonerie-${payload.id||'nou'}`,renotify:true,requireInteraction:true,
    data:{url:'/sonerie'}
  }))
})
self.addEventListener('notificationclick',(event)=>{
  event.notification.close()
  const target=event.notification.data&&event.notification.data.url?event.notification.data.url:'/dashboard/chat-intern'
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then((windows)=>{
    for(const client of windows){if('focus'in client){client.navigate(target);return client.focus()}}
    return clients.openWindow(target)
  }))
})
