// Pure game logic: room state shape, moves, and derived helpers.
// Room document:
// {
//   code, createdAt, status: 'lobby' | 'playing' | 'finished',
//   players: { host: {name, avatar, words: [5]|null, ready}, guest: {...}|null },
//   turn: 'host' | 'guest',
//   guessed: { host: {a:'hit'|'miss', ...}, guest: {...} },   // letters fired BY that role
//   solved:  { host: [bool x5], guest: [bool x5] },           // opponent words solved BY that role
//   lastMove: { by, type:'letter'|'solve', letter?, wordIndex?, correct, hits?, ts },
//   winner: 'host' | 'guest' | null,
//   left: { host?: true, guest?: true }
// }

// Letters only (no digits; I/L/O dropped to avoid look-alikes).
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ'
export const SOLVE_WINDOW_MS = 10_000
export const LETTER_WINDOW_MS = 20_000

export function makeRoomCode() {
  let code = ''
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

export function otherRole(role) {
  return role === 'host' ? 'guest' : 'host'
}

export function newRoom(code, hostProfile, hostWords) {
  return {
    code,
    createdAt: Date.now(),
    status: 'lobby',
    players: {
      host: { ...hostProfile, words: hostWords, ready: hostWords != null },
      guest: null
    },
    turn: 'host',
    guessed: { host: {}, guest: {} },
    solved: { host: [false, false, false, false, false], guest: [false, false, false, false, false] },
    lastMove: null,
    letterUntil: null,
    solveUntil: null,
    winner: null,
    left: {}
  }
}

export function startPlayingPatch() {
  const turn = Math.random() < 0.5 ? 'host' : 'guest'
  return {
    status: 'playing',
    turn,
    startedAt: Date.now(),
    letterUntil: Date.now() + LETTER_WINDOW_MS,
    solveUntil: null,
    lastMove: null
  }
}

// Words a role is attacking (the opponent's words).
export function targetWords(room, role) {
  return room.players[otherRole(role)]?.words || []
}

export function guessedBy(room, role) {
  return room.guessed?.[role] || {}
}

export function solvedBy(room, role) {
  // Default to five unsolved slots — Firebase strips empty/false-y branches,
  // and an empty array would read as "all solved".
  const s = room.solved?.[role]
  return s && s.length === 5 ? s : [false, false, false, false, false]
}

// A letter is visible in a target word if the attacker guessed it or solved that word.
export function isRevealed(room, role, wordIndex, letter) {
  return !!guessedBy(room, role)[letter] || !!solvedBy(room, role)[wordIndex]
}

function isWordFullyRevealed(word, guessedLetters) {
  return [...word].every((ch) => guessedLetters[ch])
}

// Build the DB patch for guessing a letter. The caller keeps the turn for a
// short solve window, regardless of whether the letter hit.
// Words that become fully revealed by this letter count as solved.
export function letterMovePatch(room, role, letter) {
  const words = targetWords(room, role)
  const hits = words.reduce((n, w) => n + [...w].filter((ch) => ch === letter).length, 0)
  const nextGuessed = { ...guessedBy(room, role), [letter]: hits > 0 ? 'hit' : 'miss' }
  const nextSolved = solvedBy(room, role).map(
    (s, i) => s || isWordFullyRevealed(words[i], nextGuessed)
  )
  const won = nextSolved.every(Boolean)
  return {
    [`guessed/${role}`]: nextGuessed,
    [`solved/${role}`]: nextSolved,
    turn: role,
    letterUntil: null,
    solveUntil: won ? null : Date.now() + SOLVE_WINDOW_MS,
    status: won ? 'finished' : 'playing',
    winner: won ? role : null,
    lastMove: { by: role, type: 'letter', letter, correct: hits > 0, hits, ts: Date.now() }
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
    turn: correct ? role : otherRole(role),
    letterUntil: correct || won ? null : Date.now() + LETTER_WINDOW_MS,
    solveUntil: correct && !won ? Date.now() + SOLVE_WINDOW_MS : null,
    status: won ? 'finished' : 'playing',
    winner: won ? role : null,
    lastMove: { by: role, type: 'solve', wordIndex, correct, ts: Date.now() }
  }
}

// Player chose to pass instead of solving — turn moves on immediately.
export function passSolvePatch(room) {
  return {
    turn: otherRole(room.turn),
    letterUntil: Date.now() + LETTER_WINDOW_MS,
    solveUntil: null,
    lastMove: {
      by: room.turn,
      type: 'pass',
      correct: false,
      ts: Date.now()
    }
  }
}

export function solveWindowExpiredPatch(room) {
  return {
    turn: otherRole(room.turn),
    letterUntil: Date.now() + LETTER_WINDOW_MS,
    solveUntil: null,
    lastMove: {
      by: room.turn,
      type: 'timeout',
      phase: 'solve',
      correct: false,
      ts: Date.now()
    }
  }
}

export function letterWindowExpiredPatch(room) {
  return {
    turn: otherRole(room.turn),
    letterUntil: Date.now() + LETTER_WINDOW_MS,
    solveUntil: null,
    lastMove: {
      by: room.turn,
      type: 'timeout',
      phase: 'letter',
      correct: false,
      ts: Date.now()
    }
  }
}

export function solvedCount(room, role) {
  return solvedBy(room, role).filter(Boolean).length
}

// Reset patch for a rematch: same players, fresh boards, back to word picking.
export function rematchResetPatch() {
  return {
    status: 'lobby',
    'players/host/words': null,
    'players/host/ready': false,
    'players/guest/words': null,
    'players/guest/ready': false,
    guessed: null,
    solved: null,
    lastMove: null,
    letterUntil: null,
    solveUntil: null,
    startedAt: null,
    winner: null,
    rematch: null,
    taunt: null,
    turn: 'host'
  }
}
