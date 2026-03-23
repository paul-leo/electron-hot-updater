import type { Logger } from './types'

const PREFIX = '[ehu]'

export const defaultLogger: Logger = {
  info(message: string, ...args: unknown[]) {
    console.log(`${PREFIX} ${message}`, ...args)
  },
  warn(message: string, ...args: unknown[]) {
    console.warn(`${PREFIX} ${message}`, ...args)
  },
  error(message: string, ...args: unknown[]) {
    console.error(`${PREFIX} ${message}`, ...args)
  },
}
