import type { HouseId } from '../houses'

import BrandLogo from '@/assets/houses/tsa.png'

import tsa from './houses/tsa.png'
import yang from './houses/yang.png'
import khant from './houses/khant.png'
import irve from './houses/irve.png'
import tsen from './houses/tsen.png'
import buhu from './houses/buhu.png'
import maza from './houses/maza.png'
import hawt from './houses/hawt.png'

export const BRAND_LOGO: string | null =
  BrandLogo

export const HOUSE_IMAGES: Record<HouseId, string | null> = {
  TSA:   tsa,  
  YANG:  yang, 
  KHANT: khant,
  IRVE:  irve, 
  TSEN:  tsen, 
  BUHU:  buhu, 
  MAZA:  maza,
  HAWT:  hawt,
}

export const HOUSE_IMAGE_FIT: 'contain' | 'cover' = 'contain'
export const BRAND_LOGO_FIT: 'contain' | 'cover' = 'contain'

export const HOUSE_IMAGE_KEEPS_BG = true

export const HOUSE_IMAGE_PADDING = 2
