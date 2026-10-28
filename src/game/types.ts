// ── Shared game types ────────────────────────────────────────────────────────

export interface Vec2 { x: number; y: number }

export type WeaponId = 'kunai' | 'guardian' | 'molotov' | 'lightning' | 'rpg' | 'katana'
export type PassiveId = 'scroll' | 'exo' | 'oil' | 'drink' | 'he' | 'fitness' | 'shoes'

export type EnemyKind = 'zombie' | 'sprinter' | 'fatty' | 'thrower' | 'spiker' | 'bomber' | 'ghost' | 'boss'
export type BossArchetype = 'charger' | 'spitter'

export interface OwnedWeapon {
  id: WeaponId
  level: number
  evo: boolean
  cdT: number
  burst: number        // staggered shots remaining
  // guardian
  up: boolean
  phase: number
  bladeA: number
}

export interface OwnedPassive { id: PassiveId; level: number }

export interface Player {
  x: number; y: number; vx: number; vy: number
  hp: number; maxHp: number
  level: number; xp: number; xpNeed: number
  facing: number; moving: boolean; bob: number
  iframes: number; magnetR: number
  weapons: OwnedWeapon[]
  passives: OwnedPassive[]
  // derived
  dmgMul: number; xpMul: number; cdr: number; armor: number; regen: number; spdMul: number
  critC: number; critM: number
  baseSpeed: number
}

export interface Enemy {
  id: number; kind: EnemyKind
  x: number; y: number
  hp: number; maxHp: number
  speed: number; dmg: number; radius: number
  xpVal: number; elite: boolean; boss: boolean
  archetype: BossArchetype | null
  kbX: number; kbY: number
  flash: number; hitCd: number; zoneTick: number
  attackT: number
  telegraph: number; dashT: number; dashX: number; dashY: number
  wob: number
}

export interface Gem { id: number; x: number; y: number; value: number; tier: number; magnet: boolean; vx: number; vy: number; ph: number }
export interface Item { id: number; kind: 'meat' | 'magnet' | 'bomb' | 'chest'; x: number; y: number; ph: number }

export type ProjectileKind = 'kunai' | 'shuriken' | 'molotov' | 'rocket' | 'wave' | 'cleaver' | 'orb'
export interface Projectile {
  id: number; kind: ProjectileKind
  x: number; y: number; vx: number; vy: number
  sx: number; sy: number; tx: number; ty: number; t: number; dur: number
  dmg: number; radius: number; aoe: number; knock: number
  pierce: number; life: number; spin: number; ret: boolean
  fromEnemy: boolean; hitIds: Set<number>
}

export interface Zone { id: number; x: number; y: number; radius: number; life: number; maxLife: number; dmg: number; tick: number; kind: 'fire' | 'shock' }
export interface Bolt { id: number; pts: number[]; life: number; maxLife: number; x: number; y: number }
export interface Slash { id: number; x: number; y: number; angle: number; arc: number; range: number; life: number; maxLife: number; color: string }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number; grav: number }
export interface FloatText { x: number; y: number; life: number; maxLife: number; text: string; color: string; size: number }

export interface World {
  time: number; kills: number
  player: Player
  enemies: Enemy[]; gems: Gem[]; items: Item[]; projectiles: Projectile[]
  zones: Zone[]; bolts: Bolt[]; slashes: Slash[]; parts: Particle[]; texts: FloatText[]
  cam: { x: number; y: number }; shake: number
  bossId: number | null; bossName: string
  nextBoss: number; nextElite: number; nextRush: number; bossCount: number; bossWarned: boolean
  pendingLevels: number; over: boolean
  dmgByWeapon: Record<string, number>
  spawnT: number; hurtFlash: number; levelFlash: number; bombFlash: number
  combo: number; comboT: number; gemsGot: number
}

// ── Offers / stats ───────────────────────────────────────────────────────────

export type OfferKind = 'weapon' | 'passive' | 'evolve' | 'heal' | 'bombitem' | 'magnetitem'
export interface Offer { kind: OfferKind; id: string; toLevel: number }

export interface DmgRow { id: string; name: string; color: string; amount: number; share: number }
export interface RunStats { time: number; kills: number; level: number; gems: number; dmg: DmgRow[]; victory: boolean }

export interface BossHud { name: string; hp: number; maxHp: number }
export interface SkillHud { id: string; level: number; evo: boolean }
export interface Hud {
  hp: number; maxHp: number; xp: number; xpNeed: number; level: number
  kills: number; time: number
  boss: BossHud | null
  weapons: SkillHud[]; passives: SkillHud[]
}

export interface EngineHooks {
  onLevelUp: (offers: Offer[]) => void
  onChest: (offers: Offer[]) => void
  onOver: (stats: RunStats) => void
  onBanner: (text: string, kind: 'warn' | 'info' | 'good') => void
  onPause: (paused: boolean) => void
}
