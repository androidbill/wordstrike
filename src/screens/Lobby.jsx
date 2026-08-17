import { useState } from 'react'
import QRModal from './QRModal.jsx'
import { APP_URL, QrGlyph } from './Home.jsx'
import { TEAM_LABELS, TEAM_BADGES, membersOf, openSeats, otherRole } from '../game.js'

export default function Lobby({ room, role, seat = 0, onLeave }) {
  const [copied, setCopied] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable — code is on screen anyway */ }
  }

  const share = async () => {
    const url = `${APP_URL}?join=${room.code}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join my WordStrike room', text: `Join my room — tap the link or enter code ${room.code}`, url })
      } else {
        await navigator.clipboard.writeText(url)
        window.alert('Room link copied to your clipboard.')
      }
    } catch (e) {
      if (e?.name !== 'AbortError') window.alert('Unable to share on this device.')
    }
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
      <button className="btn ghost qr-room-btn" type="button" onClick={share}>
        <ShareGlyph /> Share room to join
      </button>
      {qrOpen && (
        <QRModal
          url={`${APP_URL}?join=${room.code}`}
          title={`Join room ${room.code}`}
          subtitle="Have your rivals scan this to jump straight into the room."
          onClose={() => setQrOpen(false)}
        />
      )}

      {room.teamMode
        ? <TeamRoster room={room} role={role} seat={seat} />
        : <Duel room={room} role={role} />}

      <p className="hint">{statusLine(room, role)}</p>
      <button className="btn ghost" onClick={onLeave}>Leave room</button>
    </div>
  )
}

function ShareGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18 16c-.79 0-1.5.31-2.03.81L8.91 12.7A3.3 3.3 0 0 0 9 12c0-.24-.04-.47-.09-.7l7-4.07A2.99 2.99 0 0 0 18 8a3 3 0 1 0-3-3c0 .24.04.47.09.7L8.09 9.77A2.99 2.99 0 0 0 6 9a3 3 0 0 0 0 6c.79 0 1.5-.31 2.03-.81l7.06 4.12c-.05.21-.09.43-.09.69a3 3 0 1 0 3-3z"/>
    </svg>
  )
}

function statusLine(room, role) {
  if (room.teamMode) {
    const waiting = openSeats(room).length
    if (waiting) return `Waiting on ${waiting} more player${waiting > 1 ? 's' : ''} — share the code.`
    return 'Everyone is in. The battle begins once all four sets of words are locked in.'
  }
  return room.players[otherRole(role)]?.ready
    ? 'Starting…'
    : 'The battle begins the moment both players lock in their words.'
}

function Duel({ room, role }) {
  const me = room.players[role]
  const them = room.players[otherRole(role)]
  return (
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
  )
}

// 2v2: both teams side by side so everyone can see who is still missing and
// who still owes the room their secret words.
function TeamRoster({ room, role, seat }) {
  // Nobody is asked for words until all four seats are filled, so don't claim
  // they're picking any before then.
  const filling = openSeats(room).length > 0
  return (
    <div className="team-pick lobby-teams">
      {['host', 'guest'].map((team) => (
        <div key={team} className={`team-panel ${team === role ? 'mine' : ''}`}>
          <span className="team-title">{TEAM_BADGES[team]} {TEAM_LABELS[team]}</span>
          {membersOf(room, team).map((p, s) => (
            <div
              key={s}
              className={`team-seat ${p ? 'taken' : ''} ${p?.ready ? 'ready' : ''} ${team === role && s === seat ? 'you' : ''}`}
            >
              <span className={`player-avatar ${p ? '' : 'waiting'}`}>{p ? p.avatar : '?'}</span>
              <span className="player-name">{p ? p.name : 'Empty seat'}</span>
              <span className="player-status">
                {!p ? 'Waiting…' : p.ready ? 'Ready ✓' : filling ? 'Seated' : 'Picking words…'}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
