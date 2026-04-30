import { useQuery } from '@tanstack/react-query'
import { useLang } from '@/lib/LangContext'
import { categoryLabel, fetchShopCategoryTree } from '@/lib/shopCategories'

export default function CategoryScroller({ active, onSelect }) {
  const { t, lang } = useLang()
  const { data: tree } = useQuery({
    queryKey: ['shopCategoryTree'],
    queryFn: fetchShopCategoryTree,
    staleTime: 60_000,
  })

  const categories = tree?.categories ?? []

  function titleFor(cat) {
    const fromDb = categoryLabel(cat, lang)
    if (fromDb) return fromDb
    const fromI18n = t(cat.slug)
    if (fromI18n && fromI18n !== cat.slug) return fromI18n
    return cat.slug
  }

  return (
    <div className="flex gap-1.5 px-4 pb-2 pt-0.5 overflow-x-auto hide-scrollbar">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
          active == null ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        {t('allCategories')}
      </button>
      {categories.map((cat) => {
        const on = active === cat.slug
        return (
          <button
            type="button"
            key={cat.slug}
            onClick={() => onSelect(active === cat.slug ? null : cat.slug)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
              on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {titleFor(cat)}
          </button>
        )
      })}
    </div>
  )
}
