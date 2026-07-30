// Pure game logic: room state shape, moves, and derived helpers.
// Room document:
// {
//   code, createdAt, status: 'lobby' | 'playing' | 'finished',
//   pace: 'live' | 'async', blitz: bool, wordCount: 3 | 5,
//   players: { host: {name, avatar, words: [N]|null, ready}, guest: {...}|null },
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

// Four-letter common words used as room codes — easy to say aloud.
const ROOM_CODE_WORDS = [
  'ABLE','ARCH','ARMY','BACK','BAKE','BALL','BAND','BARK','BASE','BATH',
  'BEAM','BEAR','BEAT','BELL','BELT','BEND','BIKE','BIRD','BITE','BLUE',
  'BOAT','BOLD','BOLT','BOND','BONE','BOOK','BOOT','BOWL','BURN','BUZZ',
  'CAGE','CAKE','CALM','CAMP','CANE','CARD','CARE','CART','CAVE','CHEF',
  'CHIP','CLAY','CLUB','CLUE','COAL','COAT','CODE','COIN','COLD','COOK',
  'COOL','CORE','CORN','COST','COVE','CROP','CURL','DARK','DART','DASH',
  'DAWN','DEAL','DECK','DEEP','DENT','DESK','DISH','DIVE','DOCK','DOME',
  'DOOR','DOVE','DRAW','DRUM','DUCK','DUNE','DUSK','DUST','DUTY','EARN',
  'EAST','EDGE','EPIC','FACT','FAIR','FALL','FAME','FARM','FAST','FATE',
  'FILE','FILM','FIRE','FISH','FLAG','FLAT','FLIP','FLOW','FOAM','FOLD',
  'FOLK','FOND','FOOD','FORD','FORK','FORT','FREE','FROG','FUEL','FULL',
  'FUND','FUSE','GALE','GAME','GATE','GEAR','GLOW','GLUE','GOAL','GOAT',
  'GOLD','GOLF','GOOD','GORE','GRAB','GRID','GRIN','GRIP','GROW','GULF',
  'GUST','HAIL','HAIR','HALF','HALL','HAND','HANG','HARD','HARP','HAZE',
  'HEAL','HEAP','HEAT','HELM','HELP','HERB','HIGH','HILL','HINT','HIVE',
  'HOLD','HOLE','HOME','HOOK','HOPE','HORN','HOST','HUGE','HULL','HUNT',
  'IDLE','IRON','JADE','JAIL','JOKE','JUMP','JURY','JUST','KEEN','KEEP',
  'KICK','KIND','KING','KNOT','KNOW','LACE','LAKE','LAMB','LAMP','LAND',
  'LANE','LARK','LAST','LATE','LAVA','LAWN','LEAD','LEAF','LEAN','LEAP',
  'LEFT','LEND','LENS','LIFT','LIKE','LILY','LIME','LINK','LION','LIST',
  'LIVE','LOCK','LOFT','LONG','LOOK','LOOP','LORE','LOVE','LUCK','LURE',
  'LUSH','MADE','MAIL','MAKE','MANE','MARE','MARK','MASK','MASS','MAZE',
  'MEAL','MEAT','MELT','MESH','MILD','MILE','MILK','MILL','MIND','MINE',
  'MINT','MIST','MODE','MOON','MORE','MOSS','MOTH','MOVE','MULE','MYTH',
  'NAIL','NAME','NEAR','NECK','NEST','NEXT','NICE','NODE','NORM','NOTE',
  'OATH','ONCE','OPEN','OVAL','PACE','PACK','PAGE','PAIL','PAIR','PALE',
  'PALM','PARK','PART','PATH','PEAK','PEEL','PICK','PILE','PINE','PIPE',
  'PLUM','POEM','POLE','POOL','PORT','POSE','POST','POUR','PREY','PUMP',
  'PURE','PUSH','RACK','RAIN','RANK','RARE','RATE','READ','REAL','REEF',
  'REEL','RENT','RICE','RICH','RIDE','RING','RINK','RISE','RISK','ROAD',
  'ROAR','ROCK','ROLE','ROLL','ROOF','ROPE','ROSE','RULE','RUSH','RUST',
  'SAFE','SAGE','SAIL','SALT','SAND','SAVE','SEAL','SEAT','SEED','SEEK',
  'SELF','SELL','SEND','SHIP','SHOE','SHOW','SILK','SING','SINK','SKIN',
  'SLAB','SLIM','SLIP','SLOW','SNAP','SOIL','SOLE','SONG','SOUL','SPAN',
  'SPIN','SPOT','SPUR','STAR','STAY','STEM','STEP','STIR','STOP','SUIT',
  'SURF','SWAN','SWAY','SWIM','TALE','TALL','TAME','TANG','TASK','TEAM',
  'TEAR','TELL','TEND','TENT','TEST','TILT','TIME','TINY','TIRE','TOLL',
  'TOMB','TONE','TOOL','TOWN','TREK','TRIM','TRIP','TROT','TRUE','TUBE',
  'TUNE','TURF','TURN','TWIN','TWIG','VALE','VAST','VEIL','VEST','VIEW',
  'VINE','VOLT','WADE','WAGE','WAKE','WALK','WALL','WAND','WARM','WASH',
  'WAVE','WEAK','WEAR','WEED','WEEK','WELL','WEST','WILD','WILL','WIND',
  'WING','WIRE','WISE','WISH','WOLF','WOOD','WOOL','WORD','WORM','WRAP',
  'YEAR','YELL','YOGA','ZEAL','ZERO','ZONE','ZOOM'
]

