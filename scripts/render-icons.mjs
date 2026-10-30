import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const GROUND = [243, 238, 230, 255]
const PAPER = [246, 243, 236, 255]
const RIVET = [36, 36, 36, 255]
const RIVET_PIN = [243, 239, 232, 255]

const BLADES = [
  { angle: -40, shades: ['#17345c', '#2c4c7c', '#8eafd2'] },
  { angle: 40, shades: ['#922e26', '#c4473a', '#f0a198'] },
  { angle: -20, shades: ['#1b4632', '#2f6f4e', '#84c09a'] },
  { angle: 20, shades: ['#c65e24', '#e28a3c', '#f4c48e'] },
  { angle: 0, shades: ['#c49222', '#e2b13c', '#f6e3a6'] },
]

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

function hex(value) {
  return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16), 255]
}

function rotate(x, y, degrees) {
  const rad = (degrees * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return [x * cos - y * sin, x * sin + y * cos]
}

function insideRoundRect(x, y, x0, y0, x1, y1, radius) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = x < x0 + radius ? x0 + radius : x > x1 - radius ? x1 - radius : x
  const cy = y < y0 + radius ? y0 + radius : y > y1 - radius ? y1 - radius : y
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= radius * radius
}

function fanColor(u, v) {
  const dx = u - 32
  const dy = v - 56
  for (const blade of [...BLADES].reverse()) {
    const [lx, ly] = rotate(dx, dy, -blade.angle)
    if (!insideRoundRect(lx, ly, -5, -38, 5, -2, 2.2)) continue
    if (ly >= -36.6 && ly < -25.4 && Math.abs(lx) <= 4.15) return hex(blade.shades[2])
    if (ly >= -24.6 && ly < -14.6 && Math.abs(lx) <= 4.15) return hex(blade.shades[1])
    if (ly >= -13.8 && ly < -4.2 && Math.abs(lx) <= 4.15) return hex(blade.shades[0])
    return PAPER
  }
  return null
}

function sample(u, v) {
  const dx = u - 32
  const dy = v - 56
  if (dx * dx + dy * dy <= 1.6 * 1.6) return RIVET_PIN
  if (dx * dx + dy * dy <= 4.2 * 4.2) return RIVET
  return fanColor(u, v)
}

function iconPixel(x, y, size, inset) {
  const scale = 1 - inset * 2
  let r = 0
  let g = 0
  let b = 0
  const steps = 2
  for (let sy = 0; sy < steps; sy += 1) {
    for (let sx = 0; sx < steps; sx += 1) {
      const px = x + (sx + 0.5) / steps
      const py = y + (sy + 0.5) / steps
      const u = ((px / size - inset) / scale) * 64
      const v = ((py / size - inset) / scale) * 64
      const color = u < 0 || v < 0 || u > 64 || v > 64 ? GROUND : (sample(u, v) ?? GROUND)
      r += color[0]
      g += color[1]
      b += color[2]
    }
  }
  const count = steps * steps
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count), 255]
}

function bladeMarkup(blade) {
  const [dark, mid, light] = blade.shades
  return `    <g transform="rotate(${blade.angle})">
      <rect x="-5" y="-38" width="10" height="36" rx="2.2" fill="#f6f3ec"/>
      <rect x="-4.15" y="-36.6" width="8.3" height="11.2" fill="${light}"/>
      <rect x="-4.15" y="-24.6" width="8.3" height="10" fill="${mid}"/>
      <rect x="-4.15" y="-13.8" width="8.3" height="9.6" fill="${dark}"/>
    </g>`
}

const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="460" viewBox="0 16 64 46" role="img" aria-label="Éventail de nuances">
  <g transform="translate(32 56)">
${BLADES.map(bladeMarkup).join('\n')}
    <circle r="4.2" fill="#242424"/>
    <circle r="1.6" fill="#f3efe8"/>
  </g>
</svg>
`

writeFileSync('public/logo.svg', `${logo}\n`)
writeFileSync('public/favicon.svg', `${logo}\n`)
writeFileSync('public/app-icon-192.png', png(192, (x, y, size) => iconPixel(x, y, size, 0)))
writeFileSync('public/app-icon-512.png', png(512, (x, y, size) => iconPixel(x, y, size, 0)))
writeFileSync('public/app-icon-maskable-192.png', png(192, (x, y, size) => iconPixel(x, y, size, 0.1)))
writeFileSync('public/app-icon-maskable-512.png', png(512, (x, y, size) => iconPixel(x, y, size, 0.1)))
writeFileSync('public/apple-touch-icon.png', png(180, (x, y, size) => iconPixel(x, y, size, 0)))
