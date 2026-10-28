import type { LucideIcon } from 'lucide-react'
import { Gift, Clock, Skull, Star, Gem, Sparkles, Trophy, RefreshCw, Home, Play, Volume2, VolumeX, RotateCcw } from 'lucide-react'
import type { Offer, RunStats, WeaponId, PassiveId } from '../game/types'
import { WEAPON_META, PASSIVE_META, CONSUMABLE_META, weaponBullets, passiveBullet, consumableBullet, fmtTime, fmtNum } from '../game/data'
import { cn } from '../utils/cn'
import { getHouse } from '../houses'
import { loadHouse, loadName } from '../leaderboard'
import HouseIcon from './HouseIcon'

// ── Icon tile (colored, flat) ────────────────────────────────────────────────

function IconTile({ meta, evo }: { meta: { icon: LucideIcon; evoIcon?: LucideIcon; color: string; iconRotate?: boolean }; evo?: boolean }) {
  const Icon = evo ? (meta.evoIcon ?? meta.icon) : meta.icon
  return (
    <div
      className="shrink-0 w-14 h-14 rounded-xl border flex items-center justify-center"
      style={{ backgroundColor: `${meta.color}1c`, borderColor: `${meta.color}59` }}
    >
      <Icon
        size={29}
        strokeWidth={2.3}
        style={{ color: meta.color }}
        className={cn(meta.iconRotate && '-rotate-45')}
      />
    </div>
  )
}

// ── Offer card ───────────────────────────────────────────────────────────────

function OfferCard({ offer, index, onPick }: { offer: Offer; index: number; onPick: (o: Offer) => void }) {
  const isEvo = offer.kind === 'evolve'
  const isWeapon = offer.kind === 'weapon' || isEvo
  const meta = isWeapon
    ? WEAPON_META[offer.id as WeaponId]
    : offer.kind === 'passive'
      ? PASSIVE_META[offer.id as PassiveId]
      : CONSUMABLE_META[offer.id]
  const name = isEvo ? meta.evoName! : meta.name
  const isNew = offer.toLevel <= 1 && (offer.kind === 'weapon' || offer.kind === 'passive')
  const bullets = isWeapon
    ? weaponBullets(offer.id as WeaponId, offer.toLevel, isEvo)
    : offer.kind === 'passive'
      ? [passiveBullet(offer.id as PassiveId, offer.toLevel)]
      : [consumableBullet(offer.id)]
  const reqMeta = isEvo ? PASSIVE_META[WEAPON_META[offer.id as WeaponId].req!] : null
  const ReqIcon = reqMeta?.icon
  const BaseIcon = isEvo ? WEAPON_META[offer.id as WeaponId].icon : null

  return (
    <button
      onClick={() => onPick(offer)}
      className={cn(
        'pop-in group w-full text-left flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-all duration-150 cursor-pointer',
        'bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-700 hover:-translate-y-px active:scale-[0.99]',
        isEvo && 'border-amber-400/80 bg-[#241f14] hover:border-amber-300',
      )}
      style={{ animationDelay: `${index * 70 + 60}ms` }}
    >
      <IconTile meta={meta} evo={isEvo} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('font-game font-bold text-lg leading-tight', isEvo ? 'text-amber-300' : 'text-slate-100')}>
            {name}
          </span>
          {isEvo && (
            <span className="flex items-center gap-1 rounded-md bg-amber-400 text-amber-950 text-[10px] font-extrabold px-1.5 py-0.5 tracking-wider uppercase">
              <Sparkles size={10} strokeWidth={3} /> Evolution
            </span>
          )}
          {isNew && (
            <span className="rounded-md bg-green-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 tracking-wider uppercase">New</span>
          )}
          {!isEvo && (offer.kind === 'weapon' || offer.kind === 'passive') && offer.toLevel > 1 && (
            <span className="text-slate-400 text-xs font-bold">Lv.{offer.toLevel - 1} → Lv.{offer.toLevel}</span>
          )}
        </div>
        {isEvo && reqMeta && ReqIcon && BaseIcon && (
          <div className="flex items-center gap-1.5 mt-1 text-slate-400 text-xs font-semibold">
            <BaseIcon size={12} style={{ color: meta.color }} className={WEAPON_META[offer.id as WeaponId].iconRotate ? '-rotate-45' : ''} />
            <span>{meta.name} Lv.5</span><span className="opacity-50">+</span>
            <ReqIcon size={12} style={{ color: reqMeta.color }} />
            <span>{reqMeta.name}</span>
          </div>
        )}
        {(isWeapon || offer.kind === 'passive') && (
          <div className="flex items-center gap-1 mt-1.5">
            {[0, 1, 2, 3, 4].map(i => (
              <span
                key={i}
                className="h-1.5 w-5 rounded-full"
                style={{ backgroundColor: i < offer.toLevel ? meta.color : '#475569' }}
              />
            ))}
          </div>
        )}
        {bullets.map((b, i) => (
          <p key={i} className="text-[13px] leading-snug text-slate-400 font-medium mt-0.5">{b}</p>
        ))}
      </div>
    </button>
  )
}

