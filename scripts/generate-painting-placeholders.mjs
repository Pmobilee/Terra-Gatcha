/**
 * generate-painting-placeholders.mjs
 *
 * Generates 32px and 256px solid-color placeholder PNGs for all 20 paintings.
 * Run with: node scripts/generate-painting-placeholders.mjs
 *
 * Uses a pure-JS minimal PNG encoder (no external dependencies).
 * Each painting gets a unique hue derived from its index so frames are visually distinct.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import zlib from 'zlib'
const { deflateSync } = zlib

const PAINTINGS = [
  { key: 'painting_first_light',     hue: 45  },
  { key: 'painting_deep_dive',       hue: 220 },
  { key: 'painting_tree',            hue: 120 },
  { key: 'painting_flame',           hue: 20  },
  { key: 'painting_atlas',           hue: 200 },
  { key: 'painting_crystal_garden',  hue: 270 },
  { key: 'painting_relic_hunter',    hue: 30  },
  { key: 'painting_scholar',         hue: 160 },
  { key: 'painting_century',         hue: 0   },
  { key: 'painting_golem',           hue: 180 },
  { key: 'painting_wyrm_tame',       hue: 10  },
  { key: 'painting_family',          hue: 90  },
  { key: 'painting_sentinel',        hue: 260 },
  { key: 'painting_complete_atlas',  hue: 240 },
  { key: 'painting_omniscient',      hue: 50  },
  { key: 'painting_perfect_year',    hue: 195 },
  { key: 'painting_library',         hue: 130 },
  { key: 'painting_home',            hue: 210 },
  { key: 'painting_seasons',         hue: 80  },
  { key: 'painting_locked',          hue: -1  }, // special: greyscale
  { key: 'obj_gallery_frame',        hue: -2  }, // gallery frame placeholder
]

function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

// CRC32 table for PNG chunk checksums
const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  crcTable[i] = c
}

function crc32(buf) {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function uint32BE(n) {
  return Buffer.from([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff])
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const combined = Buffer.concat([typeBuf, data])
  const crc = crc32(combined)
  return Buffer.concat([uint32BE(data.length), typeBuf, data, uint32BE(crc)])
}

function makePng(width, height, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR: width, height, bit depth=8, color type=2 (RGB), compression=0, filter=0, interlace=0
  const ihdrData = Buffer.concat([
    uint32BE(width), uint32BE(height),
    Buffer.from([8, 2, 0, 0, 0])
  ])
  const ihdr = pngChunk('IHDR', ihdrData)

  // Build raw pixel data with filter byte (0 = None) per scanline
  const rowBytes = width * 3
  const rawData = Buffer.alloc(height * (1 + rowBytes))
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + rowBytes)] = 0 // filter type None
    for (let x = 0; x < width; x++) {
      const off = y * (1 + rowBytes) + 1 + x * 3
      // Draw a simple border (2px) in lighter color
      const isBorder = x < 2 || x >= width - 2 || y < 2 || y >= height - 2
      if (isBorder) {
        rawData[off] = Math.min(255, r + 50)
        rawData[off + 1] = Math.min(255, g + 50)
        rawData[off + 2] = Math.min(255, b + 50)
      } else {
        rawData[off] = r
        rawData[off + 1] = g
        rawData[off + 2] = b
      }
    }
  }

  // Compress with zlib
  const compressed = deflateSync(rawData, { level: 6 })
  const idat = pngChunk('IDAT', compressed)
  const iend = pngChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([sig, ihdr, idat, iend])
}

for (const size of [32, 256]) {
  const dir = size === 32
    ? join('src', 'assets', 'sprites', 'dome')
    : join('src', 'assets', 'sprites-hires', 'dome')
  mkdirSync(dir, { recursive: true })

  for (const { key, hue } of PAINTINGS) {
    let r, g, b
    if (hue === -1) {
      // Greyscale locked silhouette
      r = g = b = 58
    } else if (hue === -2) {
      // Gallery frame — dark brown/gold
      r = 74; g = 48; b = 16
    } else {
      ;[r, g, b] = hslToRgb(hue, 0.55, 0.38)
    }

    const png = makePng(size, size, r, g, b)
    writeFileSync(join(dir, `${key}.png`), png)
    console.log(`Generated ${size}px/${key}.png`)
  }
}
console.log('All painting placeholders generated.')
