// ── Local leaderboard (stored on this device) ────────────────────────────────
// ONE entry per user: a player name can appear on the board only once.
// Re-running with the same name overwrites that user's entry when the new run
// is better (longer survival, then more kills).
import type { HouseId } from './houses'
import { DEFAULT_HOUSE } from './houses'

export interface LBEntry {
  name: string
  house: HouseId
  time: number   // seconds survived
  kills: number
  level: number
  date: number
}

const KEY = 'sv_leaderboard'
export const NAME_KEY = 'sv_name'
export const HOUSE_KEY = 'sv_house'
export const MUTE_KEY = 'sv_muted'
const MAX_ENTRIES = 50

const normalize = (n: string) => n.trim().toLowerCase()
const isBetter = (a: { time: number; kills: number }, b: { time: number; kills: number }) =>
  a.time > b.time || (a.time === b.time && a.kills > b.kills)

function sortEntries(list: LBEntry[]): LBEntry[] {
  return list.sort((a, b) => (b.time - a.time) || (b.kills - a.kills))
}

/** Collapses any duplicate names down to each user's single best run. */
function dedupe(list: LBEntry[]): LBEntry[] {
  const best = new Map<string, LBEntry>()
  for (const e of list) {
    if (!e || typeof e.time !== 'number' || typeof e.name !== 'string') continue
    const key = normalize(e.name)
    if (!key) continue
    const cur = best.get(key)
    if (!cur || isBetter(e, cur)) best.set(key, e)
  }
  return sortEntries([...best.values()])
}

export function loadBoard(): LBEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return dedupe(parsed as LBEntry[])
  } catch {
    return []
  }
}

export interface SaveResult {
  rank: number | null      // 1-based position on the board
  improved: boolean        // did this run beat the user's previous best?
  previousBest: number     // their old time (0 if first run)
}

/** Saves a run under a unique name. Returns rank + whether it was a personal best. */
export function saveRun(entry: Omit<LBEntry, 'date'>): SaveResult {
  try {
    const list = loadBoard()
    const key = normalize(entry.name)
    const existing = list.find(e => normalize(e.name) === key)
    const previousBest = existing?.time ?? 0

    // Keep only this user's best run — never two rows for one name.
    if (existing && !isBetter(entry, existing)) {
      const rank = list.findIndex(e => normalize(e.name) === key) + 1
      return { rank: rank || null, improved: false, previousBest }
    }

    const fresh: LBEntry = { ...entry, house: entry.house ?? DEFAULT_HOUSE, date: Date.now() }
    const next = dedupe([...list.filter(e => normalize(e.name) !== key), fresh]).slice(0, MAX_ENTRIES)
    localStorage.setItem(KEY, JSON.stringify(next))

    const rank = next.findIndex(e => normalize(e.name) === key) + 1
    return { rank: rank || null, improved: true, previousBest }
  } catch {
    return { rank: null, improved: false, previousBest: 0 }
  }
}

export function loadName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' }
}

export function saveName(name: string) {
  try { localStorage.setItem(NAME_KEY, name.slice(0, 14)) } catch { /* noop */ }
}

export function loadHouse(): HouseId {
  try { return (localStorage.getItem(HOUSE_KEY) as HouseId) || DEFAULT_HOUSE } catch { return DEFAULT_HOUSE }
}

export function saveHouse(house: HouseId) {
  try { localStorage.setItem(HOUSE_KEY, house) } catch { /* noop */ }
}
