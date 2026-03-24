# electron-hot-updater

Incremental hot update solution for Electron apps. Split your app into **Shell** (runtime) and **Code Bundle** (business code) — update the code bundle without reinstalling.

```
Full Update:  170MB download → quit app → run installer → restart (30-60s)
Hot Update:    49MB download → relaunch (1s)
```

## How It Works

```
┌─────────────────────────────────────────────┐
│ Shell (rarely changes)                       │
│ Chromium + Node.js + Native Modules          │
│ + bootstrap.js (entry point)                 │
├─────────────────────────────────────────────┤
│ Code Bundle (frequently changes)             │
│ Business code + Renderer assets              │
│ Stored in userData, loaded at startup        │
└─────────────────────────────────────────────┘
```

**bootstrap.js** decides at startup:
- Code bundle exists + valid → load `main.bundle.js` from userData
- No code bundle or invalid → load built-in code

**Shell Fingerprint** (16-char SHA-256) ensures compatibility:
- Same fingerprint → incremental update (code bundle only)
- Different fingerprint → full update required

## Packages

| Package | Description |
|---------|-------------|
| `@electron-hot-updater/core` | Runtime SDK: bootstrap loader, updater client, fingerprint calculator |
| `@electron-hot-updater/cli` | CLI tool: pack code bundles, generate manifests, local test server |

## Quick Start

### 1. Install

```bash
npm install @electron-hot-updater/core
npm install -D @electron-hot-updater/cli
```

### 2. Initialize

```bash
npx ehu init
```

This creates:
- `shell/bootstrap.js` — production entry point
- `ehu.config.ts` — configuration file

### 3. Configure

Edit `ehu.config.ts`:

```typescript
import { defineConfig } from '@electron-hot-updater/cli'

export default defineConfig({
  shell: {
    files: ['shell/bootstrap.js', 'shell/loading.html'],
    dependencies: ['electron'],
  },
  main: {
    entry: '.vite/build/main.js',
    external: ['electron'],
  },
  renderer: {
    distDir: '.vite/build/renderer',
  },
  updateUrl: 'https://your-cdn.com/releases',
})
```

### 4. Integrate in Main Process

```typescript
import { HotUpdater, registerIpcHandlers } from '@electron-hot-updater/core'

const updater = new HotUpdater({
  updateUrl: 'https://your-cdn.com/releases',
  autoCheckInterval: 3600000, // 1 hour
})

app.whenReady().then(() => {
  registerIpcHandlers(updater)
  updater.mainWindow = mainWindow
  updater.startAutoCheck()
  updater.clearCrashRecord()
})
```

### 5. Add Forge Hooks

In `forge.config.ts`, add a hook to inject bootstrap.js for production builds:

```typescript
hooks: {
  packageAfterCopy: async (_config, buildPath) => {
    // Copy shell/bootstrap.js to build
    // Modify package.json main to 'shell/bootstrap.js'
    // See examples/demo-app/forge.config.ts for full implementation
  },
}
```

### 6. Build & Release

```bash
# Full release (installer + code bundle)
electron-forge make            # Build installer
ehu pack                       # Build code bundle zip
ehu yml                        # Generate code-bundle-latest.yml
ehu publish                    # Publish to GitHub Releases

# Hot update only (no shell changes)
ehu pack && ehu yml && ehu publish

# Publish with extra assets (e.g., installer)
ehu publish --assets "out/make/zip/darwin/arm64/MyApp.zip,out/make/squirrel.windows/MyApp.exe"
```

### 7. Test Locally

```bash
ehu serve --run --auto-bump
```

This builds a test code bundle, starts a local HTTP server, and launches Electron pointing at it.

## CLI Commands

| Command | Description |
|---------|-------------|
| `ehu init` | Scaffold bootstrap.js and config |
| `ehu fingerprint` | Calculate shell fingerprint |
| `ehu fingerprint --inject` | Inject fingerprint into bootstrap.js |
| `ehu pack` | Build code bundle (esbuild + zip) |
| `ehu yml` | Generate code-bundle-latest.yml |
| `ehu serve` | Start local test update server |
| `ehu serve --run` | Same + launch Electron |
| `ehu publish` | Publish code bundle to GitHub Releases |

## Safety

6 layers of protection:

| Layer | Mechanism | On Failure |
|-------|-----------|------------|
| Download | SHA-512 integrity check | Fall back to full update |
| Install | Verify main.bundle.js exists | Don't load, use built-in |
| Compatibility | Fingerprint-isolated directories | Incompatible bundles ignored |
| Version | Bundle >= app version check | Full update cleans old bundles |
| Runtime | Crash protection (3 crashes / 30s) | Auto-delete bundle, revert |
| Global | Incremental failure → full update | User doesn't notice |

## electron-updater Integration (Optional)

Install `electron-updater` as a peer dependency to enable automatic full-update fallback:

```bash
npm install electron-updater
```

```typescript
const updater = new HotUpdater({
  updateUrl: 'https://github.com/user/repo/releases/latest/download',
  enableFullUpdater: true,  // auto-detect electron-updater
  fullUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: true,
  },
})

// When shell fingerprint changes, HotUpdater automatically
// falls back to electron-updater for a full app update
updater.on('full-update-available', (info) => {
  console.log('Full update available:', info.version)
})
```

Without `electron-updater`, HotUpdater emits `'full-update-required'` and you handle it yourself.

## GitHub Releases

Publish code bundles to GitHub Releases with the CLI:

```bash
ehu pack && ehu yml && ehu publish
```

Your release will contain:
```
v1.0.0/
  code-bundle-latest.yml      # Manifest for hot updates
  code-bundle/1.0.0.zip       # Code bundle
  MyApp-1.0.0.dmg             # (optional) Full installer
```

Set `updateUrl` to your releases URL:
```typescript
updateUrl: 'https://github.com/user/repo/releases/latest/download'
```

## Architecture

```
Development:  npm start → electron-forge + Vite (normal HMR, no bootstrap)

Production:   bootstrap.js → resolve code bundle → load main.bundle.js
              └→ no bundle? → load built-in .vite/build/main.js

Update Flow:  check yml → fingerprint match?
              ├─ yes → download zip → SHA-512 verify → unzip → relaunch (1s)
              └─ no  → electron-updater full update (or emit event)
```

## License

MIT
