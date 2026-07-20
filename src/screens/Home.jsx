import { useEffect, useState } from 'react'
import { APP_VERSION } from '../version.js'
import { hardRefresh } from '../appUpdates.js'
import QRModal from './QRModal.jsx'
import Daily from './Daily.jsx'
import { loadHistory, historyStats, formatDuration, formatSolveTime } from '../history.js'
import { ACHIEVEMENTS, loadEarned } from '../achievements.js'
import { isMuted, toggleMuted } from '../sounds.js'

export const APP_URL = 'https://androidbill.github.io/wordstrike/'

export default function Home({ onCreate, onJoin, onHotseat, error }) {
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [dailyOpen, setDailyOpen] = useState(false)
  const [muted, setMuted] = useState(isMuted)
  const [welcome, setWelcome] = useState(false)

  // First launch on this device: greet with confetti.
  useEffect(() => {
    if (!localStorage.getItem('ws-welcomed')) {
      localStorage.setItem('ws-welcomed', '1')
      setWelcome(true)
      const t = setTimeout(() => setWelcome(false), 4200)
      return () => clearTimeout(t)
    }
  }, [])

  const shareApp = async () => {
    setMenuOpen(false)
    const shareData = {
      title: 'WordStrike',
      text: 'Play WordStrike — guess letters, solve words, and sink your rival!',
      url: APP_URL
    }
    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(shareData.url)
        window.alert('WordStrike link copied to your clipboard.')
      }
    } catch (error) {
      if (error?.name !== 'AbortError') window.alert('Unable to share WordStrike on this device.')
    }
  }

  if (dailyOpen) return <Daily onBack={() => setDailyOpen(false)} />

  const submitJoin = (e) => {
    e.preventDefault()
    if (code.length === 4) onJoin(code.toUpperCase())
  }

  return (
    <div className="screen home">
      <div className="kebab-wrap">
        <button
          className="kebab qr-btn"
          type="button"
          aria-label="Show QR code to share WordStrike"
          onClick={() => setQrOpen(true)}
        >
          <QrGlyph />
        </button>
        <button
          className="kebab"
          type="button"
          aria-label="Open app menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ⋮
        </button>
        {menuOpen && (
          <>
            <button className="menu-backdrop" aria-label="Close app menu" onClick={() => setMenuOpen(false)} />
            <div className="menu-pop">
              <button className="menu-item" type="button" onClick={hardRefresh}>↻ Refresh</button>
              <button className="menu-item" type="button" onClick={shareApp}>↗ Share</button>
              <button className="menu-item" type="button" onClick={() => setMuted(toggleMuted())}>
                {muted ? '🔇 Sound off' : '🔊 Sound on'}
              </button>
              <button className="menu-item" type="button" onClick={() => { setMenuOpen(false); setHistoryOpen(true) }}>🏆 History</button>
              <button className="menu-item" type="button" onClick={() => { setMenuOpen(false); setAboutOpen(true) }}>ⓘ About</button>
            </div>
          </>
        )}
      </div>
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
          <button className="btn ghost big" onClick={() => setDailyOpen(true)}>
            📅 Daily Word
            <span className="btn-sub">one word a day · brag to your friends</span>
          </button>
        </div>
      ) : (
        <form className="home-actions" onSubmit={submitJoin}>
          <input
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
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
          <li>You have 20 seconds to call a letter, then 10 seconds to solve a word. A correct solve restarts the solve timer; a miss or timeout ends your turn.</li>
          <li>First to crack all five of their rival's words wins.</li>
          <li>No internet? Pass &amp; Play shares one device — a curtain screen keeps words secret between turns.</li>
        </ul>
      </details>

      <span className="version">v{APP_VERSION}</span>
      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
      {welcome && (
        <div className="welcome-toast" role="status">
          <div className="welcome-confetti" aria-hidden>
            {Array.from({ length: 40 }, (_, i) => (
              <span key={i} style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 1.6}s`,
                background: ['#f5c542', '#5b8def', '#e75a7c', '#4ecdc4', '#a78bfa'][i % 5]
              }} />
            ))}
          </div>
          🎉 Welcome to WordStrike!
        </div>
      )}
      {qrOpen && (
        <QRModal
          url={APP_URL}
          title="Share WordStrike"
          subtitle="Have a friend scan this to get the app."
          onClose={() => setQrOpen(false)}
        />
      )}
      {aboutOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={() => setAboutOpen(false)}>
          <div className="modal-card about-card" onClick={(event) => event.stopPropagation()}>
            <img className="about-icon" src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="WordStrike app icon" />
            <h2 id="about-title">WordStrike</h2>
            <p>Created By Bill Parsons</p>
            <span className="about-version">Version {APP_VERSION}</span>
            <button className="btn ghost" type="button" onClick={() => setAboutOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

function HistoryModal({ onClose }) {
  const history = loadHistory()
  const stats = historyStats(history)
  const earned = loadEarned()

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="history-title" onClick={onClose}>
      <div className="modal-card history-card" onClick={(e) => e.stopPropagation()}>
        <h2 id="history-title">Game history</h2>
        {history.length === 0 ? (
          <p className="hint">No games finished on this device yet. Go play one!</p>
        ) : (
          <>
            <div className="history-stats">
              <div className="stat">
                <span className="stat-value">{stats.games}</span>
                <span className="stat-label">games</span>
              </div>
              {stats.topWinner && (
                <div className="stat">
                  <span className="stat-value">{stats.topWinner.name}</span>
                  <span className="stat-label">{stats.topWinner.wins} win{stats.topWinner.wins > 1 ? 's' : ''}</span>
                </div>
              )}
              {stats.fastestSolve && (
                <div className="stat">
                  <span className="stat-value">{formatSolveTime(stats.fastestSolve.ms)}</span>
                  <span className="stat-label">fastest solve · {stats.fastestSolve.name}</span>
                </div>
              )}
            </div>
            <div className="history-list">
              {history.map((g, i) => (
                <div key={i} className="history-row">
                  <span className="history-winner">{g.winnerAvatar} {g.winnerName} 🏆</span>
                  <span className="history-detail">
                    {g.players.host.name} {g.scores.host}–{g.scores.guest} {g.players.guest.name}
                  </span>
                  <span className="history-meta">
                    {new Date(g.ts).toLocaleDateString()} · {formatDuration(g.durationMs)}
                    {g.fastestSolve ? ` · ⚡${formatSolveTime(g.fastestSolve.ms)}` : ''}
                    {g.mode === 'hotseat' ? ' · 🤝' : ''}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="ach-grid">
          {ACHIEVEMENTS.map((a) => (
            <div key={a.id} className={`ach-badge ${earned[a.id] ? 'earned' : ''}`} title={a.desc}>
              <span className="ach-badge-emoji">{a.emoji}</span>
              <span className="ach-badge-name">{a.name}</span>
            </div>
          ))}
        </div>
        <button className="btn ghost" type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

// Simple QR glyph so the icon works offline with no extra assets.
export function QrGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h3v3h-3v-3zm5 0h3v3h-3v-3zm-5 5h3v3h-3v-3zm5 0h3v3h-3v-3z" />
    </svg>
  )
}
