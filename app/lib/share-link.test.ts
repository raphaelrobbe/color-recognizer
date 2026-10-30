import { describe, expect, it } from 'vitest'
import { colorShareUrl, rgbFromSearch } from './share-link'

const yellow = { r: 226, g: 177, b: 59 }

describe('color share link', () => {
  it('builds a link that reopens the shown color', () => {
    expect(colorShareUrl(yellow)).toBe('https://raphaelrobbe.github.io/color-recognizer/?c=e2b13b')
    expect(rgbFromSearch('?c=e2b13b')).toEqual(yellow)
    expect(rgbFromSearch('?c=E2B13B')).toEqual(yellow)
  })

  it('ignores a missing or broken color', () => {
    expect(rgbFromSearch('')).toBeNull()
    expect(rgbFromSearch('?c=zz')).toBeNull()
    expect(rgbFromSearch('?c=e2b13')).toBeNull()
  })
})
