import fs from 'fs'
import path from 'path'
import type { EhuConfig } from './types'

const CONFIG_NAMES = ['ehu.config.ts', 'ehu.config.js', 'ehu.config.mjs']

/**
 * Load ehu.config.ts/js from the project root.
 * Uses esbuild to transpile TypeScript config on the fly.
 */
export async function loadConfig(projectRoot?: string): Promise<EhuConfig> {
  const root = projectRoot || process.cwd()

  for (const name of CONFIG_NAMES) {
    const configPath = path.join(root, name)
    if (!fs.existsSync(configPath)) continue

    if (name.endsWith('.ts')) {
      return await loadTsConfig(configPath)
    }

    // JS/MJS: use dynamic import or require
    if (name.endsWith('.mjs')) {
      const mod = await import(configPath)
      return mod.default || mod
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(configPath)
    return mod.default || mod
  }

  throw new Error(
    `No ehu config found. Create one of: ${CONFIG_NAMES.join(', ')}\n` +
    `Run 'ehu init' to generate a starter config.`,
  )
}

/**
 * Transpile and load a TypeScript config file using esbuild.
 */
async function loadTsConfig(configPath: string): Promise<EhuConfig> {
  const esbuild = await import('esbuild')
  const outfile = configPath.replace(/\.ts$/, '.config-compiled.mjs')

  try {
    await esbuild.build({
      entryPoints: [configPath],
      outfile,
      format: 'esm',
      platform: 'node',
      target: 'node18',
      bundle: true,
      external: ['@electron-hot-updater/*'],
      write: true,
    })

    const mod = await import(outfile)
    return mod.default || mod
  } finally {
    // Clean up compiled file
    try { if (fs.existsSync(outfile)) fs.unlinkSync(outfile) } catch { /* ignore */ }
  }
}
