// ─────────────────────────────────────────────────────────────────────────────
//  TSA HOUSE BRAND LOGO
//  Renders the PNG set as BRAND_LOGO in  src/assets/images.ts
//  Until one is set, it shows an empty dashed placeholder box.
//
//  ▶ To add the logo: open  src/assets/images.ts  and follow the 3 steps there.
// ─────────────────────────────────────────────────────────────────────────────
import { BRAND_LOGO, BRAND_LOGO_FIT } from '../assets/images'

export default function Logo({ size = 48 }: { size?: number }) {
  if (BRAND_LOGO) {
    return (
      <img
        src={BRAND_LOGO}
        alt="TSA HOUSE"
        draggable={false}
        style={{ width: size, height: size, objectFit: BRAND_LOGO_FIT }}
        className="shrink-0 rounded-xl select-none"
      />
    )
  }

  // Empty placeholder — disappears automatically once BRAND_LOGO is set.
  return (
    <div
      style={{ width: size, height: size }}
      aria-label="TSA HOUSE logo"
      className="shrink-0 rounded-xl border-2 border-dashed border-slate-300 bg-white overflow-hidden"
    />
  )
}
