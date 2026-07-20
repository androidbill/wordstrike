import { useState } from 'react'
import { APP_VERSION } from '../version.js'

export default function Home({ onCreate, onJoin, onHotseat, error }) {
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)

  const submitJoin = (e) => {
    e.preventDefault()
    if (code.length === 4) onJoin(code.toUpperCase())
  }

  return (
    <div className="screen home">
      <div className="logo">
        <div className="logo-tiles">
          {['W', 'O', 'R', 'D'].map((ch, i) => (
            <span key={i} className="logo-tile" style={{ '--d': `${i * 0.08}s` }}>{ch}</span>
          ))}
        </div>
        <div className="logo-tiles strike">
          {['S', 'T', 'R', 'I', 'K', 'E'].map((ch, i) => (
            <span key={i} className="logo-tile gold" style={{ '--d': `${0.35 + i * 0.08}s` }}>{ch}</span>
          ))}
        </div>
        <p className="tagline">Guess letters. Solve words. Sink your rival.</p>
      </div>

      {!joining ? (
        <div className="home-actions">
          <button className="btn primary big" onClick={onCreate}>Create Room</button>
          <button className="btn ghost big" onClick={() => setJoining(true)}>Join Room</button>
          <button className="btn ghost big" onClick={onHotseat}>
            🤝 Pass &amp; Play
            <span className="btn-sub">one device · works offline</span>
          </button>
        </div>
      ) : (
        <form className="home-actions" onSubmit={submitJoin}>
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
            placeholder="CODE"
            autoFocus
            maxLength={4}
            aria-label="Room code"
          />
          <button className="btn primary big" disabled={code.length !== 4}>Join</button>
          <button type="button" className="btn ghost" onClick={() => setJoining(false)}>Back</button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      <details className="rules">
        <summary>How to play</summary>
        <ul>
          <li>Each player secretly picks five 5-letter words.</li>
          <li>Take turns calling a letter — it lights up everywhere it appears in your rival's five words.</li>
          <li>On your turn you can instead try to solve a word. Solve it right and you go again; miss and you lose the turn.</li>
          <li>First to crack all five of their rival's words wins.</li>
          <li>No internet? Pass &amp; Play shares one device — a curtain screen keeps words secret between turns.</li>
        </ul>
      </details>

      <span className="version">v{APP_VERSION}</span>
    </div>
  )
}
