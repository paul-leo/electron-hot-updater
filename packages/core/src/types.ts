/**
 * Shell manifest: defines which files and dependencies constitute the Shell layer.
 * Any change to these triggers a fingerprint change → full update required.
 */
export interface ShellManifest {
  /** File paths or directories (relative to project root) whose content affects the fingerprint */
  files: string[]
  /** npm dependency names whose versions affect the fingerprint */
  dependencies: string[]
}

/**
 * Options for fingerprint calculation
 */
export interface FingerprintOptions {
  /** Project root directory. Defaults to process.cwd() */
  projectRoot?: string
  /** Shell manifest. If not provided, must be loaded from config */
  manifest: ShellManifest
}

/**
 * Options for bootstrap.js generation
 */
export interface BootstrapOptions {
  /** Placeholder string in bootstrap.js replaced at build time with actual fingerprint.
   *  Default: '__SHELL_FINGERPRINT__' */
  fingerprintPlaceholder?: string
  /** Max crashes before reverting to built-in code. Default: 3 */
  maxCrashes?: number
  /** Crash detection window in ms. Default: 30000 */
  crashWindow?: number
  /** Directory name prefix for code bundle in userData. Default: 'code-bundle' */
  bundleDirPrefix?: string
  /** Relative path from bootstrap.js to built-in main entry. Default: '.vite/build/main.js' */
  builtinMainPath?: string
}

/**
 * Code bundle metadata (meta.json inside the bundle)
 */
export interface BundleMeta {
  version: string
  shellFingerprint: string
  createdAt: string
  installedAt?: number
}

/**
 * Result of checking for updates
 */
export interface UpdateInfo {
  available: boolean
  version?: string
  url?: string
  sha512?: string
  size?: number
  shellFingerprint?: string
  /** True if the shell fingerprint doesn't match — requires full app update */
  needFullUpdate?: boolean
}

/**
 * Result of download + install
 */
export interface InstallResult {
  success: boolean
  error?: string
}

/**
 * Current code bundle status
 */
export interface BundleStatus {
  usingCodeBundle: boolean
  codeBundleVersion: string
  shellFingerprint: string
  appVersion: string
  bundleMeta: BundleMeta | null
  bundleDir: string
}

/**
 * Parsed code-bundle-latest.yml
 */
export interface CodeBundleYml {
  version: string
  shellFingerprint: string
  releaseDate: string
  files: Array<{
    url: string
    sha512: string
    size: number
  }>
}

/**
 * Pluggable logger interface
 */
export interface Logger {
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

/**
 * HotUpdater configuration
 */
export interface HotUpdaterConfig {
  /** Base URL where code-bundle-latest.yml is hosted */
  updateUrl: string
  /** Auto-check interval in ms. 0 = disabled. Default: 0 */
  autoCheckInterval?: number
  /** Auto-download after finding update. Default: false */
  autoDownload?: boolean
  /** Auto-relaunch after install. Default: false */
  autoRelaunch?: boolean
  /** Custom logger. Default: console */
  logger?: Logger
}

/**
 * Download progress event data
 */
export interface DownloadProgress {
  percent: number
  transferred: number
  total: number
}
