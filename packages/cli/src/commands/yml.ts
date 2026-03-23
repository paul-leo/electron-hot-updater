import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { computeShellFingerprint, generateCodeBundleYml } from '@electron-hot-updater/core'
import { loadConfig } from '../config-loader'

/**
 * ehu yml — generate code-bundle-latest.yml from existing zip.
 */
export async function yml(options: {
  env?: string
  zip?: string
  baseUrl?: string
  projectRoot?: string
}): Promise<void> {
  const root = options.projectRoot || process.cwd()
  const config = await loadConfig(root)
  const outDir = path.resolve(root, config.outDir || 'dist-ehu')

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
  const version = pkg.version

  // Find zip file
  const zipPath = options.zip || path.join(outDir, 'code-bundle', `${version}.zip`)
  if (!fs.existsSync(zipPath)) {
    console.error(`Error: Code bundle zip not found: ${zipPath}`)
    console.error(`Run 'ehu pack' first.`)
    process.exit(1)
  }

  // Calculate SHA-512
  const buffer = fs.readFileSync(zipPath)
  const sha512 = crypto.createHash('sha512').update(buffer).digest('base64')
  const size = buffer.length

  // Calculate fingerprint
  const shellFingerprint = computeShellFingerprint({
    projectRoot: root,
    manifest: config.shell,
  })

  // Generate yml content
  const ymlContent = generateCodeBundleYml({
    version,
    shellFingerprint,
    sha512,
    size,
    fileName: `${version}.zip`,
  })

  // Write yml
  const ymlPath = path.join(outDir, 'code-bundle-latest.yml')
  fs.writeFileSync(ymlPath, ymlContent, 'utf-8')

  console.log(`\ncode-bundle-latest.yml generated`)
  console.log(`  version:          ${version}`)
  console.log(`  shellFingerprint: ${shellFingerprint}`)
  console.log(`  sha512:           ${sha512.substring(0, 24)}...`)
  console.log(`  size:             ${(size / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  path:             ${ymlPath}\n`)
}
