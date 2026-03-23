import path from 'path'

/**
 * Path resolution utilities for code bundle mode.
 *
 * In code bundle mode, files are split across two locations:
 * - Shell root: the app's installation directory (Chromium, Node.js, native modules, bootstrap)
 * - Code root: userData/code-bundle-{fingerprint}/ (business code, renderer assets)
 *
 * Environment variables set by bootstrap.js:
 * - CODE_ROOT: code bundle dir or built-in app root
 * - SHELL_ROOT: always the app installation root
 * - SHELL_ELECTRON_DIR: directory containing bootstrap.js
 * - USING_CODE_BUNDLE: 'true' or 'false'
 */

export interface Paths {
  /** Whether running from a code bundle */
  usingCodeBundle: boolean
  /** Code root: bundle dir or built-in root */
  codeRoot: string
  /** Shell root: always the installation directory */
  shellRoot: string
  /** Shell electron dir: directory containing bootstrap.js */
  shellElectronDir: string
  /** Resolve a path relative to code root */
  resolve(...segments: string[]): string
  /** Resolve a path relative to shell root */
  resolveShell(...segments: string[]): string
  /** Resolve a renderer file path */
  resolveRenderer(...segments: string[]): string
}

/**
 * Create path resolver based on environment variables set by bootstrap.js.
 */
export function createPaths(options?: {
  /** Renderer dist directory name relative to code root. Default: 'dist/renderer' */
  rendererDir?: string
}): Paths {
  const rendererDir = options?.rendererDir ?? 'dist/renderer'
  const codeRoot = process.env.CODE_ROOT || path.join(__dirname, '..')
  const shellRoot = process.env.SHELL_ROOT || path.join(__dirname, '..')
  const shellElectronDir = process.env.SHELL_ELECTRON_DIR || __dirname
  const usingCodeBundle = process.env.USING_CODE_BUNDLE === 'true'

  return {
    usingCodeBundle,
    codeRoot,
    shellRoot,
    shellElectronDir,

    resolve(...segments: string[]) {
      return path.join(codeRoot, ...segments)
    },

    resolveShell(...segments: string[]) {
      return path.join(shellRoot, ...segments)
    },

    resolveRenderer(...segments: string[]) {
      return path.join(codeRoot, rendererDir, ...segments)
    },
  }
}
