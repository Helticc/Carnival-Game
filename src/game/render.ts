// ── Canvas 2D renderer ───────────────────────────────────────────────────────
import type { World, Enemy, Projectile, Zone, Gem, Item } from './types'
import { ENEMY_DEFS } from './data'

const TAU = Math.PI * 2

// Seeded pseudo-random for tile decorations
function srand(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

// ── School campus courtyard ground ───────────────────────────────────────────
let groundTile: HTMLCanvasElement | null = null
export function getGroundPattern(): HTMLCanvasElement {
  if (groundTile) return groundTile
  const S = 256
  const c = document.createElement('canvas')
  c.width = S; c.height = S
  const g = c.getContext('2d')!

  // paving slab base
  g.fillStyle = '#cfcabc'
  g.fillRect(0, 0, S, S)

  const rnd = srand(9173)
  const cell = 64
  for (let y = 0; y < S / cell; y++) {
    for (let x = 0; x < S / cell; x++) {
      // slight per-slab tone variation
      const v = rnd()
      g.fillStyle = v < 0.33 ? '#d4cfc1' : v < 0.66 ? '#c9c4b6' : '#d0cbbd'
      g.fillRect(x * cell, y * cell, cell, cell)
      // speckle (concrete aggregate)
      for (let i = 0; i < 26; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(120,115,104,0.18)' : 'rgba(255,255,255,0.22)'
        g.fillRect(x * cell + rnd() * cell, y * cell + rnd() * cell, 1.6, 1.6)
      }
    }
  }
  // grout lines between slabs
  g.strokeStyle = 'rgba(126,120,108,0.55)'
  g.lineWidth = 2
  for (let i = 0; i <= S / cell; i++) {
    g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, S); g.stroke()
    g.beginPath(); g.moveTo(0, i * cell); g.lineTo(S, i * cell); g.stroke()
  }
  // highlight on top/left of each slab for a subtle 3D lip
  g.strokeStyle = 'rgba(255,255,255,0.3)'
  g.lineWidth = 1
  for (let i = 0; i <= S / cell; i++) {
    g.beginPath(); g.moveTo(i * cell + 1.5, 0); g.lineTo(i * cell + 1.5, S); g.stroke()
    g.beginPath(); g.moveTo(0, i * cell + 1.5); g.lineTo(S, i * cell + 1.5); g.stroke()
  }
  groundTile = c
  return c
}

// ── Campus props (deterministic per 512px world chunk) ───────────────────────
const CHUNK = 512

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  const sway = Math.sin(t * 0.9 + x * 0.01) * 2
  ctx.fillStyle = 'rgba(40,50,35,0.2)'
  ctx.beginPath(); ctx.ellipse(x, y + 4 * s, 26 * s, 10 * s, 0, 0, TAU); ctx.fill()
  // planter ring
  ctx.fillStyle = '#b9b2a2'
  ctx.strokeStyle = '#8e8777'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.ellipse(x, y + 2 * s, 30 * s, 13 * s, 0, 0, TAU); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#6b5641'
  ctx.beginPath(); ctx.ellipse(x, y + 2 * s, 23 * s, 9 * s, 0, 0, TAU); ctx.fill()
  // trunk
  ctx.fillStyle = '#7a5b3c'
  ctx.strokeStyle = '#523c27'
  ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.roundRect(x - 5 * s, y - 34 * s, 10 * s, 38 * s, 4 * s); ctx.fill(); ctx.stroke()
  // canopy
  ctx.fillStyle = '#4e8c3a'
  ctx.strokeStyle = '#356127'
  ctx.lineWidth = 3
  for (const o of [[-16, -44], [16, -44], [0, -62], [-9, -30], [9, -30]]) {
    ctx.beginPath()
    ctx.arc(x + o[0] * s + sway, y + o[1] * s, 18 * s, 0, TAU)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath(); ctx.arc(x - 8 * s + sway, y - 52 * s, 9 * s, 0, TAU); ctx.fill()
}

function drawBench(ctx: CanvasRenderingContext2D, x: number, y: number, horiz: boolean) {
  ctx.save()
  ctx.translate(x, y)
  if (!horiz) ctx.rotate(Math.PI / 2)
  ctx.fillStyle = 'rgba(40,50,35,0.18)'
  ctx.beginPath(); ctx.ellipse(0, 10, 44, 9, 0, 0, TAU); ctx.fill()
  ctx.fillStyle = '#6b7280'
  ctx.fillRect(-36, 2, 7, 12)
  ctx.fillRect(29, 2, 7, 12)
  ctx.fillStyle = '#a97c4e'
  ctx.strokeStyle = '#7a5733'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.roundRect(-42, -8, 84, 12, 3); ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.roundRect(-42, -20, 84, 9, 3); ctx.fill(); ctx.stroke()
  ctx.restore()
}

function drawPlanter(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(40,50,35,0.18)'
  ctx.beginPath(); ctx.ellipse(x, y + 10, 22, 8, 0, 0, TAU); ctx.fill()
  ctx.fillStyle = '#c75d4f'
  ctx.strokeStyle = '#8f3f34'
  ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.roundRect(x - 18, y - 6, 36, 20, 4); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#4e8c3a'
  for (const o of [-9, 0, 9]) {
    ctx.beginPath(); ctx.arc(x + o, y - 10, 9, 0, TAU); ctx.fill()
  }
  ctx.fillStyle = '#f5d76e'
  ctx.beginPath(); ctx.arc(x - 6, y - 14, 3, 0, TAU); ctx.fill()
  ctx.beginPath(); ctx.arc(x + 7, y - 12, 3, 0, TAU); ctx.fill()
}

