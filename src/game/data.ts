// ── Static balance data + UI meta ────────────────────────────────────────────
import {
  Navigation, Fan, Orbit, Tornado, Flame, Fuel, Zap, CloudLightning, Rocket, Crosshair,
  Sword, Sparkles, Scroll, Shield, Droplet, CupSoda, Timer, HeartPulse, Footprints,
  Heart, Bomb, Magnet,
  type LucideIcon,
} from 'lucide-react'
import type { WeaponId, PassiveId, EnemyKind } from './types'

// ── Numeric tables (index 0 = level 1 … 4 = level 5) ─────────────────────────

export interface WeaponTab {
  cd: number[]
  dmg: number[]
  count: number[]
  evoCd: number
  evoDmg: number
  evoCount: number
}

export const WTAB: Record<WeaponId, WeaponTab> = {
  kunai:     { cd: [1.2, 1.2, 1.15, 1.1, 1.05], dmg: [14, 18, 23, 28, 35], count: [1, 2, 3, 3, 4], evoCd: 0.9, evoDmg: 42, evoCount: 5 },
  guardian:  { cd: [1.5, 1.4, 1.3, 1.2, 1.1], dmg: [13, 17, 21, 26, 32], count: [2, 3, 3, 4, 5], evoCd: 0.5, evoDmg: 40, evoCount: 6 },
  molotov:   { cd: [2.6, 2.5, 2.4, 2.3, 2.2], dmg: [9, 11, 14, 17, 21], count: [1, 1, 2, 2, 3], evoCd: 1.7, evoDmg: 28, evoCount: 4 },
  lightning: { cd: [1.9, 1.8, 1.7, 1.6, 1.5], dmg: [26, 32, 40, 48, 58], count: [1, 2, 2, 3, 4], evoCd: 1.1, evoDmg: 72, evoCount: 8 },
  rpg:       { cd: [2.3, 2.1, 1.9, 1.7, 1.5], dmg: [32, 40, 50, 60, 74], count: [1, 1, 1, 1, 1], evoCd: 1.3, evoDmg: 105, evoCount: 2 },
  katana:    { cd: [1.15, 1.05, 0.95, 0.85, 0.75], dmg: [28, 34, 42, 52, 66], count: [1, 1, 1, 1, 1], evoCd: 0.66, evoDmg: 88, evoCount: 1 },
}

export const PTAB: Record<PassiveId, number> = {
  scroll: 0.10,   // +10% xp / lvl
  exo: 2,         // -2 dmg taken / lvl
  oil: 0.10,      // +10% dmg / lvl
  drink: 1,       // +1 hp/s / lvl
  he: 0.09,       // +9% attack speed / lvl
  fitness: 20,    // +20 max hp / lvl
  shoes: 0.08,    // +8% speed / lvl
}

// ── Meta (names, icons, colors, evolution pairings) ──────────────────────────

export interface SkillMeta {
  name: string
  evoName?: string
  icon: LucideIcon
  evoIcon?: LucideIcon
  color: string
  req?: PassiveId        // passive required to evolve
  iconRotate?: boolean   // rotate icon -45deg (kunai arrow)
}

export const WEAPON_META: Record<WeaponId, SkillMeta> = {
  kunai:     { name: 'Kunai',             evoName: 'Spirit Shuriken', icon: Navigation,      evoIcon: Fan,            color: '#f472b6', req: 'scroll', iconRotate: true },
  guardian:  { name: 'Guardian',          evoName: 'Blade Halo',      icon: Orbit,           evoIcon: Tornado,        color: '#facc15', req: 'exo' },
  molotov:   { name: 'Molotov',           evoName: 'Fuel Barrel',     icon: Flame,           evoIcon: Fuel,           color: '#fb923c', req: 'oil' },
  lightning: { name: 'Lightning Emitter', evoName: 'Supercell',       icon: Zap,             evoIcon: CloudLightning, color: '#38bdf8', req: 'drink' },
  rpg:       { name: 'RPG Launcher',      evoName: 'Sharkmaw Gun',    icon: Rocket,          evoIcon: Crosshair,      color: '#a78bfa', req: 'he' },
  katana:    { name: 'Katana',            evoName: 'Demon Blade',     icon: Sword,           evoIcon: Sparkles,       color: '#4ade80', req: 'fitness' },
}