export const SOLVE_WINDOW_MS = 10_000
export const LETTER_WINDOW_MS = 20_000
export const BLITZ_LETTER_MS = 7_000
export const BLITZ_SOLVE_MS = 6_000
export const PAUSE_WINDOW_MS = 5 * 60_000

export function makeRoomCode() {
  return ROOM_CODE_WORDS[Math.floor(Math.random() * ROOM_CODE_WORDS.length)]
}

export function otherRole(role) {
  return role === 'host' ? 'guest' : 'host'
}

export function wordCountOf(room) {
  return room.wordCount || 5
}

export function wordLenOf(room) {
  return room.wordLen || 5
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
  const wordCount = opts.wordCount || 5
  const wordLen = opts.wordLen || 5
  return {
    code,
    createdAt: Date.now(),
    status: 'lobby',
    pace: opts.pace || 'live',
    blitz: !!opts.blitz,
    wordCount,
    wordLen,
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
}

export function startPlayingPatch(room) {
  const turn = Math.random() < 0.5 ? 'host' : 'guest'
  return {
    status: 'playing',
    turn,
    startedAt: Date.now(),
    letterUntil: letterDeadline(room),
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
    lastMove: { by: role, type: 'letter', letter, correct: hits > 0, hits, striking, ts: Date.now() }
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
    letterUntil: correct || won ? null : letterDeadline(room),
    solveUntil: correct && !won ? solveDeadline(room) : null,
    status: won ? 'finished' : 'playing',
    winner: won ? role : null,
    lastMove: { by: role, type: 'solve', wordIndex, correct, ts: Date.now() }
  }
}

// Player chose to pass instead of solving — turn moves on immediately.
export function passSolvePatch(room) {
  return {
    turn: otherRole(room.turn),
    letterUntil: letterDeadline(room),
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
    letterUntil: letterDeadline(room),
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
    letterUntil: letterDeadline(room),
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
    lastMove: { by: role, type: 'powerup', powerup: 'reveal', letter, correct: true, ts: Date.now() }
  }
}

export function timePowerupPatch(room, role) {
  return {
    [`powerups/${role}`]: 'used',
    ...(room.solveUntil ? { solveUntil: room.solveUntil + 20_000 } : {}),
    ...(!room.solveUntil && room.letterUntil ? { letterUntil: room.letterUntil + 20_000 } : {}),
    lastMove: { by: role, type: 'powerup', powerup: 'time', correct: true, ts: Date.now() }
  }
}

export function doublePowerupPatch(room, role) {
  return {
    [`powerups/${role}`]: 'used',
    doubleStrike: role,
    lastMove: { by: role, type: 'powerup', powerup: 'double', correct: true, ts: Date.now() }
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
  return {
    status: 'lobby',
    'players/host/words': null,
    'players/host/ready': false,
    'players/guest/words': null,
    'players/guest/ready': false,
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