/** Court markings, lawn patches, trees, benches — tiled across the world. */
function drawCampus(ctx: CanvasRenderingContext2D, cx: number, cy: number, W: number, H: number, t: number) {
  const c0x = Math.floor(cx / CHUNK) - 1, c1x = Math.floor((cx + W) / CHUNK) + 1
  const c0y = Math.floor(cy / CHUNK) - 1, c1y = Math.floor((cy + H) / CHUNK) + 1

  for (let gy = c0y; gy <= c1y; gy++) {
    for (let gx = c0x; gx <= c1x; gx++) {
      const ox = gx * CHUNK, oy = gy * CHUNK
      const rnd = srand((gx * 73856093) ^ (gy * 19349663) ^ 0x5f3a)
      const kind = Math.floor(rnd() * 4)

      if (kind === 0) {
        // ── lawn quad with hedge border ──
        const lx = ox + 70, ly = oy + 70, lw = 300, lh = 240
        ctx.fillStyle = '#7fb04a'
        ctx.strokeStyle = '#5c8534'
        ctx.lineWidth = 8
        ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 26); ctx.fill(); ctx.stroke()
        ctx.strokeStyle = 'rgba(255,255,255,0.14)'
        ctx.lineWidth = 3
        ctx.beginPath(); ctx.roundRect(lx + 8, ly + 8, lw - 16, lh - 16, 20); ctx.stroke()
        // mow stripes
        ctx.save()
        ctx.beginPath(); ctx.roundRect(lx, ly, lw, lh, 26); ctx.clip()
        ctx.fillStyle = 'rgba(255,255,255,0.055)'
        for (let i = 0; i < 8; i++) ctx.fillRect(lx + i * 40, ly, 20, lh)
        ctx.restore()
        drawTree(ctx, lx + lw * 0.5, ly + lh * 0.55, 1, t)
        drawBench(ctx, lx - 44, ly + lh * 0.5, false)
      } else if (kind === 1) {
        // ── basketball / sports court ──
        const bx = ox + 90, by = oy + 90, bw = 320, bh = 250
        ctx.fillStyle = '#9c6a4e'
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.lineWidth = 4
        ctx.beginPath(); ctx.roundRect(bx + 14, by + 14, bw - 28, bh - 28, 6); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(bx + bw / 2, by + 14); ctx.lineTo(bx + bw / 2, by + bh - 14); ctx.stroke()
        ctx.beginPath(); ctx.arc(bx + bw / 2, by + bh / 2, 46, 0, TAU); ctx.stroke()
        ctx.beginPath(); ctx.arc(bx + 14, by + bh / 2, 62, -Math.PI / 2, Math.PI / 2); ctx.stroke()
        ctx.beginPath(); ctx.arc(bx + bw - 14, by + bh / 2, 62, Math.PI / 2, -Math.PI / 2); ctx.stroke()
      } else if (kind === 2) {
        // ── planters + benches plaza ──
        drawPlanter(ctx, ox + 130, oy + 150)
        drawPlanter(ctx, ox + 330, oy + 150)
        drawBench(ctx, ox + 230, oy + 290, true)
        drawTree(ctx, ox + 400, oy + 360, 0.85, t)
      } else {
        // ── walkway crossing with painted lines ──
        ctx.fillStyle = '#b6b0a1'
        ctx.fillRect(ox + 150, oy, 120, CHUNK)
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        for (let i = 0; i < 9; i++) ctx.fillRect(ox + 162, oy + 20 + i * 56, 96, 16)
        drawTree(ctx, ox + 70, oy + 180, 0.8, t)
        drawBench(ctx, ox + 340, oy + 240, true)
      }
    }
  }
}

// scratch arrays reused across frames
const scratch: Enemy[] = []
const markerList: { x: number; y: number; color: string }[] = []

function shade(e: Enemy) {
  const s = ENEMY_DEFS[e.kind as keyof typeof ENEMY_DEFS]
  return s
}

/** Shared trailing bits for every monster: hit flash, HP bar, dash telegraph. */
function drawEnemyOverlay(ctx: CanvasRenderingContext2D, e: Enemy, t: number, r: number) {
  // hit flash
  if (e.flash > 0) {
    ctx.globalAlpha = Math.min(1, e.flash * 4)
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r, 0, 0, TAU); ctx.fill()
    ctx.globalAlpha = 1
  }
  // hp bar
  if (e.hp < e.maxHp) {
    const bw = r * 1.7, bx = -bw / 2, by = -r * 1.5
    ctx.fillStyle = 'rgba(10,20,8,0.65)'
    ctx.fillRect(bx, by, bw, 4.5)
    const p = Math.max(0, e.hp / e.maxHp)
    ctx.fillStyle = `hsl(${p * 110}, 80%, 45%)`
    ctx.fillRect(bx, by, bw * p, 4.5)
  }
  ctx.restore()

  // charge telegraph (screen-space line from the enemy)
  if (e.telegraph > 0) {
    ctx.save()
    ctx.globalAlpha = 0.4 + 0.3 * Math.sin(t * 30)
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = e.radius * 1.6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(e.x, e.y)
    ctx.lineTo(e.x + e.dashX * 480, e.y + e.dashY * 480)
    ctx.stroke()
    ctx.restore()
  }
}

