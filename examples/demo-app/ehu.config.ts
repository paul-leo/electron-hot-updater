import { defineConfig } from '@electron-hot-updater/cli'

export default defineConfig({
  shell: {
    files: [
      'shell/bootstrap.js',
      'shell/loading.html',
    ],
    // All production dependencies are auto-hashed from package.json.
    // ignoreDependencies: [],
  },

  main: {
    entry: '.vite/build/main.js',
    external: ['electron'],
    target: 'node20',
  },

  renderer: {
    distDir: '.vite/build/renderer',
  },

  preload: {
    files: ['.vite/build/preload.js'],
  },

  updateUrl: 'http://localhost:51973',
  outDir: 'dist-ehu',
})
