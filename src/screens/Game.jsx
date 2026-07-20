import { useEffect, useMemo, useRef, useState } from 'react'
import Curtain from './Curtain.jsx'
import {
  otherRole, targetWords, guessedBy, solvedBy, solvedCount,
  LETTER_WINDOW_MS, letterMovePatch, solveMovePatch,
  letterWindowExpiredPatch, solveWindowExpiredPatch, passSolvePatch,
  pauseGamePatch, resumeGamePatch, rematchResetPatch,
  isAsync, wordCountOf, windows,
  POWERUPS, revealPowerupPatch, timePowerupPatch, doublePowerupPatch
} from '../game.js'
import {
  hapticHit, hapticMiss, hapticSolve, hapticWrong, hapticWin,
  notifyTurn, requestNotifyPermission
} from '../haptics.js'
import { addGame } from '../history.js'
import { botMovePatch, botWords } from '../bot.js'
import { playHits, playMiss, playSolve, playWrongSolve, playWin, playTaunt } from '../sounds.js'
import { earn } from '../achievements.js'

const TAUNTS = ['😂', '😱', '🔥', '😭', '👏']

const WIN_TITLES = [
  'Word Wizard 🧙', 'Vowel Vandal 😈', 'The Alphabet Menace 🔤', 'Letter Lord 👑',
  'Consonant Crusher 💪', 'The Dictionary 📖', 'Spelling Bee Royalty 🐝', 'Lexicon Legend ⭐'
]
const LOSE_TITLES = [
  'Moral Victor 🎖️', 'Almost Famous 🌟', 'Future Champion 🌱', 'Crowd Favorite 💐',
  'The Comeback Kid (next time) 🔄', 'Style Points Winner ✨'
]

// Deterministic pick so both devices show the same title.
function pickTitle(list, room) {
  let h = 0
  const s = `${room.code}${room.startedAt || 0}`
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return list[h % list.length]
}

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

