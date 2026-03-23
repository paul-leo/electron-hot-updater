// Main class
export { HotUpdater } from './updater'

// IPC
export { registerIpcHandlers } from './ipc'

// Fingerprint
export { computeShellFingerprint } from './fingerprint'

// Paths
export { createPaths } from './paths'
export type { Paths } from './paths'

// Bootstrap generator
export { generateBootstrapSource } from './bootstrap-gen'

// Preload
export { generatePreloadSource } from './preload'

// Bundle resolver (used by bootstrap, exposed for advanced use)
export { resolveBundle, saveInstallId } from './bundle-resolver'

// Crash guard
export { isCrashLooping, recordCrash, clearCrashRecord } from './crash-guard'

// YML parser
export { parseCodeBundleYml, generateCodeBundleYml } from './yml-parser'

// Version comparison
export { compareVersions } from './version'

// HTTP utilities
export { httpGet, httpDownloadToFile } from './downloader'

// Installer
export { installCodeBundle } from './installer'

// Types
export type {
  ShellManifest,
  FingerprintOptions,
  BootstrapOptions,
  BundleMeta,
  UpdateInfo,
  InstallResult,
  BundleStatus,
  CodeBundleYml,
  Logger,
  HotUpdaterConfig,
  DownloadProgress,
} from './types'