export const PASSIVE_META: Record<PassiveId, SkillMeta> = {
  scroll:  { name: 'Koga Ninja Scroll', icon: Scroll,     color: '#fbbf24' },
  exo:     { name: 'Exo Bracer',        icon: Shield,     color: '#94a3b8' },
  oil:     { name: 'Oil Bond',          icon: Droplet,    color: '#f97316' },
  drink:   { name: 'Energy Drink',      icon: CupSoda,    color: '#2dd4bf' },
  he:      { name: 'HE Fuel',           icon: Timer,      color: '#60a5fa' },
  fitness: { name: 'Fitness Guide',     icon: HeartPulse, color: '#fb7185' },
  shoes:   { name: 'Sports Shoes',      icon: Footprints, color: '#a3e635' },
}

export const CONSUMABLE_META: Record<string, SkillMeta> = {
  heal:       { name: 'Emergency Patch', icon: Heart,  color: '#f87171' },
  bombitem:   { name: 'Tactical Bomb',   icon: Bomb,   color: '#e2e8f0' },
  magnetitem: { name: 'Power Magnet',    icon: Magnet, color: '#f43f5e' },
}

export const WEAPON_IDS = Object.keys(WEAPON_META) as WeaponId[]
export const PASSIVE_IDS = Object.keys(PASSIVE_META) as PassiveId[]

// ── Card descriptions ────────────────────────────────────────────────────────

export function weaponBullets(id: WeaponId, lvl: number, evo: boolean): string[] {
  const t = WTAB[id]
  if (evo) {
    switch (id) {
      case 'kunai':     return [`Hurls ${t.evoCount} returning spirit shurikens`, `${t.evoDmg} dmg • piercing • boomerang`]
      case 'guardian':  return [`${t.evoCount} titan blades orbit almost non-stop`, `${t.evoDmg} dmg per hit • huge knockback`]
      case 'molotov':   return [`Lobs ${t.evoCount} fuel barrels that flood the field`, `${t.evoDmg} burn dmg • massive fire zones`]
      case 'lightning': return [`${t.evoCount} supercell bolts strike everywhere`, `${t.evoDmg} dmg • chains between enemies`]
      case 'rpg':       return [`Fires ${t.evoCount} twin homing rockets`, `${t.evoDmg} dmg • colossal explosion`]
      case 'katana':    return [`Front AND back slashes + flying blade waves`, `${t.evoDmg} dmg • wave pierces everything`]
    }
  }
  const i = lvl - 1
  switch (id) {
    case 'kunai':     return [`Fires ${t.count[i]} kunai at the nearest enemies`, `${t.dmg[i]} damage per hit`]
    case 'guardian':  return [`${t.count[i]} spinning tops orbit you`, `${t.dmg[i]} damage per hit • knockback`]
    case 'molotov':   return [`Throws ${t.count[i]} molotov${t.count[i] > 1 ? 's' : ''} at nearby enemies`, `${t.dmg[i]} burn damage per tick`]
    case 'lightning': return [`${t.count[i]} lightning bolt${t.count[i] > 1 ? 's' : ''} zap random enemies`, `${t.dmg[i]} dmg • chains 50%`]
    case 'rpg':       return [`Fires a homing rocket`, `${t.dmg[i]} dmg • area explosion`]
    case 'katana':    return [`Slashes toward the nearest enemy`, `${t.dmg[i]} dmg • wide arc • knockback`]
  }
}

