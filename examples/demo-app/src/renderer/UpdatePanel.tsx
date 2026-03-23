import React, { useEffect, useState } from 'react'

interface BundleStatus {
  usingCodeBundle: boolean
  codeBundleVersion: string
  shellFingerprint: string
  appVersion: string
  bundleMeta: { version: string; shellFingerprint: string; createdAt: string } | null
  bundleDir: string
}

interface UpdateInfo {
  available: boolean
  version?: string
  url?: string
  size?: number
  needFullUpdate?: boolean
}

interface DownloadProgress {
  percent: number
  transferred: number
  total: number
}

declare global {
  interface Window {
    hotUpdater: {
      checkForUpdate: () => Promise<UpdateInfo>
      downloadAndInstall: (info: UpdateInfo) => Promise<{ success: boolean; error?: string }>
      relaunch: () => Promise<{ success: boolean }>
      getStatus: () => Promise<BundleStatus>
      reset: () => Promise<{ success: boolean }>
      clearCrash: () => Promise<{ success: boolean }>
      onDownloadProgress: (cb: (data: DownloadProgress) => void) => () => void
    }
  }
}

const styles = {
  card: {
    background: '#16213e',
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
  } as React.CSSProperties,
  label: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  } as React.CSSProperties,
  value: {
    fontSize: 14,
    marginBottom: 12,
  } as React.CSSProperties,
  badge: (active: boolean) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    background: active ? '#2d6a4f' : '#333',
    color: active ? '#b7e4c7' : '#888',
  } as React.CSSProperties),
  btn: (variant: 'primary' | 'danger' | 'default' = 'default') => ({
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    marginRight: 8,
    marginBottom: 8,
    background: variant === 'primary' ? '#6c63ff' : variant === 'danger' ? '#d32f2f' : '#333',
    color: '#fff',
  } as React.CSSProperties),
  progress: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    background: '#333',
    overflow: 'hidden' as const,
    marginTop: 8,
  } as React.CSSProperties,
  progressBar: (percent: number) => ({
    width: `${percent}%`,
    height: '100%',
    background: '#6c63ff',
    transition: 'width 0.3s',
  } as React.CSSProperties),
}

const UpdatePanel: React.FC = () => {
  const [status, setStatus] = useState<BundleStatus | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [checking, setChecking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadStatus()

    const cleanup = window.hotUpdater.onDownloadProgress((data) => {
      setProgress(data as DownloadProgress)
    })

    return cleanup
  }, [])

  async function loadStatus() {
    const s = await window.hotUpdater.getStatus()
    setStatus(s)
  }

  async function handleCheck() {
    setChecking(true)
    setMessage('')
    setUpdateInfo(null)
    setProgress(null)

    const info = await window.hotUpdater.checkForUpdate()
    setChecking(false)

    if (info.available) {
      setUpdateInfo(info)
      setMessage(`Update available: v${info.version}`)
    } else if (info.needFullUpdate) {
      setMessage('Shell fingerprint changed. Full update required.')
    } else {
      setMessage('Already up to date.')
    }
  }

  async function handleInstall() {
    if (!updateInfo) return
    setInstalling(true)
    setMessage('Downloading...')

    const result = await window.hotUpdater.downloadAndInstall(updateInfo)
    setInstalling(false)

    if (result.success) {
      setMessage('Installed! Click "Restart" to apply.')
    } else {
      setMessage(`Install failed: ${result.error}`)
    }
  }

  async function handleRelaunch() {
    await window.hotUpdater.relaunch()
  }

  async function handleReset() {
    const result = await window.hotUpdater.reset()
    if (result.success) {
      setMessage('Code bundle deleted. Restart to use built-in code.')
      await loadStatus()
    }
  }

  return (
    <div>
      {/* Status Card */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Status</h3>
        {status && (
          <>
            <div style={styles.label}>Mode</div>
            <div style={styles.value}>
              <span style={styles.badge(status.usingCodeBundle)}>
                {status.usingCodeBundle ? 'Code Bundle' : 'Built-in'}
              </span>
            </div>

            <div style={styles.label}>App Version</div>
            <div style={styles.value}>{status.appVersion}</div>

            {status.codeBundleVersion && (
              <>
                <div style={styles.label}>Code Bundle Version</div>
                <div style={styles.value}>{status.codeBundleVersion}</div>
              </>
            )}

            <div style={styles.label}>Shell Fingerprint</div>
            <div style={{ ...styles.value, fontFamily: 'monospace', fontSize: 13 }}>
              {status.shellFingerprint || '(not set)'}
            </div>
          </>
        )}
      </div>

      {/* Update Card */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Update</h3>

        <div>
          <button style={styles.btn('primary')} onClick={handleCheck} disabled={checking}>
            {checking ? 'Checking...' : 'Check for Update'}
          </button>

          {updateInfo?.available && (
            <button style={styles.btn('primary')} onClick={handleInstall} disabled={installing}>
              {installing ? 'Installing...' : `Install v${updateInfo.version}`}
            </button>
          )}

          <button style={styles.btn()} onClick={handleRelaunch}>
            Restart
          </button>

          <button style={styles.btn('danger')} onClick={handleReset}>
            Reset to Built-in
          </button>
        </div>

        {/* Progress bar */}
        {progress && (
          <div>
            <div style={styles.progress}>
              <div style={styles.progressBar(progress.percent)} />
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {progress.percent}% ({(progress.transferred / 1024 / 1024).toFixed(1)} / {(progress.total / 1024 / 1024).toFixed(1)} MB)
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#aaa' }}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

export default UpdatePanel
