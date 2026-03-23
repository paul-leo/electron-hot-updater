import type { CodeBundleYml } from './types'

/**
 * Lightweight YAML parser for code-bundle-latest.yml.
 * Only handles the specific structure we use — not a general YAML parser.
 * Zero dependencies.
 */
export function parseCodeBundleYml(text: string): CodeBundleYml {
  const result: Record<string, unknown> = {}
  const lines = text.split('\n')
  let inFiles = false
  let fileObj: Record<string, unknown> | null = null
  const files: Array<{ url: string; sha512: string; size: number }> = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (trimmed === 'files:') {
      inFiles = true
      continue
    }

    if (inFiles) {
      if (trimmed.startsWith('- url:')) {
        if (fileObj) files.push(fileObj as { url: string; sha512: string; size: number })
        fileObj = { url: trimmed.replace('- url:', '').trim() }
      } else if (fileObj && trimmed.startsWith('sha512:')) {
        fileObj.sha512 = trimmed.replace('sha512:', '').trim()
      } else if (fileObj && trimmed.startsWith('size:')) {
        fileObj.size = parseInt(trimmed.replace('size:', '').trim(), 10)
      } else if (!trimmed.startsWith('-') && !trimmed.startsWith(' ') && trimmed.includes(':')) {
        if (fileObj) files.push(fileObj as { url: string; sha512: string; size: number })
        fileObj = null
        inFiles = false
      }
    }

    if (!inFiles) {
      const colonIdx = trimmed.indexOf(':')
      if (colonIdx > 0) {
        const key = trimmed.substring(0, colonIdx).trim()
        let value = trimmed.substring(colonIdx + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        result[key] = value
      }
    }
  }
  if (fileObj) files.push(fileObj as { url: string; sha512: string; size: number })

  return {
    version: (result.version as string) || '',
    shellFingerprint: (result.shellFingerprint as string) || '',
    releaseDate: (result.releaseDate as string) || '',
    files,
  }
}

/**
 * Generate code-bundle-latest.yml content string.
 */
export function generateCodeBundleYml(data: {
  version: string
  shellFingerprint: string
  sha512: string
  size: number
  fileName: string
}): string {
  return [
    `version: "${data.version}"`,
    `shellFingerprint: "${data.shellFingerprint}"`,
    `releaseDate: "${new Date().toISOString()}"`,
    `files:`,
    `  - url: code-bundle/${data.fileName}`,
    `    sha512: ${data.sha512}`,
    `    size: ${data.size}`,
  ].join('\n') + '\n'
}
