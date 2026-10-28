import { useEffect, useState } from 'react'
import {
  Trophy, Keyboard, MousePointer2, Crosshair, Sparkles, Skull, Infinity as InfinityIcon, Gamepad2, Check,
} from 'lucide-react'
import { fmtTime } from '../game/data'
import { loadBoard, loadName, saveName, loadHouse, saveHouse, type LBEntry } from '../leaderboard'
import { HOUSES, getHouse, type HouseId } from '../houses'
import { cn } from '../utils/cn'
import Logo from './Logo'
import HouseIcon from './HouseIcon'

const PODIUM = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-700', 'bg-orange-300 text-orange-900']

export default function MenuScreen({ onPlay }: { onPlay: () => void }) {
  const [name, setName] = useState('')
  const [house, setHouse] = useState<HouseId>('TSA')
  const [board, setBoard] = useState<LBEntry[]>([])

  useEffect(() => {
    setName(loadName())
    setHouse(loadHouse())
    setBoard(loadBoard())
  }, [])

  const pickHouse = (id: HouseId) => { setHouse(id); saveHouse(id) }
  const me = name.trim().toLowerCase()
  const selected = getHouse(house)

  return (
    <div className="relative h-full w-full overflow-y-auto bg-[#eceff1]">
      <div className="bg-dots absolute inset-0 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10 min-h-full flex flex-col">
        {/* ── brand header ── */}
        <header className="pop-in flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={46} />
            <div>
              <div className="text-[10px] font-bold tracking-[0.35em] text-slate-400 uppercase">Made by</div>
              <div className="font-game font-extrabold text-slate-800 text-xl sm:text-2xl leading-none tracking-wide">TSA HOUSE</div>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500 shadow-sm">
            <InfinityIcon size={13} className="text-green-600" /> Endless Mode
          </span>
        </header>

        <div className="mt-9 sm:mt-12 grid lg:grid-cols-[minmax(0,1fr)_360px] gap-10 lg:gap-14 items-start flex-1">
          {/* ── left ── */}
          <div className="pop-in" style={{ animationDelay: '60ms' }}>
            <h1 className="font-game font-extrabold leading-[0.92] text-slate-900 text-[15vw] sm:text-7xl">
              IB 0/45 SURVIVAL
            </h1>
            <div className="mt-2 font-game font-extrabold tracking-[0.4em] text-green-600 text-[5vw] sm:text-xl">
              SCHOOL CAMPUS&nbsp;APOCALYPSE
            </div>
            <p className="mt-3.5 max-w-md font-game font-medium text-slate-500 text-sm sm:text-base leading-relaxed">
              Human International Schools Carnival Festival 2026. Shoot and survive as long as you can. Compete for the top standings on the leaderboard.
            </p>

            {/* name + play */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3 max-w-xl">
              <div className="flex-1 min-w-0">
                <label htmlFor="player-name" className="block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1.5">
                  Your name
                </label>
                <input
                  id="player-name"
                  value={name}
                  maxLength={14}
                  onChange={(e) => { setName(e.target.value); saveName(e.target.value) }}
                  placeholder="Survivor"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-game font-bold text-slate-800 text-lg placeholder:text-slate-300 outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/15 transition shadow-sm"
                />
              </div>
              <div className="sm:self-end shrink-0">
                <button
                  onClick={onPlay}
                  className="btn-chunk rounded-xl w-full sm:w-auto flex items-center justify-center gap-2.5 bg-green-600 hover:bg-green-500 px-10 py-3 font-game font-extrabold uppercase tracking-widest text-white text-lg cursor-pointer"
                >
                  <Gamepad2 size={22} strokeWidth={2.4} /> Play
                </button>
              </div>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-slate-400">
              One entry per name — your best run is the one that counts.
            </p>

            {/* ── house picker ── */}
            <div className="mt-7 max-w-xl">
              <div className="flex items-baseline justify-between mb-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Choose your house</label>
                <span className="font-game font-bold text-xs" style={{ color: selected.color }}>
                  {selected.name} · {selected.note}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2.5">
                {HOUSES.map(h => {
                  const active = h.id === house
                  return (
                    <button
                      key={h.id}
                      onClick={() => pickHouse(h.id)}
                      title={`${h.name} — ${h.note}`}
                      className={cn(
                        'relative rounded-xl border bg-white px-2 py-3 flex flex-col items-center gap-1.5 cursor-pointer transition-all',
                        active ? 'border-transparent ring-2 shadow-md -translate-y-0.5' : 'border-slate-200 hover:border-slate-300 hover:-translate-y-0.5 shadow-sm',
                      )}
                      style={active ? { boxShadow: `0 0 0 2px ${h.color}` } : undefined}
                    >
                      <HouseIcon house={h.id} size={34} />
                      <span className={cn('font-game font-extrabold text-[11px] tracking-wider', active ? 'text-slate-800' : 'text-slate-500')}>
                        {h.name}
                      </span>
                      {active && (
                        <span
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: h.color }}
                        >
                          <Check size={12} strokeWidth={3.5} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* controls */}
            <div className="mt-7 grid grid-cols-3 gap-2.5 max-w-xl">
              {[
                { Icon: Keyboard, Icon2: MousePointer2, title: 'Move', sub: 'WASD / Arrows or drag' },
                { Icon: Crosshair, Icon2: null, title: 'Auto-attack', sub: 'Weapons fire by themselves' },
                { Icon: Sparkles, Icon2: null, title: 'Evolve', sub: 'Max a weapon + its passive' },
              ].map((c, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-white px-3 py-3.5 text-center shadow-sm">
                  <div className="flex justify-center gap-1.5 text-slate-600">
                    <c.Icon size={19} strokeWidth={2.2} />
                    {c.Icon2 && <c.Icon2 size={19} strokeWidth={2.2} />}
                  </div>
                  <div className="font-game font-extrabold text-slate-800 text-sm mt-1.5">{c.title}</div>
                  <div className="font-game font-medium text-slate-400 text-[11px] leading-tight mt-0.5">{c.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── leaderboard ── */}
          <aside className="pop-in rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" style={{ animationDelay: '140ms' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy size={19} className="text-amber-500" />
                <h2 className="font-game font-extrabold text-slate-800 text-lg">Leaderboard</h2>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Top 10</span>
            </div>

            <div className="mt-4 flex flex-col divide-y divide-slate-100">
              {board.slice(0, 10).map((e, i) => {
                const isMe = me.length > 0 && e.name.trim().toLowerCase() === me
                const h = getHouse(e.house)
                return (
                  <div
                    key={`${e.name}-${e.date}`}
                    className={cn('flex items-center gap-2.5 py-2.5', isMe && 'bg-green-50 -mx-2 px-2 rounded-lg')}
                  >
                    <span className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-game font-extrabold shrink-0',
                      i < 3 ? PODIUM[i] : 'bg-slate-100 text-slate-400',
                    )}>
                      {i + 1}
                    </span>
                    <HouseIcon house={h.id} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="font-game font-bold text-slate-800 text-[15px] truncate leading-tight flex items-center gap-1.5">
                        {e.name}
                        {isMe && <span className="rounded bg-green-600 text-white text-[9px] font-extrabold px-1 py-px uppercase tracking-wider">You</span>}
                      </div>
                      <div className="text-[11px] font-semibold flex items-center gap-1.5 mt-0.5">
                        <span style={{ color: h.color }} className="font-extrabold tracking-wider">{h.name}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-400 flex items-center gap-1"><Skull size={10} /> {e.kills}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-400">Lv {e.level}</span>
                      </div>
                    </div>
                    <div className="font-game font-extrabold text-slate-700 tabular-nums text-[15px]">{fmtTime(e.time)}</div>
                  </div>
                )
              })}
              {board.length === 0 && (
                <div className="py-10 text-center">
                  <Trophy size={26} className="mx-auto text-slate-200" />
                  <p className="font-game font-bold text-slate-400 mt-2 text-sm">No runs yet.</p>
                  <p className="font-game font-medium text-slate-300 text-xs">Be the first name on the board.</p>
                </div>
              )}
            </div>

            {board.length > 0 && (
              <p className="mt-3 pt-3 border-t border-slate-100 text-[11px] font-semibold text-slate-400 text-center">
                Each survivor appears once — best run only
              </p>
            )}
          </aside>
        </div>

        {/* ── footer ── */}
        <footer className="mt-10 pt-5 border-t border-slate-200 flex items-center gap-2.5">
          <Logo size={24} />
          <span className="font-game font-extrabold text-slate-500 text-sm tracking-wide">TSA HOUSE</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-400 text-xs font-semibold">Human International School</span>
        </footer>
      </div>
    </div>
  )
}
