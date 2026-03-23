import http from 'http'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execSync, spawn, type ChildProcess } from 'child_process'
import { computeShellFingerprint, generateCodeBundleYml } from '@electron-hot-updater/core'
import { loadConfig } from '../config-loader'
import { bundleMainProcess } from '../esbuild-bundle'

const DEFAULT_PORT = 51973

/**
 * ehu serve — start local HTTP server for testing hot updates.
 */
export async function serve(options: {
  port?: number
  run?: boolean
  autoBump?: boolean
  projectRoot?: string
}): Promise<void> {
  const root = options.projectRoot || process.cwd()
  const port = options.port || DEFAULT_PORT
  const config = await loadConfig(root)
  const serveDir = path.join(root, '.test-update-server')

  // Generate test bundle
  console.log('Generating test code bundle...\n')
  await generateTestBundle(root, config, serveDir, options.autoBump)

  // Start HTTP server
  const server = startServer(serveDir, port)

  // Optionally launch Electron
  let child: ChildProcess | null = null
  if (options.run) {
    setTimeout(() => {
      child = launchElectron(root, port)
    }, 500)
  }

  // Cleanup on exit
  process.on('SIGINT', () => {
    console.log('\nCleaning up...')
    if (child) child.kill()
    server.close()
    if (fs.existsSync(serveDir)) fs.rmSync(serveDir, { recursive: true, force: true })
    process.exit(0)
  })
}

async function generateTestBundle(
  root: string,
  config: Awaited<ReturnType<typeof loadConfig>>,
  serveDir: string,
  autoBump?: boolean,
): Promise<void> {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
  let version = pkg.version

  if (autoBump) {
    const parts = version.split('.')
    parts[2] = String(parseInt(parts[2], 10) + 1)
    version = parts.join('.')
  }

  console.log(`  Current: ${pkg.version}`)
  console.log(`  Test:    ${version}`)

  // Clean serve dir
  if (fs.existsSync(serveDir)) {
    fs.rmSync(serveDir, { recursive: true, force: true })
  }

  const bundleDir = path.join(serveDir, 'code-bundle')
  const tmpDir = path.join(serveDir, '_tmp')
  fs.mkdirSync(bundleDir, { recursive: true })
  fs.mkdirSync(tmpDir, { recursive: true })

  // 1. esbuild bundle
  console.log('  Bundling main process...')
  const { outfile, errors } = await bundleMainProcess(
    config,
    path.join(tmpDir, 'main.bundle.js'),
    root,
  )
  if (errors.length > 0) {
    console.error('esbuild failed:', errors)
    process.exit(1)
  }
  const size = fs.statSync(outfile).size
  console.log(`  main.bundle.js (${(size / 1024).toFixed(1)} KB)`)

  // 2. Placeholder renderer
  const rendererDest = path.join(tmpDir, config.renderer.distDir)
  fs.mkdirSync(rendererDest, { recursive: true })

  // Try copying real renderer output, fall back to placeholder
  const rendererSrc = path.resolve(root, config.renderer.distDir)
  if (fs.existsSync(rendererSrc)) {
    copyDir(rendererSrc, rendererDest)
  } else {
    fs.writeFileSync(
      path.join(rendererDest, 'index.html'),
      `<html><body>Code Bundle Test v${version}</body></html>`,
    )
  }

  // 3. meta.json
  const fingerprint = computeShellFingerprint({
    projectRoot: root,
    manifest: config.shell,
  })
  // In dev mode, fingerprint placeholder matches bootstrap.js placeholder
  const metaFingerprint = '__SHELL_FINGERPRINT__'
  const meta = {
    version,
    shellFingerprint: metaFingerprint,
    createdAt: new Date().toISOString(),
  }
  fs.writeFileSync(path.join(tmpDir, 'meta.json'), JSON.stringify(meta, null, 2))

  // 4. Zip
  const zipName = `${version}.zip`
  const zipPath = path.join(bundleDir, zipName)

  if (process.platform === 'win32') {
    execSync(`powershell -Command "Compress-Archive -Path '${tmpDir}/*' -DestinationPath '${zipPath}' -Force"`)
  } else {
    execSync(`cd "${tmpDir}" && zip -r -q "${zipPath}" .`)
  }
  fs.rmSync(tmpDir, { recursive: true, force: true })

  // 5. Generate yml
  const zipBuffer = fs.readFileSync(zipPath)
  const sha512 = crypto.createHash('sha512').update(zipBuffer).digest('base64')

  const ymlContent = generateCodeBundleYml({
    version,
    shellFingerprint: metaFingerprint,
    sha512,
    size: zipBuffer.length,
    fileName: zipName,
  })
  fs.writeFileSync(path.join(serveDir, 'code-bundle-latest.yml'), ymlContent)

  console.log(`  ${zipName} (${(zipBuffer.length / 1024).toFixed(1)} KB)\n`)
}

function startServer(serveDir: string, port: number): http.Server {
  const mimeTypes: Record<string, string> = {
    '.yml': 'text/yaml',
    '.yaml': 'text/yaml',
    '.zip': 'application/zip',
    '.json': 'application/json',
    '.txt': 'text/plain',
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`)
    const filePath = path.join(serveDir, url.pathname)

    console.log(`  ${req.method} ${url.pathname}`)

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404)
      res.end('Not Found')
      return
    }

    const ext = path.extname(filePath)
    const contentType = mimeTypes[ext] || 'application/octet-stream'
    const stat = fs.statSync(filePath)

    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    })
    fs.createReadStream(filePath).pipe(res)
  })

  server.listen(port, () => {
    console.log(`Update server: http://localhost:${port}\n`)
  })

  return server
}

function launchElectron(root: string, port: number): ChildProcess {
  console.log('Launching Electron...')
  let electronPath: string
  try {
    electronPath = require('electron') as unknown as string
  } catch {
    console.error('Error: electron not found. Install it as a devDependency.')
    process.exit(1)
  }

  const child = spawn(electronPath, ['.'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      UPDATE_SERVER_URL: `http://localhost:${port}`,
    },
    stdio: 'inherit',
  })

  child.on('exit', (code) => {
    if (code === 0) console.log('Electron exited (may be relaunching)')
    else console.log(`Electron exited with code: ${code}`)
  })

  return child
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
