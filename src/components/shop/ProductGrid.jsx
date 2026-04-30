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

function ProductCard({ product, favoriteIds, index, realRating }) {
  const { user } = useAuth()
  const { t, lang } = useLang()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const isFav = favoriteIds.includes(product.id)
  const displayImages = getDisplayImages(product)
  const fallbackUrl = getDisplayImages({ category: product?.category })[0]
  const imageUrl = getFirstImage(product) ?? displayImages?.[0] ?? fallbackUrl
  const realImageUrl = getFirstImage(product)
  const displayName = (lang === 'en' && product.name_en) ? product.name_en
    : (lang === 'ru' && product.name_ru) ? product.name_ru
    : product.name || ''

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
          product_name: displayName || product.name, product_image: realImageUrl || imageUrl,
          price: product.price ?? 0, quantity: 1,
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="bg-card rounded-2xl border border-border/60 overflow-hidden cursor-pointer"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      {/* Rasm */}
      <div className="relative aspect-square bg-muted/30 min-h-[120px] overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={displayName}
            className="w-full h-full object-cover" loading="lazy"
            onError={e => onProductImageError(e, product, fallbackUrl)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingCart className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}
        {/* Sevimlilar tugmasi */}
        <button
          onClick={e => { e.stopPropagation(); toggleFavMutation.mutate() }}
          disabled={toggleFavMutation.isPending}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow-sm"
        >
          <Heart className={`w-4 h-4 transition-colors ${isFav ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        {product.brand && (
          <p className="text-xs text-muted-foreground mb-0.5">{product.brand}</p>
        )}
        <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2 min-h-[2.5rem]">
          {displayName || '—'}
        </h3>
        <div className="flex items-center gap-1 mt-1">
          {[1, 2, 3, 4, 5].map(i => (
            <Star
              key={i}
              className={`w-3 h-3 ${i <= Math.round(Number(realRating || 0)) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
            />
          ))}
          <span className="text-xs font-medium text-foreground ml-0.5">
            {Number(realRating || 0).toFixed(1)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-bold text-primary">
            {(product.price ?? 0).toLocaleString()} so'm
          </span>
          <button
            onClick={e => { e.stopPropagation(); addToCartMutation.mutate() }}
            disabled={addToCartMutation.isPending}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center disabled:opacity-60"
          >
            <ShoppingCart className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default function ProductGrid({ products = [], isLoading, title, favoriteIds = [] }) {
  const { t: tGrid } = useLang()
  const productIds = useMemo(() => products.map(p => p.id), [products])
  const { data: reviews = [] } = useQuery({
    queryKey: ['reviewsForProducts', productIds],
    queryFn: async () => {
      if (productIds.length === 0) return []
      const { data } = await supabase
        .from('reviews')
        .select('product_id, rating')
        .in('product_id', productIds)
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
    for (const [pid, v] of Object.entries(map)) {
      result[pid] = (v.sum / v.count).toFixed(1)
    }
    return result
  }, [reviews])

  if (isLoading) {
    return (
      <div className="px-5 pt-2">
        {title && <h2 className="text-base font-bold text-foreground mb-3">{title}</h2>}
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-muted rounded-2xl aspect-[3/4] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!products.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-5">
        <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">{tGrid('noProducts')}</p>
      </div>
    )
  }

  return (
    <div className="px-5 pt-2 pb-6">
      {title && <h2 className="text-base font-bold text-foreground mb-3">{title}</h2>}
      <div className="grid grid-cols-2 gap-3">
        {products.map((product, i) => (
          <ProductCard
            key={product.id}
            product={product}
            index={i}
            favoriteIds={favoriteIds}
            realRating={avgByProduct[product.id]}
          />
        ))}
      </div>
    </div>
  )
}
