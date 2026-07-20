// Generates src/data/words.json — every 5-letter word from the `word-list`
// dictionary (SOWPODS). Run once after `npm install`: `npm run words`.
import { readFileSync, writeFileSync } from 'node:fs'
import wordListPath from 'word-list'

const all = readFileSync(wordListPath, 'utf8').split('\n')
const five = all.filter((w) => w.length === 5 && /^[a-z]+$/.test(w))
writeFileSync(
  new URL('../src/data/words.json', import.meta.url),
  JSON.stringify(five)
)
console.log(`Wrote ${five.length} five-letter words to src/data/words.json`)
