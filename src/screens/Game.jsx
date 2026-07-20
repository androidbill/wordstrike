import { useEffect, useMemo, useRef, useState } from 'react'
import { getStore } from '../net/store.js'
import {
  otherRole, targetWords, guessedBy, solvedBy, solvedCount,
  letterMovePatch, solveMovePatch
} from '../game.js'

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

export default function Game({ room, role, onLeave }) {
  const rival = otherRole(role)
  const me = room.players[role]
  const them = room.players[rival]
  const myTurn = room.turn === role && room.status === 'playing'
  const [view, setView] = useState('attack') // 'attack' | 'defend'
  const [solving, setSolving] = useState(null) // word index
  const busyRef = useRef(false)

  const fire = async (patch) => {
    if (busyRef.current) return
    busyRef.current = true
    const store = await getStore()
    await store.update(room.code, patch)
    busyRef.current = false
  }

  const callLetter = (letter) => {
    if (!myTurn || guessedBy(room, role)[letter]) return
    fire(letterMovePatch(room, role, letter))
  }

  const submitSolve = (wordIndex, attempt) => {
    setSolving(null)
    fire(solveMovePatch(room, role, wordIndex, attempt))
  }

  // Host referees the rematch: when both flags are up, reset to the lobby.
  useEffect(() => {
    if (role !== 'host' || room.status !== 'finished') return
    if (room.rematch?.host && room.rematch?.guest) {
      fire({
        status: 'lobby',
        'players/host/words': null,
        'players/host/ready': false,
        'players/guest/words': null,
        'players/guest/ready': false,
        guessed: null,
        solved: null,
        lastMove: null,
        winner: null,
        rematch: null,
        turn: 'host'
      })
    }
  }, [room, role])

  const opponentLeft = room.left?.[rival]

  return (
    <div className="screen game">
      <header className="game-header">
        <PlayerBadge player={me} label="You" active={room.turn === role && room.status === 'playing'} score={solvedCount(room, role)} />
        <div className="turn-pill-wrap">
          {room.status === 'playing' && (
            <span className={`turn-pill ${myTurn ? 'mine' : ''}`}>
              {myTurn ? 'Your turn' : `${them.name}'s turn`}
            </span>
          )}
        </div>
        <PlayerBadge player={them} label="Rival" active={room.turn === rival && room.status === 'playing'} score={solvedCount(room, rival)} right />
      </header>

      <MoveBanner room={room} role={role} />

      <div className="board-tabs">
        <button className={`tab ${view === 'attack' ? 'on' : ''}`} onClick={() => setView('attack')}>
          ⚔️ {them.name}'s words
        </button>
        <button className={`tab ${view === 'defend' ? 'on' : ''}`} onClick={() => setView('defend')}>
          🛡️ Your words
        </button>
      </div>

      {view === 'attack' ? (
        <Board
          words={targetWords(room, role)}
          guessed={guessedBy(room, role)}
          solved={solvedBy(room, role)}
          canSolve={myTurn}
          onSolve={setSolving}
          animate
        />
      ) : (
        <Board
          words={me.words}
          guessed={guessedBy(room, rival)}
          solved={solvedBy(room, rival)}
          defend
        />
      )}

      {view === 'attack' && room.status === 'playing' && (
        <>
          <p className="kb-hint">{myTurn ? 'Call a letter — or tap a word to solve it' : 'Waiting for your rival…'}</p>
          <Keyboard guessed={guessedBy(room, role)} disabled={!myTurn} onKey={callLetter} />
        </>
      )}
      {view === 'defend' && room.status === 'playing' && (
        <p className="kb-hint">Letters your rival has uncovered. Solved words show gold.</p>
      )}

      <button className="btn ghost leave" onClick={onLeave}>Leave</button>

      {solving !== null && (
        <SolveModal
          word={targetWords(room, role)[solving]}
          index={solving}
          guessed={guessedBy(room, role)}
          onSubmit={submitSolve}
          onClose={() => setSolving(null)}
        />
      )}

      {(room.status === 'finished' || opponentLeft) && (
        <EndOverlay room={room} role={role} onLeave={onLeave} onRematch={() => fire({ [`rematch/${role}`]: true })} opponentLeft={opponentLeft} />
      )}
    </div>
  )
}

function PlayerBadge({ player, label, active, score, right }) {
  return (
    <div className={`player-badge ${active ? 'active' : ''} ${right ? 'right' : ''}`}>
      <span className="badge-avatar">{player.avatar}</span>
      <span className="badge-text">
        <span className="badge-name">{player.name}</span>
        <span className="badge-score">{score}/5 solved</span>
      </span>
    </div>
  )
}

function MoveBanner({ room, role }) {
  const m = room.lastMove
  if (!m || room.status !== 'playing') return <div className="move-banner empty" />
  const actor = m.by === role ? 'You' : room.players[m.by].name
  let text
  if (m.type === 'letter') {
    text = m.correct
      ? `${actor} called "${m.letter.toUpperCase()}" — ${m.hits} hit${m.hits > 1 ? 's' : ''}! 🔥`
      : `${actor} called "${m.letter.toUpperCase()}" — miss 💨`
  } else {
    text = m.correct
      ? `${actor} solved word #${m.wordIndex + 1}! ⚡`
      : `${actor} fumbled a solve on word #${m.wordIndex + 1} 😬`
  }
  return <div key={m.ts} className={`move-banner ${m.correct ? 'hit' : 'miss'}`}>{text}</div>
}

