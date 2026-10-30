import { describe, expect, it } from 'vitest'
import { averageRgb, deltaE, labToRgb, maxOklchChroma, oklchToRgb, rgbToHex, rgbToLab, rgbToNcs, rgbToOklch } from './color'

describe('CIELAB', () => {
  it('maps white and black to the lightness ends', () => {
    expect(rgbToLab({ r: 255, g: 255, b: 255 }).L).toBeCloseTo(100, 1)
    expect(rgbToLab({ r: 0, g: 0, b: 0 }).L).toBeCloseTo(0, 1)
  })

  it('matches the known sRGB red', () => {
    const lab = rgbToLab({ r: 255, g: 0, b: 0 })
    expect(lab.L).toBeCloseTo(53.23, 0)
    expect(lab.a).toBeCloseTo(80.1, 0)
    expect(lab.b).toBeCloseTo(67.2, 0)
  })

  it('round-trips a grid of sRGB colours', () => {
    for (const r of [0, 32, 64, 128, 200, 255]) {
      for (const g of [0, 32, 64, 128, 200, 255]) {
        for (const b of [0, 32, 64, 128, 200, 255]) {
          const back = labToRgb(rgbToLab({ r, g, b }))
          expect(Math.abs(back.r - r)).toBeLessThanOrEqual(1)
          expect(Math.abs(back.g - g)).toBeLessThanOrEqual(1)
          expect(Math.abs(back.b - b)).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe('OKLCH', () => {
  it('caps intensity at the sRGB boundary, well below the old slider max', () => {
    const yellow = rgbToOklch({ r: 255, g: 255, b: 0 })
    const limit = maxOklchChroma(yellow.l, yellow.h)
    expect(limit).toBeGreaterThan(0.05)
    expect(limit).toBeLessThan(0.25)
    expect(oklchToRgb({ l: yellow.l, c: limit, h: yellow.h }).g).toBeGreaterThan(200)
  })

  it('round-trips a grid of sRGB colours', () => {
    for (const r of [0, 40, 120, 200, 255]) {
      for (const g of [0, 40, 120, 200, 255]) {
        for (const b of [0, 40, 120, 200, 255]) {
          const back = oklchToRgb(rgbToOklch({ r, g, b }))
          expect(Math.abs(back.r - r)).toBeLessThanOrEqual(1)
          expect(Math.abs(back.g - g)).toBeLessThanOrEqual(1)
          expect(Math.abs(back.b - b)).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe('NCS estimate', () => {
  const notation = /^S \d{4}-(N|[YRGB]|[YRGB]\d{2}[YRGB])$/

  it('keeps the nuance triangle closed', () => {
    const samples = [
      { r: 255, g: 255, b: 255 },
      { r: 0, g: 0, b: 0 },
      { r: 128, g: 128, b: 128 },
      { r: 255, g: 0, b: 0 },
      { r: 255, g: 255, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
      { r: 180, g: 90, b: 40 },
      { r: 20, g: 40, b: 80 },
    ]
    for (const rgb of samples) {
      const ncs = rgbToNcs(rgb)
      expect(ncs.blackness + ncs.chromaticness + ncs.whiteness).toBe(100)
      expect(ncs.precise).toMatch(notation)
      expect(ncs.nearest).toMatch(notation)
    }
  })

  it('names the neutrals and the elementary directions', () => {
    expect(rgbToNcs({ r: 255, g: 255, b: 255 }).precise).toBe('S 0000-N')
    expect(rgbToNcs({ r: 0, g: 0, b: 0 }).precise).toBe('S 9900-N')

    const red = rgbToNcs({ r: 255, g: 0, b: 0 })
    expect(red.precise).toMatch(/Y\d{2}R$/)
    expect(red.chromaticness).toBeGreaterThan(70)
    expect(red.blackness).toBeLessThan(20)

    const yellow = rgbToNcs({ r: 255, g: 255, b: 0 })
    expect(yellow.precise).toMatch(/Y$|G\d{2}Y$/)
    expect(yellow.blackness).toBeLessThan(20)

    expect(rgbToNcs({ r: 0, g: 255, b: 0 }).precise).toContain('G')
    const blue = rgbToNcs({ r: 0, g: 0, b: 255 })
    expect(blue.precise).toContain('B')
    expect(blue.blackness).toBeGreaterThanOrEqual(20)
  })

  it('reads a light yellow from the pixels instead of calling an olive that code', () => {
    const published = rgbToNcs({ r: 252, g: 200, b: 104 })
    expect(published.hueLabel).toMatch(/^Y1[0-5]R$/)
    expect(published.blackness).toBeLessThan(15)
    expect(published.chromaticness).toBeGreaterThanOrEqual(40)
    expect(published.chromaticness).toBeLessThanOrEqual(60)

    const lookedUp = rgbToNcs({ r: 239, g: 224, b: 90 })
    expect(lookedUp.blackness).toBeLessThan(15)
    expect(lookedUp.chromaticness).toBeGreaterThanOrEqual(45)
    expect(lookedUp.chromaticness).toBeLessThanOrEqual(65)
    expect(lookedUp.hueLabel).toMatch(/^(Y|G8\dY|G9\dY)$/)

    const olive = rgbToNcs({ r: 220, g: 179, b: 87 })
    expect(olive.precise).not.toBe('S 0050-Y10R')
    expect(olive.nearest).not.toBe('S 0050-Y10R')
    expect(olive.blackness).toBeGreaterThan(published.blackness)
  })
})

describe('helpers', () => {
  it('averages opaque pixels and ignores fully transparent ones', () => {
    const pixels = new Uint8ClampedArray([10, 20, 30, 255, 30, 40, 50, 255, 0, 0, 0, 0])
    expect(averageRgb(pixels)).toEqual({ r: 20, g: 30, b: 40 })
  })

  it('formats hex and a zero colour difference', () => {
    expect(rgbToHex({ r: 196, g: 72, b: 48 })).toBe('#C44830')
    expect(deltaE({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 })).toBe(0)
  })
})
