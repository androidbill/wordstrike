// Picks the sync backend: Firebase when configured, otherwise local demo mode.
import { firebaseConfig } from '../firebase-config.js'
import { localStore } from './local.js'

let storePromise = null

export function getStore() {
  if (!storePromise) {
    storePromise = firebaseConfig
      ? import('./firebase.js').then((m) => m.createFirebaseStore(firebaseConfig))
      : Promise.resolve(localStore)
  }
  return storePromise
}

// Pass-and-play (hotseat) and bot-practice rooms always live in the local
// backend so they work fully offline, even when Firebase is configured.
export function getStoreFor(session) {
  return session?.hotseat || session?.bot ? Promise.resolve(localStore) : getStore()
}

export const isLocalMode = !firebaseConfig
