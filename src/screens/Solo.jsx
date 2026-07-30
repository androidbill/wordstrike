import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { randomCommonWord } from '../words.js'
import { isValidWord } from '../words.js'

const SOLO_STREAK_KEY = 'ws-solo-streak'
const MAX_GUESSES = { 5: 6, 6: 8 }
const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

function loadStreak() {
  try { return JSON.parse(localStorage.getItem(SOLO_STREAK_KEY)) || { current: 0, best: 0 } }
  catch { return { current: 0, best: 0 } }
}

function saveStreak(s) {
  localStorage.setItem(SOLO_STREAK_KEY, JSON.stringify(s))
}

// Score a guess against the secret word. Returns array of 'hit'|'present'|'miss' per letter.
function scoreGuess(guess, secret) {
  const result = Array(secret.length).fill('miss')
  const remaining = [...secret]

  // First pass: hits
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) {
      result[i] = 'hit'
      remaining[i] = null
    }
  }
  // Second pass: present
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'hit') continue
    const idx = remaining.indexOf(guess[i])
    if (idx !== -1) {
      result[i] = 'present'
      remaining[idx] = null
    }
  }
  return result
}

function initState(wordLen) {
  return {
    secret: randomCommonWord([], wordLen),
    wordLen,
    maxGuesses: MAX_GUESSES[wordLen],
    guesses: [],       // [{ letters: [...], score: [...] }]
    current: '',       // letters typed so far this guess
    status: 'playing', // 'playing' | 'won' | 'lost'
    shake: false,
    invalid: false,
  }
}

function reducer(state, action) {
  if (state.status !== 'playing' && action.type !== 'reset') return state

  switch (action.type) {
    case 'key': {
      if (state.current.length >= state.wordLen) return state
      return { ...state, current: state.current + action.letter, invalid: false }
    }
    case 'delete': {
      return { ...state, current: state.current.slice(0, -1), invalid: false }
    }
    case 'submit': {
      if (state.current.length !== state.wordLen) return { ...state, shake: true }
      if (action.invalid) return { ...state, shake: true, invalid: true }
      const score = scoreGuess(state.current, state.secret)
      const guesses = [...state.guesses, { letters: [...state.current], score }]
      const won = score.every((s) => s === 'hit')
      const lost = !won && guesses.length >= state.maxGuesses
      return {
        ...state,
        guesses,
        current: '',
        status: won ? 'won' : lost ? 'lost' : 'playing',
        shake: false,
        invalid: false,
      }
    }
    case 'shake-done': return { ...state, shake: false }
    case 'reset': return initState(action.wordLen || state.wordLen)
    default: return state
  }
}

export default function Solo({ onBack }) {
  const [wordLen, setWordLen] = useState(5)
  const [started, setStarted] = useState(false)
  const [streak, setStreak] = useState(loadStreak)

  if (!started) {
    return (
      <div className="screen solo-pick">
        <button className="btn ghost solo-back" type="button" onClick={onBack}>← Back</button>
        <div className="solo-pick-inner">
          <h2>Solo Strike</h2>
          <p className="hint">Guess the hidden word, one letter at a time.</p>
          <div className="solo-streak-row">
            <span className="solo-stat"><span className="solo-stat-val">{streak.current}</span> streak</span>
            <span className="solo-stat"><span className="solo-stat-val">{streak.best}</span> best</span>
          </div>
          <div className="solo-len-btns">
            <button
              className={`btn ${wordLen === 5 ? 'primary' : 'ghost'} big`}
              onClick={() => setWordLen(5)}
            >
              5-letter words
              <span className="btn-sub">6 guesses</span>
            </button>
            <button
              className={`btn ${wordLen === 6 ? 'primary' : 'ghost'} big`}
              onClick={() => setWordLen(6)}
            >
              6-letter words
              <span className="btn-sub">8 guesses</span>
            </button>
          </div>
          <button className="btn primary big" onClick={() => setStarted(true)}>Play</button>
        </div>
      </div>
    )
  }

  return (
    <SoloGame
      wordLen={wordLen}
      streak={streak}
      onStreak={(s) => { saveStreak(s); setStreak(s) }}
      onBack={onBack}
      onChangLen={(len) => { setWordLen(len); setStarted(false) }}
    />
  )
}