function drawEnemyBody(ctx: CanvasRenderingContext2D, e: Enemy, t: number, px: number, py: number) {
  const r = e.radius
  const def = e.boss ? { body: e.archetype === 'charger' ? '#8c3e3e' : '#6b4a8c', dark: e.archetype === 'charger' ? '#5c2626' : '#412c5c' } : shade(e)
  const wob = Math.sin(t * 8 + e.wob) * 0.5
  const faceX = Math.cos(Math.atan2(py - e.y, px - e.x))
  const faceY = Math.sin(Math.atan2(py - e.y, px - e.x))
  const squash = e.kind === 'sprinter' ? 0.82 : 1

  ctx.save()
  ctx.translate(e.x, e.y + wob)

  // ghosts hover and are semi-transparent
  if (e.kind === 'ghost') {
    ctx.globalAlpha = 0.82
    ctx.translate(0, Math.sin(t * 2.4 + e.wob) * 5 - 6)
  }

  // elite aura
  if (e.elite) {
    const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.1)
    g.addColorStop(0, 'rgba(180,80,255,0.35)')
    g.addColorStop(1, 'rgba(180,80,255,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(0, 0, r * 2.1, 0, TAU); ctx.fill()
  }

  // shadow
  ctx.fillStyle = 'rgba(20,30,15,0.22)'
  ctx.beginPath(); ctx.ellipse(0, r * 0.85, r * 0.95, r * 0.42, 0, 0, TAU); ctx.fill()

  ctx.lineWidth = 3
  ctx.strokeStyle = def.dark

  // ── GHOST: wispy tail, no legs ──
  if (e.kind === 'ghost') {
    ctx.fillStyle = def.body
    ctx.beginPath()
    ctx.arc(0, -r * 0.1, r * 0.9, Math.PI, 0)
    const tailN = 4
    for (let i = 0; i <= tailN; i++) {
      const k = i / tailN
      const xx = r * 0.9 - k * r * 1.8
      const yy = -r * 0.1 + r * 0.9 + Math.sin(k * Math.PI * 3 + t * 6) * r * 0.22
      ctx.lineTo(xx, yy)
    }
    ctx.closePath(); ctx.fill(); ctx.stroke()
    // hollow glowing eyes
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#334155'
      ctx.beginPath(); ctx.ellipse(s * r * 0.3 + faceX * r * 0.12, -r * 0.25, r * 0.16, r * 0.22, 0, 0, TAU); ctx.fill()
      ctx.fillStyle = e.elite ? '#f87171' : '#67e8f9'
      ctx.beginPath(); ctx.arc(s * r * 0.3 + faceX * r * 0.16, -r * 0.25, r * 0.08, 0, TAU); ctx.fill()
    }
    ctx.fillStyle = '#334155'
    ctx.beginPath(); ctx.ellipse(faceX * r * 0.1, r * 0.12, r * 0.18, r * 0.12, 0, 0, TAU); ctx.fill()
    drawEnemyOverlay(ctx, e, t, r)
    return
  }

  // ── SPIKER: armored shell with spikes ──
  if (e.kind === 'spiker') {
    ctx.fillStyle = def.dark
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + e.wob
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72)
      ctx.lineTo(Math.cos(a + 0.12) * r * 1.3, Math.sin(a + 0.12) * r * 1.3)
      ctx.lineTo(Math.cos(a + 0.34) * r * 0.72, Math.sin(a + 0.34) * r * 0.72)
      ctx.closePath(); ctx.fill()
    }
    ctx.fillStyle = def.body
    ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, TAU); ctx.fill(); ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    ctx.beginPath(); ctx.arc(-r * 0.22, -r * 0.24, r * 0.34, 0, TAU); ctx.fill()
    // single cyclops eye
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(faceX * r * 0.14, faceY * r * 0.1, r * 0.3, 0, TAU); ctx.fill()
    ctx.fillStyle = e.elite ? '#dc2626' : '#0f172a'
    ctx.beginPath(); ctx.arc(faceX * r * 0.28, faceY * r * 0.2, r * 0.17, 0, TAU); ctx.fill()
    drawEnemyOverlay(ctx, e, t, r)
    return
  }

  // ── BOMBER: round, fuse on top, pulsing ──
  if (e.kind === 'bomber') {
    const pulse = 1 + Math.sin(t * 9 + e.wob) * 0.06
    ctx.save()
    ctx.scale(pulse, pulse)
    ctx.fillStyle = def.body
    ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, TAU); ctx.fill(); ctx.stroke()
    // warning stripes
    ctx.save()
    ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, TAU); ctx.clip()
    ctx.fillStyle = 'rgba(40,20,10,0.35)'
    for (let i = -3; i < 4; i++) {
      ctx.save(); ctx.rotate(0.5); ctx.fillRect(i * r * 0.44, -r * 1.4, r * 0.2, r * 2.8); ctx.restore()
    }
    ctx.restore()
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.28, r * 0.28, 0, TAU); ctx.fill()
    ctx.restore()
    // fuse
    ctx.strokeStyle = '#57534e'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(r * 0.14, -r * 0.82); ctx.quadraticCurveTo(r * 0.5, -r * 1.2, r * 0.3, -r * 1.45); ctx.stroke()
    ctx.fillStyle = `rgba(255,${150 + Math.sin(t * 20) * 80},40,1)`
    ctx.beginPath(); ctx.arc(r * 0.3, -r * 1.45, r * 0.18 + Math.sin(t * 18) * 2, 0, TAU); ctx.fill()
    // eyes
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.arc(s * r * 0.28 + faceX * r * 0.1, -r * 0.08, r * 0.19, 0, TAU); ctx.fill()
      ctx.fillStyle = '#7f1d1d'
      ctx.beginPath(); ctx.arc(s * r * 0.28 + faceX * r * 0.16, -r * 0.08, r * 0.1, 0, TAU); ctx.fill()
    }
    // grin
    ctx.strokeStyle = '#7f1d1d'
    ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.arc(faceX * r * 0.1, r * 0.22, r * 0.3, 0.25, Math.PI - 0.25); ctx.stroke()
    drawEnemyOverlay(ctx, e, t, r)
    return
  }

  // arms (side stubs) for zombie/fatty/boss
  if (e.kind === 'zombie' || e.kind === 'fatty' || e.boss) {
    const ax = r * 0.85, ay = -r * 0.1
    ctx.fillStyle = def.body
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(-faceX * r * 0.2 + s * ax * (e.boss ? 1 : 0.8), ay + Math.sin(t * 6 + e.wob + s) * r * 0.18, r * 0.3, 0, TAU)
      ctx.fill(); ctx.stroke()
    }
  }

  // legs for sprinter (lanky runner)
  if (e.kind === 'sprinter') {
    ctx.strokeStyle = def.dark
    ctx.lineWidth = r * 0.17
    ctx.lineCap = 'round'
    for (const s of [-1, 1]) {
      const sw = Math.sin(t * 16 + e.wob + (s > 0 ? Math.PI : 0)) * r * 0.42
      ctx.beginPath()
      ctx.moveTo(s * r * 0.3, r * 0.6)
      ctx.lineTo(s * r * 0.3 + sw, r * 1.15)
      ctx.stroke()
    }
    ctx.lineWidth = 3
  }

  // body
  ctx.fillStyle = def.body
  ctx.beginPath()
  ctx.ellipse(0, r * 0.15, r * 0.92, r * 0.78 * squash + r * 0.2, 0, 0, TAU)
  ctx.fill(); ctx.stroke()

  // belly
  if (e.kind === 'fatty' || e.boss) {
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.beginPath(); ctx.ellipse(0, r * 0.32, r * 0.55, r * 0.4, 0, 0, TAU); ctx.fill()
  }

  // tattered school tie — they were students once
  if (e.kind === 'zombie' || e.kind === 'thrower' || e.kind === 'fatty') {
    ctx.fillStyle = '#b91c1c'
    ctx.beginPath()
    ctx.moveTo(faceX * r * 0.12 - r * 0.12, -r * 0.1)
    ctx.lineTo(faceX * r * 0.12 + r * 0.12, -r * 0.1)
    ctx.lineTo(faceX * r * 0.12 + r * 0.06, r * 0.5)
    ctx.lineTo(faceX * r * 0.12, r * 0.62)
    ctx.lineTo(faceX * r * 0.12 - r * 0.06, r * 0.5)
    ctx.closePath(); ctx.fill()
  }

  // head
  const hx = faceX * r * 0.22, hy = -r * 0.52 + faceY * r * 0.1
  ctx.fillStyle = def.body
  ctx.beginPath(); ctx.arc(hx, hy, r * 0.62, 0, TAU); ctx.fill(); ctx.stroke()

  // crown / hat
  if (e.boss) {
    if (e.archetype === 'charger') {
      ctx.fillStyle = '#fbbf24'
      ctx.strokeStyle = '#b45309'
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath()
        ctx.moveTo(hx + i * r * 0.36 - r * 0.13, hy - r * 0.5)
        ctx.lineTo(hx + i * r * 0.36, hy - r * (i === 0 ? 1.05 : 0.85))
        ctx.lineTo(hx + i * r * 0.36 + r * 0.13, hy - r * 0.5)
        ctx.closePath(); ctx.fill(); ctx.stroke()
      }
    } else {
      ctx.fillStyle = '#1f2937'
      ctx.strokeStyle = '#111827'
      ctx.beginPath(); ctx.ellipse(hx, hy - r * 0.35, r * 0.95, r * 0.3, 0, 0, TAU); ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.arc(hx, hy - r * 0.42, r * 0.45, Math.PI, 0); ctx.fill(); ctx.stroke()
    }
  }
  if (e.kind === 'thrower') {
    ctx.fillStyle = '#e2e8f0'
    ctx.strokeStyle = '#94a3b8'
    ctx.beginPath(); ctx.arc(hx, hy - r * 0.35, r * 0.42, Math.PI, 0); ctx.fill(); ctx.stroke()
  }

  // eyes
  const er = r * 0.13
  const eo = r * 0.26
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(hx + s * eo * 0.8 + faceX * r * 0.12, hy - r * 0.05 + s * r * 0.02, er + 1.5, 0, TAU); ctx.fill()
    ctx.fillStyle = e.boss || e.elite ? '#dc2626' : '#1f2937'
    ctx.beginPath(); ctx.arc(hx + s * eo * 0.8 + faceX * r * 0.2, hy - r * 0.05, er, 0, TAU); ctx.fill()
  }
  // angry brows for sprinter/elite
  if (e.kind === 'sprinter' || e.elite || e.boss) {
    ctx.strokeStyle = def.dark
    ctx.lineWidth = 2
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(hx + s * eo * 0.8 - s * er, hy - r * 0.24)
      ctx.lineTo(hx + s * eo * 0.8 + s * er * 1.4, hy - r * 0.32)
      ctx.stroke()
    }
  }

  // boss spikes
  if (e.boss) {
    ctx.fillStyle = def.dark
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + t * 0.4
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9 + r * 0.1)
      ctx.lineTo(Math.cos(a + 0.3) * r * 1.18, Math.sin(a + 0.3) * r * 1.18 + r * 0.1)
      ctx.lineTo(Math.cos(a + 0.15) * r * 0.9, Math.sin(a + 0.15) * r * 0.9 + r * 0.1)
      ctx.closePath(); ctx.fill()
    }
  }

  // cleaver in hand for thrower/spitter
  if (e.kind === 'thrower' || (e.boss && e.archetype === 'spitter')) {
    ctx.save()
    ctx.rotate(t * 3 + e.wob)
    ctx.fillStyle = '#cbd5e1'
    ctx.strokeStyle = '#64748b'
    ctx.beginPath(); ctx.rect(r * 0.9, -r * 0.12, r * 0.5, r * 0.4); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#78350f'
    ctx.fillRect(r * 0.55, -r * 0.05, r * 0.4, r * 0.14)
    ctx.restore()
  }

  drawEnemyOverlay(ctx, e, t, r)
}

