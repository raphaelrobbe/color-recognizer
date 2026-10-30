import { rgbToHex, type Rgb } from './color'

export const APP_URL = 'https://raphaelrobbe.github.io/color-recognizer'

export function colorShareUrl(rgb: Rgb): string {
  return `${APP_URL}/?c=${rgbToHex(rgb).slice(1).toLowerCase()}`
}

export function rgbFromSearch(search: string): Rgb | null {
  const value = new URLSearchParams(search).get('c')?.trim().replace(/^#/, '') ?? ''
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}
