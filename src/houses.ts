// ── School houses ────────────────────────────────────────────────────────────
// Human International School — 8 competing houses.
// Colors here drive every house visual in the UI (chips, borders, badges).

export type HouseId = 'TSA' | 'YANG' | 'KHANT' | 'IRVE' | 'TSEN' | 'BUHU' | 'MAZA' | 'HAWT'

export interface House {
  id: HouseId
  name: string
  color: string       // main house color
  text: string        // readable text color on top of `color`
  note: string        // short color description
}

export const HOUSES: House[] = [
  { id: 'TSA',   name: 'TSA',   color: '#808080', text: '#1f2937', note: 'Grey' },
  { id: 'YANG',  name: 'YANG',  color: '#F15A24', text: '#ffffff', note: 'Orange' },
  { id: 'KHANT', name: 'KHANT', color: '#3B86C4', text: '#ffffff', note: 'Deep Blue' },
  { id: 'IRVE',  name: 'IRVE',  color: '#29BCB9', text: '#0b2a3a', note: 'Light Blue' },
  { id: 'TSEN',  name: 'TSEN',  color: '#BB80BB', text: '#ffffff', note: 'Purple' },
  { id: 'BUHU',  name: 'BUHU',  color: '#749D52', text: '#06310f', note: 'Green' },
  { id: 'MAZA',  name: 'MAZA',  color: '#9E3345', text: '#ffffff', note: 'Red' },
  { id: 'HAWT',  name: 'HAWT',  color: '#B58763', text: '#3b3123', note: 'RAL 1011 Beige' },
]

export const HOUSE_MAP: Record<HouseId, House> = HOUSES.reduce((acc, h) => {
  acc[h.id] = h
  return acc
}, {} as Record<HouseId, House>)

export const DEFAULT_HOUSE: HouseId = 'TSA'

export function getHouse(id: string | undefined | null): House {
  return HOUSE_MAP[(id as HouseId)] ?? HOUSE_MAP[DEFAULT_HOUSE]
}
