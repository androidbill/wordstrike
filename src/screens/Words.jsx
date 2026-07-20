import { useEffect, useRef, useState } from 'react'
import { isValidWord, searchWords, randomCommonWord } from '../words.js'

export default function Words({ title, onDone, onBack }) {
  const [words, setWords] = useState(['', '', '', '', ''])
  const [valid, setValid] = useState([null, null, null, null, null]) // null=unknown
  const [browsing, setBrowsing] = useState(null) // slot index or null
  const [busy, setBusy] = useState(false)

  const setWord = (i, raw) => {
    const w = raw.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5)
    setWords((prev) => prev.map((p, j) => (j === i ? w : p)))
    if (w.length < 5) {
      setValid((prev) => prev.map((p, j) => (j === i ? null : p)))
    } else {
      isValidWord(w).then((ok) =>
        setValid((prev) => prev.map((p, j) => (j === i ? ok : p)))
      )
    }
  }

  const roll = (i) => setWord(i, randomCommonWord(words))
  const rollAll = () => {
    const picked = []
    for (let i = 0; i < 5; i++) picked.push(randomCommonWord(picked))
    setWords(picked)
    setValid([true, true, true, true, true])
  }

  const unique = new Set(words).size === 5
  const ready = valid.every((v) => v === true) && unique

  const submit = async () => {
    if (!ready || busy) return
    setBusy(true)
    await onDone(words)
    setBusy(false)
  }

  return (
    <div className="screen words">
      <h2>{title}</h2>
      <p className="hint">Your rival has to crack these. Type a word, roll the dice, or browse the dictionary.</p>

      <div className="word-slots">
        {words.map((w, i) => (
          <div key={i} className={`word-slot ${valid[i] === false ? 'invalid' : ''} ${valid[i] ? 'valid' : ''}`}>
            <span className="slot-num">{i + 1}</span>
            <input
              value={w}
              onChange={(e) => setWord(i, e.target.value)}
              placeholder="·····"
              maxLength={5}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={`Word ${i + 1}`}
            />
            <button className="icon-btn" title="Random word" onClick={() => roll(i)}>🎲</button>
            <button className="icon-btn" title="Browse words" onClick={() => setBrowsing(i)}>🔍</button>
          </div>
        ))}
      </div>

      {!unique && words.every((w) => w.length === 5) && <p className="error">Words must all be different</p>}
      {valid.some((v) => v === false) && <p className="error">Red words aren't in the dictionary</p>}

      <div className="row">
        <button className="btn ghost" onClick={onBack}>Back</button>
        <button className="btn ghost" onClick={rollAll}>🎲 Random all</button>
        <button className="btn primary" disabled={!ready || busy} onClick={submit}>
          {busy ? '…' : 'Lock in'}
        </button>
      </div>

      {browsing !== null && (
        <BrowseSheet
          onPick={(w) => {
            setWord(browsing, w)
            setBrowsing(null)
          }}
          onClose={() => setBrowsing(null)}
        />
      )}
    </div>
  )
}

function BrowseSheet({ onPick, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    searchWords(query || 'a').then((r) => {
      if (seq.current === id) setResults(r)
    })
  }, [query])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value.toLowerCase().replace(/[^a-z]/g, ''))}
          placeholder="Search 12,578 words…"
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="word-grid">
          {results.map((w) => (
            <button key={w} className="word-chip" onClick={() => onPick(w)}>{w}</button>
          ))}
        </div>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
