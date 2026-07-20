import { useState } from 'react'
import { APP_VERSION } from '../version.js'
import { hardRefresh } from '../appUpdates.js'

export default function Home({ onCreate, onJoin, onHotseat, error }) {
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  const shareApp = async () => {
    setMenuOpen(false)
    const shareData = {
      title: 'WordStrike',
      text: 'Play WordStrike — guess letters, solve words, and sink your rival!',
      url: 'https://androidbill.github.io/wordstrike/'
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

  const submitJoin = (e) => {
    e.preventDefault()
    if (code.length === 4) onJoin(code.toUpperCase())
  }

  return (
    <div className="screen home">
      <div className="kebab-wrap">
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
          <li>You have 30 seconds to call a letter, then 10 seconds to solve a word. A correct solve restarts the solve timer; a miss or timeout ends your turn.</li>
          <li>First to crack all five of their rival's words wins.</li>
          <li>No internet? Pass &amp; Play shares one device — a curtain screen keeps words secret between turns.</li>
        </ul>
      </details>

      <span className="version">v{APP_VERSION}</span>
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
