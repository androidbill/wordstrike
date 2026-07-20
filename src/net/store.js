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

export const isLocalMode = !firebaseConfig
