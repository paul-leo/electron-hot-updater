import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['electron', 'electron-updater'],
  platform: 'node',
  target: 'node18',
  splitting: false,
  sourcemap: true,
})
