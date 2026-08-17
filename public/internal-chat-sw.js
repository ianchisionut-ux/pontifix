self.addEventListener('notificationclick',(event)=>{
  event.notification.close()
  const target=event.notification.data&&event.notification.data.url?event.notification.data.url:'/dashboard/chat-intern'
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then((windows)=>{
    for(const client of windows){if('focus'in client){client.navigate(target);return client.focus()}}
    return clients.openWindow(target)
  }))
})