function drawPlayer(ctx: CanvasRenderingContext2D, w: World, t: number) {
  const p = w.player
  const bob = p.moving ? Math.sin(t * 12) * 1.6 : Math.sin(t * 3) * 0.6
  const blink = p.iframes > 0 && Math.sin(t * 40) > 0
  const fx = Math.cos(p.facing), fy = Math.sin(p.facing)

  ctx.save()
  ctx.translate(p.x, p.y + bob)
  if (blink) ctx.globalAlpha = 0.45

  // shadow
  ctx.fillStyle = 'rgba(20,40,10,0.3)'
  ctx.beginPath(); ctx.ellipse(0, 16 - bob, 16, 7, 0, 0, TAU); ctx.fill()

  // school backpack
  ctx.fillStyle = '#3f3a55'
  ctx.strokeStyle = '#272338'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.roundRect(-fx * 11 - 8, -8 - fy * 7, 14, 17, 5); ctx.fill(); ctx.stroke()

  // legs — grey uniform trousers
  ctx.fillStyle = '#4b5563'
  ctx.strokeStyle = '#374151'
  for (const s of [-1, 1]) {
    const step = p.moving ? Math.sin(t * 12 + (s > 0 ? Math.PI : 0)) * 3 : 0
    ctx.beginPath(); ctx.roundRect(s * 5.5 - 4, 12, 8, 10 + step * 0.4, 3); ctx.fill(); ctx.stroke()
  }

  // ── RED school uniform blazer ──
  ctx.fillStyle = '#c2201f'
  ctx.strokeStyle = '#7f1414'
  ctx.lineWidth = 2.2
  ctx.beginPath(); ctx.roundRect(-12, -9, 24, 25, 9); ctx.fill(); ctx.stroke()

  // white collar + tie
  ctx.fillStyle = '#f8fafc'
  ctx.beginPath()
  ctx.moveTo(-7, -9); ctx.lineTo(0, -1); ctx.lineTo(7, -9)
  ctx.lineTo(4, -10); ctx.lineTo(0, -5); ctx.lineTo(-4, -10)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#facc15'
  ctx.beginPath()
  ctx.moveTo(0, -3); ctx.lineTo(2.6, 1); ctx.lineTo(0, 7); ctx.lineTo(-2.6, 1)
  ctx.closePath(); ctx.fill()

  // golden "H" crest on the chest — Human International School
  ctx.save()
  ctx.fillStyle = '#f5c518'
  ctx.strokeStyle = '#8a6a08'
  ctx.lineWidth = 0.9
  const hX = 6.5, hY = 6.5
  ctx.fillRect(hX - 3.4, hY - 4, 1.9, 8)      // left post
  ctx.strokeRect(hX - 3.4, hY - 4, 1.9, 8)
  ctx.fillRect(hX + 1.5, hY - 4, 1.9, 8)      // right post
  ctx.strokeRect(hX + 1.5, hY - 4, 1.9, 8)
  ctx.fillRect(hX - 3.4, hY - 1, 6.8, 1.9)    // crossbar
  ctx.strokeRect(hX - 3.4, hY - 1, 6.8, 1.9)
  ctx.restore()

  // blazer shoulder sheen
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.beginPath(); ctx.roundRect(-12, -9, 24, 8, 8); ctx.fill()

  // head
  ctx.strokeStyle = '#a8793f'
  ctx.lineWidth = 2
  ctx.fillStyle = '#ffd9a8'
  ctx.beginPath(); ctx.arc(fx * 4, -17, 11.5, 0, TAU); ctx.fill(); ctx.stroke()

  // hair
  ctx.fillStyle = '#3b2a1c'
  ctx.beginPath(); ctx.arc(fx * 4, -19.5, 11.2, Math.PI * 1.03, Math.PI * 1.97); ctx.fill()
  ctx.beginPath(); ctx.ellipse(fx * 4 - 6, -21, 5, 3.4, -0.5, 0, TAU); ctx.fill()

  // eyes
  ctx.fillStyle = '#1f2937'
  ctx.beginPath(); ctx.arc(fx * 4 - 3.5 + fx * 2, -16, 1.9, 0, TAU); ctx.fill()
  ctx.beginPath(); ctx.arc(fx * 4 + 3.5 + fx * 2, -16, 1.9, 0, TAU); ctx.fill()

  ctx.globalAlpha = 1
  ctx.restore()
}

