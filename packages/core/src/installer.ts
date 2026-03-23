import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execSync } from 'child_process'
import type { BundleMeta, InstallResult, Logger, UpdateInfo } from './types'
import { defaultLogger } from './logger'

export interface InstallerOptions {
  userDataDir: string
  shellFingerprint: string
  logger?: Logger
}

/**
 * Unzip a file to a directory using system tools.
 */
function unzipToDir(zipPath: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true })

  if (process.platform === 'win32') {
    execSync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`,
      { timeout: 60_000 },
    )
  } else {
    execSync(`unzip -o -q "${zipPath}" -d "${destDir}"`, { timeout: 60_000 })
  }
}

/**
 * Verify SHA-512 hash of a file against expected value (base64).
 */
function verifySha512(filePath: string, expected: string): boolean {
  const buffer = fs.readFileSync(filePath)
  const actual = crypto.createHash('sha512').update(buffer).digest('base64')
  return actual === expected
}

/**
 * Download info → install code bundle to userData.
 *
 * Steps:
 * 1. Verify SHA-512
 * 2. Unzip to temp dir
 * 3. Update meta.json
 * 4. Verify main.bundle.js exists
 * 5. Atomic replace (rename on Unix, pending dir on Windows)
 * 6. Clean up
 */
export function installCodeBundle(
  zipPath: string,
  info: UpdateInfo,
  options: InstallerOptions,
): InstallResult {
  const { userDataDir, shellFingerprint, logger: log = defaultLogger } = options
  const bundleDir = path.join(userDataDir, `code-bundle-${shellFingerprint}`)
  const tmpDir = path.join(userDataDir, 'code-bundle-tmp')
  const crashFile = path.join(userDataDir, 'code-bundle-crash.json')

  try {
    // 1. Clean temp dir
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }

    // 2. SHA-512 verification
    if (info.sha512) {
      if (!verifySha512(zipPath, info.sha512)) {
        throw new Error('SHA-512 verification failed')
      }
      log.info('SHA-512 verification passed')
    }

    // 3. Unzip
    log.info('Extracting code bundle...')
    unzipToDir(zipPath, tmpDir)

    // 4. Update meta.json
    const metaPath = path.join(tmpDir, 'meta.json')
    let meta: Partial<BundleMeta> = {}
    try {
      if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    } catch { /* ignore */ }
    meta.version = info.version
    meta.shellFingerprint = info.shellFingerprint || meta.shellFingerprint || shellFingerprint
    meta.installedAt = Date.now()
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

    // 5. Verify main.bundle.js
    const mainBundle = path.join(tmpDir, 'main.bundle.js')
    if (!fs.existsSync(mainBundle)) {
      throw new Error('Extracted bundle missing main.bundle.js')
    }

    // 6. Atomic replace
    const pendingDir = bundleDir + '-pending'
    if (process.platform === 'win32') {
      // Windows: write to pending dir, bootstrap applies on next launch
      try {
        if (fs.existsSync(pendingDir)) fs.rmSync(pendingDir, { recursive: true, force: true })
      } catch { /* ignore */ }
      fs.renameSync(tmpDir, pendingDir)
      log.info('Windows: wrote pending bundle, will apply on relaunch')
    } else {
      // macOS/Linux: direct atomic rename
      const backupDir = bundleDir + '-backup'
      try {
        if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true })
      } catch { /* ignore */ }

      if (fs.existsSync(bundleDir)) {
        fs.renameSync(bundleDir, backupDir)
      }

      try {
        fs.renameSync(tmpDir, bundleDir)
      } catch (renameErr) {
        // Rollback
        if (fs.existsSync(backupDir)) {
          try { fs.renameSync(backupDir, bundleDir) } catch { /* ignore */ }
        }
        throw renameErr
      }

      try {
        if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true })
      } catch { /* ignore */ }
      log.info(`Bundle installed to: ${bundleDir}`)
    }

    // 7. Clean up zip and crash record
    try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath) } catch { /* ignore */ }
    try { if (fs.existsSync(crashFile)) fs.unlinkSync(crashFile) } catch { /* ignore */ }

    log.info(`Code bundle v${info.version} installed successfully`)
    return { success: true }
  } catch (e: unknown) {
    // Clean up on failure
    try {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch { /* ignore */ }
    try {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)
    } catch { /* ignore */ }

    const msg = e instanceof Error ? e.message : String(e)
    log.error(`Installation failed: ${msg}`)
    return { success: false, error: msg }
  }
}
