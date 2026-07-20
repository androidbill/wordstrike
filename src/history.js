// Local game history, newest first, capped. Stored per device.
const KEY = 'ws-history'
const MAX_GAMES = 50

export function loadHistory() {
  try {
    const h = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(h) ? h : []
  } catch {
    return []
  }
}

export function addGame(entry) {
  const h = [entry, ...loadHistory()].slice(0, MAX_GAMES)
  localStorage.setItem(KEY, JSON.stringify(h))
  return h
}

export function clearHistory() {
  localStorage.removeItem(KEY)
}

// Aggregates for the header of the history screen.
export function historyStats(history) {
  const wins = {}
  let fastest = null
  history.forEach((g) => {
    if (g.winnerName) wins[g.winnerName] = (wins[g.winnerName] || 0) + 1
    if (g.fastestSolve && (!fastest || g.fastestSolve.ms < fastest.ms)) {
      fastest = g.fastestSolve
    }
  })
  const topWinner = Object.entries(wins).sort((a, b) => b[1] - a[1])[0] || null
  return {
    games: history.length,
    topWinner: topWinner ? { name: topWinner[0], wins: topWinner[1] } : null,
    fastestSolve: fastest
  }
}

// Solve speed: sub-minute shows tenths, longer falls back to m/s.
export function formatSolveTime(ms) {
  if (ms == null) return '—'
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : formatDuration(ms)
}

export function formatDuration(ms) {
  if (ms == null) return '—'
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}
