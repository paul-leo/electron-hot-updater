import type { ForgeConfig } from '@electron-forge/shared-types'
import { VitePlugin } from '@electron-forge/plugin-vite'
import fs from 'fs'
import path from 'path'

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
  },
  makers: [
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-squirrel', config: {} },
    { name: '@electron-forge/maker-deb', config: {} },
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: './vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: './vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: './vite.renderer.config.ts',
        },
      ],
    }),
  ],
  hooks: {
    // postPackage runs after the app is fully packaged.
    // We modify the asar to inject bootstrap.js and update package.json main.
    postPackage: async (_config, result) => {
      for (const outputPath of result.outputPaths) {
        // Find the app.asar
        let asarPath: string
        if (process.platform === 'darwin' || result.platform === 'darwin') {
          const appName = fs.readdirSync(outputPath).find((f) => f.endsWith('.app'))
          if (!appName) continue
          asarPath = path.join(outputPath, appName, 'Contents', 'Resources', 'app.asar')
        } else {
          asarPath = path.join(outputPath, 'resources', 'app.asar')
        }

        if (!fs.existsSync(asarPath)) {
          console.log('[forge] app.asar not found, skipping bootstrap injection')
          continue
        }

        // Extract asar, inject bootstrap, repack
        const asar = require('@electron/asar')
        const tmpDir = path.join(outputPath, '_asar_tmp')

        asar.extractAll(asarPath, tmpDir)

        // Copy shell files
        const projectRoot = path.resolve(__dirname)
        const shellDest = path.join(tmpDir, 'shell')
        fs.mkdirSync(shellDest, { recursive: true })

        const bootstrapSrc = path.join(projectRoot, 'shell', 'bootstrap.js')
        if (fs.existsSync(bootstrapSrc)) {
          fs.copyFileSync(bootstrapSrc, path.join(shellDest, 'bootstrap.js'))
        }

        const loadingSrc = path.join(projectRoot, 'shell', 'loading.html')
        if (fs.existsSync(loadingSrc)) {
          fs.copyFileSync(loadingSrc, path.join(shellDest, 'loading.html'))
        }

        // Modify package.json main entry
        const pkgPath = path.join(tmpDir, 'package.json')
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
          pkg.main = 'shell/bootstrap.js'
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
        }

        // Repack asar
        await asar.createPackage(tmpDir, asarPath)
        fs.rmSync(tmpDir, { recursive: true, force: true })

        console.log('[forge] Injected bootstrap.js into app.asar')
      }
    },
  },
}

export default config