function drawGem(ctx: CanvasRenderingContext2D, g: Gem, t: number) {
  const bobY = Math.sin(t * 4 + g.ph) * 2.5
  const colors = ['#22d3ee', '#4ade80', '#fbbf24']
  const strok = ['#155e75', '#14532d', '#92400e']
  const s = g.tier === 0 ? 11 : g.tier === 1 ? 14 : 18
  ctx.save()
  ctx.translate(g.x, g.y + bobY)
  // soft glow disc behind the gem
  ctx.fillStyle = colors[g.tier]
  ctx.globalAlpha = 0.22 + 0.08 * Math.sin(t * 5 + g.ph)
  ctx.beginPath(); ctx.arc(0, 0, s * 1.05, 0, TAU); ctx.fill()
  ctx.globalAlpha = 1
  ctx.rotate(Math.sin(t * 2 + g.ph) * 0.25)
  ctx.rotate(Math.PI / 4)
  ctx.fillStyle = colors[g.tier]
  ctx.strokeStyle = strok[g.tier]
  ctx.lineWidth = 2.6
  ctx.beginPath(); ctx.rect(-s / 2, -s / 2, s, s); ctx.fill(); ctx.stroke()
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillRect(-s / 3.1, -s / 3.1, s * 0.3, s * 0.3)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fillRect(s / 4 - 1, s / 4, s * 0.16, s * 0.16)
  ctx.restore()
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item, t: number) {
  const bobY = Math.sin(t * 3 + it.ph) * 3
  ctx.save()
  ctx.translate(it.x, it.y + bobY)
  ctx.fillStyle = 'rgba(20,40,10,0.25)'
  ctx.beginPath(); ctx.ellipse(0, 12 - bobY, 13, 5, 0, 0, TAU); ctx.fill()

  if (it.kind === 'meat') {
    ctx.rotate(Math.sin(t * 2 + it.ph) * 0.15)
    ctx.fillStyle = '#b91c1c'
    ctx.strokeStyle = '#7f1d1d'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); ctx.stroke()
    ctx.strokeStyle = '#e7e5e4'
    ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(5, 3); ctx.lineTo(13, 9); ctx.stroke()
    ctx.fillStyle = '#e7e5e4'
    ctx.beginPath(); ctx.arc(14, 10, 3, 0, TAU); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath(); ctx.arc(-3, -3, 3.4, 0, TAU); ctx.fill()
  } else if (it.kind === 'magnet') {
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 7
    ctx.beginPath(); ctx.arc(0, 0, 8, Math.PI, 0, false); ctx.stroke()
    ctx.fillStyle = '#ef4444'
    ctx.fillRect(-11.5, -2, 7, 9)
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(4.5, -2, 7, 9)
  } else if (it.kind === 'bomb') {
    ctx.fillStyle = '#1f2937'
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 2, 9, 0, TAU); ctx.fill(); ctx.stroke()
    ctx.strokeStyle = '#a16207'
    ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(3, -5); ctx.quadraticCurveTo(8, -12, 12, -10); ctx.stroke()
    ctx.fillStyle = `rgba(251,191,36,${0.6 + 0.4 * Math.sin(t * 14)})`
    ctx.beginPath(); ctx.arc(12, -10, 3, 0, TAU); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.beginPath(); ctx.arc(-3, -1, 3, 0, TAU); ctx.fill()
  } else {
    // chest
    const glow = 0.5 + 0.5 * Math.sin(t * 5)
    const gr = ctx.createRadialGradient(0, 0, 4, 0, 0, 30)
    gr.addColorStop(0, `rgba(250,204,21,${0.5 * glow + 0.2})`)
    gr.addColorStop(1, 'rgba(250,204,21,0)')
    ctx.fillStyle = gr
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill()
    ctx.fillStyle = '#92400e'
    ctx.strokeStyle = '#451a03'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.roundRect(-11, -8, 22, 17, 3); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#b45309'
    ctx.beginPath(); ctx.roundRect(-11, -8, 22, 8, 4); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#facc15'
    ctx.fillRect(-2.5, -3, 5, 7)
  }
  ctx.restore()
}

