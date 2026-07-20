# ⚔️ WordStrike

A head-to-head word battle PWA — Battleship meets Wheel of Fortune.

Each player secretly picks **five 5-letter words**. Players take turns calling
letters: every box holding that letter lights up and flips over across all
five of the rival's words. On your turn you can instead try to **solve** a
word — get it right and you keep your turn, miss and it passes. First player
to crack all five of their rival's words wins.

## Features

- 🏠 Create / join rooms with 4-letter codes
- 😎 Avatar + nickname profiles (remembered between games)
- ✍️ Pick words by typing (dictionary-validated), rolling random words, or browsing all 12,578 five-letter words
- 🎡 Wheel-of-Fortune style tile reveal animations
- 🏆 Win detection, confetti, and one-tap rematch
- 📱 Installable PWA with offline-cached shell
- 🔌 Works instantly in **local demo mode** (two tabs, same browser) with zero setup

## Quick start

```bash
npm install
npm run words   # regenerates src/data/words.json (already committed)
npm run icons   # regenerates PWA icons (already committed)
npm run dev
```

Open two browser tabs at the dev URL — with no Firebase configured the game
runs in local demo mode and the tabs can play each other.

## Going online with Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. **Build → Realtime Database → Create database** → start in test mode
3. **Project settings → Your apps → Web app (`</>`)** → register, copy the config
4. Paste the config into [`src/firebase-config.js`](src/firebase-config.js)

That's it — rooms now sync across the internet. Before sharing widely, lock
down the database rules (test mode expires after 30 days), e.g.:

```json
{
  "rules": {
    "rooms": {
      "$code": { ".read": true, ".write": true }
    }
  }
}
```

## Deploying

`npm run build` produces a static `dist/` folder — host it anywhere
(Firebase Hosting, Netlify, Vercel, GitHub Pages).

## Stack

- React 18 + Vite 6, `vite-plugin-pwa` (auto-updating service worker)
- Firebase Realtime Database (or the built-in BroadcastChannel local backend)
- Word list generated from the `word-list` package (SOWPODS, 5-letter subset)

## Nice-to-haves not in v1

- Presence / reconnect grace (a player closing the tab just sets a `left` flag)
- Sound effects
- Solve-attempt penalty variants, timers, best-of-N scoring
