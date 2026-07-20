// Practice bot: plays the guest seat of a local relaxed-pace room.
// It "knows" the answers, so difficulty tunes how often it acts on them.
import {
  letterMovePatch, solveMovePatch, passSolvePatch,
  targetWords, guessedBy, solvedBy
} from './game.js'
import { randomCommonWord } from './words.js'

export const BOT_LEVELS = {
  easy: { name: 'Rusty', avatar: '🤖', revealNeed: 4, solveChance: 0.3, smartLetter: 0.2 },
  medium: { name: 'Circuit', avatar: '🦾', revealNeed: 3, solveChance: 0.55, smartLetter: 0.7 },
  hard: { name: 'MegaHertz', avatar: '🧠', revealNeed: 2, solveChance: 0.85, smartLetter: 1 }
}

const FREQ = 'etaoinsrhldcumfpgwybvkxjqz'

export function botWords(count = 5) {
  const picked = []
  for (let i = 0; i < count; i++) picked.push(randomCommonWord(picked))
  return picked
}

// The bot's turn phase mirrors the relaxed-pace rules in Game.jsx.
function inSolvePhase(room) {
  const m = room.lastMove
  return !!m && m.by === 'guest' && !m.striking &&
    (m.type === 'letter' || (m.type === 'solve' && m.correct))
}

export function botMovePatch(room, level) {
  const cfg = BOT_LEVELS[level] || BOT_LEVELS.easy
  const words = targetWords(room, 'guest')
  const guessed = guessedBy(room, 'guest')
  const solved = solvedBy(room, 'guest')

  if (inSolvePhase(room)) {
    // Consider solving any word with enough letters showing.
    for (let i = 0; i < words.length; i++) {
      if (solved[i]) continue
      const revealed = [...words[i]].filter((ch) => guessed[ch]).length
      if (revealed >= cfg.revealNeed && Math.random() < cfg.solveChance) {
        return solveMovePatch(room, 'guest', i, words[i])
      }
    }
    return passSolvePatch(room)
  }

  // Letter phase: smart bots follow letter frequency, easy ones wander.
  const unguessed = [...'abcdefghijklmnopqrstuvwxyz'].filter((ch) => !guessed[ch])
  if (!unguessed.length) return passSolvePatch(room)
  let letter
  if (Math.random() < cfg.smartLetter) {
    letter = [...FREQ].find((ch) => !guessed[ch]) || unguessed[0]
  } else {
    letter = unguessed[Math.floor(Math.random() * unguessed.length)]
  }
  return letterMovePatch(room, 'guest', letter)
}
