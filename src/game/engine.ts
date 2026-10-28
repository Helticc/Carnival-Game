// ── Core game engine: world state, update loop, combat, progression ─────────
import type {
  World, Enemy, Item,
  OwnedWeapon, WeaponId, PassiveId, EngineHooks, Offer, RunStats, Hud, Vec2, EnemyKind, DmgRow,
} from './types'
import {
  WTAB, PTAB, WEAPON_META, ENEMY_DEFS, BOSS_NAMES, CONSUMABLE_META,
  WEAPON_IDS, PASSIVE_IDS, hpMul, dmgMulT, spdMulT, spawnInterval, spawnBatch, xpNeed,
} from './data'
import { drawWorld } from './render'
import { Sfx } from './audio'

let nextId = 1
const TAU = Math.PI * 2
const rand = (a: number, b: number) => a + Math.random() * (b - a)

interface EnemyEx extends Enemy { summonT: number; hitCd2: number; patternA: number }

function freshWorld(): World {
  return {
    time: 0, kills: 0,
    player: {
      x: 0, y: 0, vx: 0, vy: 0,
      hp: 100, maxHp: 100,
      level: 1, xp: 0, xpNeed: xpNeed(1),
      facing: -Math.PI / 2, moving: false, bob: 0,
      iframes: 0, magnetR: 100,
      weapons: [], passives: [],
      dmgMul: 1, xpMul: 1, cdr: 1, armor: 0, regen: 0, spdMul: 1,
      critC: 0.05, critM: 1.6, baseSpeed: 225,
    },
    enemies: [], gems: [], items: [], projectiles: [],
    zones: [], bolts: [], slashes: [], parts: [], texts: [],
    cam: { x: 0, y: 0 }, shake: 0,
    bossId: null, bossName: '',
    nextBoss: 90, nextElite: 60, nextRush: 32, bossCount: 0, bossWarned: false,
    pendingLevels: 0, over: false,
    dmgByWeapon: {}, spawnT: 0, hurtFlash: 0, levelFlash: 0, bombFlash: 0,
    combo: 0, comboT: 0, gemsGot: 0,
  }
}

export class Engine {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  hooks: EngineHooks
  sfx = new Sfx()
  world: World = freshWorld()
  paused = true
  modalOpen = false
  disposed = false
  vw = 0; vh = 0
  private raf = 0
  private last = 0
  private keys = new Set<string>()
  private touch: Vec2 | null = null
  private hash = new Map<string, EnemyEx[]>()
  private hashFrame = -1
  private resizeHandler = () => this.resize()
  private keyDownHandler = (e: KeyboardEvent) => this.onKey(e, true)
  private keyUpHandler = (e: KeyboardEvent) => this.onKey(e, false)
  private visHandler = () => {
    if (document.hidden && !this.paused && !this.world.over && !this.modalOpen) this.setPaused(true)
  }

