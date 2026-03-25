import { defineConfig } from 'vite'
import { electronHotUpdater } from '@electron-hot-updater/vite'

export default defineConfig({
  plugins: [
    electronHotUpdater(),  // ← auto-injects shell/bootstrap.js into build output
  ],
  build: {
    rollupOptions: {
      external: [
        'electron',
        'path',
        'fs',
        'crypto',
        'http',
        'https',
        'child_process',
        'events',
        'os',
        'url',
        'util',
        'net',
        'stream',
        'zlib',
      ],
    },
  },
})