export function passiveBullet(id: PassiveId, lvl: number): string {
  const v = PTAB[id]
  switch (id) {
    case 'scroll':  return `EXP gain +${Math.round(v * 100)}% (total +${Math.round(v * lvl * 100)}%)`
    case 'exo':     return `Damage taken -${v} (total -${v * lvl})`
    case 'oil':     return `All damage +${Math.round(v * 100)}% (total +${Math.round(v * lvl * 100)}%)`
    case 'drink':   return `Recover ${v} HP/s (total ${v * lvl} HP/s)`
    case 'he':      return `Attack speed +${Math.round(v * 100)}% (total +${Math.round(v * lvl * 100)}%)`
    case 'fitness': return `Max HP +${v} (total +${v * lvl})`
    case 'shoes':   return `Move speed +${Math.round(v * 100)}% (total +${Math.round(v * lvl * 100)}%)`
  }
}

export function consumableBullet(id: string): string {
  switch (id) {
    case 'heal': return 'Instantly restore 30% of max HP'
    case 'bombitem': return 'Detonate every enemy on screen'
    default: return 'Vacuum every EXP gem on the field'
  }
}

// ── Enemies ──────────────────────────────────────────────────────────────────

export interface EnemyDef {
  hp: number; speed: number; dmg: number; radius: number; xp: number
  body: string; dark: string; belly?: string
}

export const ENEMY_DEFS: Record<Exclude<EnemyKind, 'boss'>, EnemyDef> = {
  // Bigger, chunkier monsters — each with its own silhouette & palette
  zombie:   { hp: 22,  speed: 66,  dmg: 11, radius: 24, xp: 1, body: '#6c9a46', dark: '#3f5f27' },
  sprinter: { hp: 16,  speed: 150, dmg: 8,  radius: 20, xp: 1, body: '#c2d94c', dark: '#76892a' },
  fatty:    { hp: 100, speed: 46,  dmg: 20, radius: 34, xp: 5, body: '#4a7a52', dark: '#2a4a31' },
  thrower:  { hp: 52,  speed: 62,  dmg: 13, radius: 26, xp: 5, body: '#8b7bb0', dark: '#4e4473' },
  spiker:   { hp: 72,  speed: 84,  dmg: 16, radius: 27, xp: 4, body: '#3f8f9c', dark: '#1f5a66' },
  bomber:   { hp: 44,  speed: 96,  dmg: 14, radius: 25, xp: 4, body: '#d97757', dark: '#8c3f28' },
  ghost:    { hp: 38,  speed: 112, dmg: 12, radius: 23, xp: 3, body: '#cfd8e8', dark: '#7b8aa6' },
}

export const ENEMY_LABEL: Record<Exclude<EnemyKind, 'boss'>, string> = {
  zombie: 'Shambler', sprinter: 'Runner', fatty: 'Brute', thrower: 'Hurler',
  spiker: 'Spiker', bomber: 'Bomber', ghost: 'Wraith',
}

export const BOSS_NAMES = ['Zombie King', 'The Butcher', 'Bone Crusher', 'Ghoul Lord', 'Wretch King', 'The Devourer']

// ── Difficulty curves ────────────────────────────────────────────────────────

export const hpMul = (t: number) => 1 + t * 0.012 + Math.pow(t / 320, 2) * 1.25
export const dmgMulT = (t: number) => 1 + t / 300
export const spdMulT = (t: number) => 1 + Math.min(0.55, t / 650)
export const spawnInterval = (t: number) => Math.max(0.07, 0.9 - t * 0.0022)
export const spawnBatch = (t: number) => 1 + Math.floor(t / 100)
// Steeper EXP curve — power-ups get noticeably slower to earn as levels climb
export const xpNeed = (level: number) => Math.round(7 + 4.5 * level + Math.pow(1.3, level))

export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export const fmtNum = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`
  return `${Math.round(n)}`
}
