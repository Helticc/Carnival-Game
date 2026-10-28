import { useEffect, useRef, useState, useCallback } from 'react'
import { Pause, Play, Volume2, VolumeX, Heart, Clock, Skull, Crown } from 'lucide-react'
import { Engine } from '../game/engine'
import type { Hud, Offer, RunStats, WeaponId, PassiveId } from '../game/types'
import { WEAPON_META, PASSIVE_META, fmtTime } from '../game/data'
import { ChoiceModal, PausePanel, GameOverPanel } from './Modals'
import { saveRun, loadName, loadHouse, MUTE_KEY } from '../leaderboard'
import { cn } from '../utils/cn'

type BannerKind = 'warn' | 'info' | 'good'
interface Banner { id: number; text: string; kind: BannerKind }
interface ModalState { chest: boolean; offers: Offer[] }

let bannerId = 1

export default function GameScreen({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const bannerTimers = useRef<number[]>([])
  const joyRef = useRef<{ id: number | null; x: number; y: number }>({ id: null, x: 0, y: 0 })

  const [hud, setHud] = useState<Hud | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [paused, setPaused] = useState(false)
  const [over, setOver] = useState<RunStats | null>(null)
  const [result, setResult] = useState<{ rank: number | null; improved: boolean; previousBest: number } | null>(null)
  const [banners, setBanners] = useState<Banner[]>([])
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
  })
  const [joy, setJoy] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null)
  const [showHint, setShowHint] = useState(true)

  // ── engine lifecycle ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false
    const engine = new Engine(canvas, {
      onLevelUp: (offers) => setModal({ chest: false, offers }),
      onChest: (offers) => setModal({ chest: true, offers }),
      onOver: (stats) => {
        setOver(stats)
        try {
          const nm = (loadName().trim() || 'Survivor')
          const res = saveRun({
            name: nm, house: loadHouse(),
            time: Math.floor(stats.time), kills: stats.kills, level: stats.level,
          })
          setResult(res)
        } catch { setResult(null) }
      },
      onBanner: (text, kind) => {
        const id = bannerId++
        setBanners(b => [...b.slice(-2), { id, text, kind }])
        const t = window.setTimeout(() => setBanners(b => b.filter(x => x.id !== id)), 3000)
        bannerTimers.current.push(t)
      },
      onPause: (v) => setPaused(v),
    })
    try { engine.sfx.setMuted(localStorage.getItem(MUTE_KEY) === '1') } catch { /* noop */ }
    engineRef.current = engine
    engine.start()

    const hudTimer = window.setInterval(() => {
      if (!disposed && engineRef.current) setHud(engineRef.current.getHud())
    }, 120)
    const hintTimer = window.setTimeout(() => setShowHint(false), 6000)

    const escHandler = (e: KeyboardEvent) => {
      const eng = engineRef.current
      if (!eng || eng.modalOpen || eng.world.over) return
      if (e.code === 'Escape' || e.code === 'KeyP') eng.setPaused(!eng.paused)
    }
    window.addEventListener('keydown', escHandler)

    return () => {
      disposed = true
      window.clearInterval(hudTimer)
      window.clearTimeout(hintTimer)
      window.removeEventListener('keydown', escHandler)
      bannerTimers.current.forEach(t => window.clearTimeout(t))
      bannerTimers.current = []
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  const pick = useCallback((o: Offer) => {
    const eng = engineRef.current
    if (!eng) return
    eng.applyUpgrade(o)
    if (!eng.modalOpen) setModal(null)
  }, [])

  const togglePause = useCallback(() => {
    const eng = engineRef.current
    if (!eng || eng.modalOpen || eng.world.over) return
    eng.sfx.ensure(); eng.sfx.ui()
    eng.setPaused(!eng.paused)
  }, [])

  const toggleMute = useCallback(() => {
    const eng = engineRef.current
    setMuted(m => {
      const next = !m
      try { localStorage.setItem(MUTE_KEY, next ? '1' : '0') } catch { /* noop */ }
      eng?.sfx.ensure()
      eng?.sfx.setMuted(next)
      if (!next) eng?.sfx.ui()
      return next
    })
  }, [])

  const retry = useCallback(() => {
    const eng = engineRef.current
    if (!eng) return
    eng.sfx.ensure()
    setOver(null); setModal(null); setResult(null); setBanners([])
    eng.resetRun()
  }, [])

  // ── joystick ──
  const onPointerDown = (e: React.PointerEvent) => {
    const el = e.target as HTMLElement
    if (el.closest('button') || el.closest('input')) return
    const eng = engineRef.current
    if (!eng || eng.paused || eng.world.over) return
    eng.sfx.ensure()
    joyRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
    setJoy({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (joyRef.current.id !== e.pointerId) return
    const eng = engineRef.current
    if (!eng) return
    const j = joyRef.current
    let dx = e.clientX - j.x, dy = e.clientY - j.y
    const len = Math.hypot(dx, dy)
    const max = 52
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max }
    eng.setTouch(len < 6 ? { x: 0, y: 0 } : { x: dx / max, y: dy / max })
    setJoy({ x: j.x, y: j.y, dx, dy })
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (joyRef.current.id !== e.pointerId) return
    joyRef.current.id = null
    engineRef.current?.setTouch(null)
    setJoy(null)
  }

  const hpPct = hud ? hud.hp / hud.maxHp : 1
  const xpPct = hud ? Math.min(1, hud.xp / hud.xpNeed) : 0

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* ── HUD ── */}
      <div className="absolute inset-0 pointer-events-none select-none">
        {/* XP bar */}
        <div className="mx-2.5 mt-2.5">
          <div className="relative h-7 rounded-full border border-black/50 bg-black/45 overflow-hidden shadow-md">
            <div
              className="absolute inset-y-0 left-0 bg-sky-400 transition-[width] duration-150"
              style={{ width: `${xpPct * 100}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center gap-2">
              <span className="font-game font-extrabold text-[13px] text-white text-outline-sm tracking-[0.2em]">
                LV {hud?.level ?? 1}
              </span>
              <span className="font-game font-bold text-[11px] text-white/70 text-outline-sm">
                {Math.floor(hud?.xp ?? 0)} / {hud?.xpNeed ?? 10} EXP
              </span>
            </div>
          </div>
        </div>

        {/* main row */}
        <div className="mt-1.5 px-2.5 flex items-start justify-between gap-2">
          {/* left: hp + skills */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <Heart size={16} className="text-rose-500 fill-rose-500 drop-shadow shrink-0" />
              <div className="w-32 sm:w-40 h-4 rounded-full border border-black/50 bg-black/45 overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-[width] duration-150"
                  style={{ width: `${hpPct * 100}%` }}
                />
              </div>
              <span className="font-game font-extrabold text-[12px] text-white text-outline-sm tabular-nums">{hud?.hp ?? 100}/{hud?.maxHp ?? 100}</span>
            </div>
            <div className="flex flex-wrap gap-1 max-w-[260px]">
              {hud?.weapons.map(w => {
                const meta = WEAPON_META[w.id as WeaponId]
                const Icon = w.evo ? meta.evoIcon! : meta.icon
                return (
                  <div
                    key={w.id}
                    className={cn(
                      'w-10 h-10 rounded-xl border bg-slate-900/70 flex items-center justify-center relative shadow-sm',
                      w.evo ? 'border-amber-400' : 'border-white/15',
                    )}
                    title={`${w.evo ? meta.evoName : meta.name} Lv.${w.level}`}
                  >
                    <Icon size={18} style={{ color: meta.color }} className={cn(meta.iconRotate && '-rotate-45')} />
                    <span className={cn(
                      'absolute -bottom-1 -right-1 rounded-md px-1 text-[8.5px] font-game font-extrabold border border-black/30',
                      w.evo ? 'bg-amber-400 text-amber-950' : 'bg-white text-slate-800',
                    )}>
                      {w.evo ? 'EVO' : w.level}
                    </span>
                  </div>
                )
              })}
              {hud?.passives.map(w => {
                const meta = PASSIVE_META[w.id as PassiveId]
                const Icon = meta.icon
                return (
                  <div key={w.id} className="w-10 h-10 rounded-xl border border-white/10 bg-slate-900/50 flex items-center justify-center relative shadow-sm" title={`${meta.name} Lv.${w.level}`}>
                    <Icon size={16} style={{ color: meta.color }} />
                    <span className="absolute -bottom-1 -right-1 rounded-md bg-slate-200 text-slate-800 px-1 text-[8.5px] font-game font-extrabold border border-black/30">{w.level}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* center: timer */}
          <div className="flex flex-col items-center shrink-0 pt-0.5">
            <div className="flex items-center gap-1.5">
              <Clock size={15} className="text-white/70" />
              <span className="font-game font-extrabold text-2xl sm:text-3xl text-white text-outline tabular-nums">
                {fmtTime(hud?.time ?? 0)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 -mt-0.5">
              <Skull size={13} className="text-rose-300" />
              <span className="font-game font-bold text-sm text-white text-outline-sm tabular-nums">{hud?.kills ?? 0}</span>
            </div>
          </div>

          {/* right: buttons */}
          <div className="flex gap-1.5 pointer-events-auto">
            <button onClick={toggleMute} className="w-9 h-9 rounded-xl bg-slate-900/70 border border-white/15 flex items-center justify-center text-white/85 cursor-pointer hover:bg-slate-800 transition-colors">
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button onClick={togglePause} className="w-9 h-9 rounded-xl bg-slate-900/70 border border-white/15 flex items-center justify-center text-white/85 cursor-pointer hover:bg-slate-800 transition-colors">
              {paused && !modal && !over ? <Play size={16} /> : <Pause size={16} />}
            </button>
          </div>
        </div>

        {/* boss bar */}
        {hud?.boss && (
          <div className="absolute top-[92px] left-1/2 -translate-x-1/2 w-[min(420px,80vw)] pop-in">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Crown size={14} className="text-amber-300" />
              <span className="font-game font-extrabold text-sm text-white text-outline-sm uppercase tracking-widest">{hud.boss.name}</span>
            </div>
            <div className="h-3.5 rounded-full border border-black/50 bg-black/50 overflow-hidden">
              <div
                className="h-full bg-red-500 transition-[width] duration-150"
                style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* banners */}
        <div className="absolute top-[136px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 w-full px-4">
          {banners.map(b => (
            <div
              key={b.id}
              className={cn(
                'banner-slam font-game font-extrabold uppercase tracking-wider text-sm sm:text-base px-5 py-1.5 rounded-full border shadow-lg',
                b.kind === 'warn' && 'bg-red-600 border-red-400 text-white',
                b.kind === 'good' && 'bg-green-600 border-green-400 text-white',
                b.kind === 'info' && 'bg-slate-700 border-slate-500 text-white',
              )}
            >
              {b.text}
            </div>
          ))}
        </div>

        {/* move hint */}
        {showHint && !modal && !over && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 fade-in">
            <div className="rounded-full bg-slate-900/80 border border-white/15 px-5 py-2 font-game font-bold text-white/80 text-sm">
              Move with <span className="text-green-400 font-extrabold">WASD / Arrows</span> or <span className="text-green-400 font-extrabold">drag</span> — weapons fire automatically
            </div>
          </div>
        )}

        {/* joystick */}
        {joy && !modal && (
          <div
            className="absolute rounded-full border border-white/30 bg-black/25"
            style={{ left: joy.x - 56, top: joy.y - 56, width: 112, height: 112 }}
          >
            <div
              className="absolute rounded-full bg-white/80 shadow-md"
              style={{ left: 56 - 23 + joy.dx, top: 56 - 23 + joy.dy, width: 46, height: 46 }}
            />
          </div>
        )}
      </div>

      {/* ── overlays ── */}
      {modal && <ChoiceModal offers={modal.offers} chest={modal.chest} onPick={pick} />}
      {paused && !modal && !over && hud && (
        <PausePanel
          time={hud.time} kills={hud.kills} level={hud.level} muted={muted}
          onResume={() => engineRef.current?.setPaused(false)}
          onRestart={retry}
          onMenu={onExit}
          onMute={toggleMute}
        />
      )}
      {over && <GameOverPanel stats={over} result={result} onRetry={retry} onMenu={onExit} />}
    </div>
  )
}
