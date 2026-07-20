import { useState } from 'react'

// Host picks how the match plays. Pace is online-only; hotseat is always live.
export default function Setup({ allowAsync, onDone, onBack }) {
  const [pace, setPace] = useState('live')
  const [wordCount, setWordCount] = useState(5)
  const [blitz, setBlitz] = useState(false)

  return (
    <div className="screen setup-screen">
      <h2>Game setup</h2>

      {allowAsync && (
        <div className="setup-group">
          <span className="setup-label">Pace</span>
          <div className="setup-options">
            <button type="button" className={`setup-card ${pace === 'live' ? 'picked' : ''}`} onClick={() => setPace('live')}>
              <span className="setup-emoji">⚡</span>
              <strong>Live</strong>
              <span className="setup-desc">Timed turns, play together now</span>
            </button>
            <button type="button" className={`setup-card ${pace === 'async' ? 'picked' : ''}`} onClick={() => { setPace('async'); setBlitz(false) }}>
              <span className="setup-emoji">☕</span>
              <strong>Relaxed</strong>
              <span className="setup-desc">No timers — take turns whenever</span>
            </button>
          </div>
        </div>
      )}

      <div className="setup-group">
        <span className="setup-label">Words each</span>
        <div className="setup-options">
          <button type="button" className={`setup-card slim ${wordCount === 3 ? 'picked' : ''}`} onClick={() => setWordCount(3)}>
            <strong>3</strong>
            <span className="setup-desc">Quick game</span>
          </button>
          <button type="button" className={`setup-card slim ${wordCount === 5 ? 'picked' : ''}`} onClick={() => setWordCount(5)}>
            <strong>5</strong>
            <span className="setup-desc">Classic</span>
          </button>
        </div>
      </div>

      {pace === 'live' && (
        <div className="setup-group">
          <span className="setup-label">Speed</span>
          <div className="setup-options">
            <button type="button" className={`setup-card slim ${!blitz ? 'picked' : ''}`} onClick={() => setBlitz(false)}>
              <strong>Normal</strong>
              <span className="setup-desc">20s letters · 10s solves</span>
            </button>
            <button type="button" className={`setup-card slim ${blitz ? 'picked' : ''}`} onClick={() => setBlitz(true)}>
              <strong>🔥 Blitz</strong>
              <span className="setup-desc">7s letters · 6s solves</span>
            </button>
          </div>
        </div>
      )}

      <div className="row">
        <button className="btn ghost" type="button" onClick={onBack}>Back</button>
        <button className="btn primary" type="button" onClick={() => onDone({ pace: allowAsync ? pace : 'live', wordCount, blitz })}>
          Continue
        </button>
      </div>
    </div>
  )
}
