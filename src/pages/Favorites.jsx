import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/api/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { Heart } from 'lucide-react'
import Header from '@/components/shop/Header'
import ProductGrid from '@/components/shop/ProductGrid'

export default function Favorites({ fromProfile }) {
  const backTo = fromProfile ? '/profile' : '/shop'
  const { user } = useAuth()
  const { t } = useLang()

  const { data: favorites = [], isLoading: favLoading } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('favorites').select('product_id').eq('user_id', user.id)
      return data || []
    },
    enabled: !!user,
  })

  const { data: allProducts = [], isLoading: prodLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('in_stock', true)
      return data || []
    },
  })

  const isLoading   = favLoading || prodLoading
  const favoriteIds = favorites.map(f => f.product_id)
  const favProducts = allProducts.filter(p => favoriteIds.includes(p.id))

  return (
    <div>
      <Header title={t('favorites')} showBack backTo={backTo} />
      <div className="px-5 pt-4 pb-2">
        <p className="text-sm text-muted-foreground">{favProducts.length} {t('products')}</p>
      </div>

      {!isLoading && favProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-5">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <Heart className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">{t('favoritesEmpty')}</p>
          <p className="text-xs text-muted-foreground text-center">
            {t('favoritesEmptyDesc')}
          </p>
        </div>
      ) : (
        <ProductGrid
          products={favProducts}
          isLoading={isLoading}
          title={null}
          favoriteIds={favoriteIds}
        />
      )}
    </div>
  )
}
