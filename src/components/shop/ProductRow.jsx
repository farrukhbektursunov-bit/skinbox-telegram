import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Heart, ShoppingCart, Star } from 'lucide-react'
import { getDisplayImages, getFirstImage, onProductImageError } from '@/lib/productImages'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/api/supabase'
import { cartItemsQueryKey } from '@/lib/cartItemsQuery'
import { useAuth } from '@/lib/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useLang } from '@/lib/LangContext'
import toast from 'react-hot-toast'

function CompactCard({ product, favoriteIds, realRating, isSale }) {
  const { user } = useAuth()
  const { t, lang } = useLang()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const isFav = favoriteIds.includes(product.id)
  const displayImages = getDisplayImages(product)
  const fallbackUrl = getDisplayImages({ category: product?.category })[0]
  const imageUrl = getFirstImage(product) ?? displayImages?.[0] ?? fallbackUrl
  const displayName = (lang === 'en' && product.name_en) ? product.name_en
    : (lang === 'ru' && product.name_ru) ? product.name_ru
    : product.name || ''
  const price = isSale && product.sale_price != null && product.sale_price < (product.price ?? 0)
    ? product.sale_price
    : product.price ?? 0

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from('cart_items').select('id, quantity')
        .eq('user_id', user.id).eq('product_id', product.id).single()
      if (existing) {
        await supabase.from('cart_items')
          .update({ quantity: existing.quantity + 1 }).eq('id', existing.id)
      } else {
        await supabase.from('cart_items').insert({
          user_id: user.id, product_id: product.id,
          product_name: displayName || product.name, product_image: getFirstImage(product) || imageUrl,
          price, quantity: 1,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartItemsQueryKey(user?.id) })
      toast.success(t('addedToCart'))
    },
    onError: () => toast.error(t('error')),
  })

  const toggleFavMutation = useMutation({
    mutationFn: async () => {
      if (isFav) {
        await supabase.from('favorites').delete()
          .eq('user_id', user.id).eq('product_id', product.id)
      } else {
        await supabase.from('favorites').insert({ user_id: user.id, product_id: product.id })
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] }),
    onError: () => toast.error(t('error')),
  })

  const isOnSale = isSale && product.sale_price != null && Number(product.sale_price) < Number(product.price || 0)
  const discount = isOnSale && product.price
    ? Math.round((1 - Number(product.sale_price) / Number(product.price)) * 100)
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-[140px] flex-shrink-0 bg-card rounded-xl border border-border/60 overflow-hidden cursor-pointer"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <div className="relative aspect-square bg-muted/30 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={displayName} className="w-full h-full object-cover" loading="lazy"
            onError={e => onProductImageError(e, product, fallbackUrl)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingCart className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}
        {isOnSale && (
          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-red-500 text-white text-[10px] font-bold">
            -{discount}%
          </span>
        )}
        <button
          onClick={e => { e.stopPropagation(); toggleFavMutation.mutate() }}
          disabled={toggleFavMutation.isPending}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/80 backdrop-blur flex items-center justify-center"
        >
          <Heart className={`w-3 h-3 ${isFav ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
        </button>
      </div>
      <div className="p-2">
        <h3 className="text-xs font-semibold text-foreground line-clamp-2 leading-tight">{displayName || '—'}</h3>
        <div className="flex items-center gap-0.5 mt-0.5">
          {[1,2,3,4,5].map(i => (
            <Star key={i} className={`w-2.5 h-2.5 ${i <= Math.round(Number(realRating || 0)) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
          ))}
          <span className="text-[10px] font-medium text-foreground ml-0.5">{Number(realRating || 0).toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between mt-1.5 gap-1">
          <div className="min-w-0">
            {isOnSale && (
              <span className="text-[10px] text-muted-foreground line-through block">{(product.price ?? 0).toLocaleString()}</span>
            )}
            <span className="text-xs font-bold text-primary">{Number(price).toLocaleString()} so'm</span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); addToCartMutation.mutate() }}
            disabled={addToCartMutation.isPending}
            className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
          >
            <ShoppingCart className="w-3 h-3 text-white" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default function ProductRow({ products = [], title, favoriteIds = [], isSale = false }) {
  const productIds = useMemo(() => products.map(p => p.id), [products])
  const { data: reviews = [] } = useQuery({
    queryKey: ['reviewsForProducts', productIds],
    queryFn: async () => {
      if (productIds.length === 0) return []
      const { data } = await supabase.from('reviews').select('product_id, rating').in('product_id', productIds)
      return data || []
    },
    enabled: productIds.length > 0,
  })
  const avgByProduct = useMemo(() => {
    const map = {}
    for (const r of reviews) {
      if (!map[r.product_id]) map[r.product_id] = { sum: 0, count: 0 }
      map[r.product_id].sum += Number(r.rating)
      map[r.product_id].count += 1
    }
    const result = {}
    for (const [pid, v] of Object.entries(map)) result[pid] = (v.sum / v.count).toFixed(1)
    return result
  }, [reviews])

  if (!products.length) return null

  return (
    <div className="pt-4 pb-2">
      <h2 className="text-base font-bold text-foreground mb-3 px-5">{title}</h2>
      <div className="overflow-x-auto hide-scrollbar px-5">
        <div className="flex gap-3 pb-2">
          {products.map((product, i) => (
            <CompactCard
              key={product.id}
              product={product}
              favoriteIds={favoriteIds}
              realRating={avgByProduct[product.id]}
              isSale={isSale}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
