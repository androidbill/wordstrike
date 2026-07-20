import { useState } from 'react'

const AVATARS = [
  '🦊', '🐼', '🦁', '🐸', '🦉', '🐙', '🦈', '🐯',
  '🐺', '🦄', '🐲', '🦅', '🐧', '🦋', '🐝', '🦜',
  '👽', '🤖', '👻', '🧙', '🥷', '🦸', '🧛', '🏴‍☠️'
]

export default function Profile({ initial, onDone, onBack, title = "Who's playing?" }) {
  const [name, setName] = useState(initial?.name || '')
  const [avatar, setAvatar] = useState(initial?.avatar || AVATARS[0])
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim().slice(0, 14)
    if (!trimmed || busy) return
    setBusy(true)
    await onDone({ name: trimmed, avatar })
    setBusy(false)
  }

  return (
    <form className="screen profile" onSubmit={submit}>
      <h2>{title}</h2>
      <div className="avatar-preview">{avatar}</div>
      <input
        className="name-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nickname"
        maxLength={14}
        autoFocus={!initial?.name}
        aria-label="Nickname"
      />
      <div className="avatar-grid">
        {AVATARS.map((a) => (
          <button
            type="button"
            key={a}
            className={`avatar-cell ${a === avatar ? 'selected' : ''}`}
            onClick={() => setAvatar(a)}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn ghost" onClick={onBack}>Back</button>
        <button className="btn primary" disabled={!name.trim() || busy}>Continue</button>
      </div>
    </form>
  )
}
