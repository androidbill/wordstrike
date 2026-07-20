// ── Firebase setup ──────────────────────────────────────────────
// 1. console.firebase.google.com → Add project (name it anything)
// 2. Build → Realtime Database → Create database → Start in test mode
// 3. Project settings → Your apps → Web app (</>) → copy the config
// 4. Paste it below, replacing `null`:
//
// export const firebaseConfig = {
//   apiKey: '...',
//   authDomain: '...',
//   databaseURL: 'https://<project>-default-rtdb.firebaseio.com',
//   projectId: '...',
//   appId: '...'
// }
//
// While this is null the game runs in LOCAL DEMO MODE: rooms sync
// between tabs of the same browser only (great for trying it out).
export const firebaseConfig = null
