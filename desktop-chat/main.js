const { app, BrowserWindow, Tray, Menu, screen, powerMonitor, ipcMain, nativeImage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { freshMessages } = require('./notification-state')

const CHAT_ORIGIN = 'https://chat.elmont.ro'
const CHAT_URL = `${CHAT_ORIGIN}/chat`
const POLL_INTERVAL_MS = 5000
const iconPath = path.join(__dirname, 'assets', 'chat.ico')
const startupMarker = () => path.join(app.getPath('userData'), 'startup-configured')

let mainWindow
let popupWindow
let tray
let quitting = false
let polling = false
let messageCount = 0
let cursor = new Date().toISOString()
const seen = new Set()
const backgroundLaunch = process.argv.includes('--background')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())

  app.whenReady().then(() => {
    app.setAppUserModelId('ro.elmont.chat')
    createMainWindow()
    createTray()
    configureStartup()
    ipcMain.on('elmont-popup-action', (event, action) => {
      if (event.sender !== popupWindow?.webContents) return
      if (action === 'open' || action === 'dismiss') closePopup()
      if (action === 'open') showMainWindow()
    })
    powerMonitor.on('resume', () => { void checkMessages() })
    setInterval(() => { void checkMessages() }, POLL_INTERVAL_MS)
    setTimeout(() => { void checkMessages() }, 2000)
  })

  app.on('window-all-closed', () => {})
  app.on('before-quit', () => { quitting = true })
  app.on('activate', () => showMainWindow())
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 410, height: 720, minWidth: 360, minHeight: 480,
    show: !backgroundLaunch, autoHideMenuBar: true, icon: iconPath,
    backgroundColor: '#f3f8fc', title: 'Chat Elmont',
    webPreferences: {
      partition: 'persist:elmont-chat', preload: path.join(__dirname, 'main-preload.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false,
    },
  })
  mainWindow.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    mainWindow.hide()
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isChatUrl(url)) event.preventDefault()
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isChatUrl(url)) mainWindow.loadURL(url).catch(() => undefined)
    return { action: 'deny' }
  })
  mainWindow.loadURL(CHAT_URL).catch(() => undefined)
}

function isChatUrl(value) {
  try { return new URL(value).origin === CHAT_ORIGIN } catch { return false }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.moveTop()
  mainWindow.focus()
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(iconPath))
  tray.setToolTip('Chat Elmont - mesaje în fundal')
  tray.on('double-click', showMainWindow)
  tray.on('click', showMainWindow)
  updateTrayMenu()
}

function updateTrayMenu() {
  if (!tray) return
  const openAtLogin = app.isPackaged && app.getLoginItemSettings().openAtLogin
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Deschide chatul', click: showMainWindow },
    { label: 'Pornește odată cu Windows', type: 'checkbox', checked: openAtLogin,
      enabled: app.isPackaged, click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked, args: item.checked ? ['--background'] : [] })
        updateTrayMenu()
      } },
    { type: 'separator' },
    { label: 'Ieșire', click: () => { quitting = true; app.quit() } },
  ]))
}

function configureStartup() {
  if (!app.isPackaged) return
  const marker = startupMarker()
  if (fs.existsSync(marker)) return
  try {
    app.setLoginItemSettings({ openAtLogin: true, args: ['--background'] })
    fs.writeFileSync(marker, '1')
    updateTrayMenu()
  } catch { /* The user can enable startup later from the tray menu. */ }
}

async function checkMessages() {
  if (polling || !mainWindow || mainWindow.isDestroyed()) return
  polling = true
  try {
    const url = `${CHAT_ORIGIN}/api/internal-chat/notifications?since=${encodeURIComponent(cursor)}`
    const response = await mainWindow.webContents.session.fetch(url, {
      credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return
    const result = freshMessages(await response.json(), seen)
    if (!result) return
    cursor = result.serverTime
    if (!result.fresh.length || mainWindow.isFocused()) return
    messageCount += result.fresh.length
    showPopup(result.fresh[result.fresh.length - 1], messageCount)
  } catch { /* Keep the cursor, then retry after the connection returns. */ }
  finally { polling = false }
}

function showPopup(item, count) {
  if (!popupWindow || popupWindow.isDestroyed()) {
    popupWindow = new BrowserWindow({
      width: 390, height: 220, minWidth: 390, maxWidth: 390, minHeight: 220, maxHeight: 220,
      show: false, frame: false, resizable: false, skipTaskbar: true,
      alwaysOnTop: true, backgroundColor: '#ffffff', icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, 'popup-preload.js'),
        contextIsolation: true, sandbox: true, nodeIntegration: false,
      },
    })
    popupWindow.on('closed', () => { popupWindow = null; messageCount = 0 })
    popupWindow.loadFile(path.join(__dirname, 'popup.html')).then(() => renderPopup(item, count)).catch(() => undefined)
  } else {
    renderPopup(item, count)
  }
}

function renderPopup(item, count) {
  if (!popupWindow || popupWindow.isDestroyed()) return
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  popupWindow.setPosition(workArea.x + workArea.width - 402, workArea.y + workArea.height - 232)
  popupWindow.webContents.send('elmont-popup-message', { sender: item.sender, text: item.text, count })
  popupWindow.setAlwaysOnTop(true, 'pop-up-menu')
  popupWindow.show()
  popupWindow.moveTop()
  popupWindow.focus()
  popupWindow.flashFrame(true)
}

function closePopup() {
  if (popupWindow && !popupWindow.isDestroyed()) popupWindow.close()
  messageCount = 0
}
