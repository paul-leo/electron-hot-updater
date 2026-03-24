import type { ForgeConfig } from '@electron-forge/shared-types'
import { VitePlugin } from '@electron-forge/plugin-vite'
import fs from 'fs'
import path from 'path'

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // afterCopy runs after app source is copied to the staging directory,
    // before asar archive is created. This is the correct place to inject bootstrap.js.
    afterCopy: [
      (buildPath: string, _electronVersion: string, _platform: string, _arch: string, callback: (err?: Error) => void) => {
        try {
          const projectRoot = path.resolve(__dirname)
          const bootstrapSrc = path.join(projectRoot, 'shell', 'bootstrap.js')
          if (!fs.existsSync(bootstrapSrc)) {
            callback()
            return
          }

          // Copy bootstrap.js to build path
          const shellDest = path.join(buildPath, 'shell')
          fs.mkdirSync(shellDest, { recursive: true })
          fs.copyFileSync(bootstrapSrc, path.join(shellDest, 'bootstrap.js'))

          // Copy loading.html
          const loadingSrc = path.join(projectRoot, 'shell', 'loading.html')
          if (fs.existsSync(loadingSrc)) {
            fs.copyFileSync(loadingSrc, path.join(shellDest, 'loading.html'))
          }

          // Modify package.json to point main to bootstrap.js
          const pkgPath = path.join(buildPath, 'package.json')
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
            pkg.main = 'shell/bootstrap.js'
            fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
          }

          console.log('[forge] Injected bootstrap.js as production entry point')
          callback()
        } catch (err) {
          callback(err as Error)
        }
      },
    ],
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
}

export default config
