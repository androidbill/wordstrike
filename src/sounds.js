// Tiny synth sound effects via WebAudio — no audio files needed.
// Muted state persists per device.
const MUTE_KEY = 'ws-muted'
let ctx = null

export function isMuted() {
  return localStorage.getItem(MUTE_KEY) === '1'
}

export function toggleMuted() {
  const next = !isMuted()
  localStorage.setItem(MUTE_KEY, next ? '1' : '0')
  return next
}

function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, { at = 0, dur = 0.12, type = 'sine', gain = 0.18, slide = 0 } = {}) {
  const c = audio()
  const t = c.currentTime + at
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur)
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function safe(fn) {
  if (isMuted()) return
  try { fn() } catch { /* no audio available — fine */ }
}

// Rising ding per revealed letter (WoF style): pitch climbs with each hit.
export function playHits(count) {
  safe(() => {
    const n = Math.min(count, 6)
    for (let i = 0; i < n; i++) {
      tone(620 + i * 110, { at: i * 0.13, dur: 0.14, type: 'triangle', gain: 0.2 })
    }
  })
}

export function playMiss() {
  safe(() => tone(160, { dur: 0.22, type: 'sawtooth', gain: 0.12, slide: -70 }))
}

export function playSolve() {
  safe(() => {
    tone(523, { at: 0, dur: 0.11, type: 'triangle' })
    tone(659, { at: 0.1, dur: 0.11, type: 'triangle' })
    tone(784, { at: 0.2, dur: 0.2, type: 'triangle', gain: 0.22 })
  })
}

export function playWrongSolve() {
  safe(() => {
    tone(220, { at: 0, dur: 0.16, type: 'square', gain: 0.09 })
    tone(185, { at: 0.15, dur: 0.28, type: 'square', gain: 0.09, slide: -40 })
  })
}

export function playWin() {
  safe(() => {
    ;[523, 659, 784, 1047].forEach((f, i) =>
      tone(f, { at: i * 0.14, dur: i === 3 ? 0.45 : 0.13, type: 'triangle', gain: 0.22 })
    )
  })
}

export function playTaunt() {
  safe(() => tone(880, { dur: 0.09, type: 'sine', gain: 0.16, slide: 350 }))
}

export function playTap() {
  safe(() => tone(440, { dur: 0.05, type: 'sine', gain: 0.07 }))
}
