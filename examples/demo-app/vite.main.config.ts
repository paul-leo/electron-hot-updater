import { defineConfig } from 'vite'

export default defineConfig({
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
