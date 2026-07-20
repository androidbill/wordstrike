// Local demo backend: rooms live in localStorage and sync across tabs of
// the same browser via BroadcastChannel. Mirrors the API of firebase.js.
const PREFIX = 'ws-room-'
const channel = new BroadcastChannel('wordstrike')
// BroadcastChannel does not deliver messages back to the posting tab, so
// same-tab subscribers are notified directly through this set.
const listeners = new Set() // of (code) => void

function read(code) {
  const raw = localStorage.getItem(PREFIX + code)
  return raw ? JSON.parse(raw) : null
}

function write(code, room) {
  localStorage.setItem(PREFIX + code, JSON.stringify(room))
  channel.postMessage(code)
  listeners.forEach((fn) => fn(code))
}

// Purge rooms older than a day so pass-and-play games don't pile up.
try {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(PREFIX)) continue
    const room = JSON.parse(localStorage.getItem(key))
    if (!room?.createdAt || room.createdAt < cutoff) localStorage.removeItem(key)
  }
} catch { /* corrupt entries are removed on next successful parse */ }

function applyPath(obj, path, value) {
  const keys = path.split('/')
  let node = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof node[keys[i]] !== 'object' || node[keys[i]] === null) node[keys[i]] = {}
    node = node[keys[i]]
  }
  node[keys[keys.length - 1]] = value
}

export const localStore = {
  isLocal: true,

  async createRoom(code, state) {
    write(code, state)
  },

  async getRoom(code) {
    return read(code)
  },

  async update(code, patch) {
    const room = read(code)
    if (!room) return
    for (const [path, value] of Object.entries(patch)) applyPath(room, path, value)
    write(code, room)
  },

  async deleteRoom(code) {
    localStorage.removeItem(PREFIX + code)
    channel.postMessage(code)
    listeners.forEach((fn) => fn(code))
  },

  subscribe(code, cb) {
    cb(read(code))
    const onMsg = (e) => {
      if (e.data === code) cb(read(code))
    }
    const onStorage = (e) => {
      if (e.key === PREFIX + code) cb(read(code))
    }
    const onLocal = (c) => {
      if (c === code) cb(read(code))
    }
    channel.addEventListener('message', onMsg)
    window.addEventListener('storage', onStorage)
    listeners.add(onLocal)
    return () => {
      channel.removeEventListener('message', onMsg)
      window.removeEventListener('storage', onStorage)
      listeners.delete(onLocal)
    }
  }
}
