// Generates PWA icons (public/icons/*.png) with zero image dependencies —
// draws letter tiles on a navy gradient and encodes the PNG by hand.
// Run: `npm run icons`.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// --- drawing helpers (per-pixel, anti-aliased rounded rects) ---
function roundedRectAlpha(px, py, x, y, w, h, r) {
  const cx = Math.max(x + r, Math.min(px, x + w - r))
  const cy = Math.max(y + r, Math.min(py, y + h - r))
  const dx = px - cx
  const dy = py - cy
  const d = Math.sqrt(dx * dx + dy * dy)
  return Math.max(0, Math.min(1, r - d + 0.5))
}

function draw(size, maskable) {
  const buf = Buffer.alloc(size * size * 4)
  const S = size
  // Tile layout: 2x2 grid of tiles, top-right tile gold (the "strike")
  const pad = maskable ? S * 0.24 : S * 0.16
  const gap = S * 0.045
  const tile = (S - pad * 2 - gap) / 2
  const tiles = [
    [pad, pad],
    [pad + tile + gap, pad],
    [pad, pad + tile + gap],
    [pad + tile + gap, pad + tile + gap]
  ]
  const gold = [245, 197, 66]
  const slate = [62, 74, 118]
  const bgTop = [16, 20, 40]
  const bgBot = [9, 11, 24]
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const t = y / S
      let r = bgTop[0] + (bgBot[0] - bgTop[0]) * t
      let g = bgTop[1] + (bgBot[1] - bgTop[1]) * t
      let b = bgTop[2] + (bgBot[2] - bgTop[2]) * t
      for (let i = 0; i < 4; i++) {
        const [tx, ty] = tiles[i]
        const a = roundedRectAlpha(x, y, tx, ty, tile, tile, tile * 0.22)
        if (a > 0) {
          const c = i === 1 ? gold : slate
          // subtle top highlight on each tile
          const hl = 1 + 0.18 * (1 - (y - ty) / tile)
          r = r * (1 - a) + Math.min(255, c[0] * hl) * a
          g = g * (1 - a) + Math.min(255, c[1] * hl) * a
          b = b * (1 - a) + Math.min(255, c[2] * hl) * a
        }
      }
      const o = (y * S + x) * 4
      buf[o] = r
      buf[o + 1] = g
      buf[o + 2] = b
      buf[o + 3] = 255
    }
  }
  return buf
}

for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-512-maskable.png', 512, true]
]) {
  const png = encodePNG(size, draw(size, maskable))
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), png)
  console.log(`Wrote public/icons/${name} (${png.length} bytes)`)
}
