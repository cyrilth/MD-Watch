import { useState } from 'react'

function App() {
  const [pong, setPong] = useState<string | null>(null)

  const handlePing = async () => {
    const result = await window.electron.ping()
    setPong(result)
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>MD-Watch</h1>
      <p>Electron + Vite + React (Task 1.1)</p>
      <button type="button" onClick={handlePing}>
        Ping main process
      </button>
      {pong && <p>Reply: {pong}</p>}
    </div>
  )
}

export default App
