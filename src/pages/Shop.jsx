import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { categoryLabel, fetchShopCategoryTree } from '@/lib/shopCategories'
import SearchBar from '@/components/shop/SearchBar'
import CategoryScroller from '@/components/shop/CategoryScroller'
import ProductGrid from '@/components/shop/ProductGrid'
import ProductRow from '@/components/shop/ProductRow'

export default function Shop() {
  const { user } = useAuth()
  const { t, lang } = useLang()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState('')

  // URL dan category o'qish — Categories sahifasidan kelganda ishlaydi
  const categoryFromUrl = searchParams.get('category')
  const [activeCategory, setActiveCategory] = useState(categoryFromUrl || null)

  // URL o'zgarganda (masalan orqaga bosganda) category yangilansin
  useEffect(() => {
    setActiveCategory(categoryFromUrl || null)
  }, [categoryFromUrl])

  // Category o'zgartirilganda URL ni ham yangilash
  const handleCategoryChange = (cat) => {
    setActiveCategory(cat)
    if (cat) {
      setSearchParams({ category: cat })
    } else {
      setSearchParams({})
    }
  }

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('in_stock', true)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: tree } = useQuery({
    queryKey: ['shopCategoryTree'],
    queryFn: fetchShopCategoryTree,
    staleTime: 60_000,
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

  const favoriteIds = favorites.map(f => f.product_id)

  const filtered = products.filter(p => {
    const matchSearch   = !search || p.name?.toLowerCase().includes(search.toLowerCase())
    const matchCategory = !activeCategory || p.category === activeCategory
    return matchSearch && matchCategory
  })

  const baseForRows = activeCategory
    ? products.filter(p => p.category === activeCategory)
    : products

  const saleProducts = baseForRows.filter(p =>
    p.sale_price != null && Number(p.sale_price) < Number(p.price || Infinity)
  )
  const bestsellerProducts = [...baseForRows]
    .sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0))
    .slice(0, 8)

  const pageTitle = useMemo(() => {
    if (!activeCategory) return t('recommended')
    const cat = tree?.categories?.find((c) => c.slug === activeCategory)
    if (cat) {
      const fromDb = categoryLabel(cat, lang)
      if (fromDb) return fromDb
    }
    const fromI18n = t(activeCategory)
    if (fromI18n && fromI18n !== activeCategory) return fromI18n
    return activeCategory
  }, [activeCategory, tree, t, lang])

  return (
    <div>
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 bg-card/90 backdrop-blur-xl border-b border-border/50">
        <SearchBar value={search} onChange={setSearch} />
        <CategoryScroller active={activeCategory} onSelect={handleCategoryChange} />
      </div>
      <div className="pt-[118px]">
      <ProductRow products={saleProducts} title={t('sale')} favoriteIds={favoriteIds} isSale />
      <ProductRow products={bestsellerProducts} title={t('bestseller')} favoriteIds={favoriteIds} />
      <ProductGrid
        products={filtered}
        isLoading={isLoading}
        title={pageTitle}
        favoriteIds={favoriteIds}
      />
      </div>
    </div>
  )
}
