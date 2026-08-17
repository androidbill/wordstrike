// Pure game logic: room state shape, moves, and derived helpers.
//
// 'host' and 'guest' are SIDES. In a 1v1 game a side is one player; in 2v2
// team mode a side is two players who share a board, a score and a turn.
// Everything below that takes a `role` takes a side, so the team rules ride
// on top of the same engine — the only extra state is `seat`, which says
// which of a side's two players is up.
//
// Room document:
// {
//   code, createdAt, status: 'lobby' | 'playing' | 'finished',
//   pace: 'live' | 'async', blitz: bool, wordCount: 3 | 5 (1v1) | 4 | 6 (teams),
//   teamMode: bool, perPlayer: words each player picks,
//   players: { host: {name, avatar, words: [N]|null, ready}, guest: {...}|null },
//   members: { host: [p0, p1], guest: [p0, p1] },   // team mode only
//   seat: { host: 0|1, guest: 0|1 },                // team mode only
//   turn: 'host' | 'guest',
//   guessed: { host: {a:'hit'|'miss', ...}, guest: {...} },   // letters fired BY that role
//   solved:  { host: [bool xN], guest: [bool xN] },           // opponent words solved BY that role
//   lastMove: { by, type:'letter'|'solve'|'pass'|'timeout'|'powerup', ... },
//   powerups: { host: 'reveal'|'time'|'double'|'used'|null, guest: ... },  // null = unused
//   doubleStrike: 'host' | 'guest' | null,   // that role's next letter doesn't open solve yet
//   winner: 'host' | 'guest' | null,
//   left: { host?: true, guest?: true },
//   seen: { host: ts, guest: ts }            // heartbeat for presence
// }

// Letters only (no digits; I/L/O dropped to avoid look-alikes).
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ'
export const SOLVE_WINDOW_MS = 10_000
export const LETTER_WINDOW_MS = 20_000
export const BLITZ_LETTER_MS = 7_000
export const BLITZ_SOLVE_MS = 6_000
export const PAUSE_WINDOW_MS = 5 * 60_000
export const TEAM_SIZE = 2
export const TEAM_LABELS = { host: 'Team One', guest: 'Team Two' }
export const TEAM_BADGES = { host: '🔵', guest: '🔴' }

