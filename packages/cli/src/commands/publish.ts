import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { loadConfig } from '../config-loader'

/**
 * ehu publish — publish code bundle to GitHub Releases.
 *
 * Uses `gh` CLI (GitHub CLI) to avoid heavy dependencies.
 * Requires: `gh auth login` before first use.
 */
export async function publish(options: {
  tag?: string
  draft?: boolean
  prerelease?: boolean
  assets?: string[]
  projectRoot?: string
}): Promise<void> {
  const root = options.projectRoot || process.cwd()
  const config = await loadConfig(root)
  const outDir = path.resolve(root, config.outDir || 'dist-ehu')

  // Verify gh CLI is available
  try {
    execSync('gh --version', { stdio: 'ignore' })
  } catch {
    console.error('Error: GitHub CLI (gh) is not installed.')
    console.error('Install it: https://cli.github.com/')
    process.exit(1)
  }

  // Verify gh is authenticated
  try {
    execSync('gh auth status', { stdio: 'ignore' })
  } catch {
    console.error('Error: Not logged in to GitHub CLI.')
    console.error('Run: gh auth login')
    process.exit(1)
  }

  // Read version
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
  const version = pkg.version
  const tag = options.tag || `v${version}`

  // Collect assets to upload
  const assets: string[] = []

  // Code bundle zip
  const zipPath = path.join(outDir, 'code-bundle', `${version}.zip`)
  if (fs.existsSync(zipPath)) {
    assets.push(zipPath)
    console.log(`  code-bundle/${version}.zip`)
  } else {
    console.error(`Error: Code bundle zip not found: ${zipPath}`)
    console.error(`Run 'ehu pack' first.`)
    process.exit(1)
  }

  // Code bundle yml
  const ymlPath = path.join(outDir, 'code-bundle-latest.yml')
  if (fs.existsSync(ymlPath)) {
    assets.push(ymlPath)
    console.log(`  code-bundle-latest.yml`)
  } else {
    console.error(`Error: code-bundle-latest.yml not found: ${ymlPath}`)
    console.error(`Run 'ehu yml' first.`)
    process.exit(1)
  }

  // Extra assets (e.g., .dmg, .exe from electron-builder)
  if (options.assets) {
    for (const assetPath of options.assets) {
      const resolved = path.resolve(root, assetPath)
      if (fs.existsSync(resolved)) {
        assets.push(resolved)
        console.log(`  ${path.basename(resolved)}`)
      } else {
        console.warn(`Warning: Asset not found, skipping: ${assetPath}`)
      }
    }
  }

  console.log(`\nPublishing ${tag} to GitHub Releases...\n`)

  // Check if release already exists
  let releaseExists = false
  try {
    execSync(`gh release view ${tag}`, { stdio: 'ignore', cwd: root })
    releaseExists = true
  } catch {
    releaseExists = false
  }

  if (releaseExists) {
    // Upload assets to existing release
    console.log(`Release ${tag} exists, uploading assets...`)
    const assetArgs = assets.map((a) => `"${a}"`).join(' ')
    execSync(`gh release upload ${tag} ${assetArgs} --clobber`, {
      stdio: 'inherit',
      cwd: root,
    })
  } else {
    // Create new release with assets
    const flags: string[] = []
    if (options.draft) flags.push('--draft')
    if (options.prerelease) flags.push('--prerelease')

    const assetArgs = assets.map((a) => `"${a}"`).join(' ')
    const title = `Release ${tag}`
    const notes = `Code bundle v${version}`

    execSync(
      `gh release create ${tag} ${assetArgs} --title "${title}" --notes "${notes}" ${flags.join(' ')}`,
      { stdio: 'inherit', cwd: root },
    )
  }

  console.log(`\nPublished to GitHub Releases: ${tag}`)
  console.log(`\nUpdate URL for clients:`)

  // Detect repo from git remote
  try {
    const remote = execSync('git remote get-url origin', { cwd: root, encoding: 'utf-8' }).trim()
    const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/)
    if (match) {
      const repo = match[1]
      console.log(`  https://github.com/${repo}/releases/latest/download`)
    }
  } catch {
    console.log(`  https://github.com/<owner>/<repo>/releases/latest/download`)
  }
}
