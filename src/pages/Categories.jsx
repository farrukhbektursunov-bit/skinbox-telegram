import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronLeft, Search, Headphones, Package } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/api/supabase'
import { useLang } from '@/lib/LangContext'
import {
  categoryLabel,
  fetchShopCategoryTree,
  sectionLabel,
} from '@/lib/shopCategories'
import { categoryChipVisual } from '@/lib/categoryChipVisuals'

const CATEGORY_SUB_KEYS = {
  cleansers: ['catSub_cleansers_1', 'catSub_cleansers_2', 'catSub_cleansers_3'],
  toners: ['catSub_toners_1', 'catSub_toners_2', 'catSub_toners_3'],
  serums: ['catSub_serums_1', 'catSub_serums_2', 'catSub_serums_3'],
  moisturizers: ['catSub_moisturizers_1', 'catSub_moisturizers_2', 'catSub_moisturizers_3'],
  masks: ['catSub_masks_1', 'catSub_masks_2', 'catSub_masks_3'],
  sunscreen: ['catSub_sunscreen_1', 'catSub_sunscreen_2', 'catSub_sunscreen_3'],
}

function subKeysForSlug(slug) {
  if (slug && CATEGORY_SUB_KEYS[slug]) return CATEGORY_SUB_KEYS[slug]
  return ['catSub_fallback_1', 'catSub_fallback_2', 'catSub_fallback_3']
}

export default function Categories() {
  const navigate = useNavigate()
  const { t, lang } = useLang()

  const [topTab, setTopTab] = useState(/** @type {'category' | 'brand' | 'service'} */ ('category'))

  const { data: tree, isLoading: treeLoading } = useQuery({
    queryKey: ['shopCategoryTree'],
    queryFn: fetchShopCategoryTree,
    staleTime: 60_000,
  })

  const { data: brands = [] } = useQuery({
    queryKey: ['productBrandsList'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('brand').eq('in_stock', true)
      const set = new Set()
      for (const row of data || []) {
        const b = row.brand?.trim()
        if (b) set.add(b)
      }
      return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    },
    enabled: topTab === 'brand',
  })

  const sections = tree?.sections ?? []
  const allCategories = tree?.categories ?? []

  const [activeSectionId, setActiveSectionId] = useState(null)

  useEffect(() => {
    if (!sections.length) return
    setActiveSectionId((prev) => {
      if (prev && sections.some((s) => s.id === prev)) return prev
      return sections[0].id
    })
  }, [sections])

  const categoriesInSection = useMemo(() => {
    if (!activeSectionId) return []
    return allCategories.filter((c) => c.section_id === activeSectionId)
  }, [activeSectionId, allCategories])

  const titleForCat = (cat) => {
    if (!cat) return ''
    const fromDb = categoryLabel(cat, lang)
    if (fromDb) return fromDb
    const fromI18n = t(cat.slug)
    if (fromI18n && fromI18n !== cat.slug) return fromI18n
    return cat.slug
  }

  if (treeLoading || !tree) {
    return (
      <div className="flex flex-col min-h-[calc(100dvh-5rem)] items-center justify-center px-6 text-sm text-muted-foreground">
        {t('loading')}
      </div>
    )
  }

  const tabs = /** @type {const} */ (['category', 'brand', 'service'])

  return (
    <div className="flex flex-col min-h-[calc(100dvh-5rem)] bg-background">
      <div className="sticky top-0 z-40 bg-card border-b border-border/60">
        <div className="flex items-center gap-1 px-2 py-2">
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform shrink-0"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1 flex min-w-0">
            {tabs.map((tab) => {
              const on = topTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTopTab(tab)}
                  className={`flex-1 py-2.5 text-[13px] transition-colors ${
                    on ? 'font-bold text-foreground' : 'text-muted-foreground font-medium'
                  }`}
                >
                  {t(`catNav_${tab}`)}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform shrink-0"
            aria-label={t('searchPlaceholder')}
          >
            <Search className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </div>

      {topTab === 'category' && (
        <div className="flex flex-1 min-h-0">
          <aside className="w-[32%] max-w-[132px] flex-shrink-0 bg-neutral-100 dark:bg-muted/40 border-r border-border/40 overflow-y-auto">
            {sections.map((sec) => {
              const active = activeSectionId === sec.id
              const label = sectionLabel(sec, lang)
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSectionId(sec.id)}
                  className={`w-full text-left px-3 py-4 text-[13px] leading-snug transition-colors border-b border-neutral-200/80 dark:border-border/30 ${
                    active
                      ? 'bg-card text-foreground font-bold'
                      : 'text-muted-foreground font-medium bg-transparent'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </aside>

          <div className="flex-1 min-w-0 overflow-y-auto bg-card pb-24">
            {categoriesInSection.length === 0 ? (
              <div className="px-4 py-8 text-sm text-muted-foreground">{t('noProductsInCategory')}</div>
            ) : (
              categoriesInSection.map((cat) => {
                const { icon: CatIcon } = categoryChipVisual(cat.slug)
                const subKeys = subKeysForSlug(cat.slug)
                return (
                  <section
                    key={cat.id}
                    className="border-b border-neutral-200/90 dark:border-border/50 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/categories/${cat.slug}`)}
                      className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-muted/50 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-sm shrink-0">
                        <CatIcon className="w-6 h-6" strokeWidth={2} aria-hidden />
                      </div>
                      <span className="flex-1 min-w-0 text-[15px] font-bold text-foreground tracking-tight">
                        {titleForCat(cat)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                    </button>
                    <ul className="pb-1">
                      {subKeys.map((key) => (
                        <li key={key} className="border-t border-neutral-100 dark:border-border/40">
                          <button
                            type="button"
                            onClick={() => navigate(`/categories/${cat.slug}`)}
                            className="w-full text-left px-4 py-3.5 text-sm text-foreground font-normal hover:bg-muted/30 transition-colors"
                          >
                            {t(key)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })
            )}
          </div>
        </div>
      )}

      {topTab === 'brand' && (
        <div className="flex-1 min-h-0 overflow-y-auto bg-card pb-24">
          {brands.length === 0 ? (
            <div className="px-4 py-10 text-sm text-muted-foreground text-center">{t('catNavBrandsEmpty')}</div>
          ) : (
            <ul>
              {brands.map((brand) => (
                <li key={brand} className="border-b border-neutral-100 dark:border-border/40">
                  <button
                    type="button"
                    onClick={() => navigate(`/search?q=${encodeURIComponent(brand)}`)}
                    className="w-full text-left px-4 py-3.5 text-sm text-foreground active:bg-muted/40 transition-colors"
                  >
                    {brand}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {topTab === 'service' && (
        <div className="flex-1 min-h-0 overflow-y-auto bg-card px-4 py-2 pb-24 space-y-0">
          <button
            type="button"
            onClick={() => navigate('/help')}
            className="w-full flex items-center gap-3 py-4 border-b border-neutral-100 dark:border-border/40 text-left active:bg-muted/40"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
              <Headphones className="w-5 h-5" strokeWidth={2} />
            </div>
            <span className="flex-1 text-sm font-semibold text-foreground">{t('help')}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="w-full flex items-center gap-3 py-4 border-b border-neutral-100 dark:border-border/40 text-left active:bg-muted/40"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
              <Package className="w-5 h-5" strokeWidth={2} />
            </div>
            <span className="flex-1 text-sm font-semibold text-foreground">{t('myOrders')}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </div>
      )}
    </div>
  )
}
