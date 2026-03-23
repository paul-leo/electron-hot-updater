import fs from 'fs'
import path from 'path'
import { computeShellFingerprint } from '@electron-hot-updater/core'
import { loadConfig } from '../config-loader'

/**
 * ehu fingerprint — calculate and optionally inject shell fingerprint.
 */
export async function fingerprint(options: {
  inject?: boolean
  json?: boolean
  projectRoot?: string
}): Promise<void> {
  const root = options.projectRoot || process.cwd()
  const config = await loadConfig(root)

  const fp = computeShellFingerprint({
    projectRoot: root,
    manifest: config.shell,
  })

  if (options.json) {
    console.log(JSON.stringify({ fingerprint: fp }))
    return
  }

  console.log(`Shell fingerprint: ${fp}`)

  if (options.inject) {
    const bootstrapPath = path.join(root, 'shell', 'bootstrap.js')
    if (!fs.existsSync(bootstrapPath)) {
      console.error(`Error: shell/bootstrap.js not found. Run 'ehu init' first.`)
      process.exit(1)
    }

    let content = fs.readFileSync(bootstrapPath, 'utf-8')
    const placeholder = '__SHELL_FINGERPRINT__'
    if (!content.includes(placeholder)) {
      console.error(`Error: ${placeholder} placeholder not found in bootstrap.js`)
      process.exit(1)
    }

    content = content.replace(new RegExp(placeholder, 'g'), fp)
    fs.writeFileSync(bootstrapPath, content)
    console.log(`Injected fingerprint into shell/bootstrap.js`)
  }
}
