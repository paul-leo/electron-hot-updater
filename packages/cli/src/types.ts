/**
 * Configuration file schema (ehu.config.ts)
 */
export interface EhuConfig {
  /** Shell manifest: which files/deps define the shell fingerprint */
  shell: {
    /** File paths or directory globs relative to project root */
    files: string[]
    /**
     * @deprecated All production dependencies from package.json are now auto-hashed.
     * Use `ignoreDependencies` to exclude specific packages instead.
     */
    dependencies?: string[]
    /** Package names to exclude from auto-hashing */
    ignoreDependencies?: string[]
  }

  /** Main process bundling options */
  main: {
    /** Entry file path. Default: '.vite/build/main.js' */
    entry: string
    /** Modules to keep external (native deps). Default: ['electron'] */
    external?: string[]
    /** esbuild target. Default: 'node20' */
    target?: string
  }

  /** Renderer output directory to include in code bundle */
  renderer: {
    /** Path to built renderer files. Default: '.vite/build/renderer' */
    distDir: string
  }

  /** Preload files to include in code bundle */
  preload?: {
    /** Preload file paths relative to project root */
    files: string[]
  }

  /** Additional files to copy into code bundle */
  extraFiles?: Array<{ from: string; to: string }>

  /** Update server URL (used in yml generation) */
  updateUrl?: string

  /** Output directory for code bundle artifacts. Default: 'dist-ehu' */
  outDir?: string
}

/**
 * Type helper for config file
 */
export function defineConfig(config: EhuConfig): EhuConfig {
  return config
}