export default function Game({ room, role, store, hotseat, bot, onLeave }) {
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
  const relaxed = isAsync(room)
  const isPaused = !relaxed && !!room.paused && room.status === 'playing'
  // Relaxed pace: no deadlines. After your letter (or a correct solve) you
  // are in the solve phase until you solve wrong, pass, or end your turn.
  const asyncSolvePhase = relaxed && myTurn && room.lastMove?.by === myRole &&
    (room.lastMove.type === 'letter' || (room.lastMove.type === 'solve' && room.lastMove.correct)) &&
    !room.lastMove.striking
  const solveWindowOpen = relaxed
    ? asyncSolvePhase
    : myTurn && !isPaused && room.solveUntil > now
  const solveSeconds = !relaxed && solveWindowOpen ? Math.max(1, Math.ceil((room.solveUntil - now) / 1000)) : 0
  const letterWindowOpen = relaxed
    ? myTurn && !asyncSolvePhase
    : myTurn && !isPaused && !room.solveUntil && room.letterUntil > now
  const letterSeconds = !relaxed && letterWindowOpen ? Math.max(1, Math.ceil((room.letterUntil - now) / 1000)) : 0

  const fire = async (patch) => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      await store.update(room.code, patch)
    } finally {
      busyRef.current = false
    }
  }

  const callLetter = (letter) => {
    if (!letterWindowOpen || guessedBy(room, myRole)[letter]) return
    fire(letterMovePatch(room, myRole, letter))
  }

  const submitSolve = (wordIndex, attempt) => {
    if (!solveWindowOpen) return
    setSolving(null)
    // Achievement checks belong to the local solver.
    const word = targetWords(room, myRole)[wordIndex]
    if (attempt.toLowerCase() === word) {
      if ([...word].every((ch) => !guessedBy(room, myRole)[ch])) unlock('mind_reader')
      if (room.startedAt && Date.now() - room.startedAt < 60_000) unlock('speed_demon')
    }
    fire(solveMovePatch(room, myRole, wordIndex, attempt))
  }

  const sendTaunt = (emoji) => {
    fire({ taunt: { emoji, by: myRole, ts: Date.now() } })
  }

  const endTurn = () => {
    if (relaxed && asyncSolvePhase) fire(passSolvePatch(room))
  }

  // One power-up per player per game, usable on your turn in the letter phase.
  const [powerOpen, setPowerOpen] = useState(false)
  // Firebase strips nulls, so "never used" can read as undefined.
  const myPowerUnused = room.powerups?.[myRole] !== 'used'
  const usePowerup = (id) => {
    setPowerOpen(false)
    if (!myTurn || !myPowerUnused) return
    if (id === 'reveal') {
      const patch = revealPowerupPatch(room, myRole)
      if (patch) fire(patch)
    } else if (id === 'time' && !relaxed) {
      fire(timePowerupPatch(room, myRole))
    } else if (id === 'double') {
      fire(doublePowerupPatch(room, myRole))
    }
  }

  // Achievement toast queue.
  const [toast, setToast] = useState(null)
  const unlock = (id) => {
    const a = earn(id)
    if (a) {
      setToast(a)
      setTimeout(() => setToast(null), 3200)
    }
  }

  useEffect(() => {
    if ((!room.solveUntil && !room.letterUntil && !room.paused) || room.status !== 'playing') return
    const tick = () => setNow(Date.now())
    tick()
    const interval = setInterval(tick, 200)
    return () => clearInterval(interval)
  }, [room.solveUntil, room.letterUntil, room.paused, room.status])

  // Pause: only on your own turn, for up to 5 minutes; a repause starts a
  // fresh clock. Only the pauser can resume early; at 0:00 it auto-resumes.
  const pauseGame = () => {
    if (!isPaused && myTurn) fire(pauseGamePatch(room, myRole))
  }
  const resumeGame = () => {
    if (room.paused && room.paused.by === myRole) fire(resumeGamePatch(room))
  }
  useEffect(() => {
    if (!isPaused || now < room.paused.until) return
    fire(resumeGamePatch(room))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, isPaused])

  // Give rooms created by an older app build a deadline as soon as the
  // current player opens them.
  useEffect(() => {
    if (relaxed || !myTurn || room.solveUntil || room.letterUntil || room.status !== 'playing') return
    fire({ letterUntil: Date.now() + LETTER_WINDOW_MS })
  }, [myTurn, room.solveUntil, room.letterUntil, room.status, relaxed])

  useEffect(() => {
    if (relaxed || !myTurn || isPaused || room.solveUntil || !room.letterUntil || room.status !== 'playing' || Date.now() < room.letterUntil) return
    fire(letterWindowExpiredPatch(room))
  }, [now, myTurn, isPaused, room.letterUntil, room.solveUntil, room.status, relaxed])

  useEffect(() => {
    if (relaxed || !myTurn || isPaused || !room.solveUntil || room.status !== 'playing' || Date.now() < room.solveUntil) return
    setSolving(null)
    fire(solveWindowExpiredPatch(room))
  }, [now, myTurn, isPaused, room.solveUntil, room.status, relaxed])

  // Relaxed pace: ask for notification permission once, then nudge whenever
  // the turn lands on this player while the tab is hidden.
  useEffect(() => {
    if (relaxed && !hotseat) requestNotifyPermission()
  }, [relaxed, hotseat])
  useEffect(() => {
    if (!relaxed || hotseat || !myTurn) return
    const m = room.lastMove
    const what = m?.type === 'letter'
      ? `${them.name} called "${m.letter?.toUpperCase()}"`
      : m?.type === 'solve'
        ? `${them.name} tried a solve`
        : `${them.name} moved`
    notifyTurn('WordStrike — your turn!', `${what}. Come take your shot.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTurn, relaxed, hotseat])

  // Presence heartbeat (online games): stamp "seen" every 20s so the rival's
  // device can show offline / reconnected banners.
  useEffect(() => {
    if (hotseat || bot || room.status !== 'playing') return
    const beat = () => store.update(room.code, { [`seen/${role}`]: Date.now() }).catch(() => {})
    beat()
    const interval = setInterval(beat, 20_000)
    return () => clearInterval(interval)
  }, [hotseat, room.status, room.code, role, store])

  const [rivalOffline, setRivalOffline] = useState(false)
  useEffect(() => {
    if (hotseat || relaxed || room.status !== 'playing') return
    const check = () => {
      const seen = room.seen?.[rival]
      setRivalOffline(!!seen && Date.now() - seen > 50_000)
    }
    check()
    const interval = setInterval(check, 5_000)
    return () => clearInterval(interval)
  }, [hotseat, relaxed, room.status, room.seen, rival])
  const wasOfflineRef = useRef(false)
  const [reconnected, setReconnected] = useState(false)
  useEffect(() => {
    if (rivalOffline) {
      wasOfflineRef.current = true
    } else if (wasOfflineRef.current) {
      wasOfflineRef.current = false
      setReconnected(true)
      const t = setTimeout(() => setReconnected(false), 3000)
      return () => clearTimeout(t)
    }
  }, [rivalOffline])

  // Hotseat handoff: once the turn flips away from the player holding the
  // phone, give them a moment to watch the reveal, then drop the curtain.
  useEffect(() => {
    if (!hotseat || room.status !== 'playing' || room.turn === activeRole) return
    const t = setTimeout(() => setHandoff(true), 1800)
    return () => clearTimeout(t)
  }, [hotseat, room.turn, room.status, activeRole])

  // Online rematch: when both flags are up, whichever player sees it resets
  // the room. Both may fire — the patch is identical, so a double write is
  // harmless — and neither player can be stranded if the other tab is asleep.
  useEffect(() => {
    if (hotseat || room.status !== 'finished') return
    if (room.rematch?.host && room.rematch?.guest) {
      fire(rematchResetPatch(room))
    }
  }, [room, hotseat])

  // Track the fastest solve of this game: elapsed time from the moment the
  // game started to the moment the word was solved.
  const prevMoveRef = useRef(room.lastMove)
  const fastestRef = useRef(null)
  useEffect(() => {
    const prevMove = prevMoveRef.current
    prevMoveRef.current = room.lastMove
    const m = room.lastMove
    if (!m || m === prevMove || m.type !== 'solve' || !m.correct) return
    if (!room.startedAt) return
    const ms = m.ts - room.startedAt
    if (ms >= 0 && (!fastestRef.current || ms < fastestRef.current.ms)) {
      fastestRef.current = { name: room.players[m.by].name, ms }
    }
  }, [room])

  // Record the finished game once per playthrough (rematches reset startedAt).
  const recordedRef = useRef(null)
  useEffect(() => {
    if (room.status !== 'finished' || !room.winner) return
    const key = `${room.code}:${room.startedAt || 0}`
    if (recordedRef.current === key) return
    recordedRef.current = key
    addGame({
      ts: Date.now(),
      mode: hotseat ? 'hotseat' : 'online',
      code: room.code,
      players: {
        host: { name: room.players.host.name, avatar: room.players.host.avatar },
        guest: { name: room.players.guest.name, avatar: room.players.guest.avatar }
      },
      winnerName: room.players[room.winner].name,
      winnerAvatar: room.players[room.winner].avatar,
      scores: { host: solvedCount(room, 'host'), guest: solvedCount(room, 'guest') },
      durationMs: room.startedAt ? Date.now() - room.startedAt : null,
      fastestSolve: fastestRef.current
    })
    fastestRef.current = null
  }, [room, hotseat])

  // Per-player hot streaks (consecutive correct letters), sound effects,
  // screen shake on a fumbled solve, and avatar reactions — all driven by
  // watching lastMove change.
  const [streaks, setStreaks] = useState({ host: 0, guest: 0 })
  const [shake, setShake] = useState(false)
  const [reaction, setReaction] = useState(null) // {role, kind, ts}
  const seenMoveRef = useRef(room.lastMove?.ts)
  useEffect(() => {
    const m = room.lastMove
    if (!m || m.ts === seenMoveRef.current) return
    seenMoveRef.current = m.ts
    if (m.type === 'letter' || (m.type === 'powerup' && m.powerup === 'reveal')) {
      if (m.type === 'letter') setStreaks((s) => ({ ...s, [m.by]: m.correct ? s[m.by] + 1 : 0 }))
      setReaction({ role: m.by, kind: m.correct ? 'bounce' : 'droop', ts: m.ts })
      if (m.correct) {
        playHits(m.hits || 1)
        hapticHit()
      } else {
        playMiss()
        hapticMiss()
      }
    } else if (m.type === 'solve') {
      setReaction({ role: m.by, kind: m.correct ? 'spin' : 'droop', ts: m.ts })
      if (m.correct) {
        playSolve()
        hapticSolve()
      } else {
        playWrongSolve()
        hapticWrong()
        setShake(true)
        setTimeout(() => setShake(false), 550)
      }
    }
  }, [room.lastMove])

  // Taunt flying across the screen (both devices see it).
  const [tauntShow, setTauntShow] = useState(null)
  const seenTauntRef = useRef(room.taunt?.ts)
  useEffect(() => {
    const t = room.taunt
    if (!t || t.ts === seenTauntRef.current) return
    seenTauntRef.current = t.ts
    setTauntShow(t)
    playTaunt()
    const timer = setTimeout(() => setTauntShow(null), 1600)
    return () => clearTimeout(timer)
  }, [room.taunt])

  // Winner fanfare + result achievements once the game ends.
  useEffect(() => {
    if (room.status !== 'finished' || !room.winner) return
    playWin()
    hapticWin()
    const iWon = hotseat || room.winner === role
    if (iWon) {
      unlock('first_blood')
      const n = wordCountOf(room)
      const w = solvedCount(room, room.winner)
      const l = solvedCount(room, otherRole(room.winner))
      if (w === n && l === n - 1) unlock('photo_finish')
      if (w === n && l === 0) unlock('clean_sweep')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.status, room.winner])

  // Practice bot: this device plays the guest seat after a thinking pause.
  useEffect(() => {
    if (!bot || room.status !== 'playing' || room.turn !== 'guest') return
    const t = setTimeout(() => {
      fire(botMovePatch(room, bot))
    }, 1200 + Math.random() * 1300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot, room])
  // Bot always accepts a rematch and re-picks its secret words.
  useEffect(() => {
    if (!bot) return
    if (room.status === 'finished' && room.rematch?.host && !room.rematch?.guest) {
      fire({ 'rematch/guest': true })
    }
    if (room.status === 'lobby' && !room.players.guest?.words) {
      fire({ 'players/guest/words': botWords(wordCountOf(room)), 'players/guest/ready': true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot, room])

  // Fireworks celebrate every correct solve; keyed by the move timestamp so
  // each solve gets a fresh burst.
  const [fireworksAt, setFireworksAt] = useState(null)
  useEffect(() => {
    const m = room.lastMove
    if (m?.type === 'solve' && m.correct && room.status !== 'finished') {
      setFireworksAt(m.ts)
      const t = setTimeout(() => setFireworksAt(null), 1700)
      return () => clearTimeout(t)
    }
  }, [room.lastMove, room.status])

  const opponentLeft = !hotseat && room.left?.[rival]

  return (
    <div className={`screen game ${shake ? 'shake' : ''}`}>
      <header className="game-header">
        <PlayerBadge player={me} active={room.turn === myRole && room.status === 'playing'} score={solvedCount(room, myRole)} total={wordCountOf(room)} reaction={reaction?.role === myRole ? reaction : null} />
        <div className="turn-pill-wrap">
          {room.status === 'playing' && (
            <span className={`turn-pill ${myTurn ? 'mine' : ''}`}>
              {myTurn ? (hotseat ? `${me.name}'s turn` : 'Your turn') : `${them.name}'s turn`}
            </span>
          )}
        </div>
        <PlayerBadge player={them} active={room.turn === rival && room.status === 'playing'} score={solvedCount(room, rival)} total={wordCountOf(room)} reaction={reaction?.role === rival ? reaction : null} right />
      </header>

      <MoveBanner room={room} role={myRole} streaks={streaks} />

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
                ? relaxed
                  ? 'Solve a word, call it good, or end your turn'
                  : `Solve a word now — ${solveSeconds} second${solveSeconds === 1 ? '' : 's'} left`
                : relaxed
                  ? 'Your turn — pick a letter whenever you like'
                  : `Pick a letter — ${letterSeconds} second${letterSeconds === 1 ? '' : 's'} left`
              : hotseat
                ? `Nice — hand the phone to ${them.name} when you're ready`
                : relaxed
                  ? `Waiting for ${them.name} — you'll get a nudge when it's your turn`
                  : 'Waiting for your rival…'}
          </p>
          {solveWindowOpen && !relaxed && (
            <div className="solve-actions">
              <div className="solve-countdown" role="timer" aria-live="polite">
                <span style={{ '--timer-progress': `${((room.solveUntil - now) / windows(room).solve) * 100}%` }} />
                <strong>{solveSeconds}</strong>
              </div>
              <button
                className="btn ghost pass-btn"
                type="button"
                onClick={() => { setSolving(null); fire(passSolvePatch(room)) }}
              >
                Pass ➜
              </button>
            </div>
          )}
          {solveWindowOpen && relaxed && (
            <button className="btn ghost pass-btn" type="button" onClick={endTurn}>
              End my turn ➜
            </button>
          )}
          {letterWindowOpen && !relaxed && (
            <div className="letter-countdown" role="timer" aria-live="polite">
              <span style={{ '--timer-progress': `${((room.letterUntil - now) / windows(room).letter) * 100}%` }} />
              <strong>{letterSeconds}</strong>
            </div>
          )}
          {myTurn && myPowerUnused && (
            <div className="powerup-wrap">
              <button className="btn ghost powerup-btn" type="button" onClick={() => setPowerOpen((o) => !o)}>
                🎁 Power-up
              </button>
              {powerOpen && (
                <div className="powerup-pop">
                  {POWERUPS.filter((p) => !(relaxed && p.id === 'time')).map((p) => (
                    <button key={p.id} className="menu-item" type="button" onClick={() => usePowerup(p.id)}>
                      {p.emoji} <strong>{p.name}</strong> — {p.desc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Keyboard guessed={guessedBy(room, myRole)} disabled={!letterWindowOpen} onKey={callLetter} />
        </>
      )}
      {view === 'defend' && !hotseat && room.status === 'playing' && (
        <p className="kb-hint">Letters your rival has uncovered. Solved words show gold.</p>
      )}

      {room.status === 'playing' && !hotseat && !bot && (
        <div className="taunt-bar" aria-label="Send a reaction">
          {TAUNTS.map((e) => (
            <button key={e} className="taunt-btn" type="button" onClick={() => sendTaunt(e)}>{e}</button>
          ))}
        </div>
      )}

      {rivalOffline && (
        <p className="offline-banner">📡 {them.name} seems to be offline — hang tight…</p>
      )}
      {reconnected && (
        <p className="offline-banner back">✅ {them.name} reconnected!</p>
      )}

      <div className="row game-footer">
        {myTurn && !relaxed && (
          <button className="btn ghost leave" onClick={pauseGame}>⏸ Pause</button>
        )}
        <button className="btn ghost leave" onClick={onLeave}>Leave</button>
      </div>

      {isPaused && (
        <div className="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <div className="pause-card">
            <span className="pause-emoji">⏸</span>
            <h2 id="pause-title">Game paused</h2>
            <p className="hint">
              {room.paused.by === myRole
                ? 'You paused the game. It resumes automatically at 0:00.'
                : `${room.players[room.paused.by].name} paused the game. It resumes when they're ready or at 0:00.`}
            </p>
            <PauseCountdown until={room.paused.until} now={now} />
            {room.paused.by === myRole && (
              <button className="btn primary big" onClick={resumeGame}>▶ Resume</button>
            )}
          </div>
        </div>
      )}

      {tauntShow && (
        <div key={tauntShow.ts} className="taunt-fly" aria-hidden>
          <span>{tauntShow.emoji}</span>
        </div>
      )}

      {toast && (
        <div className="ach-toast" role="status">
          <span className="ach-emoji">{toast.emoji}</span>
          <span><strong>Achievement unlocked!</strong><br />{toast.name} — {toast.desc}</span>
        </div>
      )}

      {solving !== null && (
        <SolveModal
          word={targetWords(room, myRole)[solving]}
          index={solving}
          guessed={guessedBy(room, myRole)}
          onSubmit={submitSolve}
          onClose={() => setSolving(null)}
        />
      )}

      {fireworksAt && <Fireworks key={fireworksAt} />}

      {(room.status === 'finished' || opponentLeft) && (
        <EndOverlay
          room={room}
          role={myRole}
          hotseat={hotseat}
          onLeave={onLeave}
          onRematch={() => fire(hotseat ? rematchResetPatch(room) : { [`rematch/${myRole}`]: true })}
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

function PauseCountdown({ until, now }) {
  const left = Math.max(0, until - now)
  const m = Math.floor(left / 60_000)
  const s = Math.floor((left % 60_000) / 1000)
  return (
    <div className="pause-timer" role="timer" aria-live="polite">
      {m}:{String(s).padStart(2, '0')}
    </div>
  )
}

function PlayerBadge({ player, label, active, score, total = 5, right, reaction }) {
  return (
    <div className={`player-badge ${active ? 'active' : ''} ${right ? 'right' : ''}`}>
      <span key={reaction?.ts || 'still'} className={`badge-avatar ${reaction ? `react-${reaction.kind}` : ''}`}>{player.avatar}</span>
      <span className="badge-text">
        <span className="badge-name">{player.name}</span>
        <span className="badge-score">{score}/{total} solved</span>
      </span>
    </div>
  )
}

function MoveBanner({ room, role, streaks }) {
  const m = room.lastMove
  if (!m || room.status !== 'playing') return <div className="move-banner empty" />
  const actor = m.by === role ? 'You' : room.players[m.by].name
  const streak = streaks?.[m.by] || 0
  let text
  if (m.type === 'letter') {
    if (m.correct) {
      const flair = streak >= 5 ? ' 🌋 UNSTOPPABLE!' : streak >= 3 ? ' 🔥 On fire!' : ''
      text = `${actor} called "${m.letter.toUpperCase()}" — ${m.hits} hit${m.hits > 1 ? 's' : ''}!${flair}`
    } else {
      text = `${actor} called "${m.letter.toUpperCase()}" — miss 💨`
    }
  } else {
    if (m.type === 'pass') {
      text = `${actor} passed on solving 👋`
    } else if (m.type === 'powerup') {
      text = m.powerup === 'reveal'
        ? `${actor} used 🔍 X-Ray — "${m.letter?.toUpperCase()}" revealed!`
        : m.powerup === 'time'
          ? `${actor} used ⏳ Extra Time!`
          : `${actor} used ⚡ Double Strike — two letters this turn!`
    } else if (m.type === 'timeout') {
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
            <p className="end-title">{pickTitle(WIN_TITLES, room)}</p>
            <p className="hint">All {wordCountOf(room)} of {room.players[loserRole].name}'s words — cracked.</p>
            <FinalWords label={`${room.players[loserRole].name}'s words were:`} words={room.players[loserRole].words} />
          </>
        ) : (
          <>
            <span className="end-emoji">{won ? '🏆' : '💥'}</span>
            <h2>{won ? 'Victory!' : 'Defeated'}</h2>
            <p className="end-title">{won ? pickTitle(WIN_TITLES, room) : pickTitle(LOSE_TITLES, room)}</p>
            <p className="hint">
              {won ? `You cracked all ${wordCountOf(room)} words.` : `${room.players[rival].name} cracked your board first.`}
            </p>
            <FinalWords label={`${room.players[rival].name}'s words were:`} words={room.players[rival].words} />
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

// The losing side's words flip in one at a time, wheel-of-fortune style.
// Tap a word to look up what it means.
function FinalWords({ label, words }) {
  const [defWord, setDefWord] = useState(null)
  return (
    <div className="final-words">
      <span className="final-label">{label} <em className="def-hint">(tap a word for its meaning)</em></span>
      <div className="final-list">
        {(words || []).map((w, wi) => (
          <button key={w} type="button" className="final-word" onClick={() => setDefWord(w)}>
            {[...w].map((ch, li) => (
              <span key={li} className="tile revealed fresh gold" style={{ '--d': `${wi * 0.5 + li * 0.09}s` }}>{ch}</span>
            ))}
          </button>
        ))}
      </div>
      {defWord && <DefinitionSheet word={defWord} onClose={() => setDefWord(null)} />}
    </div>
  )
}

function DefinitionSheet({ word, onClose }) {
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    let stopped = false
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (stopped) return
        const meanings = (data[0]?.meanings || []).slice(0, 2).map((m) => ({
          pos: m.partOfSpeech,
          def: m.definitions?.[0]?.definition
        })).filter((m) => m.def)
        setState({ meanings })
      })
      .catch(() => { if (!stopped) setState({ error: true }) })
    return () => { stopped = true }
  }, [word])

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { e.stopPropagation(); onClose() }}>
      <div className="modal-card def-card" onClick={(e) => e.stopPropagation()}>
        <h2>{word.toUpperCase()}</h2>
        {state.loading && <div className="spinner" />}
        {state.error && <p className="hint">Couldn't fetch the definition — maybe you're offline.</p>}
        {state.meanings?.map((m, i) => (
          <p key={i} className="def-line"><em>{m.pos}</em> — {m.def}</p>
        ))}
        {state.meanings?.length === 0 && <p className="hint">No definition found, but it's in our dictionary — promise!</p>}
        <button className="btn ghost" type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

// Short celebratory bursts when a word gets solved.
function Fireworks() {
  const bursts = useMemo(
    () =>
      Array.from({ length: 4 }, (_, b) => ({
        left: `${15 + Math.random() * 70}%`,
        top: `${12 + Math.random() * 45}%`,
        delay: `${b * 0.22}s`,
        color: ['#f5c542', '#5b8def', '#e75a7c', '#4ecdc4', '#a78bfa'][Math.floor(Math.random() * 5)],
        particles: Array.from({ length: 14 }, (_, i) => {
          const angle = (i / 14) * Math.PI * 2
          const dist = 46 + Math.random() * 42
          return {
            dx: `${Math.cos(angle) * dist}px`,
            dy: `${Math.sin(angle) * dist}px`
          }
        })
      })),
    []
  )
  return (
    <div className="fireworks" aria-hidden>
      {bursts.map((b, bi) => (
        <span key={bi} className="burst" style={{ left: b.left, top: b.top, '--burst-delay': b.delay, '--burst-color': b.color }}>
          {b.particles.map((p, pi) => (
            <i key={pi} style={{ '--dx': p.dx, '--dy': p.dy }} />
          ))}
        </span>
      ))}
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
