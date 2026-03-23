import https from 'https'
import http from 'http'
import fs from 'fs'
import type { DownloadProgress, Logger } from './types'
import { defaultLogger } from './logger'

/**
 * Simple HTTP GET that returns a Buffer. Follows redirects.
 */
export function httpGet(url: string, timeoutMs = 15_000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, timeoutMs).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')) })
  })
}

/**
 * Download a file via HTTP with progress callback. Follows redirects.
 */
export function httpDownloadToFile(
  url: string,
  destPath: string,
  options?: {
    timeoutMs?: number
    onProgress?: (progress: DownloadProgress) => void
    logger?: Logger
  },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 60_000
  const onProgress = options?.onProgress
  const log = options?.logger ?? defaultLogger

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpDownloadToFile(res.headers.location, destPath, options).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`))
      }

      const totalSize = parseInt(res.headers['content-length'] || '0', 10)
      let downloadedSize = 0
      const file = fs.createWriteStream(destPath)

      res.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length
        file.write(chunk)
        if (totalSize > 0 && onProgress) {
          onProgress({
            percent: Math.round((downloadedSize / totalSize) * 100),
            transferred: downloadedSize,
            total: totalSize,
          })
        }
      })

      res.on('end', () => {
        file.end(() => resolve())
      })

      res.on('error', (err) => {
        file.destroy()
        reject(err)
      })
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Download timeout'))
    })
  })
}
