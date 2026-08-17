import { useState } from 'react'

// Host picks how the match plays. Pace is online-only; hotseat is always live.
// In team mode the word count is per player and each side's board is double it.
export default function Setup({ allowAsync, teamMode, onDone, onBack }) {
  const [pace, setPace] = useState('live')
  const [wordCount, setWordCount] = useState(teamMode ? 2 : 5)
  const [wordLen, setWordLen] = useState(5)
  const [blitz, setBlitz] = useState(false)
  const options = teamMode
    ? [
        { n: 2, label: 'Quick game · 4 per team' },
        { n: 3, label: 'Long haul · 6 per team' }
      ]
    : [
        { n: 3, label: 'Quick game' },
        { n: 5, label: 'Classic' }
      ]

  return (
    <div className="screen setup-screen">
      <h2>Game setup</h2>
      {teamMode && <p className="hint">👥 2 vs 2 — four players, two boards.</p>}

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
          {options.map((o) => (
            <button
              key={o.n}
              type="button"
              className={`setup-card slim ${wordCount === o.n ? 'picked' : ''}`}
              onClick={() => setWordCount(o.n)}
            >
              <strong>{o.n}</strong>
              <span className="setup-desc">{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="setup-group">
        <span className="setup-label">Word length</span>
        <div className="setup-options">
          <button type="button" className={`setup-card slim ${wordLen === 5 ? 'picked' : ''}`} onClick={() => setWordLen(5)}>
            <strong>5 letters</strong>
            <span className="setup-desc">Classic</span>
          </button>
          <button type="button" className={`setup-card slim ${wordLen === 6 ? 'picked' : ''}`} onClick={() => setWordLen(6)}>
            <strong>6 letters</strong>
            <span className="setup-desc">More challenge</span>
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
        <button
          className="btn primary"
          type="button"
          onClick={() =>
            onDone({
              pace: allowAsync ? pace : 'live',
              teamMode,
              ...(teamMode ? { perPlayer: wordCount } : { wordCount }),
              wordLen,
              blitz
            })
          }
        >

          Continue
        </button>
      </div>
    </div>
  )
}