function SoloGame({ wordLen, streak, onStreak, onBack, onChangLen }) {
  const [state, dispatch] = useReducer(reducer, wordLen, initState)
  const submittingRef = useRef(false)

  // When game ends, update streak
  useEffect(() => {
    if (state.status === 'won') {
      const next = { current: streak.current + 1, best: Math.max(streak.best, streak.current + 1) }
      onStreak(next)
    } else if (state.status === 'lost') {
      onStreak({ ...streak, current: 0 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status])

  // Clear shake after animation
  useEffect(() => {
    if (!state.shake) return
    const t = setTimeout(() => dispatch({ type: 'shake-done' }), 500)
    return () => clearTimeout(t)
  }, [state.shake])

  const submit = useCallback(async () => {
    if (submittingRef.current) return
    if (state.current.length !== state.wordLen) {
      dispatch({ type: 'submit', invalid: false })
      return
    }
    submittingRef.current = true
    const valid = await isValidWord(state.current)
    submittingRef.current = false
    dispatch({ type: 'submit', invalid: !valid })
  }, [state.current, state.wordLen])

  const pressKey = useCallback((k) => {
    if (k === 'enter') { submit(); return }
    if (k === 'backspace') { dispatch({ type: 'delete' }); return }
    dispatch({ type: 'key', letter: k })
  }, [submit])

  // Hardware keyboard
  useEffect(() => {
    const handler = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'enter') { e.preventDefault(); submit() }
      else if (k === 'backspace') dispatch({ type: 'delete' })
      else if (/^[a-z]$/.test(k)) dispatch({ type: 'key', letter: k })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [submit])

  // Build per-key status from all completed guesses
  const keyStatus = {}
  for (const g of state.guesses) {
    g.letters.forEach((ch, i) => {
      const s = g.score[i]
      const prev = keyStatus[ch]
      if (s === 'hit' || (!prev && s === 'present') || (!prev && s === 'miss')) {
        keyStatus[ch] = s
      }
      if (prev === 'present' && s === 'hit') keyStatus[ch] = 'hit'
    })
  }

  const rows = []
  for (let r = 0; r < state.maxGuesses; r++) {
    const guess = state.guesses[r]
    const isCurrent = r === state.guesses.length && state.status === 'playing'
    const letters = guess ? guess.letters : isCurrent ? [...state.current] : []
    rows.push({ letters, score: guess?.score || null, isCurrent })
  }

  return (
    <div className="screen solo-game">
      <div className="solo-header">
        <button className="btn ghost solo-back-sm" type="button" onClick={onBack}>←</button>
        <span className="solo-title">Solo Strike</span>
        <span className="solo-streak-chip">🔥 {streak.current}</span>
      </div>

      <div className={`solo-grid solo-grid-${wordLen}`}>
        {rows.map((row, ri) => (
          <div
            key={ri}
            className={[
              'solo-row',
              row.isCurrent && state.shake ? 'solo-shake' : '',
            ].join(' ').trim()}
          >
            {Array.from({ length: wordLen }, (_, ci) => {
              const ch = row.letters[ci] || ''
              const st = row.score ? row.score[ci] : ''
              return (
                <div
                  key={ci}
                  className={['solo-cell', st, ch && !row.score ? 'solo-filled' : ''].join(' ').trim()}
                  style={row.score ? { animationDelay: `${ci * 0.08}s` } : {}}
                >
                  {ch.toUpperCase()}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {state.invalid && <p className="solo-invalid">Not in word list</p>}

      {state.status !== 'playing' && (
        <div className="solo-result">
          {state.status === 'won'
            ? <><span className="solo-result-emoji">🎉</span><span className="solo-result-text">Nice solve!</span></>
            : <><span className="solo-result-emoji">💀</span><span className="solo-result-text">The word was <strong>{state.secret.toUpperCase()}</strong></span></>
          }
        </div>
      )}

      {state.status !== 'playing' ? (
        <div className="solo-end-btns">
          <button className="btn primary big" onClick={() => dispatch({ type: 'reset', wordLen })}>Next Word</button>
          <button className="btn ghost" onClick={() => onChangLen(wordLen === 5 ? 6 : 5)}>
            Switch to {wordLen === 5 ? '6' : '5'}-letter words
          </button>
          <button className="btn ghost" onClick={onBack}>Home</button>
        </div>
      ) : (
        <Keyboard keyStatus={keyStatus} onKey={pressKey} />
      )}
    </div>
  )
}

function Keyboard({ keyStatus, onKey }) {
  return (
    <div className="solo-kb">
      {KEYBOARD_ROWS.map((row, ri) => (
        <div key={ri} className="solo-kb-row">
          {ri === 2 && (
            <button className="solo-key solo-key-wide" onClick={() => onKey('enter')}>Enter</button>
          )}
          {[...row].map((ch) => (
            <button
              key={ch}
              className={['solo-key', keyStatus[ch] || ''].join(' ').trim()}
              onClick={() => onKey(ch)}
            >
              {ch.toUpperCase()}
            </button>
          ))}
          {ri === 2 && (
            <button className="solo-key solo-key-wide" onClick={() => onKey('backspace')}>⌫</button>
          )}
        </div>
      ))}
    </div>
  )
}
