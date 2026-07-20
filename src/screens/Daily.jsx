import { useEffect, useMemo, useState } from 'react'
import { COMMON } from '../words.js'
import { playHits, playMiss, playSolve, playWrongSolve, playWin } from '../sounds.js'
import { APP_URL } from './Home.jsx'

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const RESULT_KEY = 'ws-daily'

function todayStamp() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Same word for everyone on a given local date.
function dailyWord() {
  const days = Math.floor(Date.now() / 86_400_000)
  const seed = (days * 2654435761) % 4294967296
  return COMMON[seed % COMMON.length]
}

function loadResult() {
  try {
    const r = JSON.parse(localStorage.getItem(RESULT_KEY))
    return r?.date === todayStamp() ? r : null
  } catch {
    return null
  }
}

export default function Daily({ onBack }) {
  const word = useMemo(dailyWord, [])
  const [guessed, setGuessed] = useState({}) // letter -> 'hit' | 'miss'
  const [solving, setSolving] = useState(false)
  const [attempt, setAttempt] = useState('')
  const [wrongSolves, setWrongSolves] = useState(0)
  const [result, setResult] = useState(loadResult)
  const [shake, setShake] = useState(false)

  const lettersUsed = Object.keys(guessed).length
  const revealedAll = [...word].every((ch) => guessed[ch])

  const finish = (letters, wrong) => {
    const r = { date: todayStamp(), letters, wrong }
    localStorage.setItem(RESULT_KEY, JSON.stringify(r))
    setResult(r)
    playWin()
  }

  // Fully revealing the word by letters counts as solving it.
  useEffect(() => {
    if (!result && revealedAll && lettersUsed > 0) finish(lettersUsed, wrongSolves)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedAll])

  const callLetter = (k) => {
    if (result || guessed[k]) return
    const hits = [...word].filter((ch) => ch === k).length
    setGuessed({ ...guessed, [k]: hits > 0 ? 'hit' : 'miss' })
    if (hits > 0) playHits(hits)
    else playMiss()
  }

  const submitSolve = (e) => {
    e.preventDefault()
    if (attempt.length !== 5) return
    if (attempt.toLowerCase() === word) {
      finish(lettersUsed, wrongSolves)
    } else {
      setWrongSolves((w) => w + 1)
      playWrongSolve()
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
    setSolving(false)
    setAttempt('')
  }

  const share = async () => {
    const text = `WordStrike Daily ${todayStamp()}: cracked "${word.toUpperCase()}" with ${result.letters} letters${result.wrong ? ` (${result.wrong} wrong solve${result.wrong > 1 ? 's' : ''})` : ''}! 🎯 ${APP_URL}`
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        window.alert('Result copied to your clipboard.')
      }
    } catch { /* user cancelled the share sheet */ }
  }

  return (
    <div className={`screen daily ${shake ? 'shake' : ''}`}>
      <h2>📅 Daily Word</h2>
      <p className="hint">
        {result
          ? `Solved with ${result.letters} letter${result.letters === 1 ? '' : 's'}${result.wrong ? ` and ${result.wrong} wrong solve${result.wrong > 1 ? 's' : ''}` : ''}. Come back tomorrow!`
          : 'One word a day, same for everyone. Crack it with the fewest letters.'}
      </p>

      <div className="board daily-board">
        <div className="word-row solved-look">
          {[...word].map((ch, i) => (
            <span key={i} className={`tile ${result || guessed[ch] ? 'revealed' : ''} ${result ? 'gold' : ''}`}>
              {result || guessed[ch] ? ch : ''}
            </span>
          ))}
        </div>
      </div>

      {!result && (
        <>
          <p className="kb-hint">{lettersUsed} letter{lettersUsed === 1 ? '' : 's'} used{wrongSolves ? ` · ${wrongSolves} wrong solve${wrongSolves > 1 ? 's' : ''}` : ''}</p>
          <div className="keyboard">
            {KEY_ROWS.map((row) => (
              <div key={row} className="key-row">
                {[...row].map((k) => (
                  <button key={k} className={`key ${guessed[k] || ''}`} disabled={!!guessed[k]} onClick={() => callLetter(k)}>
                    {k}
                  </button>
                ))}
              </div>
            ))}
          </div>
          {!solving ? (
            <button className="btn primary" onClick={() => setSolving(true)}>I know it — solve!</button>
          ) : (
            <form className="row daily-solve" onSubmit={submitSolve}>
              <input
                className="code-input daily-input"
                value={attempt}
                onChange={(e) => setAttempt(e.target.value.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5))}
                placeholder="?????"
                autoFocus
                aria-label="Your solve attempt"
              />
              <button className="btn primary" disabled={attempt.length !== 5}>Go</button>
              <button type="button" className="btn ghost" onClick={() => { setSolving(false); setAttempt('') }}>✕</button>
            </form>
          )}
        </>
      )}

      {result && <button className="btn primary" onClick={share}>↗ Share result</button>}
      <button className="btn ghost" onClick={onBack}>Back</button>
    </div>
  )
}
