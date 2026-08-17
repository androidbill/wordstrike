import { useEffect, useState } from 'react'
import { getStore } from '../net/store.js'
import { TEAM_LABELS, TEAM_BADGES, TEAM_SIZE, membersOf } from '../game.js'

// Online 2v2: a joiner claims one of the four seats. The room is live here, so
// seats fill in as friends arrive and everyone can see who to pair up with.
export default function TeamPick({ code, onPick, onBack, error }) {
  const [room, setRoom] = useState(null)

  useEffect(() => {
    let unsub = () => {}
    let cancelled = false
    getStore().then((store) => {
      if (cancelled) return
      unsub = store.subscribe(code, setRoom)
    })
    return () => { cancelled = true; unsub() }
  }, [code])

  if (!room) return <div className="center-page"><div className="spinner" /></div>

  return (
    <div className="screen setup-screen">
      <h2>Pick your side</h2>
      <p className="hint">Room {room.code} · tap an open seat to join that team.</p>

      <div className="team-pick">
        {['host', 'guest'].map((team) => {
          const members = membersOf(room, team)
          const full = members.filter(Boolean).length === TEAM_SIZE
          return (
            <div key={team} className={`team-panel ${full ? 'full' : ''}`}>
              <span className="team-title">{TEAM_BADGES[team]} {TEAM_LABELS[team]}</span>
              {members.map((p, seat) =>
                p ? (
                  <div key={seat} className="team-seat taken">
                    <span className="player-avatar">{p.avatar}</span>
                    <span className="player-name">{p.name}</span>
                  </div>
                ) : (
                  <button
                    key={seat}
                    type="button"
                    className="team-seat open"
                    onClick={() => onPick({ team, seat })}
                  >
                    <span className="player-avatar waiting">+</span>
                    <span className="player-name">Sit here</span>
                  </button>
                )
              )}
            </div>
          )
        })}
      </div>

      {error && <p className="error">{error}</p>}
      <button className="btn ghost" onClick={onBack}>Back</button>
    </div>
  )
}
