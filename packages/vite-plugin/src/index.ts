import fs from 'fs'
import path from 'path'

export interface ElectronHotUpdaterViteOptions {
  /** Shell directory. Default: 'shell' */
  shellDir?: string
  /** Bootstrap file name. Default: 'bootstrap.js' */
  bootstrapFile?: string
  /** Project root. Default: process.cwd() */
  projectRoot?: string
  /** Vite build output dir. Default: '.vite/build' */
  buildDir?: string
}

/**
 * Vite plugin that injects bootstrap.js into the build output.
 *
 * During `electron-forge package/make`, this plugin:
 * 1. Copies `shell/` files into `.vite/build/shell/`
 * 2. Updates `.vite/build/package.json` main to `shell/bootstrap.js`
 *
 * In development (`electron-forge start`), the plugin is ignored —
 * your normal main.ts entry runs directly.
 *
 * Usage in vite.main.config.ts:
 * ```ts
 * import { electronHotUpdater } from '@electron-hot-updater/vite'
 * export default defineConfig({ plugins: [electronHotUpdater()] })
 * ```
 */
export function electronHotUpdater(opts: ElectronHotUpdaterViteOptions = {}): import('vite').Plugin {
  const {
    shellDir = 'shell',
    bootstrapFile = 'bootstrap.js',
    projectRoot = process.cwd(),
    buildDir = '.vite/build',
  } = opts

  const buildDirResolved = path.resolve(projectRoot, buildDir)
  let injected = false

  return {
    name: 'electron-hot-updater',
    apply: 'build',

    closeBundle() {
      if (injected) return
      injected = true

      const root = path.resolve(projectRoot)
      const shellSrc = path.join(root, shellDir)
      const shellDest = path.join(buildDirResolved, shellDir)

      // Copy shell files
      if (fs.existsSync(shellSrc)) {
        fs.mkdirSync(shellDest, { recursive: true })
        for (const file of fs.readdirSync(shellSrc)) {
          const src = path.join(shellSrc, file)
          const dest = path.join(shellDest, file)
          if (fs.statSync(src).isFile()) {
            fs.copyFileSync(src, dest)
          }
        }
      }

      // Update .vite/build/package.json main
      const pkgPath = path.join(buildDirResolved, 'package.json')
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
          pkg.main = `${shellDir}/${bootstrapFile}`
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
        } catch { /* ignore */ }
      }
    },
  }
}