  constructor(canvas: HTMLCanvasElement, hooks: EngineHooks) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.hooks = hooks
    this.resize()
    window.addEventListener('resize', this.resizeHandler)
    window.addEventListener('keydown', this.keyDownHandler)
    window.addEventListener('keyup', this.keyUpHandler)
    document.addEventListener('visibilitychange', this.visHandler)
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.vw = window.innerWidth
    this.vh = window.innerHeight
    this.canvas.width = Math.floor(this.vw * dpr)
    this.canvas.height = Math.floor(this.vh * dpr)
    this.canvas.style.width = `${this.vw}px`
    this.canvas.style.height = `${this.vh}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  start() {
    this.resetRun()
    this.paused = false
    this.last = performance.now()
    const loop = (now: number) => {
      if (this.disposed) return
      const dt = Math.min(0.04, Math.max(0, (now - this.last) / 1000))
      this.last = now
      if (!this.paused) {
        this.update(dt)
        drawWorld(this.ctx, this.world, this.vw, this.vh)
      }
      if (!this.disposed) this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
    this.hooks.onBanner('Survive as long as you can!', 'info')
  }

  resetRun() {
    this.world = freshWorld()
    this.world.cam.x = -this.vw / 2
    this.world.cam.y = -this.vh / 2
    this.modalOpen = false
    this.paused = false
    this.last = performance.now()
    this.hooks.onPause(false)
    // starter weapon
    this.world.player.weapons.push({ id: 'kunai', level: 1, evo: false, cdT: 0.4, burst: 0, up: true, phase: 0, bladeA: 0 })
    this.recompute()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.resizeHandler)
    window.removeEventListener('keydown', this.keyDownHandler)
    window.removeEventListener('keyup', this.keyUpHandler)
    document.removeEventListener('visibilitychange', this.visHandler)
  }

  setPaused(v: boolean) {
    if (this.world.over) return
    this.paused = v
    this.last = performance.now()
    this.hooks.onPause(v)
  }

  setTouch(v: Vec2 | null) { this.touch = v }

  private onKey(e: KeyboardEvent, down: boolean) {
    const k = e.code
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault()
    this.sfx.ensure()
    if (down) this.keys.add(k); else this.keys.delete(k)
  }

  // ── input ──────────────────────────────────────────────────────────────────
  private inputVec(): Vec2 {
    if (this.touch) return this.touch
    let x = 0, y = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1
    if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l } }
    return { x: 0, y: 0 }
  }

  // ── derived stats ──────────────────────────────────────────────────────────
  recompute() {
    const p = this.world.player
    const pl = (id: PassiveId) => p.passives.find(q => q.id === id)?.level ?? 0
    const oldMax = p.maxHp
    p.xpMul = 1 + PTAB.scroll * pl('scroll')
    p.armor = PTAB.exo * pl('exo')
    p.dmgMul = 1 + PTAB.oil * pl('oil')
    p.regen = PTAB.drink * pl('drink')
    p.cdr = 1 / (1 + PTAB.he * pl('he'))
    p.maxHp = 100 + PTAB.fitness * pl('fitness')
    p.spdMul = 1 + PTAB.shoes * pl('shoes')
    if (p.maxHp > oldMax) p.hp += p.maxHp - oldMax
    p.hp = Math.min(p.hp, p.maxHp)
  }

  // ── offers / progression ───────────────────────────────────────────────────
  makeOffers(): Offer[] {
    const p = this.world.player
    const out: Offer[] = []
    const seen = new Set<string>()
    const push = (o: Offer) => { const k = `${o.kind}:${o.id}`; if (!seen.has(k)) { seen.add(k); out.push(o) } }

    // evolutions first (max 1)
    for (const w of p.weapons) {
      if (w.level >= 5 && !w.evo && out.length === 0) {
        const req = WEAPON_META[w.id].req!
        if (p.passives.some(pp => pp.id === req)) push({ kind: 'evolve', id: w.id, toLevel: 5 })
      }
    }
    const bucket: Offer[] = []
    const wewWeapons = p.weapons.filter(w => !w.evo && w.level < 5)
    for (const w of wewWeapons) bucket.push({ kind: 'weapon', id: w.id, toLevel: w.level + 1 })
    if (p.weapons.length < 6) for (const id of WEAPON_IDS) if (!p.weapons.some(w => w.id === id)) bucket.push({ kind: 'weapon', id, toLevel: 1 })
    for (const pp of p.passives.filter(x => x.level < 5)) bucket.push({ kind: 'passive', id: pp.id, toLevel: pp.level + 1 })
    if (p.passives.length < 6) for (const id of PASSIVE_IDS) if (!p.passives.some(x => x.id === id)) bucket.push({ kind: 'passive', id, toLevel: 1 })

    // shuffle
    for (let i = bucket.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = bucket[i]; bucket[i] = bucket[j]; bucket[j] = tmp
    }
    for (const o of bucket) { if (out.length >= 3) break; push(o) }
    const cons: Offer['kind'][] = ['heal', 'magnetitem', 'bombitem']
    let ci = 0
    while (out.length < 3 && ci < 6) { push({ kind: cons[ci % 3], id: cons[ci % 3], toLevel: 0 }); ci++ }
    return out
  }

  private openLevelModal() {
    this.world.pendingLevels--
    this.modalOpen = true
    this.paused = true
    this.world.levelFlash = 1
    this.sfx.levelup()
    this.ringBurst(this.world.player.x, this.world.player.y, '#22d3ee', 16, 180)
    this.hooks.onLevelUp(this.makeOffers())
  }

  private openChestModal() {
    this.modalOpen = true
    this.paused = true
    this.sfx.chest()
    this.hooks.onChest(this.makeOffers())
  }

  applyUpgrade(o: Offer) {
    const p = this.world.player
    if (o.kind === 'weapon' || o.kind === 'evolve') {
      const id = o.id as WeaponId
      let w = p.weapons.find(x => x.id === id)
      if (!w) { w = { id, level: 0, evo: false, cdT: 0.15, burst: 0, up: true, phase: 0, bladeA: rand(0, TAU) }; p.weapons.push(w) }
      if (o.kind === 'evolve') {
        w.evo = true
        this.sfx.evolve()
        this.hooks.onBanner(`EVOLVED: ${WEAPON_META[id].evoName}!`, 'good')
        this.ringBurst(p.x, p.y, WEAPON_META[id].color, 24, 260)
      } else {
        w.level = o.toLevel
      }
    } else if (o.kind === 'passive') {
      const id = o.id as PassiveId
      const ex = p.passives.find(x => x.id === id)
      if (ex) ex.level = o.toLevel
      else p.passives.push({ id, level: 1 })
    } else if (o.kind === 'heal') {
      this.healPlayer(p.maxHp * 0.3)
    } else if (o.kind === 'bombitem') {
      this.detonate()
    } else if (o.kind === 'magnetitem') {
      for (const g of this.world.gems) g.magnet = true
      this.sfx.magnetize()
    }
    this.recompute()
    this.sfx.ui()
    // close or chain
    if (this.world.pendingLevels > 0) {
      this.openLevelModal()
    } else {
      this.modalOpen = false
      this.paused = false
      this.last = performance.now()
    }
  }

  closeChest() {
    this.modalOpen = false
    this.paused = false
    this.last = performance.now()
  }

  // ── stats / hud ────────────────────────────────────────────────────────────
  getHud(): Hud {
    const p = this.world.player
    const boss = this.world.bossId !== null ? this.world.enemies.find(e => e.id === this.world.bossId) : null
    return {
      hp: Math.max(0, Math.ceil(p.hp)), maxHp: p.maxHp,
      xp: p.xp, xpNeed: p.xpNeed, level: p.level,
      kills: this.world.kills, time: this.world.time,
      boss: boss ? { name: this.world.bossName, hp: Math.max(0, boss.hp), maxHp: boss.maxHp } : null,
      weapons: p.weapons.map(w => ({ id: w.id, level: w.level, evo: w.evo })),
      passives: p.passives.map(w => ({ id: w.id, level: w.level, evo: false })),
    }
  }

  getStats(): RunStats {
    const dmgMap = this.world.dmgByWeapon
    const total = Object.values(dmgMap).reduce((a, b) => a + b, 0) || 1
    const dmg: DmgRow[] = Object.entries(dmgMap)
      .filter(([, v]) => v > 0)
      .map(([id, v]) => {
        const wid = id as WeaponId
        const meta = WEAPON_META[wid]
        return meta
          ? { id, name: meta.name, color: meta.color, amount: v, share: v / total }
          : { id, name: CONSUMABLE_META.bombitem.name, color: CONSUMABLE_META.bombitem.color, amount: v, share: v / total }
      })
      .sort((a, b) => b.amount - a.amount)
    return { time: this.world.time, kills: this.world.kills, level: this.world.player.level, gems: this.world.gemsGot, dmg, victory: false }
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  private addText(x: number, y: number, text: string, color: string, size: number) {
    const w = this.world
    if (w.texts.length > 90) w.texts.shift()
    w.texts.push({ x: x + rand(-4, 4), y: y - 10, life: 0.7, maxLife: 0.7, text, color, size })
  }

  private addParts(x: number, y: number, color: string, n: number, speed: number, size = 4, grav = 420) {
    const w = this.world
    for (let i = 0; i < n; i++) {
      if (w.parts.length > 450) break
      const a = rand(0, TAU), s = rand(speed * 0.3, speed)
      w.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - rand(30, 120), life: rand(0.3, 0.7), maxLife: 0.7, color, size: rand(size * 0.6, size * 1.4), grav })
    }
  }

  private ringBurst(x: number, y: number, color: string, n: number, speed: number) {
    const w = this.world
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU
      w.parts.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 0.5, maxLife: 0.5, color, size: 5, grav: 0 })
    }
  }

  private cellKey(x: number, y: number) { return `${(x / 60) | 0}:${(y / 60) | 0}` }

  private buildHash() {
    if (this.hashFrame === ((this.world.time * 1000) | 0)) return
    this.hashFrame = (this.world.time * 1000) | 0
    this.hash.clear()
    for (const e of this.world.enemies as EnemyEx[]) {
      if (e.hp <= 0) continue
      const k = this.cellKey(e.x, e.y)
      let arr = this.hash.get(k)
      if (!arr) { arr = []; this.hash.set(k, arr) }
      arr.push(e)
    }
  }

  private forEachEnemyNear(x: number, y: number, r: number, cb: (e: EnemyEx) => void) {
    const pad = r + 44 // account for big enemy radii stored by center cell
    const c0x = ((x - pad) / 60) | 0, c1x = ((x + pad) / 60) | 0
    const c0y = ((y - pad) / 60) | 0, c1y = ((y + pad) / 60) | 0
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const arr = this.hash.get(`${cx}:${cy}`)
        if (!arr) continue
        for (const e of arr) {
          if (e.hp <= 0) continue
          const dx = e.x - x, dy = e.y - y
          if (dx * dx + dy * dy <= (r + e.radius) * (r + e.radius)) cb(e)
        }
      }
    }
  }

  private nearestEnemies(n: number, range: number): EnemyEx[] {
    const p = this.world.player
    const out: { e: EnemyEx; d: number }[] = []
    const r2 = range * range
    for (const e of this.world.enemies as EnemyEx[]) {
      if (e.hp <= 0) continue
      const dx = e.x - p.x, dy = e.y - p.y
      const d = dx * dx + dy * dy
      if (d > r2) continue
      if (out.length < n) {
        out.push({ e, d })
        out.sort((a, b) => a.d - b.d)
      } else if (d < out[out.length - 1].d) {
        out[out.length - 1] = { e, d }
        out.sort((a, b) => a.d - b.d)
      }
    }
    return out.map(o => o.e)
  }

  private randomEnemies(n: number, range: number): EnemyEx[] {
    const p = this.world.player
    const near: EnemyEx[] = []
    const r2 = range * range
    for (const e of this.world.enemies as EnemyEx[]) {
      if (e.hp <= 0) continue
      const dx = e.x - p.x, dy = e.y - p.y
      if (dx * dx + dy * dy <= r2) near.push(e)
    }
    const out: EnemyEx[] = []
    for (let i = 0; i < n && near.length; i++) {
      out.push(near.splice(Math.floor(Math.random() * near.length), 1)[0])
    }
    return out
  }

  // ── damage & death ─────────────────────────────────────────────────────────
  damageEnemy(e: EnemyEx, amt: number, source: string, kbx = 0, kby = 0) {
    if (e.hp <= 0 || this.world.over) return
    const p = this.world.player
    let final = amt * p.dmgMul
    let crit = false
    if (Math.random() < p.critC) { final *= p.critM; crit = true }
    final = Math.max(1, Math.round(final))
    e.hp -= final
    this.world.dmgByWeapon[source] = (this.world.dmgByWeapon[source] || 0) + final
    const kbMul = e.boss ? 0.1 : e.elite ? 0.35 : 1
    e.kbX += kbx * kbMul
    e.kbY += kby * kbMul
    e.flash = 0.13
    this.addText(e.x, e.y - e.radius - 4, crit ? `${final}!` : `${final}`, crit ? '#fde047' : '#ffffff', crit ? 15 : 12)
    if (e.hp <= 0) this.killEnemy(e)
  }

  private spawnGem(x: number, y: number, value: number) {
    const w = this.world
    if (w.gems.length > 450) {
      const g = w.gems[(Math.random() * w.gems.length) | 0]
      g.value += value
      g.tier = g.value >= 20 ? 2 : g.value >= 5 ? 1 : 0
      return
    }
    const tier = value >= 20 ? 2 : value >= 5 ? 1 : 0
    const a = rand(0, TAU), d = rand(6, 26)
    w.gems.push({ id: nextId++, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, value, tier, magnet: false, vx: 0, vy: 0, ph: rand(0, TAU) })
  }

  private spawnItem(x: number, y: number, kind: Item['kind']) {
    this.world.items.push({ id: nextId++, kind, x: x + rand(-16, 16), y: y + rand(-16, 16), ph: rand(0, TAU) })
  }

  killEnemy(e: EnemyEx) {
    if (e.hp > 0) return // guard: only die once
    const w = this.world
    const def = e.boss ? { body: '#8c3e3e', dark: '#5c2626' } : ENEMY_DEFS[e.kind as Exclude<EnemyKind, 'boss'>]
    const idx = w.enemies.indexOf(e)
    if (idx >= 0) w.enemies.splice(idx, 1)
    w.kills++
    this.sfx.kill()

    // Bombers detonate where they fall and hurt the player too
    if (e.kind === 'bomber') {
      const R = 86
      this.sfx.boom()
      w.shake = Math.max(w.shake, 7)
      this.ringBurst(e.x, e.y, '#fb923c', 16, 230)
      this.addParts(e.x, e.y, '#f97316', 14, 220, 7)
      const victims: EnemyEx[] = []
      this.forEachEnemyNear(e.x, e.y, R, o => victims.push(o))
      for (const o of victims) this.damageEnemy(o, 26, 'bomber-blast')
      const pd = Math.hypot(w.player.x - e.x, w.player.y - e.y)
      if (pd < R && !w.over) this.hurtPlayer(e.dmg * 1.1, e.x, e.y)
      w.zones.push({ id: nextId++, x: e.x, y: e.y, radius: R * 0.72, life: 1.1, maxLife: 1.1, dmg: 6, tick: 0.3, kind: 'fire' })
    }
    this.addParts(e.x, e.y, def.body, e.boss ? 26 : e.elite ? 16 : 8, e.boss ? 260 : 160, e.boss ? 8 : 5)
    this.addParts(e.x, e.y, def.dark, 4, 120, 4)
    if (e.boss) {
      if (w.bossId === e.id) { w.bossId = null; w.bossName = '' }
      this.sfx.bigBoom()
      w.shake = Math.max(w.shake, 14)
      this.hooks.onBanner(`${w.bossName || 'Boss'} defeated!`, 'good')
      for (let i = 0; i < 24; i++) this.spawnGem(e.x + rand(-70, 70), e.y + rand(-70, 70), i % 3 === 0 ? 20 : 5)
      this.spawnItem(e.x, e.y, 'chest')
      this.spawnItem(e.x + 30, e.y, 'meat')
      this.spawnItem(e.x - 30, e.y, 'magnet')
    } else if (e.elite) {
      for (let i = 0; i < 6; i++) this.spawnGem(e.x + rand(-40, 40), e.y + rand(-40, 40), 10)
      this.spawnItem(e.x, e.y, 'chest')
    } else {
      if (Math.random() < 0.04) this.spawnItem(e.x, e.y, 'meat')
      else if (Math.random() < 0.012) this.spawnItem(e.x, e.y, 'bomb')
      else if (Math.random() < 0.012) this.spawnItem(e.x, e.y, 'magnet')
      this.spawnGem(e.x, e.y, e.xpVal)
    }
  }

  private healPlayer(amt: number) {
    const p = this.world.player
    p.hp = Math.min(p.maxHp, p.hp + amt)
    this.addText(p.x, p.y - 30, `+${Math.round(amt)}`, '#4ade80', 15)
    this.sfx.heal()
  }

  private hurtPlayer(amt: number, sx: number, sy: number) {
    const p = this.world.player
    if (p.iframes > 0 || this.world.over) return
    const dmg = Math.max(1, Math.round(amt * rand(0.94, 1.06) - p.armor))
    p.hp -= dmg
    p.iframes = 0.45
    const dx = p.x - sx, dy = p.y - sy
    const d = Math.hypot(dx, dy) || 1
    p.vx += (dx / d) * 240
    p.vy += (dy / d) * 240
    this.world.hurtFlash = 0.9
    this.world.shake = Math.max(this.world.shake, 7)
    this.sfx.hurt()
    this.addParts(p.x, p.y, '#f87171', 6, 150, 4)
    this.addText(p.x, p.y - 30, `-${dmg}`, '#f87171', 14)
    if (p.hp <= 0) {
      p.hp = 0
      this.world.over = true
      this.sfx.die()
      this.world.shake = 18
      this.addParts(p.x, p.y, '#f59e0b', 30, 240, 7)
      this.hooks.onOver(this.getStats())
    }
  }

  private detonate() {
    const w = this.world
    const p = w.player
    const R = Math.hypot(this.vw, this.vh) / 2 + 80
    w.bombFlash = 1
    w.shake = Math.max(w.shake, 16)
    this.sfx.bigBoom()
    const victims = (w.enemies as EnemyEx[]).filter(e => {
      const dx = e.x - p.x, dy = e.y - p.y
      return dx * dx + dy * dy <= R * R
    })
    for (const e of victims) {
      if (e.hp <= 0) continue
      this.ringBurst(e.x, e.y, '#fb923c', 6, 140)
      if (e.boss) this.damageEnemy(e, 500, 'bombitem')
      else { e.hp = 0; this.killEnemy(e) }
    }
    this.hooks.onBanner('BOOM! Screen cleared!', 'good')
  }

  // ── spawning ───────────────────────────────────────────────────────────────
  private spawnEnemy(kind: Exclude<EnemyKind, 'boss'>, x: number, y: number, elite = false) {
    const w = this.world
    const d = ENEMY_DEFS[kind]
    const hm = hpMul(w.time)
    const e: EnemyEx = {
      id: nextId++, kind,
      x, y,
      hp: d.hp * hm * (elite ? 8 : 1), maxHp: d.hp * hm * (elite ? 8 : 1),
      speed: d.speed * spdMulT(w.time) * rand(0.9, 1.1) * (elite ? 0.92 : 1),
      dmg: d.dmg * dmgMulT(w.time) * (elite ? 1.5 : 1),
      radius: d.radius * (elite ? 1.45 : 1),
      xpVal: d.xp * (elite ? 10 : 1),
      elite, boss: false, archetype: null,
      kbX: 0, kbY: 0, flash: 0, hitCd: 0, hitCd2: 0, zoneTick: 0,
      attackT: rand(1, 3), telegraph: 0, dashT: 0, dashX: 0, dashY: 0,
      wob: rand(0, TAU), summonT: 8, patternA: rand(0, TAU),
    }
    w.enemies.push(e)
    return e
  }

  private spawnPosAt(radius: number, spread = 0): Vec2 {
    const p = this.world.player
    const a = rand(0, TAU)
    return { x: p.x + Math.cos(a) * (radius + rand(0, spread)), y: p.y + Math.sin(a) * (radius + rand(0, spread)) }
  }

  private spawnTick(dt: number) {
    const w = this.world
    const t = w.time
    const viewR = Math.hypot(this.vw, this.vh) / 2
    // regular stream
    w.spawnT -= dt
    if (w.spawnT <= 0 && w.enemies.length < 220) {
      w.spawnT = spawnInterval(t)
      const batch = spawnBatch(t)
      for (let i = 0; i < batch && w.enemies.length < 220; i++) {
        let kind: Exclude<EnemyKind, 'boss'> = 'zombie'
        const roll = Math.random()
        if (t > 200 && roll < 0.10) kind = 'thrower'
        else if (t > 150 && roll < 0.20) kind = 'bomber'
        else if (t > 110 && roll < 0.32) kind = 'spiker'
        else if (t > 80 && roll < 0.44) kind = 'ghost'
        else if (t > 60 && roll < 0.58) kind = 'fatty'
        else if (t > 30 && roll < 0.76) kind = 'sprinter'
        const pos = this.spawnPosAt(viewR + rand(50, 240))
        this.spawnEnemy(kind, pos.x, pos.y)
      }
    }
    // rush horde
    if (t >= w.nextRush) {
      w.nextRush += 34
      if (t > 30 && w.enemies.length < 200) {
        const base = rand(0, TAU)
        const n = 10 + Math.floor(t / 45)
        for (let i = 0; i < n; i++) {
          const a = base + rand(-0.5, 0.5)
          const d = viewR + rand(40, 220)
          const rk = Math.random()
          const kind: Exclude<EnemyKind, 'boss'> = rk < 0.5 ? 'sprinter' : rk < 0.8 ? 'zombie' : 'ghost'
          this.spawnEnemy(kind, w.player.x + Math.cos(a) * d, w.player.y + Math.sin(a) * d)
        }
        this.hooks.onBanner('A horde is charging!', 'warn')
        this.sfx.warn()
      }
    }
    // elite
    if (t >= w.nextElite) {
      w.nextElite += 48
      const elites = w.enemies.filter(e => e.elite && !e.boss).length
      if (elites < 2 && t > 60) {
        const kinds: Exclude<EnemyKind, 'boss'>[] = ['fatty', 'thrower', 'spiker', 'ghost']
        const pos = this.spawnPosAt(viewR + 120)
        this.spawnEnemy(kinds[(Math.random() * kinds.length) | 0], pos.x, pos.y, true)
        this.hooks.onBanner('An elite has appeared!', 'warn')
        this.sfx.warn()
      }
    }
    // boss warning + spawn
    if (!w.bossWarned && t >= w.nextBoss - 3) {
      w.bossWarned = true
      this.hooks.onBanner('WARNING: a massive creature approaches!', 'warn')
      this.sfx.boss()
    }
    if (t >= w.nextBoss) {
      w.nextBoss += 150
      w.bossCount++
      w.bossWarned = false
      const pos = this.spawnPosAt(viewR + 100)
      const idx = w.bossCount - 1
      const arche = idx % 2 === 0 ? 'charger' : 'spitter'
      const bhp = (1900 + idx * 1700) * (1 + t / 650)
      const e: EnemyEx = {
        id: nextId++, kind: 'boss',
        x: pos.x, y: pos.y,
        hp: bhp, maxHp: bhp,
        speed: arche === 'charger' ? 64 : 52, dmg: 22 * dmgMulT(t), radius: 52,
        xpVal: 0, elite: true, boss: true, archetype: arche,
        kbX: 0, kbY: 0, flash: 0, hitCd: 0, hitCd2: 0, zoneTick: 0,
        attackT: 3, telegraph: 0, dashT: 0, dashX: 0, dashY: 0,
        wob: rand(0, TAU), summonT: 7, patternA: 0,
      }
      w.enemies.push(e)
      w.bossId = e.id
      w.bossName = BOSS_NAMES[idx % BOSS_NAMES.length]
      this.ringBurst(pos.x, pos.y, '#ef4444', 26, 300)
    }
  }

  // ── weapons ────────────────────────────────────────────────────────────────
  private fireKunai(wpn: OwnedWeapon, evo: boolean) {
    const p = this.world.player
    const tab = WTAB.kunai
    const targets = this.nearestEnemies(evo ? tab.evoCount : tab.count[wpn.level - 1] + 1, 760)
    const dmg = (evo ? tab.evoDmg : tab.dmg[wpn.level - 1])
    const baseA = targets.length ? Math.atan2(targets[0].y - p.y, targets[0].x - p.x) : p.facing
    const bi = wpn.burst // burst index descending means variation
    const ang = evo ? baseA + bi * 0.62 + rand(-0.1, 0.1) : 0
    const tgt = !evo && targets.length ? targets[(targets.length - wpn.burst + 100 * targets.length) % targets.length] : null
    if (!evo) {
      const a = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : baseA + rand(-0.7, 0.7)
      this.world.projectiles.push({
        id: nextId++, kind: 'kunai', x: p.x, y: p.y - 6,
        vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
        sx: 0, sy: 0, tx: 0, ty: 0, t: 0, dur: 0,
        dmg, radius: 13, aoe: 0, knock: 90, pierce: wpn.level >= 3 ? 1 : 0,
        life: 1.7, spin: rand(0, TAU), ret: false, fromEnemy: false, hitIds: new Set(),
      })
      this.sfx.shoot()
    } else {
      this.world.projectiles.push({
        id: nextId++, kind: 'shuriken', x: p.x, y: p.y - 6,
        vx: Math.cos(ang) * 470, vy: Math.sin(ang) * 470,
        sx: 0, sy: 0, tx: 0, ty: 0, t: 0, dur: 0,
        dmg, radius: 24, aoe: 0, knock: 120, pierce: -1,
        life: 1.9, spin: rand(0, TAU), ret: false, fromEnemy: false, hitIds: new Set(),
      })
      this.sfx.shoot()
    }
  }

  private fireMolotov(wpn: OwnedWeapon, evo: boolean) {
    const p = this.world.player
    const tab = WTAB.molotov
    const near = this.randomEnemies(4, evo ? 560 : 460)
    const tgt = near.length ? near[0] : null
    const tx = tgt ? tgt.x : p.x + rand(-220, 220)
    const ty = tgt ? tgt.y : p.y + rand(-180, 180)
    this.world.projectiles.push({
      id: nextId++, kind: 'molotov',
      x: p.x, y: p.y, vx: 0, vy: 0,
      sx: p.x, sy: p.y, tx, ty, t: 0, dur: rand(0.5, 0.68),
      dmg: (evo ? tab.evoDmg : tab.dmg[wpn.level - 1]), radius: 12,
      aoe: evo ? 122 : 62 + wpn.level * 8, knock: 0, pierce: 0,
      life: 3, spin: rand(0, TAU), ret: false, fromEnemy: false, hitIds: new Set(),
    })
    this.sfx.throwIt()
  }

  private fireOrb(x: number, y: number, a: number, speed: number, dmg: number, radius: number, life: number) {
    this.world.projectiles.push({
      id: nextId++, kind: 'orb', x, y,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      sx: 0, sy: 0, tx: 0, ty: 0, t: 0, dur: 0,
      dmg, radius, aoe: 0, knock: 0, pierce: 0,
      life, spin: 0, ret: false, fromEnemy: true, hitIds: new Set(),
    })
  }

  private fireRocket(wpn: OwnedWeapon, evo: boolean) {
    const p = this.world.player
    const tab = WTAB.rpg
    const tgt = this.nearestEnemies(1, 900)[0]
    const a = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : p.facing
    this.world.projectiles.push({
      id: nextId++, kind: 'rocket', x: p.x, y: p.y - 6,
      vx: Math.cos(a) * 380, vy: Math.sin(a) * 380,
      sx: 0, sy: 0, tx: 0, ty: 0, t: 0, dur: 0,
      dmg: evo ? tab.evoDmg : tab.dmg[wpn.level - 1], radius: 16,
      aoe: evo ? 150 : 72 + wpn.level * 11, knock: 260, pierce: 0,
      life: 2.6, spin: 0, ret: false, fromEnemy: false, hitIds: new Set(),
    })
    this.sfx.shoot()
  }

  private swingKatana(wpn: OwnedWeapon, evo: boolean) {
    const p = this.world.player
    const tab = WTAB.katana
    const tgt = this.nearestEnemies(1, 420)[0]
    const baseA = tgt ? Math.atan2(tgt.y - p.y, tgt.x - p.x) : p.facing
    const range = (evo ? 150 : 104 + wpn.level * 11)
    const dmg = evo ? tab.evoDmg : tab.dmg[wpn.level - 1]
    const dirs = evo ? [baseA, baseA + Math.PI] : [baseA]
    this.sfx.slash()
    for (const a of dirs) {
      this.world.slashes.push({ id: nextId++, x: p.x, y: p.y, angle: a, arc: evo ? 2.5 : 2.3, range, life: 0.16, maxLife: 0.16, color: evo ? '#22c55e' : '#86efac' })
      const hits: EnemyEx[] = []
      this.forEachEnemyNear(p.x + Math.cos(a) * range * 0.5, p.y + Math.sin(a) * range * 0.5, range * 0.72, e => {
        const ea = Math.atan2(e.y - p.y, e.x - p.x)
        let diff = ea - a
        while (diff > Math.PI) diff -= TAU
        while (diff < -Math.PI) diff += TAU
        if (Math.abs(diff) < 1.35) hits.push(e)
      })
      for (const e of hits) {
        this.damageEnemy(e, dmg, 'katana', Math.cos(a) * 320, Math.sin(a) * 320)
      }
      if (evo) {
        this.world.projectiles.push({
          id: nextId++, kind: 'wave', x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
          vx: Math.cos(a) * 540, vy: Math.sin(a) * 540,
          sx: 0, sy: 0, tx: 0, ty: 0, t: 0, dur: 0,
          dmg: dmg * 0.55, radius: 27, aoe: 0, knock: 140, pierce: -1,
          life: 0.75, spin: 0, ret: false, fromEnemy: false, hitIds: new Set(),
        })
      }
    }
  }

  private castLightning(wpn: OwnedWeapon, evo: boolean) {
    const tab = WTAB.lightning
    const dmg = evo ? tab.evoDmg : tab.dmg[wpn.level - 1]
    const n = evo ? tab.evoCount : tab.count[wpn.level - 1]
    const targets = this.randomEnemies(n, evo ? 640 : 520)
    if (!targets.length) return
    this.sfx.zap()
    for (const tgt of targets) {
      // bolt from sky
      const pts: number[] = []
      const sx = tgt.x + rand(-30, 30), sy = tgt.y - 170
      const segs = 5
      for (let i = 0; i <= segs; i++) {
        const k = i / segs
        pts.push(sx + (tgt.x - sx) * k + (i === 0 || i === segs ? 0 : rand(-16, 16)))
        pts.push(sy + (tgt.y - sy) * k + (i === 0 || i === segs ? 0 : rand(-10, 10)))
      }
      this.world.bolts.push({ id: nextId++, pts, life: 0.2, maxLife: 0.2, x: tgt.x, y: tgt.y })
      this.damageEnemy(tgt, dmg, 'lightning')
      // chain
      const chainN = evo ? 3 : 2
      const chained: EnemyEx[] = []
      this.forEachEnemyNear(tgt.x, tgt.y, 130, e => { if (e !== tgt && chained.length < chainN) chained.push(e) })
      for (const c of chained) {
        this.damageEnemy(c, dmg * (evo ? 0.6 : 0.5), 'lightning')
        this.world.bolts.push({
          id: nextId++, pts: [tgt.x, tgt.y, (tgt.x + c.x) / 2 + rand(-8, 8), (tgt.y + c.y) / 2 + rand(-8, 8), c.x, c.y],
          life: 0.14, maxLife: 0.14, x: c.x, y: c.y,
        })
      }
      if (evo) {
        this.world.zones.push({ id: nextId++, x: tgt.x, y: tgt.y, radius: 46, life: 1.1, maxLife: 1.1, dmg: dmg * 0.25, tick: 0, kind: 'shock' })
      }
    }
  }

  private explode(x: number, y: number, r: number, dmg: number, source: string) {
    const w = this.world
    this.sfx.boom()
    w.shake = Math.max(w.shake, 6)
    this.ringBurst(x, y, '#fdba74', 14, 220)
    this.addParts(x, y, '#f97316', 10, 200, 6)
    this.addParts(x, y, '#57534e', 6, 90, 6, 60)
    const hits: EnemyEx[] = []
    this.forEachEnemyNear(x, y, r, e => hits.push(e))
    for (const e of hits) {
      const d = Math.hypot(e.x - x, e.y - y) || 1
      const fall = d > r * 0.6 ? 0.65 : 1
      this.damageEnemy(e, dmg * fall, source, ((e.x - x) / d) * 300, ((e.y - y) / d) * 300)
    }
  }

  private updateWeapon(wpn: OwnedWeapon, dt: number) {
    const p = this.world.player
    const evo = wpn.evo
    if (wpn.id === 'guardian') {
      const tab = WTAB.guardian
      if (wpn.up) {
        wpn.phase -= dt
        wpn.bladeA += dt * (evo ? 4.4 : 3.2)
        // damage
        const n = evo ? tab.evoCount : tab.count[wpn.level - 1]
        const rad = evo ? 128 : 92 + wpn.level * 6
        const dmg = evo ? tab.evoDmg : tab.dmg[wpn.level - 1]
        const bladeR = evo ? 17 : 13
        for (let i = 0; i < n; i++) {
          const a = wpn.bladeA + (i / n) * TAU
          const bx = p.x + Math.cos(a) * rad
          const by = p.y + Math.sin(a) * rad
          const hits: EnemyEx[] = []
          this.forEachEnemyNear(bx, by, bladeR, e => { if (e.hitCd <= 0) hits.push(e) })
          for (const e of hits) {
            const d = Math.hypot(e.x - p.x, e.y - p.y) || 1
            this.damageEnemy(e, dmg, 'guardian', ((e.x - p.x) / d) * 260, ((e.y - p.y) / d) * 260)
            e.hitCd = evo ? 0.3 : 0.38
            this.sfx.hit()
          }
        }
        if (wpn.phase <= 0) { wpn.up = false; wpn.phase = (evo ? 0.5 : tab.cd[wpn.level - 1]) * p.cdr }
      } else {
        wpn.phase -= dt
        if (wpn.phase <= 0) { wpn.up = true; wpn.phase = evo ? 3.0 : 2.3 + wpn.level * 0.1 }
      }
      return
    }
    wpn.cdT -= dt
    if (wpn.burst > 0) {
      if (wpn.cdT <= 0) {
        wpn.burst--
        if (wpn.id === 'kunai') this.fireKunai(wpn, evo)
        else if (wpn.id === 'molotov') this.fireMolotov(wpn, evo)
        else if (wpn.id === 'rpg') this.fireRocket(wpn, evo)
        wpn.cdT = wpn.burst === 0 ? 0 : 0.14
        if (wpn.burst === 0) wpn.cdT = this.wcd(wpn)
      }
      return
    }
    if (wpn.cdT > 0) return
    const tab = WTAB[wpn.id]
    const count = evo ? tab.evoCount : tab.count[wpn.level - 1]
    if (wpn.id === 'kunai') {
      wpn.burst = count
      this.fireKunai(wpn, evo)
      wpn.burst--
      wpn.cdT = wpn.burst > 0 ? 0.13 : this.wcd(wpn)
      if (wpn.burst === 0) wpn.cdT = this.wcd(wpn)
    }
    else if (wpn.id === 'molotov') { wpn.burst = count; this.fireMolotov(wpn, evo); wpn.burst--; wpn.cdT = wpn.burst ? 0.14 : this.wcd(wpn) }
    else if (wpn.id === 'rpg') { wpn.burst = count; this.fireRocket(wpn, evo); wpn.burst--; wpn.cdT = wpn.burst ? 0.16 : this.wcd(wpn) }
    else if (wpn.id === 'katana') { this.swingKatana(wpn, evo); wpn.cdT = this.wcd(wpn) }
    else if (wpn.id === 'lightning') { this.castLightning(wpn, evo); wpn.cdT = this.wcd(wpn) }
  }

  private wcd(wpn: OwnedWeapon) {
    const tab = WTAB[wpn.id]
    const cd = wpn.evo ? tab.evoCd : tab.cd[wpn.level - 1]
    return cd * this.world.player.cdr * rand(0.92, 1.05)
  }

  // ── enemy update ───────────────────────────────────────────────────────────
  private updateEnemies(dt: number) {
    const w = this.world
    const p = w.player
    const enemies = w.enemies as EnemyEx[]
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i]
      if (e.hp <= 0) continue
      e.flash = Math.max(0, e.flash - dt)
      e.hitCd = Math.max(0, e.hitCd - dt)
      e.hitCd2 = Math.max(0, e.hitCd2 - dt)
      e.zoneTick = Math.max(0, e.zoneTick - dt)
      e.attackT -= dt
      const dx = p.x - e.x, dy = p.y - e.y
      const d = Math.hypot(dx, dy) || 1
      let vx = (dx / d) * e.speed, vy = (dy / d) * e.speed

      if (e.boss && e.archetype === 'charger') {
        if (e.dashT > 0) {
          e.dashT -= dt
          vx = e.dashX * e.speed * 5.2
          vy = e.dashY * e.speed * 5.2
        } else if (e.telegraph > 0) {
          e.telegraph -= dt
          vx = 0; vy = 0
          e.dashX = dx / d; e.dashY = dy / d
          if (e.telegraph <= 0) { e.dashT = 0.72 }
        } else {
          // bullet-hell radial ring
          if (e.attackT <= 0) {
            e.attackT = 3.4
            const n = Math.min(24, 12 + Math.floor(w.time / 90) * 2)
            for (let bi = 0; bi < n; bi++) {
              const a = (bi / n) * TAU + e.patternA
              this.fireOrb(e.x, e.y, a, 150, e.dmg * 0.55, 13, 5.5)
            }
            e.patternA += 0.35
            this.sfx.warn()
            this.addText(e.x, e.y - 52, 'BULLET RING!', '#fca5a5', 13)
          }
          // charge when close
          if (e.zoneTick <= 0 && d < 480) {
            e.telegraph = 0.8
            e.zoneTick = rand(7, 9)
          }
        }
      } else if (e.boss && e.archetype === 'spitter') {
        // keep mid range, strafe
        const px2 = -dy / d, py2 = dx / d
        if (d < 250) { vx = -vx * 0.8; vy = -vy * 0.8 }
        else if (d < 340) { vx = px2 * e.speed * 0.7; vy = py2 * e.speed * 0.7 }
        // bullet-hell spiral
        if (e.attackT <= 0) {
          e.attackT = 1.9
          const n = Math.min(9, 5 + Math.floor(w.time / 240))
          for (let bi = 0; bi < n; bi++) {
            const a = e.patternA + (bi / n) * TAU
            this.fireOrb(e.x, e.y, a, 170, e.dmg * 0.5, 12, 4.5)
          }
          e.patternA += 0.55
          this.sfx.warn()
          // occasional aimed fan
          if (Math.random() < 0.35) {
            for (let s = -1; s <= 1; s++) {
              this.fireOrb(e.x, e.y, Math.atan2(dy, dx) + s * 0.18, 235, e.dmg * 0.65, 12, 3.5)
            }
          }
        }
        e.summonT -= dt
        if (e.summonT <= 0 && w.enemies.length < 210) {
          e.summonT = 9
          for (let s = 0; s < 3; s++) {
            const a = rand(0, TAU)
            this.spawnEnemy('zombie', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60)
          }
          this.addText(e.x, e.y - 50, 'SUMMON!', '#c084fc', 13)
        }
      } else if (e.kind === 'thrower') {
        if (d < 430 && e.attackT <= 0) {
          e.attackT = rand(2.8, 3.6)
          const a = Math.atan2(dy, dx) + rand(-0.08, 0.08)
          w.projectiles.push({
            id: nextId++, kind: 'cleaver', x: e.x, y: e.y,
            vx: Math.cos(a) * 235, vy: Math.sin(a) * 235,
            sx: 0, sy: 0, tx: 0, ty: 0, t: 0, dur: 0,
            dmg: e.dmg * 1.1, radius: 14, aoe: 0, knock: 0, pierce: 0,
            life: 3, spin: rand(0, TAU), ret: false, fromEnemy: true, hitIds: new Set(),
          })
        }
        if (d < 200) { vx = -vx * 0.6; vy = -vy * 0.6 }
      }

      // knockback decay + integrate
      e.x += (vx + e.kbX) * dt
      e.y += (vy + e.kbY) * dt
      e.kbX *= Math.max(0, 1 - 9 * dt)
      e.kbY *= Math.max(0, 1 - 9 * dt)

      // contact damage
      const pr = 15 + e.radius * 0.8
      if (d < pr && !w.over) {
        this.hurtPlayer(e.dmg, e.x, e.y)
        e.kbX -= (dx / d) * 140
        e.kbY -= (dy / d) * 140
      }
    }
    // separation (ghosts phase through the crowd)
    this.buildHash()
    for (const e of enemies) {
      if (e.hp <= 0 || e.kind === 'ghost') continue
      this.forEachEnemyNear(e.x, e.y, e.radius + 18, o => {
        if ((o as EnemyEx).id <= e.id || o.hp <= 0 || o.kind === 'ghost') return
        const dx = o.x - e.x, dy = o.y - e.y
        const d = Math.hypot(dx, dy) || 1
        const overlap = (e.radius + o.radius) * 0.86 - d
        if (overlap > 0) {
          const push = overlap * 0.32
          const nx = (dx / d) * push, ny = (dy / d) * push
          e.x -= nx; e.y -= ny
          o.x += nx; o.y += ny
        }
      })
    }
  }

  // ── projectiles / zones update ─────────────────────────────────────────────
  private updateProjectiles(dt: number) {
    const w = this.world
    const p = w.player
    const prs = w.projectiles
    for (let i = prs.length - 1; i >= 0; i--) {
      const pr = prs[i]
      pr.life -= dt
      let dead = pr.life <= 0

      if (pr.kind === 'molotov') {
        pr.t += dt
        if (pr.t >= pr.dur) {
          w.zones.push({ id: nextId++, x: pr.tx, y: pr.ty, radius: pr.aoe, life: 3.2, maxLife: 3.2, dmg: pr.dmg, tick: 0, kind: 'fire' })
          this.sfx.land()
          this.addParts(pr.tx, pr.ty, '#fb923c', 8, 130, 5)
          w.shake = Math.max(w.shake, 2)
          prs.splice(i, 1)
          continue
        }
        continue
      }

      if (pr.kind === 'rocket' && !dead) {
        // homing
        const tgt = this.nearestEnemies(1, 520)[0]
        if (tgt) {
          const cur = Math.atan2(pr.vy, pr.vx)
          const want = Math.atan2(tgt.y - pr.y, tgt.x - pr.x)
          let diff = want - cur
          while (diff > Math.PI) diff -= TAU
          while (diff < -Math.PI) diff += TAU
          const turn = Math.min(Math.abs(diff), 5.2 * dt) * Math.sign(diff)
          const sp = 390
          const na = cur + turn
          pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp
        }
      }

      if (pr.kind === 'shuriken' && !dead) {
        pr.t += dt
        if (pr.t > 0.6) {
          pr.ret = true
          const a = Math.atan2(p.y - pr.y, p.x - pr.x)
          const sp = 500
          pr.vx = pr.vx * 0.86 + Math.cos(a) * sp * 0.14 * (sp / 500)
          pr.vy = pr.vy * 0.86 + Math.sin(a) * sp * 0.14 * (sp / 500)
          const nn = Math.hypot(pr.vx, pr.vy) || 1
          pr.vx = (pr.vx / nn) * 500; pr.vy = (pr.vy / nn) * 500
          const d = Math.hypot(p.x - pr.x, p.y - pr.y)
          if (d < 30) dead = true
        }
      }

      pr.x += pr.vx * dt
      pr.y += pr.vy * dt

      if (pr.fromEnemy) {
        // hit player
        const d = Math.hypot(p.x - pr.x, p.y - pr.y)
        if (d < pr.radius + 13 && !w.over) {
          this.hurtPlayer(pr.dmg, pr.x, pr.y)
          dead = true
        }
      } else if (!dead) {
        // hit enemies
        const hits: EnemyEx[] = []
        this.forEachEnemyNear(pr.x, pr.y, pr.radius, e => {
          if (pr.hitIds.has(e.id)) return
          if (pr.kind === 'shuriken' && e.hitCd2 > 0) return
          if (pr.kind === 'wave' && e.hitCd2 > 0) return
          hits.push(e)
        })
        for (const e of hits) {
          if (pr.kind === 'rocket') {
            this.explode(pr.x, pr.y, pr.aoe, pr.dmg, 'rpg')
            dead = true
            break
          }
          const kb = pr.knock
          const d = Math.hypot(pr.vx, pr.vy) || 1
          const src = pr.kind === 'shuriken' ? 'kunai' : pr.kind as string
          this.damageEnemy(e, pr.dmg, src, (pr.vx / d) * kb, (pr.vy / d) * kb)
          this.sfx.hit()
          this.addParts(pr.x, pr.y, '#e2e8f0', 3, 130, 3)
          if (pr.kind === 'shuriken' || pr.kind === 'wave') {
            pr.hitIds.add(e.id)
            e.hitCd2 = 0.45
          } else if (pr.pierce > 0) {
            pr.pierce--
            pr.hitIds.add(e.id)
          } else {
            dead = true
          }
          if (dead) break
        }
      }

      // rocket expires → explode
      if (!dead && pr.life <= 0 && pr.kind === 'rocket') {
        this.explode(pr.x, pr.y, pr.aoe, pr.dmg, 'rpg')
        dead = true
      }
      if (dead) prs.splice(i, 1)
    }

    // zones
    for (let i = w.zones.length - 1; i >= 0; i--) {
      const z = w.zones[i]
      z.life -= dt
      z.tick -= dt
      if (z.tick <= 0) {
        z.tick = 0.4
        const hits: EnemyEx[] = []
        this.forEachEnemyNear(z.x, z.y, z.radius, e => hits.push(e))
        const src = z.kind === 'fire' ? 'molotov' : 'lightning'
        for (const e of hits) this.damageEnemy(e, z.dmg, src)
      }
      if (z.life <= 0) w.zones.splice(i, 1)
    }

    // bolts
    for (let i = w.bolts.length - 1; i >= 0; i--) {
      w.bolts[i].life -= dt
      if (w.bolts[i].life <= 0) w.bolts.splice(i, 1)
    }
    // slashes
    for (let i = w.slashes.length - 1; i >= 0; i--) {
      w.slashes[i].life -= dt
      if (w.slashes[i].life <= 0) w.slashes.splice(i, 1)
    }
    // particles
    for (let i = w.parts.length - 1; i >= 0; i--) {
      const pt = w.parts[i]
      pt.life -= dt
      pt.x += pt.vx * dt
      pt.y += pt.vy * dt
      pt.vy += pt.grav * dt
      if (pt.life <= 0) w.parts.splice(i, 1)
    }
    // texts
    for (let i = w.texts.length - 1; i >= 0; i--) {
      const tx = w.texts[i]
      tx.life -= dt
      tx.y -= 42 * dt
      if (tx.life <= 0) w.texts.splice(i, 1)
    }
  }

  // ── pickups ────────────────────────────────────────────────────────────────
  private updatePickups(dt: number) {
    const w = this.world
    const p = w.player
    w.comboT -= dt
    if (w.comboT <= 0) w.combo = 0

    for (let i = w.gems.length - 1; i >= 0; i--) {
      const g = w.gems[i]
      const dx = p.x - g.x, dy = p.y - g.y
      const d = Math.hypot(dx, dy)
      if (g.magnet || d < p.magnetR) g.magnet = true
      if (g.magnet) {
        const pull = d < 70 ? 1500 : 620 + (p.magnetR - Math.min(d, p.magnetR)) * 8
        g.vx += ((dx / (d || 1)) * pull - g.vx * 6) * dt * 3
        g.vy += ((dy / (d || 1)) * pull - g.vy * 6) * dt * 3
        g.x += g.vx * dt * 3
        g.y += g.vy * dt * 3
      }
      if (d < 26) {
        w.gems.splice(i, 1)
        w.gemsGot++
        w.combo = Math.min(w.combo + 1, 40)
        w.comboT = 1.1
        this.sfx.pickup(w.combo)
        this.addXp(g.value)
        this.addParts(p.x, p.y, '#67e8f9', 3, 90, 3, -60)
      }
    }

    for (let i = w.items.length - 1; i >= 0; i--) {
      const it = w.items[i]
      const d = Math.hypot(p.x - it.x, p.y - it.y)
      if (d < 30) {
        w.items.splice(i, 1)
        if (it.kind === 'meat') this.healPlayer(p.maxHp * 0.3)
        else if (it.kind === 'magnet') {
          for (const g of w.gems) g.magnet = true
          this.sfx.magnetize()
          this.addText(p.x, p.y - 34, 'MAGNET!', '#f43f5e', 15)
        } else if (it.kind === 'bomb') this.detonate()
        else this.openChestModal()
      }
    }
  }

  private addXp(v: number) {
    const w = this.world
    const p = w.player
    p.xp += v * p.xpMul
    while (p.xp >= p.xpNeed) {
      p.xp -= p.xpNeed
      p.level++
      p.xpNeed = xpNeed(p.level)
      w.pendingLevels++
    }
    if (w.pendingLevels > 0 && !this.modalOpen && !w.over) {
      this.openLevelModal()
    }
  }

  // ── main update ────────────────────────────────────────────────────────────
  private update(dt: number) {
    const w = this.world
    const p = w.player
    if (w.over) return
    w.time += dt

    // decay fx
    w.shake = Math.max(0, w.shake - 34 * dt)
    w.hurtFlash = Math.max(0, w.hurtFlash - 2.6 * dt)
    w.bombFlash = Math.max(0, w.bombFlash - 2.2 * dt)
    w.levelFlash = Math.max(0, w.levelFlash - 1.4 * dt)

    // player movement
    const iv = this.inputVec()
    p.moving = iv.x !== 0 || iv.y !== 0
    const sp = p.baseSpeed * p.spdMul
    p.vx = p.vx * Math.max(0, 1 - 10 * dt)
    p.vy = p.vy * Math.max(0, 1 - 10 * dt)
    p.x += (iv.x * sp + p.vx) * dt
    p.y += (iv.y * sp + p.vy) * dt
    if (p.moving) p.facing = Math.atan2(iv.y, iv.x)
    p.bob += dt
    p.iframes = Math.max(0, p.iframes - dt)

    // regen
    if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt)

    // camera
    const k = 1 - Math.exp(-6 * dt)
    w.cam.x += (p.x - this.vw / 2 - w.cam.x) * k
    w.cam.y += (p.y - this.vh / 2 - w.cam.y) * k

    this.spawnTick(dt)
    this.updateEnemies(dt)
    this.buildHash()
    for (const wpn of p.weapons) this.updateWeapon(wpn, dt)
    this.updateProjectiles(dt)
    this.updatePickups(dt)
  }
}
