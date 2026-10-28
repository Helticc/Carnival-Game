// ─────────────────────────────────────────────────────────────────────────────
//  HOUSE CREST
//  Renders the PNG set for this house in  src/assets/images.ts
//  While a house has no image yet, it falls back to the house color + initial,
//  so the UI always looks complete.
//
//  ▶ To add crests: open  src/assets/images.ts  and follow the 3 steps there.
// ─────────────────────────────────────────────────────────────────────────────
import type { HouseId } from '../houses'
import { getHouse } from '../houses'
import { HOUSE_IMAGES, HOUSE_IMAGE_FIT, HOUSE_IMAGE_KEEPS_BG, HOUSE_IMAGE_PADDING } from '../assets/images'

export default function HouseIcon({ house, size = 32 }: { house: HouseId; size?: number }) {
  const h = getHouse(house)
  const src = HOUSE_IMAGES[h.id]

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: !src || HOUSE_IMAGE_KEEPS_BG ? h.color : 'transparent',
        color: h.text,
        padding: src ? HOUSE_IMAGE_PADDING : 0,
      }}
      className="shrink-0 rounded-lg flex items-center justify-center overflow-hidden relative"
      aria-label={`${h.name} house`}
      title={`${h.name} — ${h.note}`}
    >
      {src ? (
        <img
          src={src}
          alt={`${h.name} house crest`}
          draggable={false}
          className="w-full h-full select-none"
          style={{ objectFit: HOUSE_IMAGE_FIT }}
        />
      ) : (
        <span className="font-game font-extrabold leading-none" style={{ fontSize: size * 0.5 }}>
          {h.name.charAt(0)}
        </span>
      )}
    </div>
  )
}
