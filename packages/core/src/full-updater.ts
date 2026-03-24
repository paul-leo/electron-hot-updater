import { EventEmitter } from 'events'
import type { DownloadProgress, Logger } from './types'
import { defaultLogger } from './logger'

/**
 * Full update info from electron-updater
 */
export interface FullUpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string | null
  files?: Array<{ url: string; sha512: string; size: number }>
}

export interface FullUpdaterConfig {
  /** Auto download full updates. Default: false */
  autoDownload?: boolean
  /** Auto install on quit. Default: true */
  autoInstallOnAppQuit?: boolean
  /** Custom logger */
  logger?: Logger
}

/**
 * Optional wrapper around electron-updater's autoUpdater.
 *
 * Detects at runtime whether electron-updater is installed.
 * If not installed, all methods are safe no-ops.
 *
 * Usage:
 * ```ts
 * const full = new FullUpdater({ autoDownload: false })
 * if (full.isAvailable) {
 *   const info = await full.checkForUpdate()
 * }
 * ```
 */
export class FullUpdater extends EventEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private autoUpdater: any = null
  private _available = false
  private logger: Logger

  constructor(config?: FullUpdaterConfig) {
    super()
    this.logger = config?.logger ?? defaultLogger

    try {
      // Runtime detection — no build-time dependency
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const eu = require('electron-updater')
      this.autoUpdater = eu.autoUpdater
      this._available = true

      // Configure
      this.autoUpdater.autoDownload = config?.autoDownload ?? false
      this.autoUpdater.autoInstallOnAppQuit = config?.autoInstallOnAppQuit ?? true
      this.autoUpdater.logger = this.logger

      // Forward events
      this.autoUpdater.on('update-available', (info: FullUpdateInfo) => {
        this.emit('update-available', info)
      })
      this.autoUpdater.on('update-not-available', () => {
        this.emit('update-not-available')
      })
      this.autoUpdater.on('download-progress', (progress: DownloadProgress) => {
        this.emit('download-progress', progress)
      })
      this.autoUpdater.on('update-downloaded', (info: FullUpdateInfo) => {
        this.emit('update-downloaded', info)
      })
      this.autoUpdater.on('error', (err: Error) => {
        this.emit('error', err)
      })

      this.logger.info('electron-updater detected, full update available')
    } catch {
      this._available = false
      this.logger.info('electron-updater not installed, full update disabled')
    }
  }

  /** Whether electron-updater is available */
  get isAvailable(): boolean {
    return this._available
  }

  /**
   * Check for full app update via electron-updater.
   * Returns null if electron-updater is not available.
   */
  async checkForUpdate(): Promise<FullUpdateInfo | null> {
    if (!this._available) return null

    try {
      const result = await this.autoUpdater.checkForUpdates()
      if (!result || !result.updateInfo) return null
      return {
        version: result.updateInfo.version,
        releaseDate: result.updateInfo.releaseDate,
        releaseNotes: result.updateInfo.releaseNotes,
        files: result.updateInfo.files,
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      this.logger.error(`Full update check failed: ${msg}`)
      return null
    }
  }

  /**
   * Download the full update.
   */
  async downloadUpdate(): Promise<void> {
    if (!this._available) return
    await this.autoUpdater.downloadUpdate()
  }

  /**
   * Quit and install the full update.
   * Includes macOS-safe quit workaround.
   */
  quitAndInstall(isSilent = false, isForceRunAfter = true): void {
    if (!this._available) return

    this.logger.info('Installing full update...')

    // macOS workaround: force close windows before quit
    if (process.platform === 'darwin') {
      try {
        const { BrowserWindow, app } = require('electron')
        const windows = BrowserWindow.getAllWindows()
        for (const win of windows) {
          try { win.close() } catch { /* ignore */ }
        }
        app.dock?.hide()
      } catch { /* ignore */ }
    }

    // Small delay to let windows close
    setTimeout(() => {
      this.autoUpdater.quitAndInstall(isSilent, isForceRunAfter)
    }, 100)
  }
}
