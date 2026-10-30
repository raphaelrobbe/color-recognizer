import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const COLORS = {
  yellow: [226, 177, 60],
  red: [196, 71, 58],
  green: [47, 111, 78],
  blue: [44, 76, 124],
  ground: [111, 111, 111],
}

function crc32(data) {
  let crc = ~0
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y, size)
      const index = row + 1 + x * 4
      raw[index] = r
      raw[index + 1] = g
      raw[index + 2] = b
      raw[index + 3] = a
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function quadrant(x, y, size, inset) {
  const left = x < size / 2
  const top = y < size / 2
  const inside =
    x >= size * inset && x < size * (1 - inset) && y >= size * inset && y < size * (1 - inset)
  if (!inside) return [...COLORS.ground, 255]
  if (top && left) return [...COLORS.yellow, 255]
  if (top) return [...COLORS.red, 255]
  if (left) return [...COLORS.green, 255]
  return [...COLORS.blue, 255]
}

const anyIcon = (size) => png(size, (x, y) => quadrant(x, y, size, 0))
const maskableIcon = (size) => png(size, (x, y) => quadrant(x, y, size, 0.1))

writeFileSync('public/app-icon-192.png', anyIcon(192))
writeFileSync('public/app-icon-512.png', anyIcon(512))
writeFileSync('public/app-icon-maskable-192.png', maskableIcon(192))
writeFileSync('public/app-icon-maskable-512.png', maskableIcon(512))
writeFileSync('public/apple-touch-icon.png', anyIcon(180))
