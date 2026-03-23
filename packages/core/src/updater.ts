import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'
import type {
  BundleStatus,
  DownloadProgress,
  HotUpdaterConfig,
  InstallResult,
  Logger,
  UpdateInfo,
} from './types'
import { defaultLogger } from './logger'
import { httpGet, httpDownloadToFile } from './downloader'
import { parseCodeBundleYml } from './yml-parser'
import { compareVersions } from './version'
import { installCodeBundle } from './installer'
import { clearCrashRecord } from './crash-guard'

/**
 * HotUpdater — main SDK class for checking, downloading, and installing code bundle updates.
 *
 * Usage in Electron main process:
 * ```ts
 * import { HotUpdater } from '@electron-hot-updater/core'
 *
 * const updater = new HotUpdater({ updateUrl: 'https://cdn.example.com/releases' })
 * updater.on('update-available', (info) => { ... })
 * updater.startAutoCheck()
 * ```
 */
export class HotUpdater extends EventEmitter {
  private config: Required<Pick<HotUpdaterConfig, 'updateUrl'>> & HotUpdaterConfig
  private logger: Logger
  private autoCheckTimer: ReturnType<typeof setInterval> | null = null
  private _app: typeof import('electron').app | null = null
  private _mainWindow: import('electron').BrowserWindow | null = null

  constructor(config: HotUpdaterConfig) {
    super()
    this.config = config
    this.logger = config.logger ?? defaultLogger
  }

