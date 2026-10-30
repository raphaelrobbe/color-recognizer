import { describe, expect, it } from 'vitest'
import { parseSavedColors } from './saved-colors'

describe('parseSavedColors', () => {
  it('keeps valid named colors and drops the rest', () => {
    const raw = JSON.stringify([
      { id: 'a', name: '  Terracotta  ', r: 196, g: 72, b: 48 },
      { id: 'b', name: '   ', r: 1, g: 2, b: 3 },
      { id: 'c', name: 'Bleu', r: 1.5, g: 2, b: 3 },
      { name: 'Sans id', r: 0, g: 0, b: 0 },
    ])
    expect(parseSavedColors(raw)).toEqual([{ id: 'a', name: 'Terracotta', r: 196, g: 72, b: 48 }])
  })

  it('returns an empty list for unreadable storage', () => {
    expect(parseSavedColors(null)).toEqual([])
    expect(parseSavedColors('pas du json')).toEqual([])
    expect(parseSavedColors('{"id":"a"}')).toEqual([])
  })
})
