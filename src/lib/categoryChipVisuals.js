import {
  Droplets,
  Pipette,
  Sparkles,
  FlaskConical,
  CircleDot,
  Sun,
  LayoutGrid,
} from 'lucide-react'

/** Olive Young–style: pastel circular chips + lucide icons */
export const CATEGORY_CHIP_VISUALS = {
  cleansers: { icon: Droplets, circle: 'bg-sky-100 text-sky-700' },
  toners: { icon: FlaskConical, circle: 'bg-violet-100 text-violet-700' },
  serums: { icon: Pipette, circle: 'bg-rose-100 text-rose-600' },
  moisturizers: { icon: Sparkles, circle: 'bg-emerald-100 text-emerald-700' },
  masks: { icon: CircleDot, circle: 'bg-amber-100 text-amber-800' },
  sunscreen: { icon: Sun, circle: 'bg-orange-100 text-orange-700' },
}

export function categoryChipVisual(slug) {
  return (
    CATEGORY_CHIP_VISUALS[slug] ?? {
      icon: LayoutGrid,
      circle: 'bg-slate-100 text-slate-600',
    }
  )
}
