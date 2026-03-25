import fs from 'fs'
import path from 'path'
import { generateBootstrapSource } from '@electron-hot-updater/core'

/**
 * ehu init — scaffold bootstrap.js and ehu.config.ts in the current project.
 */
export function init(options: { force?: boolean; template?: string } = {}): void {
  const root = process.cwd()

  // Generate shell/bootstrap.js
  const shellDir = path.join(root, 'shell')
  const bootstrapPath = path.join(shellDir, 'bootstrap.js')

  if (fs.existsSync(bootstrapPath) && !options.force) {
    console.log(`shell/bootstrap.js already exists. Use --force to overwrite.`)
  } else {
    fs.mkdirSync(shellDir, { recursive: true })
    fs.writeFileSync(bootstrapPath, generateBootstrapSource())
    console.log(`Created shell/bootstrap.js`)
  }

  // Generate shell/loading.html
  const loadingPath = path.join(shellDir, 'loading.html')
  if (!fs.existsSync(loadingPath) || options.force) {
    fs.writeFileSync(loadingPath, generateLoadingHtml())
    console.log(`Created shell/loading.html`)
  }

  // Generate ehu.config.ts
  const configPath = path.join(root, 'ehu.config.ts')
  if (fs.existsSync(configPath) && !options.force) {
    console.log(`ehu.config.ts already exists. Use --force to overwrite.`)
  } else {
    fs.writeFileSync(configPath, generateConfigTemplate())
    console.log(`Created ehu.config.ts`)
  }

  console.log(`\nDone! Next steps:`)
  console.log(`  1. Review ehu.config.ts and adjust paths for your project`)
  console.log(`  2. Add forge hooks to inject bootstrap.js in production builds`)
  console.log(`  3. Run 'ehu fingerprint' to verify the shell fingerprint`)
}

function generateConfigTemplate(): string {
  return `import { defineConfig } from '@electron-hot-updater/cli'

export default defineConfig({
  shell: {
    files: [
      'shell/bootstrap.js',
      'shell/loading.html',
    ],
    // All production dependencies from package.json are auto-hashed.
    // Uncomment below to exclude specific packages:
    // ignoreDependencies: ['some-pure-js-dep'],
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

  // extraFiles: [
  //   { from: 'some/file.json', to: 'config.json' },
  // ],

  updateUrl: 'https://your-cdn.com/releases',
  outDir: 'dist-ehu',
})
`
}

function generateLoadingHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: #1a1a2e;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .loader {
      text-align: center;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #333;
      border-top-color: #6c63ff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <div>Loading...</div>
  </div>
</body>
</html>
`
}
