import { app, BrowserWindow } from 'electron'
import { HotUpdater, registerIpcHandlers, createPaths } from '@electron-hot-updater/core'
import path from 'path'

const paths = createPaths({ rendererDir: '.vite/build/renderer/main_window' })

const updater = new HotUpdater({
  updateUrl: process.env.UPDATE_SERVER_URL || 'http://localhost:51973',
  autoCheckInterval: 60 * 60 * 1000, // 1 hour
  autoDownload: false,
})

// Register IPC handlers for renderer communication
registerIpcHandlers(updater)

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Set main window for IPC progress events
  updater.mainWindow = mainWindow

  // Load renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    )
  }

  // Open DevTools in development
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools()
  }

  return mainWindow
}

// Vite plugin global declarations
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string
declare const MAIN_WINDOW_VITE_NAME: string

app.whenReady().then(() => {
  createWindow()

  // Clear crash record on successful launch
  updater.clearCrashRecord()

  // Start auto-check (with initial delay)
  updater.startAutoCheck()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
