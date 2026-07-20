// Achievement definitions + per-device earned store.
const KEY = 'ws-achievements'

export const ACHIEVEMENTS = [
  { id: 'first_blood', emoji: '🩸', name: 'First Blood', desc: 'Win your first game' },
  { id: 'mind_reader', emoji: '🔮', name: 'Mind Reader', desc: 'Solve a word with zero letters revealed' },
  { id: 'photo_finish', emoji: '📸', name: 'Photo Finish', desc: 'Win a nail-biter 5–4' },
  { id: 'clean_sweep', emoji: '🧹', name: 'Clean Sweep', desc: 'Win 5–0' },
  { id: 'speed_demon', emoji: '⚡', name: 'Speed Demon', desc: 'Solve a word within 60 seconds of the start' }
]

export function loadEarned() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}

// Returns the achievement def if newly earned, null if already had it.
export function earn(id) {
  const earned = loadEarned()
  if (earned[id]) return null
  earned[id] = Date.now()
  localStorage.setItem(KEY, JSON.stringify(earned))
  return ACHIEVEMENTS.find((a) => a.id === id) || null
}