export function makeRoomCode() {
  let code = ''
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

export function otherRole(role) {
  return role === 'host' ? 'guest' : 'host'
}

// Board size for one side.
export function wordCountOf(room) {
  return room.wordCount || 5
}

// How many words a single human types on the word-picker screen.
export function perPlayerCount(room) {
  return room.teamMode ? room.perPlayer || 2 : wordCountOf(room)
}

export function isTeams(room) {
  return !!room.teamMode
}

// Firebase strips empty branches and can hand back a sparse object instead of
// an array, so always read seats positionally.
export function membersOf(room, team) {
  const m = room.members?.[team] || {}
  return [m[0] || null, m[1] || null]
}

export function playerAt(room, team, seat) {
  return membersOf(room, team)[seat] || null
}

// Display identity for a side: the player in 1v1, both names in team mode.
export function sideOf(room, team) {
  if (!room.teamMode) return room.players?.[team] || { name: '…', avatar: '?' }
  const m = membersOf(room, team).filter(Boolean)
  if (!m.length) return { name: TEAM_LABELS[team], avatar: TEAM_BADGES[team] }
  return { name: m.map((p) => p.name).join(' & '), avatar: m.map((p) => p.avatar).join('') }
}

// A side's secret words: in team mode both members' picks, in seat order.
export function wordsOf(room, team) {
  if (!room.teamMode) return room.players?.[team]?.words || []
  return membersOf(room, team).flatMap((p) => p?.words || [])
}

export function sideReady(room, team) {
  if (!room.teamMode) return !!room.players?.[team]?.ready
  const m = membersOf(room, team)
  return m.every((p) => p?.ready)
}

// Seats start at 1 so the first handoff rotates to 0; the side that opens the
// game is set to 0 outright. Turn order ends up host0 → guest0 → host1 → guest1.
export function activeSeat(room, team) {
  return room.teamMode ? room.seat?.[team] ?? 0 : 0
}

export function isMyTurn(room, team, seat = 0) {
  return room.turn === team && (!room.teamMode || activeSeat(room, team) === seat)
}

export function activePlayer(room) {
  return room.teamMode ? playerAt(room, room.turn, activeSeat(room, room.turn)) : room.players?.[room.turn]
}

// Name of whoever made a move — the individual, not the side.
export function moverName(room, move) {
  if (!move) return ''
  if (room.teamMode) return playerAt(room, move.by, move.seat || 0)?.name || sideOf(room, move.by).name
  return room.players?.[move.by]?.name || ''
}

// Seats a newcomer can still claim.
export function openSeats(room) {
  if (!room.teamMode) return room.players?.guest ? [] : [{ team: 'guest', seat: 0 }]
  const out = []
  for (const team of ['host', 'guest']) {
    const m = membersOf(room, team)
    for (let seat = 0; seat < TEAM_SIZE; seat++) if (!m[seat]) out.push({ team, seat })
  }
  return out
}

// Hand the turn to the other side, rotating that side's seat in team mode.
function handTo(room, team) {
  if (!room.teamMode) return { turn: team }
  return { turn: team, [`seat/${team}`]: ((room.seat?.[team] ?? 1) + 1) % TEAM_SIZE }
}

export function isAsync(room) {
  return room.pace === 'async'
}

export function windows(room) {
  if (isAsync(room)) return { letter: null, solve: null }
  if (room.blitz) return { letter: BLITZ_LETTER_MS, solve: BLITZ_SOLVE_MS }
  return { letter: LETTER_WINDOW_MS, solve: SOLVE_WINDOW_MS }
}

function letterDeadline(room) {
  const w = windows(room)
  return w.letter ? Date.now() + w.letter : null
}

function solveDeadline(room) {
  const w = windows(room)
  return w.solve ? Date.now() + w.solve : null
}

function emptySolved(n) {
  return Array.from({ length: n }, () => false)
}

export function newRoom(code, hostProfile, hostWords, opts = {}) {
  const teamMode = !!opts.teamMode
  const perPlayer = teamMode ? opts.perPlayer || 2 : opts.wordCount || 5
  const wordCount = teamMode ? perPlayer * TEAM_SIZE : perPlayer
  const room = {
    code,
    createdAt: Date.now(),
    status: 'lobby',
    pace: opts.pace || 'live',
    blitz: !!opts.blitz,
    teamMode,
    perPlayer,
    wordCount,
    players: {
      host: { ...hostProfile, words: hostWords, ready: hostWords != null },
      guest: null
    },
    turn: 'host',
    guessed: { host: {}, guest: {} },
    solved: { host: emptySolved(wordCount), guest: emptySolved(wordCount) },
    powerups: { host: null, guest: null },
    doubleStrike: null,
    lastMove: null,
    letterUntil: null,
    solveUntil: null,
    winner: null,
    left: {}
  }
  if (teamMode) {
    // The sides become teams: `players` keeps generic labels so anything
    // reading room.players still works, and `members` holds the humans.
    room.players = {
      host: { name: TEAM_LABELS.host, avatar: TEAM_BADGES.host, words: null, ready: false },
      guest: { name: TEAM_LABELS.guest, avatar: TEAM_BADGES.guest, words: null, ready: false }
    }
    room.members = { host: [{ ...hostProfile, words: null, ready: false }], guest: [] }
    room.seat = { host: 1, guest: 1 }
  }
  return room
}

export function startPlayingPatch(room) {
  const turn = Math.random() < 0.5 ? 'host' : 'guest'
  return {
    status: 'playing',
    turn,
    startedAt: Date.now(),
    ...(room.teamMode
      ? { seat: { host: turn === 'host' ? 0 : 1, guest: turn === 'guest' ? 0 : 1 } }
      : {}),
    letterUntil: letterDeadline(room),
    solveUntil: null,
    lastMove: null
  }
}

// Words a role is attacking (the opposing side's words).
export function targetWords(room, role) {
  return wordsOf(room, otherRole(role))
}

export function guessedBy(room, role) {
  return room.guessed?.[role] || {}
}

export function solvedBy(room, role) {
  // Default to N unsolved slots — Firebase strips empty/false-y branches,
  // and an empty array would read as "all solved".
  const n = wordCountOf(room)
  const s = room.solved?.[role]
  return s && s.length === n ? s : emptySolved(n)
}

// A letter is visible in a target word if the attacker guessed it or solved that word.
export function isRevealed(room, role, wordIndex, letter) {
  return !!guessedBy(room, role)[letter] || !!solvedBy(room, role)[wordIndex]
}

function isWordFullyRevealed(word, guessedLetters) {
  return [...word].every((ch) => guessedLetters[ch])
}

// Build the DB patch for guessing a letter. The caller keeps the turn for a
// solve window, regardless of whether the letter hit. Words that become
// fully revealed by this letter count as solved. If the caller has a
// double-strike active, the letter window reopens instead of the solve phase.
export function letterMovePatch(room, role, letter) {
  const words = targetWords(room, role)
  const hits = words.reduce((n, w) => n + [...w].filter((ch) => ch === letter).length, 0)
  const nextGuessed = { ...guessedBy(room, role), [letter]: hits > 0 ? 'hit' : 'miss' }
  const nextSolved = solvedBy(room, role).map(
    (s, i) => s || isWordFullyRevealed(words[i], nextGuessed)
  )
  const won = nextSolved.every(Boolean)
  const striking = room.doubleStrike === role && !won
  return {
    [`guessed/${role}`]: nextGuessed,
    [`solved/${role}`]: nextSolved,
    turn: role,
    doubleStrike: striking ? null : room.doubleStrike || null,
    letterUntil: striking ? letterDeadline(room) : null,
    solveUntil: won || striking ? null : solveDeadline(room),
    status: won ? 'finished' : 'playing',
    winner: won ? role : null,
    lastMove: { by: role, seat: activeSeat(room, role), type: 'letter', letter, correct: hits > 0, hits, striking, ts: Date.now() }
  }
}

// Build the DB patch for a solve attempt. Correct: word revealed, keep the
// turn and restart the solve window. Wrong: turn passes immediately.
export function solveMovePatch(room, role, wordIndex, attempt) {
  const words = targetWords(room, role)
  const correct = attempt.toLowerCase() === words[wordIndex]
  const nextSolved = solvedBy(room, role).map((s, i) => (i === wordIndex ? s || correct : s))
  const won = nextSolved.every(Boolean)
  // On correct solve, reveal all letters of that word in the guessed set.
  const nextGuessed = correct
    ? [...words[wordIndex]].reduce(
        (g, ch) => (g[ch] ? g : { ...g, [ch]: 'hit' }),
        guessedBy(room, role)
      )
    : undefined
  return {
    [`solved/${role}`]: nextSolved,
    ...(nextGuessed ? { [`guessed/${role}`]: nextGuessed } : {}),
    ...(correct ? { turn: role } : handTo(room, otherRole(role))),
    letterUntil: correct || won ? null : letterDeadline(room),
    solveUntil: correct && !won ? solveDeadline(room) : null,
    status: won ? 'finished' : 'playing',
    winner: won ? role : null,
    lastMove: { by: role, seat: activeSeat(room, role), type: 'solve', wordIndex, correct, ts: Date.now() }
  }
}

// Player chose to pass instead of solving — turn moves on immediately.
export function passSolvePatch(room) {
  return {
    ...handTo(room, otherRole(room.turn)),
    letterUntil: letterDeadline(room),
    solveUntil: null,
    lastMove: {
      by: room.turn,
      seat: activeSeat(room, room.turn),
      type: 'pass',
      correct: false,
      ts: Date.now()
    }
  }
}

export function solveWindowExpiredPatch(room) {
  return {
    ...handTo(room, otherRole(room.turn)),
    letterUntil: letterDeadline(room),
    solveUntil: null,
    lastMove: {
      by: room.turn,
      seat: activeSeat(room, room.turn),
      type: 'timeout',
      phase: 'solve',
      correct: false,
      ts: Date.now()
    }
  }
}

export function letterWindowExpiredPatch(room) {
  return {
    ...handTo(room, otherRole(room.turn)),
    letterUntil: letterDeadline(room),
    solveUntil: null,
    lastMove: {
      by: room.turn,
      seat: activeSeat(room, room.turn),
      type: 'timeout',
      phase: 'letter',
      correct: false,
      ts: Date.now()
    }
  }
}

// ── Power-ups (one per player per game) ─────────────────────────
export const POWERUPS = [
  { id: 'reveal', emoji: '🔍', name: 'X-Ray', desc: 'Reveal a random letter in your rival\'s words' },
  { id: 'time', emoji: '⏳', name: 'Extra Time', desc: 'Add 20 seconds to your current timer' },
  { id: 'double', emoji: '⚡', name: 'Double Strike', desc: 'Call two letters this turn' }
]

// X-Ray: reveal one random letter that appears in unsolved target words and
// hasn't been guessed. Free — turn and timers unchanged.
export function revealPowerupPatch(room, role) {
  const words = targetWords(room, role)
  const guessed = guessedBy(room, role)
  const solved = solvedBy(room, role)
  const pool = new Set()
  words.forEach((w, i) => {
    if (!solved[i]) [...w].forEach((ch) => { if (!guessed[ch]) pool.add(ch) })
  })
  const options = [...pool]
  if (!options.length) return null
  const letter = options[Math.floor(Math.random() * options.length)]
  const nextGuessed = { ...guessed, [letter]: 'hit' }
  const nextSolved = solved.map((s, i) => s || isWordFullyRevealed(words[i], nextGuessed))
  const won = nextSolved.every(Boolean)
  return {
    [`guessed/${role}`]: nextGuessed,
    [`solved/${role}`]: nextSolved,
    [`powerups/${role}`]: 'used',
    status: won ? 'finished' : 'playing',
    winner: won ? role : null,
    lastMove: { by: role, seat: activeSeat(room, role), type: 'powerup', powerup: 'reveal', letter, correct: true, ts: Date.now() }
  }
}

export function timePowerupPatch(room, role) {
  return {
    [`powerups/${role}`]: 'used',
    ...(room.solveUntil ? { solveUntil: room.solveUntil + 20_000 } : {}),
    ...(!room.solveUntil && room.letterUntil ? { letterUntil: room.letterUntil + 20_000 } : {}),
    lastMove: { by: role, seat: activeSeat(room, role), type: 'powerup', powerup: 'time', correct: true, ts: Date.now() }
  }
}

export function doublePowerupPatch(room, role) {
  return {
    [`powerups/${role}`]: 'used',
    doubleStrike: role,
    lastMove: { by: role, seat: activeSeat(room, role), type: 'powerup', powerup: 'double', correct: true, ts: Date.now() }
  }
}

// ── Pause (live pace only) ──────────────────────────────────────
// Each player has a 5-minute pause budget for the whole game; pausing
// again continues from whatever time is left, not a fresh 5:00.
export function pauseBudgetLeft(room, role) {
  return Math.max(0, PAUSE_WINDOW_MS - (room.pauseUsed?.[role] || 0))
}

export function pauseGamePatch(room, role) {
  const remaining = pauseBudgetLeft(room, role)
  if (remaining <= 0) return null
  return {
    paused: {
      by: role,
      at: Date.now(),
      until: Date.now() + remaining,
      letterUntil: room.letterUntil || null,
      solveUntil: room.solveUntil || null
    }
  }
}

export function resumeGamePatch(room) {
  const p = room.paused
  const elapsed = Date.now() - p.at
  return {
    paused: null,
    [`pauseUsed/${p.by}`]: Math.min(PAUSE_WINDOW_MS, (room.pauseUsed?.[p.by] || 0) + elapsed),
    letterUntil: p.letterUntil ? p.letterUntil + elapsed : null,
    solveUntil: p.solveUntil ? p.solveUntil + elapsed : null
  }
}

export function solvedCount(room, role) {
  return solvedBy(room, role).filter(Boolean).length
}

// Reset patch for a rematch: same players, fresh boards, back to word picking.
export function rematchResetPatch(room) {
  const teamReset = {}
  if (room.teamMode) {
    for (const team of ['host', 'guest']) {
      for (let seat = 0; seat < TEAM_SIZE; seat++) {
        teamReset[`members/${team}/${seat}/words`] = null
        teamReset[`members/${team}/${seat}/ready`] = false
      }
    }
    teamReset.seat = { host: 1, guest: 1 }
  }
  return {
    status: 'lobby',
    'players/host/words': null,
    'players/host/ready': false,
    'players/guest/words': null,
    'players/guest/ready': false,
    ...teamReset,
    guessed: null,
    solved: { host: emptySolved(wordCountOf(room)), guest: emptySolved(wordCountOf(room)) },
    powerups: { host: null, guest: null },
    doubleStrike: null,
    lastMove: null,
    letterUntil: null,
    solveUntil: null,
    startedAt: null,
    winner: null,
    rematch: null,
    taunt: null,
    paused: null,
    pauseUsed: null,
    turn: 'host'
  }
}
