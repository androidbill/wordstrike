import { useState } from 'react'
import QRModal from './QRModal.jsx'
import { APP_URL, QrGlyph } from './Home.jsx'

export default function Lobby({ room, role, onLeave }) {
  const [copied, setCopied] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const me = room.players[role]
  const them = room.players[role === 'host' ? 'guest' : 'host']

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable — code is on screen anyway */ }
  }

  return (
    <div className="screen lobby">
      <h2>Battle room</h2>
      <button className="room-code" onClick={copy} title="Copy code">
        {[...room.code].map((ch, i) => (
          <span key={i} className="logo-tile gold" style={{ '--d': `${i * 0.08}s` }}>{ch}</span>
        ))}
        <span className="copy-hint">{copied ? 'Copied!' : 'Tap to copy'}</span>
      </button>

      <button className="btn ghost qr-room-btn" type="button" onClick={() => setQrOpen(true)}>
        <QrGlyph /> Show QR to join
      </button>
      {qrOpen && (
        <QRModal
          url={`${APP_URL}?join=${room.code}`}
          title={`Join room ${room.code}`}
          subtitle="Have your rival scan this to jump straight into the room."
          onClose={() => setQrOpen(false)}
        />
      )}

      <div className="versus">
        <div className={`player-card ${me?.ready ? 'ready' : ''}`}>
          <span className="player-avatar">{me.avatar}</span>
          <span className="player-name">{me.name}</span>
          <span className="player-status">{me?.ready ? 'Ready ✓' : 'Picking words…'}</span>
        </div>
        <span className="vs">VS</span>
        <div className={`player-card ${them?.ready ? 'ready' : ''}`}>
          {them ? (
            <>
              <span className="player-avatar">{them.avatar}</span>
              <span className="player-name">{them.name}</span>
              <span className="player-status">{them.ready ? 'Ready ✓' : 'Picking words…'}</span>
            </>
          ) : (
            <>
              <span className="player-avatar waiting">?</span>
              <span className="player-name">Waiting…</span>
              <span className="player-status">Share the code</span>
            </>
          )}
        </div>
      </div>

      <p className="hint">
        {them?.ready ? 'Starting…' : 'The battle begins the moment both players lock in their words.'}
      </p>
      <button className="btn ghost" onClick={onLeave}>Leave room</button>
    </div>
  )
}
