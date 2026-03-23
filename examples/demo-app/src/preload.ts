import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('hotUpdater', {
  checkForUpdate: () => ipcRenderer.invoke('ehu:check'),
  downloadAndInstall: (info: unknown) => ipcRenderer.invoke('ehu:install', info),
  relaunch: () => ipcRenderer.invoke('ehu:relaunch'),
  getStatus: () => ipcRenderer.invoke('ehu:status'),
  reset: () => ipcRenderer.invoke('ehu:reset'),
  clearCrash: () => ipcRenderer.invoke('ehu:clear-crash'),
  onDownloadProgress: (callback: (data: unknown) => void) => {
    ipcRenderer.on('ehu:download-progress', (_, data) => callback(data))
    return () => { ipcRenderer.removeAllListeners('ehu:download-progress') }
  },
})