function Board({ words, guessed, solved, canSolve, onSolve, defend, animate }) {
  // Track which tiles were already revealed so only new ones play the
  // wheel-of-fortune flip.
  const prevRef = useRef(new Set())
  const revealed = useMemo(() => {
    const set = new Set()
    words.forEach((w, wi) => {
      ;[...w].forEach((ch, li) => {
        if (solved[wi] || guessed[ch]) set.add(`${wi}-${li}`)
      })
    })
    return set
  }, [words, guessed, solved])

  useEffect(() => {
    prevRef.current = revealed
  }, [revealed])

  let staggerIndex = 0
  return (
    <div className="board">
      {words.map((w, wi) => {
        const isSolved = solved[wi]
        return (
          <button
            key={wi}
            className={`word-row ${isSolved ? 'solved' : ''} ${canSolve && !isSolved ? 'solvable' : ''}`}
            disabled={!canSolve || isSolved}
            onClick={() => onSolve?.(wi)}
            aria-label={`Word ${wi + 1}${isSolved ? ' (solved)' : ''}`}
          >
            {[...w].map((ch, li) => {
              const key = `${wi}-${li}`
              const isRevealed = revealed.has(key)
              const fresh = animate && isRevealed && !prevRef.current.has(key)
              const style = fresh ? { '--d': `${staggerIndex++ * 0.12}s` } : undefined
              return (
                <span key={key} className={`tile ${isRevealed ? 'revealed' : ''} ${fresh ? 'fresh' : ''} ${isSolved ? 'gold' : ''}`} style={style}>
                  {isRevealed || defend ? ch : ''}
                </span>
              )
            })}
            {isSolved && <span className="solved-mark">✓</span>}
          </button>
        )
      })}
    </div>
  )
}

function Keyboard({ guessed, disabled, onKey }) {
  return (
    <div className={`keyboard ${disabled ? 'disabled' : ''}`}>
      {KEY_ROWS.map((row) => (
        <div key={row} className="key-row">
          {[...row].map((k) => (
            <button
              key={k}
              className={`key ${guessed[k] || ''}`}
              disabled={disabled || !!guessed[k]}
              onClick={() => onKey(k)}
            >
              {k}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function SolveModal({ word, index, guessed, onSubmit, onClose }) {
  const [attempt, setAttempt] = useState('')
  const inputRef = useRef(null)

  const submit = (e) => {
    e.preventDefault()
    if (attempt.length === 5) onSubmit(index, attempt)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet solve" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Solve word #{index + 1}</h3>
        <p className="hint">Get it right and you keep your turn. Miss and it passes.</p>
        <div className="solve-tiles" onClick={() => inputRef.current?.focus()}>
          {[0, 1, 2, 3, 4].map((i) => {
            const known = guessed[word[i]] ? word[i] : null
            return (
              <span key={i} className={`tile ${attempt[i] ? 'typed' : known ? 'revealed' : ''}`}>
                {attempt[i] || known || ''}
              </span>
            )
          })}
        </div>
        <input
          ref={inputRef}
          className="ghost-input"
          value={attempt}
          onChange={(e) => setAttempt(e.target.value.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5))}
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Your solve attempt"
        />
        <div className="row">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={attempt.length !== 5}>Solve!</button>
        </div>
      </form>
    </div>
  )
}

function EndOverlay({ room, role, onLeave, onRematch, opponentLeft }) {
  const won = room.winner === role
  const rival = otherRole(role)
  const iWantRematch = room.rematch?.[role]
  const theyWantRematch = room.rematch?.[rival]

  return (
    <div className="end-overlay">
      {won && <Confetti />}
      <div className="end-card">
        {opponentLeft && !room.winner ? (
          <>
            <span className="end-emoji">🚪</span>
            <h2>Rival left the room</h2>
          </>
        ) : (
          <>
            <span className="end-emoji">{won ? '🏆' : '💥'}</span>
            <h2>{won ? 'Victory!' : 'Defeated'}</h2>
            <p className="hint">
              {won ? 'You cracked all five words.' : `${room.players[rival].name} cracked your board first.`}
            </p>
            <div className="final-words">
              <span className="final-label">{room.players[rival].name}'s words were:</span>
              <div className="final-list">
                {(room.players[rival].words || []).map((w) => <span key={w} className="word-chip">{w}</span>)}
              </div>
            </div>
          </>
        )}
        <div className="row">
          <button className="btn ghost" onClick={onLeave}>Exit</button>
          {!opponentLeft && (
            <button className="btn primary" onClick={onRematch} disabled={iWantRematch}>
              {iWantRematch ? 'Waiting for rival…' : theyWantRematch ? 'Rival wants a rematch!' : 'Rematch'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 2.5}s`,
        duration: `${2.5 + Math.random() * 2}s`,
        color: ['#f5c542', '#5b8def', '#e75a7c', '#4ecdc4', '#a78bfa'][i % 5],
        size: `${6 + Math.random() * 8}px`,
        spin: `${360 + Math.random() * 720}deg`
      })),
    []
  )
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
            '--spin': p.spin
          }}
        />
      ))}
    </div>
  )
}
