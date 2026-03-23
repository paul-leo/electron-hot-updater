import React from 'react'
import UpdatePanel from './UpdatePanel'

const App: React.FC = () => {
  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: 32,
      maxWidth: 640,
      margin: '0 auto',
      color: '#e0e0e0',
      background: '#1a1a2e',
      minHeight: '100vh',
    }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>
        Electron Hot Updater Demo
      </h1>
      <p style={{ color: '#888', marginBottom: 32 }}>
        Shell / Code Bundle split architecture for incremental updates
      </p>
      <UpdatePanel />
    </div>
  )
}

export default App