  /** Set the Electron app reference (lazy to avoid import issues) */
  private get app() {
    if (!this._app) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this._app = require('electron').app
    }
    return this._app!
  }

  /** Set the main window for IPC progress events */
  set mainWindow(win: import('electron').BrowserWindow | null) {
    this._mainWindow = win
  }

  get mainWindow() {
    return this._mainWindow
  }

  private get userDataDir(): string {
    return this.app.getPath('userData')
  }

  private get shellFingerprint(): string {
    return process.env.SHELL_FINGERPRINT || ''
  }

  private get ymlUrl(): string {
    const base = this.config.updateUrl.replace(/\/$/, '')
    return `${base}/code-bundle-latest.yml`
  }

  /**
   * Check for a code bundle update.
   */
  async checkForUpdate(): Promise<UpdateInfo> {
    try {
      this.logger.info(`Checking for update: ${this.ymlUrl}`)
      const ymlBuffer = await httpGet(this.ymlUrl)
      const yml = parseCodeBundleYml(ymlBuffer.toString('utf-8'))

      if (!yml.version || !yml.files || yml.files.length === 0) {
        this.logger.info('No update info in yml')
        this.emit('update-not-available')
        return { available: false }
      }

      // Current effective version: prefer code bundle version over app version
      const currentVersion = process.env.CODE_BUNDLE_VERSION || this.app.getVersion()
      this.logger.info(`Version check: server=${yml.version}, local=${currentVersion}`)

      if (compareVersions(yml.version, currentVersion) <= 0) {
        this.logger.info(`Server version ${yml.version} <= local ${currentVersion}, no update`)
        this.emit('update-not-available')
        return { available: false }
      }

      // Shell fingerprint compatibility
      const localFp = this.shellFingerprint
      if (yml.shellFingerprint && localFp && localFp !== '__SHELL_FINGERPRINT__') {
        if (yml.shellFingerprint !== localFp) {
          this.logger.info('Shell fingerprint mismatch, full update required')
          const info: UpdateInfo = { available: false, needFullUpdate: true }
          this.emit('update-not-available', info)
          return info
        }
      }

      const file = yml.files[0]
      const baseUrl = this.config.updateUrl.replace(/\/$/, '')
      const downloadUrl = file.url.startsWith('http') ? file.url : `${baseUrl}/${file.url}`

      const info: UpdateInfo = {
        available: true,
        version: yml.version,
        url: downloadUrl,
        sha512: file.sha512,
        size: file.size,
        shellFingerprint: yml.shellFingerprint,
      }

      this.logger.info(`Update available: v${yml.version}, size=${file.size}`)
      this.emit('update-available', info)

      if (this.config.autoDownload) {
        await this.downloadAndInstall(info)
      }

      return info
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      this.logger.error(`Update check failed: ${msg}`)
      this.emit('error', e)
      return { available: false }
    }
  }

  /**
   * Download and install a code bundle update.
   */
  async downloadAndInstall(info?: UpdateInfo): Promise<InstallResult> {
    if (!info || !info.url || !info.version) {
      return { success: false, error: 'No update info provided' }
    }

    // Version format validation (prevent path injection)
    if (!/^\d+\.\d+\.\d+/.test(info.version)) {
      return { success: false, error: `Invalid version: ${info.version}` }
    }

    const zipPath = path.join(this.userDataDir, `code-bundle-${info.version}.zip`)

    try {
      // Clean up previous download
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)

      // Download with progress
      this.logger.info(`Downloading: ${info.url}`)
      await httpDownloadToFile(info.url, zipPath, {
        logger: this.logger,
        onProgress: (progress: DownloadProgress) => {
          this.emit('download-progress', progress)
          // Send to renderer via IPC
          if (this._mainWindow && !this._mainWindow.isDestroyed()) {
            this._mainWindow.webContents.send('ehu:download-progress', progress)
          }
        },
      })

      this.logger.info('Download complete, installing...')
      this.emit('update-downloaded', info)

      // Install
      const result = installCodeBundle(zipPath, info, {
        userDataDir: this.userDataDir,
        shellFingerprint: this.shellFingerprint,
        logger: this.logger,
      })

      if (result.success) {
        this.emit('update-installed', result)
        if (this.config.autoRelaunch) {
          this.relaunch()
        }
      } else {
        this.emit('error', new Error(result.error))
      }

      return result
    } catch (e: unknown) {
      try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath) } catch { /* ignore */ }
      const msg = e instanceof Error ? e.message : String(e)
      this.logger.error(`Download/install failed: ${msg}`)
      this.emit('error', e)
      return { success: false, error: msg }
    }
  }

  /**
   * Relaunch the app to load the new code bundle.
   */
  relaunch(): void {
    this.logger.info('Relaunching app to load new code bundle')
    this.emit('before-relaunch')
    this.app.relaunch()
    this.app.exit(0)
  }

  /**
   * Get current code bundle status.
   */
  getStatus(): BundleStatus {
    const bundleDir = path.join(this.userDataDir, `code-bundle-${this.shellFingerprint}`)
    const metaFile = path.join(bundleDir, 'meta.json')
    let bundleMeta = null

    try {
      if (fs.existsSync(metaFile)) {
        bundleMeta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'))
      }
    } catch { /* ignore */ }

    return {
      usingCodeBundle: process.env.USING_CODE_BUNDLE === 'true',
      codeBundleVersion: process.env.CODE_BUNDLE_VERSION || '',
      shellFingerprint: this.shellFingerprint,
      appVersion: this.app.getVersion(),
      bundleMeta,
      bundleDir,
    }
  }

  /**
   * Reset: delete code bundle, next launch will use built-in code.
   */
  reset(): InstallResult {
    const bundleDir = path.join(this.userDataDir, `code-bundle-${this.shellFingerprint}`)
    try {
      if (fs.existsSync(bundleDir)) {
        fs.rmSync(bundleDir, { recursive: true, force: true })
        this.logger.info('Code bundle reset, will use built-in on next launch')
      }
      return { success: true }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      this.logger.error(`Reset failed: ${msg}`)
      return { success: false, error: msg }
    }
  }

  /**
   * Clear crash records (call from renderer after successful load).
   */
  clearCrashRecord(): void {
    clearCrashRecord(this.userDataDir)
  }

  /**
   * Start auto-check interval.
   */
  startAutoCheck(): void {
    const interval = this.config.autoCheckInterval
    if (!interval || interval <= 0) return

    this.stopAutoCheck()
    this.logger.info(`Auto-check enabled: every ${interval / 1000}s`)

    // Initial check after short delay
    setTimeout(() => this.checkForUpdate(), 5000)
    this.autoCheckTimer = setInterval(() => this.checkForUpdate(), interval)
  }

  /**
   * Stop auto-check interval.
   */
  stopAutoCheck(): void {
    if (this.autoCheckTimer) {
      clearInterval(this.autoCheckTimer)
      this.autoCheckTimer = null
    }
  }
}
