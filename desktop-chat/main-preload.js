const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('elmontDesktop', true)
