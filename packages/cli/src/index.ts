import { cac } from 'cac'

const cli = cac('ehu')

cli
  .command('init', 'Scaffold bootstrap.js and ehu.config.ts')
  .option('--force', 'Overwrite existing files')
  .option('--template <template>', 'Starter template variant')
  .action(async (options) => {
    const { init } = await import('./commands/init')
    init(options)
  })

cli
  .command('fingerprint', 'Calculate shell fingerprint')
  .option('--inject', 'Replace placeholder in shell/bootstrap.js')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { fingerprint } = await import('./commands/fingerprint')
    await fingerprint(options)
  })

cli
  .command('pack', 'Build code bundle (esbuild + zip)')
  .option('--env <env>', 'Environment name')
  .option('--version <version>', 'Override version')
  .option('--skip-renderer', 'Skip copying renderer dist')
  .action(async (options) => {
    const { pack } = await import('./commands/pack')
    await pack(options)
  })

cli
  .command('yml', 'Generate code-bundle-latest.yml')
  .option('--env <env>', 'Environment name')
  .option('--zip <path>', 'Explicit path to zip file')
  .option('--base-url <url>', 'Base URL prefix for file URLs')
  .action(async (options) => {
    const { yml } = await import('./commands/yml')
    await yml(options)
  })

cli
  .command('serve', 'Start local test update server')
  .option('--port <port>', 'Port number', { default: 51973 })
  .option('--run', 'Also launch Electron')
  .option('--auto-bump', 'Auto-increment patch version')
  .action(async (options) => {
    const { serve } = await import('./commands/serve')
    await serve({ ...options, port: Number(options.port) })
  })

cli.help()
cli.version('0.1.0')

cli.parse()

// Re-export defineConfig for ehu.config.ts usage
export { defineConfig } from './types'
export type { EhuConfig } from './types'
