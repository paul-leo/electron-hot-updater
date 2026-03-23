import fs from 'fs'
import path from 'path'
import { isCrashLooping } from './crash-guard'
import type { BundleMeta, Logger } from './types'
import { defaultLogger } from './logger'

export interface BundleResolverOptions {
  userDataDir: string
  shellFingerprint: string
  appVersion: string
  maxCrashes?: number
  crashWindow?: number
  logger?: Logger
}

export interface ResolvedBundle {
  path: string
  version: string
  meta: BundleMeta
}

/**
 * Apply pending code bundle (Windows: file locks prevent rename during running process,
 * so we write to -pending dir and apply on next launch).
 */
function applyPendingBundle(bundleDir: string, logger: Logger): void {
  const pendingDir = bundleDir + '-pending'
  if (!fs.existsSync(pendingDir)) return

  try {
    const backupDir = bundleDir + '-backup'
    if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true })
    if (fs.existsSync(bundleDir)) fs.renameSync(bundleDir, backupDir)
    fs.renameSync(pendingDir, bundleDir)
    if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true })
    logger.info('Applied pending code bundle')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error(`Failed to apply pending code bundle: ${msg}`)
    try {
      if (fs.existsSync(pendingDir)) fs.rmSync(pendingDir, { recursive: true, force: true })
    } catch { /* ignore */ }
  }
}

/**
 * Clean up code bundle directories that don't match the current shell fingerprint.
 */
function cleanStaleBundles(userDataDir: string, currentFingerprint: string, prefix: string, logger: Logger): void {
  try {
    const currentDirName = `${prefix}-${currentFingerprint}`
    const entries = fs.readdirSync(userDataDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith(`${prefix}-`) && entry.name !== currentDirName) {
        const stalePath = path.join(userDataDir, entry.name)
        logger.info(`Cleaning stale code bundle: ${entry.name}`)
        try { fs.rmSync(stalePath, { recursive: true, force: true }) } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
}

/**
 * Detect if the app was reinstalled by checking executable ctime.
 * ctime changes on any form of installation but not on normal restarts.
 */
function detectReinstall(userDataDir: string, logger: Logger): boolean {
  const installIdFile = path.join(userDataDir, 'code-bundle-install-id.txt')
  try {
    const currentCtime = String(fs.statSync(process.execPath).ctimeMs)
    const lastCtime = fs.existsSync(installIdFile) ? fs.readFileSync(installIdFile, 'utf-8').trim() : ''

    if (lastCtime && currentCtime && lastCtime !== currentCtime) {
      logger.info(`Reinstall detected (ctime ${lastCtime} -> ${currentCtime})`)
      return true
    }
  } catch { /* ignore */ }
  return false
}

/**
 * Save current executable ctime for reinstall detection on next launch.
 */
export function saveInstallId(userDataDir: string): void {
  const installIdFile = path.join(userDataDir, 'code-bundle-install-id.txt')
  try {
    const ctime = String(fs.statSync(process.execPath).ctimeMs)
    fs.writeFileSync(installIdFile, ctime)
  } catch { /* ignore */ }
}

/**
 * Resolve the best available code bundle from userData.
 * Returns null if no valid bundle is found (falls back to built-in code).
 */
export function resolveBundle(options: BundleResolverOptions): ResolvedBundle | null {
  const {
    userDataDir,
    shellFingerprint,
    logger: log = defaultLogger,
    maxCrashes,
    crashWindow,
  } = options

  const prefix = 'code-bundle'
  const bundleDir = path.join(userDataDir, `${prefix}-${shellFingerprint}`)
  const metaFile = path.join(bundleDir, 'meta.json')

  // Apply pending bundle (Windows atomic replacement)
  applyPendingBundle(bundleDir, log)

  // Clean stale bundles from other shell versions
  cleanStaleBundles(userDataDir, shellFingerprint, prefix, log)

  try {
    if (!fs.existsSync(metaFile)) return null
    const meta: BundleMeta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'))

    log.info(`Found code bundle: v${meta.version}, fingerprint=${shellFingerprint}`)

    // Reinstall detection
    if (detectReinstall(userDataDir, log)) {
      log.info('Clearing code bundle due to reinstall')
      try { fs.rmSync(bundleDir, { recursive: true, force: true }) } catch { /* ignore */ }
      return null
    }

    // Entry file check
    const bundleEntry = path.join(bundleDir, 'main.bundle.js')
    if (!fs.existsSync(bundleEntry)) {
      log.info('Code bundle missing main.bundle.js, skipping')
      return null
    }

    // Crash protection
    if (isCrashLooping({ userDataDir, maxCrashes, crashWindow })) {
      log.info('Crash loop detected, deleting code bundle, reverting to built-in')
      try { fs.rmSync(bundleDir, { recursive: true, force: true }) } catch { /* ignore */ }
      try { fs.unlinkSync(path.join(userDataDir, 'code-bundle-crash.json')) } catch { /* ignore */ }
      return null
    }

    log.info(`Loading code bundle: v${meta.version}`)
    return { path: bundleDir, version: meta.version, meta }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    log.error(`Failed to read code bundle: ${msg}`)
    return null
  }
}
