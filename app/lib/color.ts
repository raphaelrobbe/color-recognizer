export type Rgb = { r: number; g: number; b: number }

export type Lab = { L: number; a: number; b: number }

export type Oklch = { l: number; c: number; h: number }

export type NcsColor = {
  blackness: number
  chromaticness: number
  whiteness: number
  hueLabel: string
  precise: string
  nearest: string
}

export type ColorCodes = {
  ncs: NcsColor
  lines: { id: string; label: string; value: string }[]
  text: string
}

const XN = 0.9504559270516716
const YN = 1
const ZN = 1.0890577507598785

const RGB_TO_XYZ = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
] as const

const XYZ_TO_RGB = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
] as const

type Elementary = 'Y' | 'R' | 'B' | 'G'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function linearize(channel: number): number {
  const x = channel / 255
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}

function encodeSrgb(value: number): number {
  const x = clamp(value, 0, 1)
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
}

function labF(value: number): number {
  const delta = 6 / 29
  return value > delta ** 3 ? Math.cbrt(value) : value / (3 * delta * delta) + 4 / 29
}

function labFInv(value: number): number {
  const delta = 6 / 29
  return value > delta ? value ** 3 : 3 * delta * delta * (value - 4 / 29)
}

function multiply(matrix: readonly (readonly number[])[], vector: readonly number[]): number[] {
  return matrix.map((row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2])
}

