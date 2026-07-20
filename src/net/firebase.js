// Firebase Realtime Database backend. Loaded lazily only when
// firebase-config.js has a real config, so local mode ships no Firebase code.
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get, set, update, onValue } from 'firebase/database'

export function createFirebaseStore(config) {
  const app = initializeApp(config)
  const db = getDatabase(app)

  return {
    isLocal: false,

    async createRoom(code, state) {
      await set(ref(db, `rooms/${code}`), state)
    },

    async getRoom(code) {
      const snap = await get(ref(db, `rooms/${code}`))
      return snap.exists() ? snap.val() : null
    },

    async update(code, patch) {
      await update(ref(db, `rooms/${code}`), patch)
    },

    subscribe(code, cb) {
      return onValue(ref(db, `rooms/${code}`), (snap) => cb(snap.exists() ? snap.val() : null))
    }
  }
}
