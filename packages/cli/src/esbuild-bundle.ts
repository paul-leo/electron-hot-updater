import type { EhuConfig } from './types'

const DEFAULT_EXTERNALS = ['electron']

/**
 * Bundle the main process entry into a single main.bundle.js using esbuild.
 */
export async function bundleMainProcess(
  config: EhuConfig,
  outfile: string,
  projectRoot: string,
): Promise<{ outfile: string; errors: string[] }> {
  const esbuild = await import('esbuild')
  const path = await import('path')

  const entry = path.resolve(projectRoot, config.main.entry)
  const external = config.main.external ?? DEFAULT_EXTERNALS
  const target = config.main.target ?? 'node20'

  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    target,
    format: 'cjs',
    outfile,
    external,
    sourcemap: false,
    minify: false,
    logLevel: 'warning',
  })

  const errors = result.errors.map((e) => e.text)
  return { outfile, errors }
}
