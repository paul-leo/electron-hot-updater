import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { computeShellFingerprint } from '@electron-hot-updater/core'
import { loadConfig } from '../config-loader'
import { bundleMainProcess } from '../esbuild-bundle'

/**
 * ehu pack — build code bundle: esbuild main + copy renderer + meta.json + zip.
 */
export async function pack(options: {
  env?: string
  version?: string
  projectRoot?: string
  skipRenderer?: boolean
}): Promise<string> {
  const root = options.projectRoot || process.cwd()
  const config = await loadConfig(root)
  const outDir = path.resolve(root, config.outDir || 'dist-ehu')

  // Read version from package.json
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
  const version = options.version || pkg.version

  const codeBundleDir = path.join(outDir, 'code-bundle')
  const zipPath = path.join(codeBundleDir, `${version}.zip`)

  console.log(`\nPacking Code Bundle v${version}\n`)

  fs.mkdirSync(codeBundleDir, { recursive: true })

  const tmpDir = path.join(outDir, '_code_bundle_tmp')
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
  fs.mkdirSync(tmpDir, { recursive: true })

  // 1. esbuild bundle main process
  console.log('  [1/5] Bundling main process with esbuild...')
  const bundleResult = await bundleMainProcess(
    config,
    path.join(tmpDir, 'main.bundle.js'),
    root,
  )
  if (bundleResult.errors.length > 0) {
    console.error('  esbuild failed:', bundleResult.errors)
    process.exit(1)
  }
  const bundleSize = fs.statSync(bundleResult.outfile).size
  console.log(`  main.bundle.js (${(bundleSize / 1024).toFixed(1)} KB)`)

  // 2. Copy preload files
  if (config.preload?.files) {
    console.log('  [2/5] Copying preload files...')
    let count = 0
    for (const file of config.preload.files) {
      const srcPath = path.resolve(root, file)
      if (fs.existsSync(srcPath)) {
        const destPath = path.join(tmpDir, file)
        fs.mkdirSync(path.dirname(destPath), { recursive: true })
        fs.copyFileSync(srcPath, destPath)
        count++
      }
    }
    console.log(`  ${count} preload file(s) copied`)
  }

  // 3. Copy renderer output
  if (!options.skipRenderer) {
    console.log('  [3/5] Copying renderer output...')
    const rendererSrc = path.resolve(root, config.renderer.distDir)
    const rendererDest = path.join(tmpDir, config.renderer.distDir)
    if (fs.existsSync(rendererSrc)) {
      copyDir(rendererSrc, rendererDest)
      const fileCount = countFiles(rendererDest)
      console.log(`  ${config.renderer.distDir} (${fileCount} files)`)
    } else {
      console.log(`  Warning: ${config.renderer.distDir} not found, skipping`)
      fs.mkdirSync(rendererDest, { recursive: true })
    }
  }

  // 4. Copy extra files
  if (config.extraFiles) {
    for (const { from, to } of config.extraFiles) {
      const srcPath = path.resolve(root, from)
      const destPath = path.join(tmpDir, to)
      if (fs.existsSync(srcPath)) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true })
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }

  // 5. Write meta.json
  console.log('  [4/5] Writing meta.json...')
  const shellFingerprint = computeShellFingerprint({
    projectRoot: root,
    manifest: config.shell,
  })
  const meta = {
    version,
    shellFingerprint,
    createdAt: new Date().toISOString(),
  }
  fs.writeFileSync(path.join(tmpDir, 'meta.json'), JSON.stringify(meta, null, 2))
  console.log(`  version=${version}, fingerprint=${shellFingerprint}`)

  // 6. Create zip
  console.log('  [5/5] Creating zip...')
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)

  if (process.platform === 'win32') {
    execSync(`powershell -Command "Compress-Archive -Path '${tmpDir}/*' -DestinationPath '${zipPath}' -Force"`)
  } else {
    execSync(`cd "${tmpDir}" && zip -r -q "${zipPath}" .`)
  }

  // Clean up tmp
  fs.rmSync(tmpDir, { recursive: true, force: true })

  const zipSize = fs.statSync(zipPath).size
  console.log(`\n  ${path.basename(zipPath)} (${(zipSize / 1024 / 1024).toFixed(2)} MB)`)
  console.log(`  ${codeBundleDir}\n`)

  return zipPath
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

function countFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0
  let count = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    count += entry.isDirectory() ? countFiles(path.join(dir, entry.name)) : 1
  }
  return count
}
