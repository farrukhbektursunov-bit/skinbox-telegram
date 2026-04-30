import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/api/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import SearchBar from '@/components/shop/SearchBar'
import CategoryScroller from '@/components/shop/CategoryScroller'
import ProductGrid from '@/components/shop/ProductGrid'

export default function SearchPage() {
  const { user } = useAuth()
  const { t } = useLang()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState(null)

  useEffect(() => {
    const q = searchParams.get('q')
    if (q != null && q !== '') setSearch(q)
  }, [searchParams])

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

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase()
    const matchSearch =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q)
    const matchCategory = !activeCategory || p.category === activeCategory
    return matchSearch && matchCategory
  })

  return (
    <div>
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 bg-card/90 backdrop-blur-xl border-b border-border/50">
        <SearchBar value={search} onChange={setSearch} />
        <CategoryScroller active={activeCategory} onSelect={setActiveCategory} />
      </div>
      <div className="pt-[118px]">
      <ProductGrid
        products={filtered}
        isLoading={isLoading}
        title={t("recommended")}
        favoriteIds={favoriteIds}
      />
      </div>
    </div>
  )
}
