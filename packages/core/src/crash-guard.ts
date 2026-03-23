import fs from 'fs'
import path from 'path'

const DEFAULT_MAX_CRASHES = 3
const DEFAULT_CRASH_WINDOW = 30_000 // 30 seconds

export interface CrashGuardOptions {
  /** Directory to store crash record file */
  userDataDir: string
  /** Max crashes within window before triggering protection. Default: 3 */
  maxCrashes?: number
  /** Time window in ms. Default: 30000 */
  crashWindow?: number
}

function getCrashFilePath(userDataDir: string): string {
  return path.join(userDataDir, 'code-bundle-crash.json')
}

/**
 * Check if the app is in a crash loop (N crashes within the time window).
 */
export function isCrashLooping(options: CrashGuardOptions): boolean {
  const maxCrashes = options.maxCrashes ?? DEFAULT_MAX_CRASHES
  const crashWindow = options.crashWindow ?? DEFAULT_CRASH_WINDOW
  const crashFile = getCrashFilePath(options.userDataDir)

  try {
    if (!fs.existsSync(crashFile)) return false
    const { crashes = [] } = JSON.parse(fs.readFileSync(crashFile, 'utf-8'))
    return crashes.filter((t: number) => Date.now() - t < crashWindow).length >= maxCrashes
  } catch {
    return false
  }
}

/**
 * Record a crash timestamp.
 */
export function recordCrash(options: CrashGuardOptions): void {
  const maxCrashes = options.maxCrashes ?? DEFAULT_MAX_CRASHES
  const crashFile = getCrashFilePath(options.userDataDir)

  try {
    const data = fs.existsSync(crashFile)
      ? JSON.parse(fs.readFileSync(crashFile, 'utf-8'))
      : { crashes: [] }
    data.crashes = [...data.crashes, Date.now()].slice(-maxCrashes)
    fs.writeFileSync(crashFile, JSON.stringify(data))
  } catch {
    // Silently fail — crash record is best-effort
  }
}

/**
 * Clear crash records (call after successful app load from renderer).
 */
export function clearCrashRecord(userDataDir: string): void {
  const crashFile = getCrashFilePath(userDataDir)
  try {
    if (fs.existsSync(crashFile)) {
      fs.unlinkSync(crashFile)
    }
  } catch {
    // Silently fail
  }
}