function drawZone(ctx: CanvasRenderingContext2D, z: Zone, t: number) {
  const a = Math.min(1, z.life / 0.6) * Math.min(1, (z.maxLife - z.life) / 0.15 + 0.4)
  const flick = 1 + Math.sin(t * 9 + z.id) * 0.05
  const r = z.radius * flick
  if (z.kind === 'fire') {
    const g = ctx.createRadialGradient(z.x, z.y, r * 0.1, z.x, z.y, r)
    g.addColorStop(0, `rgba(255,190,60,${0.55 * a})`)
    g.addColorStop(0.55, `rgba(249,115,22,${0.42 * a})`)
    g.addColorStop(1, 'rgba(220,38,38,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(z.x, z.y, r, 0, TAU); ctx.fill()
    ctx.strokeStyle = `rgba(254,215,130,${0.5 * a})`
    ctx.lineWidth = 2
    ctx.setLineDash([8, 10])
    ctx.beginPath(); ctx.arc(z.x, z.y, r * 0.92, t * 1.5, t * 1.5 + TAU); ctx.stroke()
    ctx.setLineDash([])
  } else {
    const g = ctx.createRadialGradient(z.x, z.y, r * 0.1, z.x, z.y, r)
    g.addColorStop(0, `rgba(125,211,252,${0.5 * a})`)
    g.addColorStop(1, 'rgba(56,189,248,0)')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(z.x, z.y, r, 0, TAU); ctx.fill()
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, pr: Projectile, t: number) {
  ctx.save()
  if (pr.kind === 'molotov') {
    const k = Math.min(1, pr.t / pr.dur)
    const x = pr.sx + (pr.tx - pr.sx) * k
    const y = pr.sy + (pr.ty - pr.sy) * k
    const z = Math.sin(k * Math.PI) * 120
    // target marker
    ctx.strokeStyle = 'rgba(60,20,20,0.35)'
    ctx.setLineDash([5, 6])
    ctx.beginPath(); ctx.arc(pr.tx, pr.ty, 16, 0, TAU); ctx.stroke()
    ctx.setLineDash([])
    // bottle
    ctx.translate(x, y - z)
    ctx.rotate(pr.spin + t * 12)
    ctx.fillStyle = 'rgba(20,40,10,0.2)'
    ctx.beginPath(); ctx.ellipse(0, z + 6, 6, 2.4, 0, 0, TAU); ctx.fill()
    ctx.fillStyle = '#b45309'
    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 2.4
    ctx.beginPath(); ctx.roundRect(-7, -12, 14, 22, 5); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#fbbf24'
    ctx.fillRect(-3.5, -17, 7, 7)
    ctx.fillStyle = `rgba(255,120,20,${0.75 + 0.25 * Math.sin(t * 25)})`
    ctx.beginPath(); ctx.arc(0, -20, 5.6, 0, TAU); ctx.fill()
    ctx.restore()
    return
  }
  ctx.translate(pr.x, pr.y)
  if (pr.kind === 'kunai') {
    ctx.rotate(Math.atan2(pr.vy, pr.vx))
    ctx.fillStyle = 'rgba(30,40,20,0.18)'
    ctx.beginPath(); ctx.ellipse(-2, 6, 7, 2.4, 0, 0, TAU); ctx.fill()
    ctx.fillStyle = '#f1f5f9'
    ctx.strokeStyle = '#475569'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(19, 0); ctx.lineTo(-4, 8); ctx.lineTo(-4, -8)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#334155'
    ctx.fillRect(-13, -3.4, 11, 6.8)
    ctx.fillStyle = '#f472b6'
    ctx.fillRect(-15, -2, 4, 4)
  } else if (pr.kind === 'shuriken') {
    ctx.rotate(pr.spin + t * 14)
    ctx.fillStyle = '#f9a8d4'
    ctx.strokeStyle = '#9d174d'
    ctx.lineWidth = 2.4
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(7, -5, 23, -3)
      ctx.quadraticCurveTo(9, 6, 0, 0)
      ctx.fill(); ctx.stroke()
    }
    ctx.fillStyle = '#fdf2f8'
    ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, TAU); ctx.fill(); ctx.stroke()
  } else if (pr.kind === 'rocket') {
    ctx.rotate(Math.atan2(pr.vy, pr.vx))
    ctx.fillStyle = `rgba(251,146,60,${0.75 + 0.25 * Math.sin(t * 30)})`
    ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(-30 - Math.random() * 9, 0); ctx.lineTo(-14, 6); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#c4b5fd'
    ctx.strokeStyle = '#4c1d95'
    ctx.lineWidth = 2.6
    ctx.beginPath(); ctx.roundRect(-14, -8, 24, 16, 7); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#7c3aed'
    ctx.beginPath(); ctx.moveTo(9, -8); ctx.lineTo(23, 0); ctx.lineTo(9, 8); ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#ede9fe'
    ctx.beginPath(); ctx.arc(-2, 0, 3.4, 0, TAU); ctx.fill()
  } else if (pr.kind === 'wave') {
    ctx.rotate(Math.atan2(pr.vy, pr.vx))
    ctx.strokeStyle = `rgba(220,252,231,${Math.min(1, pr.life * 3) * 0.95})`
    ctx.lineWidth = 10
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.arc(0, 0, 26, -1.25, 1.25); ctx.stroke()
    ctx.strokeStyle = `rgba(34,197,94,${Math.min(1, pr.life * 3) * 0.6})`
    ctx.lineWidth = 20
    ctx.beginPath(); ctx.arc(0, 0, 26, -1.15, 1.15); ctx.stroke()
  } else if (pr.kind === 'cleaver') {
    ctx.rotate(pr.spin + t * 16)
    ctx.fillStyle = '#e2e8f0'
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 2.4
    ctx.beginPath(); ctx.rect(-4, -14, 16, 20); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#78350f'
    ctx.fillRect(-2, 5, 5, 12)
  } else if (pr.kind === 'orb') {
    const r = pr.radius * 1.35 * (1 + Math.sin(t * 12 + pr.id) * 0.08)
    ctx.fillStyle = '#dc2626'
    ctx.strokeStyle = '#7f1d1d'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#fecaca'
    ctx.beginPath(); ctx.arc(-r * 0.16, -r * 0.16, r * 0.4, 0, TAU); ctx.fill()
  }
  ctx.restore()
}