export function rgbToLab(rgb: Rgb): Lab {
  const linear = [linearize(rgb.r), linearize(rgb.g), linearize(rgb.b)]
  const [x, y, z] = multiply(RGB_TO_XYZ, linear)
  const fx = labF(x / XN)
  const fy = labF(y / YN)
  const fz = labF(z / ZN)
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

export function labToRgb(lab: Lab): Rgb {
  const fy = (lab.L + 16) / 116
  const fx = lab.a / 500 + fy
  const fz = fy - lab.b / 200
  const xyz = [XN * labFInv(fx), YN * labFInv(fy), ZN * labFInv(fz)]
  const [r, g, b] = multiply(XYZ_TO_RGB, xyz)
  return {
    r: clamp(Math.round(encodeSrgb(r) * 255), 0, 255),
    g: clamp(Math.round(encodeSrgb(g) * 255), 0, 255),
    b: clamp(Math.round(encodeSrgb(b) * 255), 0, 255),
  }
}

function oklabToLinear(oklab: { L: number; a: number; b: number }): [number, number, number] {
  const l_ = oklab.L + 0.3963377774 * oklab.a + 0.2158037573 * oklab.b
  const m_ = oklab.L - 0.1055613458 * oklab.a - 0.0638541728 * oklab.b
  const s_ = oklab.L - 0.0894841775 * oklab.a - 1.291485548 * oklab.b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

function linearToOklab(linear: [number, number, number]): { L: number; a: number; b: number } {
  const [r, g, b] = linear
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

function oklchToOklab(oklch: Oklch): { L: number; a: number; b: number } {
  const hue = (oklch.h * Math.PI) / 180
  return {
    L: oklch.l,
    a: oklch.c * Math.cos(hue),
    b: oklch.c * Math.sin(hue),
  }
}

export function rgbToOklch(rgb: Rgb): Oklch {
  const oklab = linearToOklab([linearize(rgb.r), linearize(rgb.g), linearize(rgb.b)])
  const c = Math.hypot(oklab.a, oklab.b)
  let h = (Math.atan2(oklab.b, oklab.a) * 180) / Math.PI
  if (h < 0) h += 360
  return { l: oklab.L, c, h: c < 1e-6 ? 0 : h }
}

function linearInGamut(linear: [number, number, number]): boolean {
  return linear.every((channel) => channel >= -1e-4 && channel <= 1 + 1e-4)
}

/** Largest OKLCH chroma that still fits in sRGB for this lightness and hue. */
export function maxOklchChroma(l: number, h: number): number {
  return fitOklch({ l, c: 0.5, h }).c
}

export function fitOklch(oklch: Oklch): Oklch {
  const l = clamp(oklch.l, 0, 1)
  const h = ((oklch.h % 360) + 360) % 360
  const wanted = Math.max(0, oklch.c)
  if (linearInGamut(oklabToLinear(oklchToOklab({ l, c: wanted, h })))) {
    return { l, c: wanted, h }
  }
  let lo = 0
  let hi = wanted
  for (let step = 0; step < 18; step += 1) {
    const mid = (lo + hi) / 2
    if (linearInGamut(oklabToLinear(oklchToOklab({ l, c: mid, h })))) lo = mid
    else hi = mid
  }
  return { l, c: lo, h }
}

export function oklchToRgb(oklch: Oklch): Rgb {
  const [r, g, b] = oklabToLinear(oklchToOklab(fitOklch(oklch)))
  return {
    r: clamp(Math.round(encodeSrgb(r) * 255), 0, 255),
    g: clamp(Math.round(encodeSrgb(g) * 255), 0, 255),
    b: clamp(Math.round(encodeSrgb(b) * 255), 0, 255),
  }
}

export function rgbToHex(rgb: Rgb): string {
  return `#${[rgb.r, rgb.g, rgb.b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

export function rgbToHsl(rgb: Rgb): { h: number; s: number; l: number } {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: lightness * 100 }
  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue = 0
  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0)
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  return { h: hue * 60, s: saturation * 100, l: lightness * 100 }
}

export function rgbToHsv(rgb: Rgb): { h: number; s: number; v: number } {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let hue = 0
  if (delta !== 0) {
    if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0)
    else if (max === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
    hue *= 60
  }
  return { h: hue, s: max === 0 ? 0 : (delta / max) * 100, v: max * 100 }
}

export function rgbToCmyk(rgb: Rgb): { c: number; m: number; y: number; k: number } {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const k = 1 - Math.max(r, g, b)
  if (k >= 1 - 1e-8) return { c: 0, m: 0, y: 0, k: 100 }
  return {
    c: ((1 - r - k) / (1 - k)) * 100,
    m: ((1 - g - k) / (1 - k)) * 100,
    y: ((1 - b - k) / (1 - k)) * 100,
    k: k * 100,
  }
}

export function deltaE(a: Rgb, b: Rgb): number {
  const labA = rgbToLab(a)
  const labB = rgbToLab(b)
  return Math.hypot(labA.L - labB.L, labA.a - labB.a, labA.b - labB.b)
}

export function inkOn(rgb: Rgb): '#1a1a1a' | '#f4f4f4' {
  const y = 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b)
  return y > 0.45 ? '#1a1a1a' : '#f4f4f4'
}

export function averageRgb(pixels: Uint8ClampedArray): Rgb {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] === 0) continue
    r += pixels[index]
    g += pixels[index + 1]
    b += pixels[index + 2]
    count += 1
  }
  if (count === 0) return { r: 0, g: 0, b: 0 }
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  }
}

/**
 * Screen samples of each NCS hue, every 10% of the circle Y → R → B → G.
 * `h` is the CIELAB hue angle, `chroma` the C*ab of the full-chromatic colour,
 * `lightness` its L*. Fitted on published sRGB approximations, not the licensed atlas.
 */
const NCS_HUE_RING: { pos: number; h: number; chroma: number; lightness: number }[] = [
  { pos: 0, h: 90.8, chroma: 119.8, lightness: 85.5 },
  { pos: 10, h: 83.2, chroma: 117.2, lightness: 82.4 },
  { pos: 20, h: 77.0, chroma: 114.5, lightness: 77.7 },
  { pos: 30, h: 68.4, chroma: 108.7, lightness: 72.6 },
  { pos: 40, h: 62.0, chroma: 109.0, lightness: 66.7 },
  { pos: 50, h: 55.6, chroma: 107.8, lightness: 63.7 },
  { pos: 60, h: 49.5, chroma: 102.5, lightness: 60.2 },
  { pos: 70, h: 43.3, chroma: 98.6, lightness: 56.4 },
  { pos: 80, h: 35.6, chroma: 96.3, lightness: 53.8 },
  { pos: 90, h: 29.6, chroma: 91.4, lightness: 50.3 },
  { pos: 100, h: 20.8, chroma: 87.5, lightness: 50.3 },
  { pos: 110, h: 11.9, chroma: 83.6, lightness: 48.2 },
  { pos: 120, h: 2.0, chroma: 85.6, lightness: 50.0 },
  { pos: 130, h: 349.0, chroma: 83.5, lightness: 50.4 },
  { pos: 140, h: 333.9, chroma: 82.3, lightness: 50.9 },
  { pos: 150, h: 319.8, chroma: 79.8, lightness: 50.1 },
  { pos: 160, h: 302.4, chroma: 76.5, lightness: 53.0 },
  { pos: 170, h: 285.7, chroma: 74.6, lightness: 51.0 },
  { pos: 180, h: 271.4, chroma: 72.9, lightness: 52.1 },
  { pos: 190, h: 257.4, chroma: 70.4, lightness: 51.0 },
  { pos: 200, h: 241.5, chroma: 67.8, lightness: 54.5 },
  { pos: 210, h: 225.7, chroma: 68.9, lightness: 56.5 },
  { pos: 220, h: 217.9, chroma: 69.6, lightness: 59.9 },
  { pos: 230, h: 208.9, chroma: 73.0, lightness: 59.4 },
  { pos: 240, h: 202.2, chroma: 75.8, lightness: 61.1 },
  { pos: 250, h: 196.1, chroma: 74.7, lightness: 61.9 },
  { pos: 260, h: 190.0, chroma: 80.3, lightness: 64.0 },
  { pos: 270, h: 184.6, chroma: 80.1, lightness: 64.3 },
  { pos: 280, h: 178.7, chroma: 83.4, lightness: 65.0 },
  { pos: 290, h: 171.3, chroma: 85.5, lightness: 64.1 },
  { pos: 300, h: 161.9, chroma: 89.2, lightness: 65.2 },
  { pos: 310, h: 151.4, chroma: 92.3, lightness: 66.1 },
  { pos: 320, h: 141.5, chroma: 94.0, lightness: 67.7 },
  { pos: 330, h: 131.6, chroma: 97.1, lightness: 71.4 },
  { pos: 340, h: 121.4, chroma: 99.6, lightness: 73.3 },
  { pos: 350, h: 115.0, chroma: 108.7, lightness: 77.1 },
  { pos: 360, h: 110.4, chroma: 112.9, lightness: 81.0 },
  { pos: 370, h: 106.3, chroma: 114.8, lightness: 83.2 },
  { pos: 380, h: 101.0, chroma: 118.0, lightness: 84.0 },
  { pos: 390, h: 96.0, chroma: 119.9, lightness: 85.7 },
]

const NCS_SECTORS: [Elementary, Elementary][] = [
  ['Y', 'R'],
  ['R', 'B'],
  ['B', 'G'],
  ['G', 'Y'],
]

const ncsRing = (() => {
  let unwrapped = NCS_HUE_RING[0].h
  const circle = NCS_HUE_RING.map((anchor, index) => {
    if (index > 0) {
      let next = anchor.h
      while (next > unwrapped) next -= 360
      unwrapped = next
    }
    return { ...anchor, u: unwrapped }
  })
  const first = circle[0]
  return [...circle, { pos: 400, chroma: first.chroma, lightness: first.lightness, u: first.u - 360 }]
})()

/**
 * NCS estimate read from the measured pixels.
 * Chromaticness is C*ab divided by the full-chromatic C*ab of that hue,
 * and blackness is the complement that puts the colour on the nuance triangle
 * between white and that full-chromatic colour.
 * The licensed NCS atlas is not reproduced here.
 */
export function rgbToNcs(rgb: Rgb): NcsColor {
  const lab = rgbToLab(rgb)
  const chroma = Math.hypot(lab.a, lab.b)
  if (chroma < 2) {
    return ncsFromParts(clamp(100 - lab.L, 0, 100), 0, 'N', 'N')
  }

  let hue = (Math.atan2(lab.b, lab.a) * 180) / Math.PI
  if (hue < 0) hue += 360
  const place = ncsPlace(hue)
  let chromaticness = clamp((chroma * 100) / place.chroma, 0, 100)
  const blackness = clamp(100 - lab.L - chromaticness * (1 - place.lightness / 100), 0, 100)
  if (blackness + chromaticness > 100) chromaticness = 100 - blackness

  const sector = ncsHueLabel(place.pos)
  return ncsFromParts(blackness, chromaticness, sector.precise, sector.nearest)
}

function ncsPlace(hue: number): { pos: number; chroma: number; lightness: number } {
  const start = ncsRing[0].u
  const end = ncsRing[ncsRing.length - 1].u
  let unwrapped = hue
  while (unwrapped > start) unwrapped -= 360
  while (unwrapped < end) unwrapped += 360
  let index = 0
  while (index < ncsRing.length - 2 && unwrapped < ncsRing[index + 1].u) index += 1
  const left = ncsRing[index]
  const right = ncsRing[index + 1]
  const span = right.u - left.u
  const t = span === 0 ? 0 : (unwrapped - left.u) / span
  return {
    pos: left.pos + t * (right.pos - left.pos),
    chroma: left.chroma + t * (right.chroma - left.chroma),
    lightness: left.lightness + t * (right.lightness - left.lightness),
  }
}

function ncsHueLabel(pos: number): { precise: string; nearest: string } {
  const wrapped = pos >= 400 ? 0 : pos
  const sector = Math.min(3, Math.floor(wrapped / 100))
  const percent = wrapped - sector * 100
  const [from, to] = NCS_SECTORS[sector]
  return { precise: formatHue(from, to, percent), nearest: formatHue(from, to, snap5(percent)) }
}

function formatHue(from: Elementary, to: Elementary, percent: number): string {
  const rounded = clamp(Math.round(percent), 0, 100)
  if (rounded <= 0) return from
  if (rounded >= 100) return to
  return `${from}${String(rounded).padStart(2, '0')}${to}`
}

function snap5(value: number): number {
  return clamp(Math.round(value / 5) * 5, 0, 100)
}

const NUANCE_STEPS = [0, 2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95]

function snapNuance(value: number): number {
  return NUANCE_STEPS.reduce((best, step) => (Math.abs(step - value) < Math.abs(best - value) ? step : best))
}

function quantizePair(blackness: number, chromaticness: number): { blackness: number; chromaticness: number } {
  let nextBlackness = clamp(Math.round(blackness), 0, 99)
  let nextChromaticness = clamp(Math.round(chromaticness), 0, 99)
  if (nextBlackness + nextChromaticness > 100) nextChromaticness = 100 - nextBlackness
  return { blackness: nextBlackness, chromaticness: nextChromaticness }
}

function formatNotation(blackness: number, chromaticness: number, hueLabel: string): string {
  const pair = quantizePair(blackness, chromaticness)
  const prefix = `S ${String(pair.blackness).padStart(2, '0')}${String(pair.chromaticness).padStart(2, '0')}`
  return pair.chromaticness === 0 ? `${prefix}-N` : `${prefix}-${hueLabel}`
}

function ncsFromParts(blackness: number, chromaticness: number, preciseHue: string, nearestHue: string): NcsColor {
  const precisePair = quantizePair(blackness, chromaticness)
  const nearestBlackness = snapNuance(blackness)
  let nearestChromaticness = snapNuance(chromaticness)
  if (nearestBlackness + nearestChromaticness > 100) {
    nearestChromaticness = NUANCE_STEPS.reduce(
      (allowed, step) => (nearestBlackness + step <= 100 ? step : allowed),
      0,
    )
  }
  const precise = formatNotation(precisePair.blackness, precisePair.chromaticness, preciseHue)
  const nearest = formatNotation(nearestBlackness, nearestChromaticness, nearestHue)
  return {
    blackness: precisePair.blackness,
    chromaticness: precisePair.chromaticness,
    whiteness: 100 - precisePair.blackness - precisePair.chromaticness,
    hueLabel: precisePair.chromaticness === 0 ? 'N' : preciseHue,
    precise,
    nearest,
  }
}

export function colorCodes(rgb: Rgb): ColorCodes {
  const ncs = rgbToNcs(rgb)
  const hex = rgbToHex(rgb)
  const hsl = rgbToHsl(rgb)
  const hsv = rgbToHsv(rgb)
  const cmyk = rgbToCmyk(rgb)
  const lab = rgbToLab(rgb)
  const oklch = rgbToOklch(rgb)
  const lines = [
    { id: 'ncs', label: 'NCS estimé', value: ncs.precise },
    ...(ncs.nearest === ncs.precise ? [] : [{ id: 'ncs-near', label: 'Nuancier proche', value: ncs.nearest }]),
    { id: 'rgb', label: 'RVB', value: `${rgb.r}, ${rgb.g}, ${rgb.b}` },
    { id: 'hex', label: 'Hexadécimal', value: hex },
    { id: 'hsl', label: 'TSL', value: `${Math.round(hsl.h)}°  ${Math.round(hsl.s)} %  ${Math.round(hsl.l)} %` },
    { id: 'hsv', label: 'TSV', value: `${Math.round(hsv.h)}°  ${Math.round(hsv.s)} %  ${Math.round(hsv.v)} %` },
    {
      id: 'cmyk',
      label: 'CMJN',
      value: `${Math.round(cmyk.c)} %  ${Math.round(cmyk.m)} %  ${Math.round(cmyk.y)} %  ${Math.round(cmyk.k)} %`,
    },
    { id: 'lab', label: 'CIELAB', value: `L* ${lab.L.toFixed(1)}   a* ${lab.a.toFixed(1)}   b* ${lab.b.toFixed(1)}` },
    {
      id: 'oklch',
      label: 'OKLCH',
      value: `L ${oklch.l.toFixed(3)}   C ${oklch.c.toFixed(3)}   h ${oklch.h.toFixed(0)}°`,
    },
  ]
  return {
    ncs,
    lines,
    text: lines.map((line) => `${line.label} : ${line.value}`).join('\n'),
  }
}
