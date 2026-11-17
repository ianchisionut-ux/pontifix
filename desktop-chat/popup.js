const label = document.getElementById('label')
const sender = document.getElementById('sender')
const message = document.getElementById('message')

window.elmontPopup.onMessage((item) => {
  label.textContent = item.count > 1 ? `${item.count} mesaje noi` : 'Mesaj nou'
  sender.textContent = item.sender || 'Un coleg'
  message.textContent = item.text || ''
})

document.getElementById('dismiss').addEventListener('click', window.elmontPopup.dismiss)
document.getElementById('later').addEventListener('click', window.elmontPopup.dismiss)
document.getElementById('open').addEventListener('click', window.elmontPopup.open)