// ── Level up / chest modal ───────────────────────────────────────────────────

export function ChoiceModal({ offers, chest, onPick }: { offers: Offer[]; chest: boolean; onPick: (o: Offer) => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm fade-in">
      <div className="pop-in w-full max-w-md">
        <div className="text-center mb-5">
          <div className={cn(
            'banner-slam inline-flex items-center gap-2.5 font-game font-extrabold uppercase tracking-wide text-4xl sm:text-5xl',
            chest ? 'text-amber-300' : 'text-white',
          )}>
            {chest ? <Gift size={38} /> : <Star size={36} className="text-green-400" />}
            {chest ? 'Elite Chest' : 'Level Up'}
          </div>
          <p className="text-slate-400 font-game font-semibold mt-2 text-sm tracking-wide">
            {chest ? 'The elite dropped loot — pick one reward' : 'Choose one upgrade'}
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          {offers.map((o, i) => <OfferCard key={`${o.kind}-${o.id}`} offer={o} index={i} onPick={onPick} />)}
        </div>
      </div>
    </div>
  )
}

// ── Pause ────────────────────────────────────────────────────────────────────

export function PausePanel({ time, kills, level, muted, onResume, onRestart, onMenu, onMute }: {
  time: number; kills: number; level: number; muted: boolean
  onResume: () => void; onRestart: () => void; onMenu: () => void; onMute: () => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm fade-in">
      <div className="pop-in w-full max-w-xs rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h2 className="font-game font-extrabold text-4xl text-center text-white uppercase tracking-wide">Paused</h2>
        <div className="mt-3 mb-5 flex justify-center gap-4 text-slate-400 font-game font-semibold text-sm">
          <span className="flex items-center gap-1.5"><Clock size={14} className="text-sky-400" />{fmtTime(time)}</span>
          <span className="flex items-center gap-1.5"><Skull size={14} className="text-rose-400" />{kills}</span>
          <span className="flex items-center gap-1.5"><Star size={14} className="text-amber-400" />Lv {level}</span>
        </div>
        <div className="flex flex-col gap-2.5">
          <button onClick={onResume} className="btn-chunk rounded-xl font-game flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-extrabold uppercase tracking-wider py-3 text-lg cursor-pointer">
            <Play size={20} strokeWidth={2.6} /> Resume
          </button>
          <button onClick={onRestart} className="btn-chunk rounded-xl font-game flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-100 font-extrabold uppercase tracking-wider py-2.5 cursor-pointer">
            <RotateCcw size={18} strokeWidth={2.6} /> Restart
          </button>
          <div className="flex gap-2.5">
            <button onClick={onMute} className="btn-chunk rounded-xl font-game flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold py-2.5 cursor-pointer">
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />} {muted ? 'Muted' : 'Sound'}
            </button>
            <button onClick={onMenu} className="btn-chunk rounded-xl font-game flex-1 flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold uppercase tracking-wider py-2.5 cursor-pointer">
              <Home size={18} strokeWidth={2.6} /> Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Game over ────────────────────────────────────────────────────────────────

export function GameOverPanel({ stats, result, onRetry, onMenu }: {
  stats: RunStats
  result: { rank: number | null; improved: boolean; previousBest: number } | null
  onRetry: () => void; onMenu: () => void
}) {
  const house = getHouse(loadHouse())
  const name = loadName().trim() || 'Survivor'
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm fade-in overflow-y-auto">
      <div className="pop-in w-full max-w-md my-6">
        <div className="text-center">
          <Skull size={50} className="mx-auto text-rose-500" />
          <h1 className="font-game font-extrabold text-5xl sm:text-6xl text-rose-500 uppercase tracking-wide mt-1 banner-slam">
            You Died
          </h1>

          {/* player identity + house */}
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5">
            <HouseIcon house={house.id} size={22} />
            <span className="font-game font-bold text-slate-200 text-sm">{name}</span>
            <span className="font-game font-bold text-[11px] uppercase tracking-widest" style={{ color: house.color }}>
              {house.name}
            </span>
          </div>

          {result?.rank != null && (
            <div className="mt-2 flex flex-col items-center gap-1">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-400/10 text-amber-300 font-game font-bold text-sm px-3 py-1">
                <Trophy size={14} strokeWidth={2.6} /> Leaderboard rank #{result.rank}
              </div>
              <p className="font-game font-semibold text-xs text-slate-400">
                {result.improved
                  ? (result.previousBest > 0 ? `New personal best — beat ${fmtTime(result.previousBest)}` : 'First run recorded!')
                  : `Personal best stands at ${fmtTime(result.previousBest)}`}
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {[
            { icon: Clock, label: 'Survived', value: fmtTime(stats.time), color: '#38bdf8' },
            { icon: Skull, label: 'Kills', value: fmtNum(stats.kills), color: '#fb7185' },
            { icon: Gem, label: 'Level', value: `Lv ${stats.level}`, color: '#fbbf24' },
          ].map((s, i) => (
            <div key={i} className="rise-fade rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-center" style={{ animationDelay: `${160 + i * 70}ms` }}>
              <s.icon size={18} className="mx-auto" style={{ color: s.color }} />
              <div className="font-game font-extrabold text-xl text-white mt-1">{s.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-3.5 rounded-xl border border-slate-700 bg-slate-800 p-4">
          <h3 className="font-game font-bold text-slate-300 text-xs uppercase tracking-widest mb-3">Damage Breakdown</h3>
          <div className="flex flex-col gap-2">
            {stats.dmg.slice(0, 7).map((row, i) => {
              const meta = WEAPON_META[row.id as WeaponId] ?? CONSUMABLE_META.bombitem
              const RowIcon: LucideIcon = meta.icon
              return (
                <div key={row.id} className="flex items-center gap-2.5 rise-fade" style={{ animationDelay: `${280 + i * 60}ms` }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center border shrink-0" style={{ backgroundColor: `${row.color}1c`, borderColor: `${row.color}59` }}>
                    <RowIcon size={15} style={{ color: row.color }} className={cn(meta.iconRotate && '-rotate-45')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="font-game font-bold text-slate-200 text-[13px] truncate">{row.name}</span>
                      <span className="font-game font-bold text-[12px] text-slate-500">{fmtNum(row.amount)} · {Math.round(row.share * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(3, row.share * 100)}%`, backgroundColor: row.color }} />
                    </div>
                  </div>
                </div>
              )
            })}
            {stats.dmg.length === 0 && <p className="text-slate-500 text-sm font-game">No damage dealt.</p>}
          </div>
        </div>

        <div className="mt-4 flex gap-2.5">
          <button onClick={onRetry} className="btn-chunk rounded-xl font-game flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-extrabold uppercase tracking-wider py-3.5 text-lg cursor-pointer">
            <RefreshCw size={20} strokeWidth={2.7} /> Retry
          </button>
          <button onClick={onMenu} className="btn-chunk rounded-xl font-game flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-100 font-extrabold uppercase tracking-wider py-3.5 px-6 cursor-pointer">
            <Home size={20} strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </div>
  )
}
