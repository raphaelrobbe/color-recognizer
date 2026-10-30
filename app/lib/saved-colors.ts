const STORAGE_KEY = 'color-recognizer.colors'

export type SavedColor = {
  id: string
  name: string
  r: number
  g: number
  b: number
}

function isByte(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255
}

export function parseSavedColors(raw: string | null): SavedColor[] {
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const entry = item as Record<string, unknown>
      if (typeof entry.id !== 'string' || typeof entry.name !== 'string') return []
      if (!isByte(entry.r) || !isByte(entry.g) || !isByte(entry.b)) return []
      const name = entry.name.trim()
      if (!name) return []
      return [{ id: entry.id, name, r: entry.r, g: entry.g, b: entry.b }]
    })
  } catch {
    return []
  }
}

export function loadSavedColors(): SavedColor[] {
  if (typeof localStorage === 'undefined') return []
  try {
    return parseSavedColors(localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

export function storeSavedColors(colors: SavedColor[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors))
}
