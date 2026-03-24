import type { HotUpdater } from './updater'

/**
 * Register IPC handlers for the HotUpdater.
 * All channels use the 'ehu:' prefix to avoid collisions.
 *
 * Channels:
 * - ehu:check           → checkForUpdate()
 * - ehu:install          → downloadAndInstall(info)
 * - ehu:relaunch         → relaunch()
 * - ehu:status           → getStatus()
 * - ehu:reset            → reset()
 * - ehu:clear-crash      → clearCrashRecord()
 * - ehu:full-check       → checkFullUpdate()
 * - ehu:full-download    → downloadFullUpdate()
 * - ehu:full-install     → installFullUpdate()
 */
export function registerIpcHandlers(updater: HotUpdater): void {
  // Lazy import to avoid requiring electron at module load time
  const { ipcMain } = require('electron')

  // --- Code bundle (incremental) ---

  ipcMain.handle('ehu:check', async () => {
    return await updater.checkForUpdate()
  })

  ipcMain.handle('ehu:install', async (_: unknown, info: unknown) => {
    return await updater.downloadAndInstall(info as Parameters<HotUpdater['downloadAndInstall']>[0])
  })

  ipcMain.handle('ehu:relaunch', () => {
    updater.relaunch()
    return { success: true }
  })

  ipcMain.handle('ehu:status', () => {
    return updater.getStatus()
  })

  ipcMain.handle('ehu:reset', () => {
    return updater.reset()
  })

  ipcMain.handle('ehu:clear-crash', () => {
    updater.clearCrashRecord()
    return { success: true }
  })

  // --- Full update (electron-updater) ---

  ipcMain.handle('ehu:full-check', async () => {
    return await updater.checkFullUpdate()
  })

  ipcMain.handle('ehu:full-download', async () => {
    await updater.downloadFullUpdate()
    return { success: true }
  })

  ipcMain.handle('ehu:full-install', (_: unknown, options?: { silent?: boolean }) => {
    updater.installFullUpdate(options?.silent)
    return { success: true }
  })
}
