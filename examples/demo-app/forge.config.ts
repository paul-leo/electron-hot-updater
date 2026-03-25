import type { ForgeConfig } from '@electron-forge/shared-types'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { electronHotUpdater, ehuForgeHook } from '@electron-hot-updater/vite'

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
  // Inject bootstrap.js after packaging — runs after asar is created
  hooks: {
    ...ehuForgeHook({ shellDir: 'shell' }),
  },
}

export default config
