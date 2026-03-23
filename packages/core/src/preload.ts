/**
 * Preload API for renderer process.
 *
 * Usage in preload.ts:
 * ```ts
 * import { contextBridge } from 'electron'
 * import { hotUpdaterPreloadApi } from '@electron-hot-updater/core/preload'
 * contextBridge.exposeInMainWorld('hotUpdater', hotUpdaterPreloadApi)
 * ```
 *
 * Or manually expose specific methods.
 */

// NOTE: This file is meant to be referenced/copied, not directly imported in preload
// because preload scripts run in a sandboxed context.
// The actual preload implementation should use ipcRenderer directly.

/**
 * Generate the preload API source code for copy-paste or reference.
 */
export function generatePreloadSource(): string {
  return `const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hotUpdater', {
  checkForUpdate: () => ipcRenderer.invoke('ehu:check'),
  downloadAndInstall: (info) => ipcRenderer.invoke('ehu:install', info),
  relaunch: () => ipcRenderer.invoke('ehu:relaunch'),
  getStatus: () => ipcRenderer.invoke('ehu:status'),
  reset: () => ipcRenderer.invoke('ehu:reset'),
  clearCrash: () => ipcRenderer.invoke('ehu:clear-crash'),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('ehu:download-progress', (_, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('ehu:download-progress')
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('ehu:update-available', (_, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('ehu:update-available')
  },
})
`
}
