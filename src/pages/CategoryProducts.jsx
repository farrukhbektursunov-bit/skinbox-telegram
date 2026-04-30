import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/api/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { categoryLabel, categorySlugSet, fetchShopCategoryTree } from '@/lib/shopCategories'
import { ChevronLeft } from 'lucide-react'
import ProductGrid from '@/components/shop/ProductGrid'

export default function CategoryProducts() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, lang } = useLang()

  const { data: tree, isLoading: treeLoading } = useQuery({
    queryKey: ['shopCategoryTree'],
    queryFn: fetchShopCategoryTree,
    staleTime: 60_000,
  })

  const validSlugs = useMemo(() => (tree ? categorySlugSet(tree) : null), [tree])
  const isValidCategory = Boolean(categoryId && validSlugs && validSlugs.has(categoryId))

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products', categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('category', categoryId)
        .eq('in_stock', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: isValidCategory,
  })

  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('favorites')
        .select('product_id')
        .eq('user_id', user.id)
      return data || []
    },
    enabled: !!user,
  })

  const favoriteIds = favorites.map((f) => f.product_id)

  const meta = tree?.categories?.find((c) => c.slug === categoryId)
  const titleFromDb = meta ? categoryLabel(meta, lang) : ''
  const titleFromI18n = categoryId ? t(categoryId) : ''
  const title = !isValidCategory
    ? t('category')
    : titleFromDb
      ? titleFromDb
      : titleFromI18n && titleFromI18n !== categoryId
        ? titleFromI18n
        : categoryId || t('category')

  if (treeLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
        {t('loading')}
      </div>
    )
  }

  if (!isValidCategory) {
    return (
      <div>
        <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/categories')}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-lg font-extrabold tracking-tight text-foreground flex-1">
            {t('allCategoriesTitle')}
          </span>
        </div>
        <div className="px-5 py-16 text-center text-muted-foreground text-sm">
          {t('noProductsInCategory')}
        </div>
        <div className="px-5">
          <button
            type="button"
            onClick={() => navigate('/categories')}
            className="w-full py-3 rounded-xl bg-primary text-white font-semibold"
          >
            {t('allCategoriesTitle')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/categories')}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-lg font-extrabold tracking-tight text-foreground flex-1">{title}</span>
      </div>

      <ProductGrid
        products={products}
        isLoading={productsLoading}
        title={null}
        favoriteIds={favoriteIds}
      />
    </div>
  )
}
