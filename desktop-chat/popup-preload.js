const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('elmontPopup', {
  open: () => ipcRenderer.send('elmont-popup-action', 'open'),
  dismiss: () => ipcRenderer.send('elmont-popup-action', 'dismiss'),
  onMessage: (callback) => ipcRenderer.on('elmont-popup-message', (_event, message) => callback(message)),
})