// ── main entry ───────────────────────────────────────────────────────────────

export function drawWorld(ctx: CanvasRenderingContext2D, world: World, W: number, H: number) {
  const t = world.time
  const cx = world.cam.x + (Math.random() - 0.5) * world.shake
  const cy = world.cam.y + (Math.random() - 0.5) * world.shake

  ctx.save()
  ctx.translate(-cx, -cy)

  // ground
  const pat = ctx.createPattern(getGroundPattern(), 'repeat')
  if (pat) {
    ctx.fillStyle = pat
    ctx.fillRect(cx - 4, cy - 4, W + 8, H + 8)
  } else {
    ctx.fillStyle = '#cfcabc'
    ctx.fillRect(cx - 4, cy - 4, W + 8, H + 8)
  }

  // campus scenery (lawns, courts, trees, benches, walkways)
  drawCampus(ctx, cx, cy, W, H, t)

  // zones under everything
  for (const z of world.zones) drawZone(ctx, z, t)

  // gems & items
  for (const g of world.gems) drawGem(ctx, g, t)
  for (const it of world.items) drawItem(ctx, it, t)

  // enemies sorted by y
  scratch.length = 0
  for (const e of world.enemies) scratch.push(e)
  scratch.sort((a, b) => a.y - b.y)
  for (const e of scratch) drawEnemyBody(ctx, e, t, world.player.x, world.player.y)

  // level-up beam
  if (world.levelFlash > 0) {
    const g = ctx.createLinearGradient(0, world.player.y - 160, 0, world.player.y + 30)
    g.addColorStop(0, 'rgba(56,224,250,0)')
    g.addColorStop(1, `rgba(56,224,250,${world.levelFlash * 0.8})`)
    ctx.fillStyle = g
    ctx.fillRect(world.player.x - 26, world.player.y - 160, 52, 190)
  }

  if (!world.over) drawPlayer(ctx, world, t)

  // guardian blades
  for (const wpn of world.player.weapons) {
    if (wpn.id !== 'guardian' || !wpn.up) continue
    const n = wpn.evo ? 6 : wpn.level >= 4 ? (wpn.level === 4 ? 4 : 5) : (wpn.level === 1 ? 2 : 3)
    const rad = (wpn.evo ? 128 : 92 + wpn.level * 6)
    const col = wpn.evo ? '#fde047' : '#facc15'
    for (let i = 0; i < n; i++) {
      const a = wpn.bladeA + (i / n) * TAU
      const bx = world.player.x + Math.cos(a) * rad
      const by = world.player.y + Math.sin(a) * rad
      ctx.strokeStyle = 'rgba(250,204,21,0.22)'
      ctx.lineWidth = 10
      ctx.beginPath()
      ctx.arc(world.player.x, world.player.y, rad, a - 0.5, a - 0.05)
      ctx.stroke()
      ctx.save()
      ctx.translate(bx, by)
      ctx.rotate(a * 3 + t * 10)
      ctx.fillStyle = col
      ctx.strokeStyle = wpn.evo ? '#a16207' : '#ca8a04'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(0, 0, wpn.evo ? 15 : 12, wpn.evo ? 11 : 9, 0, 0, TAU)
      ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#fffbeb'
      ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, TAU); ctx.fill()
      ctx.restore()
    }
  }

  // projectiles
  for (const pr of world.projectiles) drawProjectile(ctx, pr, t)

  // slashes
  for (const s of world.slashes) {
    const p = 1 - s.life / s.maxLife
    ctx.save()
    ctx.translate(s.x, s.y)
    ctx.rotate(s.angle)
    ctx.globalAlpha = Math.max(0, 1 - p)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 5
    ctx.beginPath(); ctx.arc(0, 0, s.range * (0.55 + 0.45 * p), -s.arc / 2, s.arc / 2); ctx.stroke()
    ctx.strokeStyle = s.color
    ctx.lineWidth = 11
    ctx.beginPath(); ctx.arc(0, 0, s.range * (0.55 + 0.45 * p), -s.arc / 2 + 0.06, s.arc / 2 - 0.06); ctx.stroke()
    ctx.restore()
    ctx.globalAlpha = 1
  }

  // lightning bolts
  for (const b of world.bolts) {
    const a = b.life / b.maxLife
    ctx.save()
    ctx.strokeStyle = `rgba(56,189,248,${0.5 * a})`
    ctx.lineWidth = 6
    ctx.shadowColor = '#38bdf8'
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.moveTo(b.pts[0], b.pts[1])
    for (let i = 2; i < b.pts.length; i += 2) ctx.lineTo(b.pts[i], b.pts[i + 1])
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.strokeStyle = `rgba(255,255,255,${a})`
    ctx.lineWidth = 2.2
    ctx.stroke()
    ctx.restore()
    // ground flash
    const fg = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 40)
    fg.addColorStop(0, `rgba(186,230,253,${0.5 * a})`)
    fg.addColorStop(1, 'rgba(186,230,253,0)')
    ctx.fillStyle = fg
    ctx.beginPath(); ctx.arc(b.x, b.y, 40, 0, TAU); ctx.fill()
  }

  // particles
  for (const pt of world.parts) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife)
    ctx.fillStyle = pt.color
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size)
  }
  ctx.globalAlpha = 1

  // floating texts
  ctx.textAlign = 'center'
  for (const ft of world.texts) {
    const p = ft.life / ft.maxLife
    ctx.globalAlpha = Math.max(0, Math.min(1, p * 2))
    ctx.font = `800 ${ft.size}px "Baloo 2", sans-serif`
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(15,25,10,0.75)'
    ctx.strokeText(ft.text, ft.x, ft.y)
    ctx.fillStyle = ft.color
    ctx.fillText(ft.text, ft.x, ft.y)
  }
  ctx.globalAlpha = 1

  ctx.restore()

  // ── screen space: edge markers for boss/elites ──
  markerList.length = 0
  for (const e of world.enemies) {
    if (!e.boss && !e.elite) continue
    if (e.x > cx + 30 && e.x < cx + W - 30 && e.y > cy + 30 && e.y < cy + H - 30) continue
    markerList.push({ x: e.x, y: e.y, color: e.boss ? '#ef4444' : '#c084fc' })
  }
  for (const m of markerList) {
    const sx = Math.min(Math.max(m.x - cx, 44), W - 44)
    const sy = Math.min(Math.max(m.y - cy, 96), H - 44)
    const ang = Math.atan2(m.y - cy - sy, m.x - cx - sx)
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(ang)
    ctx.fillStyle = m.color
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(16, 0); ctx.lineTo(2, -9); ctx.lineTo(2, 9)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.restore()
  }

  // ── overlays ──
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(6,18,8,0.4)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)

  const hpPct = world.player.hp / world.player.maxHp
  if (hpPct < 0.32 && !world.over) {
    const pulse = 0.16 + 0.1 * Math.sin(t * 5)
    const lg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7)
    lg.addColorStop(0, 'rgba(220,38,38,0)')
    lg.addColorStop(1, `rgba(220,38,38,${pulse + (0.32 - hpPct)})`)
    ctx.fillStyle = lg
    ctx.fillRect(0, 0, W, H)
  }
  if (world.hurtFlash > 0) {
    ctx.fillStyle = `rgba(220,38,38,${world.hurtFlash * 0.4})`
    ctx.fillRect(0, 0, W, H)
  }
  if (world.bombFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${world.bombFlash})`
    ctx.fillRect(0, 0, W, H)
  }
}
