import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { FingerprintOptions } from './types'

const TEXT_EXTS = new Set(['.js', '.ts', '.html', '.css', '.json', '.yml', '.yaml', '.md', '.txt'])

/**
 * Read file content, normalizing line endings for text files (remove \r)
 * to ensure consistent hashes across Windows/macOS/Linux.
 */
function readFileNormalized(filePath: string): Buffer {
  const ext = path.extname(filePath).toLowerCase()
  const buf = fs.readFileSync(filePath)
  if (TEXT_EXTS.has(ext)) {
    return Buffer.from(buf.toString('utf-8').replace(/\r/g, ''))
  }
  return buf
}

/**
 * Recursively hash all files in a directory (sorted alphabetically for determinism).
 */
function hashDir(hash: crypto.Hash, dir: string): void {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of entries) {
    const p = path.join(dir, entry.name)
    hash.update(`name:${entry.name}\n`)
    if (entry.isDirectory()) {
      hashDir(hash, p)
    } else {
      hash.update(readFileNormalized(p))
    }
  }
}

/**
 * Compute Shell fingerprint — a 16-char hex SHA-256 hash based on:
 * 1. Production dependency versions (from package.json dependencies, NOT devDependencies)
 * 2. Shell layer file contents
 *
 * Any change to these → new fingerprint → full update required.
 */
export function computeShellFingerprint(options: FingerprintOptions): string {
  const root = options.projectRoot || process.cwd()
  const { manifest } = options
  const hash = crypto.createHash('sha256')

  // 1. Production dependency versions
  const pkgPath = path.join(root, 'package.json')
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))

    let depsToHash: string[]

    if (manifest.dependencies && manifest.dependencies.length > 0) {
      // Legacy whitelist mode (deprecated)
      console.warn(
        '[ehu] shell.dependencies is deprecated. '
        + 'All package.json dependencies are now auto-hashed. '
        + 'Use shell.ignoreDependencies to exclude specific packages.',
      )
      depsToHash = [...manifest.dependencies].sort()
    } else {
      // Auto mode: hash all production dependencies, excluding ignoreDependencies
      const allDeps = Object.keys(pkg.dependencies || {})
      const ignore = new Set(manifest.ignoreDependencies || [])
      depsToHash = allDeps.filter(d => !ignore.has(d)).sort()
    }

    for (const dep of depsToHash) {
      const ver = pkg.dependencies?.[dep] || 'none'
      hash.update(`dep:${dep}:${ver}\n`)
    }
  }

  // 2. Shell layer file contents
  for (const file of manifest.files) {
    const fullPath = path.resolve(root, file)
    if (!fs.existsSync(fullPath)) {
      hash.update(`missing:${file}\n`)
      continue
    }
    hash.update(`path:${file}\n`)
    if (fs.statSync(fullPath).isDirectory()) {
      hashDir(hash, fullPath)
    } else {
      hash.update(readFileNormalized(fullPath))
    }
  }

  return hash.digest('hex').substring(0, 16)
}
