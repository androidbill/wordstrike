import { useState } from 'react'
import { playHits, playMiss, playSolve } from '../sounds.js'
import { hapticHit, hapticSolve } from '../haptics.js'

const WORD = 'apple'
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

// 60-second interactive lesson: call letters on a dummy word, then solve it.
export default function Tutorial({ onDone }) {
  const [guessed, setGuessed] = useState({})
  const [solving, setSolving] = useState(false)
  const [attempt, setAttempt] = useState('')
  const [won, setWon] = useState(false)

  const hits = Object.entries(guessed).filter(([, v]) => v === 'hit').length
  const step = won ? 3 : solving ? 2 : hits >= 2 ? 1 : 0

  const callLetter = (k) => {
    if (guessed[k] || won || solving) return
    const isHit = WORD.includes(k)
    setGuessed({ ...guessed, [k]: isHit ? 'hit' : 'miss' })
    if (isHit) { playHits([...WORD].filter((ch) => ch === k).length); hapticHit() }
    else playMiss()
  }

  const submit = (e) => {
    e.preventDefault()
    if (attempt.toLowerCase() === WORD) {
      setWon(true)
      playSolve()
      hapticSolve()
      localStorage.setItem('ws-tutorial-done', '1')
    } else {
      setAttempt('')
    }
  }

  return (
    <div className="screen tutorial">
      <h2>🎓 How to play</h2>
      <p className="tut-step">
        {step === 0 && 'This is one of your rival\'s secret words. Tap letters — hits light up, misses turn red. Try "P" or "E"!'}
        {step === 1 && 'Nice! Letters reveal everywhere they appear. Think you know the word? Hit Solve!'}
        {step === 2 && 'Type the full word. In a real game a correct solve keeps your turn going.'}
        {step === 3 && '🎉 That\'s the whole game! Crack all your rival\'s words before they crack yours.'}
      </p>

      <div className="board">
        <div className="word-row">
          {[...WORD].map((ch, i) => (
            <span key={i} className={`tile ${guessed[ch] || won ? 'revealed' : ''} ${won ? 'gold' : ''}`}>
              {guessed[ch] || won ? ch : ''}
            </span>
          ))}
        </div>
      </div>

      {!won && !solving && (
        <>
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
          {step >= 1 && (
            <button className="btn primary" onClick={() => setSolving(true)}>I know it — Solve!</button>
          )}
        </>
      )}

      {solving && !won && (
        <form className="row daily-solve" onSubmit={submit}>
          <input
            className="code-input daily-input"
            value={attempt}
            onChange={(e) => setAttempt(e.target.value.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5))}
            placeholder="?????"
            autoFocus
            aria-label="Your solve attempt"
          />
          <button className="btn primary" disabled={attempt.length !== 5}>Solve!</button>
        </form>
      )}

      {won && <button className="btn primary big" onClick={onDone}>Let's play! 🚀</button>}
      {!won && <button className="btn ghost" onClick={onDone}>Skip</button>}
    </div>
  )
}
