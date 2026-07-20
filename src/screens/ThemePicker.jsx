import { useState } from 'react'
import { THEMES, getTheme, applyTheme } from '../themes.js'

// Host chooses the room's look. Tapping a card previews it live;
// Continue locks it in.
export default function ThemePicker({ onDone, onBack }) {
  const [picked, setPicked] = useState('midnight')

  const pick = (id) => {
    setPicked(id)
    applyTheme(id)
  }

  const back = () => {
    applyTheme(null)
    onBack()
  }

  return (
    <div className="screen theme-screen">
      <h2>Pick the room's theme</h2>
      <p className="hint">Both players will see this look. Tap to preview.</p>
      <div className="theme-grid">
        {THEMES.map((t) => {
          const accent = t.vars['--gold'] || '#f5c542'
          const bg = t.vars['--bg2'] || '#121732'
          return (
            <button
              key={t.id}
              type="button"
              className={`theme-card ${picked === t.id ? 'picked' : ''}`}
              style={{ '--swatch-bg': bg, '--swatch-accent': accent }}
              onClick={() => pick(t.id)}
            >
              <span className="theme-swatch">
                <span className="swatch-dot" />
                <span className="swatch-dot" />
                <span className="swatch-dot" />
              </span>
              <span className="theme-name">{t.name}</span>
            </button>
          )
        })}
      </div>
      <div className="row">
        <button className="btn ghost" type="button" onClick={back}>Back</button>
        <button className="btn primary" type="button" onClick={() => onDone(picked)}>
          Continue with {getTheme(picked).name}
        </button>
      </div>
    </div>
  )
}
