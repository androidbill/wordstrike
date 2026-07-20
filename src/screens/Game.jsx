import { useEffect, useMemo, useRef, useState } from 'react'
import Curtain from './Curtain.jsx'
import {
  otherRole, targetWords, guessedBy, solvedBy, solvedCount,
  LETTER_WINDOW_MS, letterMovePatch, solveMovePatch, letterWindowExpiredPatch,
  solveWindowExpiredPatch, rematchResetPatch
} from '../game.js'

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

export default function Game({ room, role, store, hotseat, onLeave }) {
  // Hotseat: one device, so the "viewing" role follows whoever holds the
  // phone; a curtain gates each handoff. Online: the role is fixed.
  const [activeRole, setActiveRole] = useState(room.turn)
  const [handoff, setHandoff] = useState(hotseat) // curtain up at game start
  const myRole = hotseat ? activeRole : role
  const rival = otherRole(myRole)
  const me = room.players[myRole]
  const them = room.players[rival]
  const myTurn = room.turn === myRole && room.status === 'playing'
  const [view, setView] = useState('attack') // 'attack' | 'defend'
  const [solving, setSolving] = useState(null) // word index
  const [now, setNow] = useState(Date.now())
  const busyRef = useRef(false)
  const solveWindowOpen = myTurn && room.solveUntil > now
  const solveSeconds = solveWindowOpen ? Math.max(1, Math.ceil((room.solveUntil - now) / 1000)) : 0
  const letterWindowOpen = myTurn && !room.solveUntil && room.letterUntil > now
  const letterSeconds = letterWindowOpen ? Math.max(1, Math.ceil((room.letterUntil - now) / 1000)) : 0

  const fire = async (patch) => {
    if (busyRef.current) return
    busyRef.current = true
    await store.update(room.code, patch)
    busyRef.current = false
  }

  const callLetter = (letter) => {
    if (!letterWindowOpen || guessedBy(room, myRole)[letter]) return
    fire(letterMovePatch(room, myRole, letter))
  }

  const submitSolve = (wordIndex, attempt) => {
    if (!solveWindowOpen) return
    setSolving(null)
    fire(solveMovePatch(room, myRole, wordIndex, attempt))
  }

  useEffect(() => {
    if ((!room.solveUntil && !room.letterUntil) || room.status !== 'playing') return
    const tick = () => setNow(Date.now())
    tick()
    const interval = setInterval(tick, 200)
    return () => clearInterval(interval)
  }, [room.solveUntil, room.letterUntil, room.status])

  // Give rooms created by an older app build a deadline as soon as the
  // current player opens them.
  useEffect(() => {
    if (!myTurn || room.solveUntil || room.letterUntil || room.status !== 'playing') return
    fire({ letterUntil: Date.now() + LETTER_WINDOW_MS })
  }, [myTurn, room.solveUntil, room.letterUntil, room.status])

  useEffect(() => {
    if (!myTurn || room.solveUntil || !room.letterUntil || room.status !== 'playing' || Date.now() < room.letterUntil) return
    fire(letterWindowExpiredPatch(room))
  }, [now, myTurn, room.letterUntil, room.solveUntil, room.status])

  useEffect(() => {
    if (!myTurn || !room.solveUntil || room.status !== 'playing' || Date.now() < room.solveUntil) return
    setSolving(null)
    fire(solveWindowExpiredPatch(room))
  }, [now, myTurn, room.solveUntil, room.status])

  // Hotseat handoff: once the turn flips away from the player holding the
  // phone, give them a moment to watch the reveal, then drop the curtain.
  useEffect(() => {
    if (!hotseat || room.status !== 'playing' || room.turn === activeRole) return
    const t = setTimeout(() => setHandoff(true), 1800)
    return () => clearTimeout(t)
  }, [hotseat, room.turn, room.status, activeRole])

  // Host referees the online rematch: when both flags are up, reset.
  useEffect(() => {
    if (hotseat || role !== 'host' || room.status !== 'finished') return
    if (room.rematch?.host && room.rematch?.guest) {
      fire(rematchResetPatch())
    }
  }, [room, role, hotseat])

  const opponentLeft = !hotseat && room.left?.[rival]

  return (
    <div className="screen game">
      <header className="game-header">
        <PlayerBadge player={me} active={room.turn === myRole && room.status === 'playing'} score={solvedCount(room, myRole)} />
        <div className="turn-pill-wrap">
          {room.status === 'playing' && (
            <span className={`turn-pill ${myTurn ? 'mine' : ''}`}>
              {myTurn ? (hotseat ? `${me.name}'s turn` : 'Your turn') : `${them.name}'s turn`}
            </span>
          )}
        </div>
        <PlayerBadge player={them} active={room.turn === rival && room.status === 'playing'} score={solvedCount(room, rival)} right />
      </header>

      <MoveBanner room={room} role={myRole} />

      {!hotseat && (
        <div className="board-tabs">
          <button className={`tab ${view === 'attack' ? 'on' : ''}`} onClick={() => setView('attack')}>
            ⚔️ {them.name}'s words
          </button>
          <button className={`tab ${view === 'defend' ? 'on' : ''}`} onClick={() => setView('defend')}>
            🛡️ Your words
          </button>
        </div>
      )}

      {view === 'attack' || hotseat ? (
        <Board
          words={targetWords(room, myRole)}
          guessed={guessedBy(room, myRole)}
          solved={solvedBy(room, myRole)}
          canSolve={solveWindowOpen}
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

      {(view === 'attack' || hotseat) && room.status === 'playing' && (
        <>
          <p className="kb-hint">
            {myTurn
              ? solveWindowOpen
                ? `Solve a word now — ${solveSeconds} second${solveSeconds === 1 ? '' : 's'} left`
                : `Pick a letter — ${letterSeconds} second${letterSeconds === 1 ? '' : 's'} left`
              : hotseat
                ? `Nice — hand the phone to ${them.name} when you're ready`
                : 'Waiting for your rival…'}
          </p>
          {solveWindowOpen && (
            <div className="solve-countdown" role="timer" aria-live="polite">
              <span style={{ '--timer-progress': `${((room.solveUntil - now) / 10_000) * 100}%` }} />
              <strong>{solveSeconds}</strong>
            </div>
          )}
          {letterWindowOpen && (
            <div className="letter-countdown" role="timer" aria-live="polite">
              <span style={{ '--timer-progress': `${((room.letterUntil - now) / 30_000) * 100}%` }} />
              <strong>{letterSeconds}</strong>
            </div>
          )}
          <Keyboard guessed={guessedBy(room, myRole)} disabled={!letterWindowOpen} onKey={callLetter} />
        </>
      )}
      {view === 'defend' && !hotseat && room.status === 'playing' && (
        <p className="kb-hint">Letters your rival has uncovered. Solved words show gold.</p>
      )}

      <button className="btn ghost leave" onClick={onLeave}>Leave</button>

      {solving !== null && (
        <SolveModal
          word={targetWords(room, myRole)[solving]}
          index={solving}
          guessed={guessedBy(room, myRole)}
          onSubmit={submitSolve}
          onClose={() => setSolving(null)}
        />
      )}

      {(room.status === 'finished' || opponentLeft) && (
        <EndOverlay
          room={room}
          role={myRole}
          hotseat={hotseat}
          onLeave={onLeave}
          onRematch={() => fire(hotseat ? rematchResetPatch() : { [`rematch/${myRole}`]: true })}
          opponentLeft={opponentLeft}
        />
      )}

      {hotseat && handoff && room.status === 'playing' && (
        <Curtain
          avatar={room.players[room.turn].avatar}
          name={room.players[room.turn].name}
          hint="No peeking while the phone changes hands!"
          onReady={() => {
            setActiveRole(room.turn)
            setHandoff(false)
          }}
        />
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
    if (m.type === 'timeout') {
      text = m.phase === 'letter'
        ? `${actor} ran out of time to pick a letter ⏱️`
        : `${actor}'s solve time ran out ⏱️`
    } else {
      text = m.correct
        ? `${actor} solved word #${m.wordIndex + 1}! ⚡`
        : `${actor} fumbled a solve on word #${m.wordIndex + 1} 😬`
    }
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
  const blankIndexes = useMemo(
    () => [...word].map((_, i) => i).filter((i) => !guessed[word[i]]),
    [word, guessed]
  )
  const [blankLetters, setBlankLetters] = useState('')
  const inputRef = useRef(null)

  const attempt = [...word]
  blankIndexes.forEach((wordIndex, blankIndex) => {
    attempt[wordIndex] = blankLetters[blankIndex] || ''
  })

  const submit = (e) => {
    e.preventDefault()
    if (blankLetters.length === blankIndexes.length) onSubmit(index, attempt.join(''))
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet solve" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Solve word #{index + 1}</h3>
        <p className="hint">Type only the highlighted blank letters. Get it right and the timer restarts.</p>
        <div className="solve-tiles" onClick={() => inputRef.current?.focus()}>
          {[0, 1, 2, 3, 4].map((i) => {
            const known = guessed[word[i]] ? word[i] : null
            const blankIndex = blankIndexes.indexOf(i)
            const typed = blankIndex >= 0 ? blankLetters[blankIndex] : ''
            return (
              <span key={i} className={`tile ${typed ? 'typed' : known ? 'revealed locked' : 'solve-blank'}`}>
                {typed || known || ''}
              </span>
            )
          })}
        </div>
        <input
          ref={inputRef}
          className="ghost-input"
          value={blankLetters}
          onChange={(e) => setBlankLetters(e.target.value.toLowerCase().replace(/[^a-z]/g, '').slice(0, blankIndexes.length))}
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Your solve attempt"
        />
        <div className="row">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={blankLetters.length !== blankIndexes.length}>Solve!</button>
        </div>
      </form>
    </div>
  )
}

function EndOverlay({ room, role, hotseat, onLeave, onRematch, opponentLeft }) {
  const won = room.winner === role
  const rival = otherRole(role)
  const winner = room.winner ? room.players[room.winner] : null
  const loserRole = room.winner ? otherRole(room.winner) : rival
  const iWantRematch = !hotseat && room.rematch?.[role]
  const theyWantRematch = !hotseat && room.rematch?.[rival]

  return (
    <div className="end-overlay">
      {(won || (hotseat && winner)) && <Confetti />}
      <div className="end-card">
        {opponentLeft && !room.winner ? (
          <>
            <span className="end-emoji">🚪</span>
            <h2>Rival left the room</h2>
          </>
        ) : hotseat ? (
          <>
            <span className="end-emoji">🏆</span>
            <h2>{winner.avatar} {winner.name} wins!</h2>
            <p className="hint">All five of {room.players[loserRole].name}'s words — cracked.</p>
            <div className="final-words">
              <span className="final-label">{room.players[loserRole].name}'s words were:</span>
              <div className="final-list">
                {(room.players[loserRole].words || []).map((w) => <span key={w} className="word-chip">{w}</span>)}
              </div>
            </div>
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
