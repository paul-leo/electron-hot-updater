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
    // In production builds, inject bootstrap.js as the real entry point
    packageAfterCopy: async (_config, buildPath) => {
      const bootstrapSrc = path.join(__dirname, 'shell', 'bootstrap.js')
      if (!fs.existsSync(bootstrapSrc)) return

      // Copy bootstrap.js to build path
      const bootstrapDest = path.join(buildPath, 'shell', 'bootstrap.js')
      fs.mkdirSync(path.dirname(bootstrapDest), { recursive: true })
      fs.copyFileSync(bootstrapSrc, bootstrapDest)

      // Copy loading.html
      const loadingSrc = path.join(__dirname, 'shell', 'loading.html')
      if (fs.existsSync(loadingSrc)) {
        fs.copyFileSync(loadingSrc, path.join(buildPath, 'shell', 'loading.html'))
      }

      // Modify package.json to point main to bootstrap.js
      const pkgPath = path.join(buildPath, 'package.json')
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      pkg.main = 'shell/bootstrap.js'
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))

      console.log('[forge] Injected bootstrap.js as production entry point')
    },
  },
}

export default config
