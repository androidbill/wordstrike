// Generates src/data/words.json — every 5- and 6-letter word from the `word-list`
// dictionary (SOWPODS). Run once after `npm install`: `npm run words`.
import { readFileSync, writeFileSync } from 'node:fs'
import wordListPath from 'word-list'

const all = readFileSync(wordListPath, 'utf8').split('\n')
const words = all.filter((w) => (w.length === 5 || w.length === 6) && /^[a-z]+$/.test(w))
writeFileSync(
  new URL('../src/data/words.json', import.meta.url),
  JSON.stringify(words)
)
const five = words.filter((w) => w.length === 5).length
const six = words.filter((w) => w.length === 6).length
console.log(`Wrote ${words.length} words (${five} five-letter, ${six} six-letter) to src/data/words.json`)
