import { CreateGiftModal, GiftLinkModal } from '@/pages/Gift'
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/api/supabase'
import { cartItemsQueryKey } from '@/lib/cartItemsQuery'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, Heart, Share2, ShoppingCart, Star,
  Package, MessageCircle, X, Check, Users, AlertCircle, Loader2
} from 'lucide-react'
import VariantSelector from '@/components/shop/VariantSelector'
import { descriptionTranslations, nameTranslations } from '@/data/productTranslations'
import { getDisplayImages, getDemoImages, onProductImageError } from '@/lib/productImages'
import toast from 'react-hot-toast'

// ── Yulduzlar ─────────────────────────────────────────────────────
function Stars({ rating, size = 'sm', interactive = false, onRate }) {
  const s = size === 'sm' ? 'w-3.5 h-3.5' : 'w-7 h-7'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" disabled={!interactive}
          onClick={() => interactive && onRate?.(i)}
          className={interactive ? 'cursor-pointer' : 'cursor-default'}
        >
          <Star className={`${s} ${i <= Math.round(rating)
            ? 'fill-yellow-400 text-yellow-400'
            : 'fill-muted text-muted-foreground/30'}`}
          />
        </button>
      ))}
    </div>
  )
}

// ── Baholash modali — faqat buyurtma qilganlar uchun ──────────────
function ReviewModal({ productId, existingReview, onClose, onSaved }) {
  const { user } = useAuth()
  const { t } = useLang()
  const [rating, setRating]   = useState(existingReview?.rating || 5)
  const [comment, setComment] = useState(existingReview?.comment || '')
  const [loading, setLoading] = useState(false)

  const LABELS = { 1: t('rating1'), 2: t('rating2'), 3: t('rating3'), 4: t('rating4'), 5: t('rating5') }

  const handleSave = async () => {
    setLoading(true)
    try {
      if (existingReview) {
        await supabase.from('reviews').update({ rating, comment }).eq('id', existingReview.id)
      } else {
        await supabase.from('reviews').insert({ user_id: user.id, product_id: productId, rating, comment })
      }
      toast.success(t('reviewAccepted'))
      onSaved()
    } catch { toast.error(t('error')) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md bg-card rounded-t-3xl p-6 pb-10"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-extrabold">{t('rateProduct')}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col items-center mb-5">
          <Stars rating={rating} size="lg" interactive onRate={setRating} />
          <p className="text-sm text-muted-foreground mt-2">{LABELS[rating]}</p>
        </div>
        <div className="mb-4">
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('commentOptional')}</label>
          <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)}
            placeholder={t('commentPlaceholder')}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
          />
        </div>
        <button onClick={handleSave} disabled={loading}
          className="w-full py-3.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {loading ? t('saving') : t('rateBtn')}
        </button>
      </motion.div>
    </div>
  )
}

// ── Asosiy sahifa ─────────────────────────────────────────────────
export default function ProductDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeImg, setActiveImg]             = useState(0)
  const [quantity, setQuantity]               = useState(1)
  const [selectedVariants, setSelectedVariants] = useState({})
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showGiftModal, setShowGiftModal]     = useState(false)
  const [createdGift, setCreatedGift]         = useState(null)

  // Mahsulot
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  // Sotuvlar soni (products.sold_count yoki RPC orqali buyurtmalardan)
  const { data: realSoldCount } = useQuery({
    queryKey: ['productSoldCount', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_product_sold_count', { p_product_id: id })
      if (error) return null
      return typeof data === 'number' ? data : 0
    },
    enabled: !!id && (product?.sold_count ?? 0) === 0,
    retry: false,
  })

  const displaySoldCount = (product?.sold_count ?? 0) > 0
    ? (product.sold_count ?? 0)
    : (realSoldCount ?? product?.sold_count ?? 0)

  // Baholar
  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, user_id, product_id, rating, comment, created_at')
        .eq('product_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!id,
  })

  // Variantlar
  const { data: variants = [] } = useQuery({
    queryKey: ['variants', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_variants').select('*').eq('product_id', id).order('sort_order')
      return data || []
    },
  })

  // Sevimlilar
  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('favorites').select('product_id').eq('user_id', user.id)
      return data || []
    },
    enabled: !!user,
  })

  // Foydalanuvchi bu mahsulotni sotib olganmi? (baholash uchun)
  const { data: myOrders = [] } = useQuery({
    queryKey: ['myOrdersForProduct', user?.id, id],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, items, status')
        .eq('user_id', user.id)
        .in('status', ['confirmed', 'delivering', 'delivered'])
      return data || []
    },
    enabled: !!user,
  })

  // Shu mahsulotni sotib olganmi
  const hasPurchased = myOrders.some(order =>
    Array.isArray(order.items) && order.items.some(item => item.product_id === id)
  )

  const isFav    = favorites.some(f => f.product_id === id)
  const myReview = reviews.find(r => r.user_id === user?.id)
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : 0

  // Variant hisoblash
  const variantPriceDiff = Object.values(selectedVariants).reduce((s, v) => s + (v?.price_diff || 0), 0)
  const finalPrice       = (product?.price || 0) + variantPriceDiff
  const variantImage     = Object.values(selectedVariants).find(v => v?.image_url)?.image_url
  const variantTypes     = [...new Set(variants.map(v => v.type))]
  const allSelected      = variantTypes.every(t => selectedVariants[t])
  const hasVariants      = variants.length > 0

  const handleVariantSelect = (type, variant) => {
    setSelectedVariants(prev => ({
      ...prev,
      [type]: prev[type]?.id === variant.id ? null : variant,
    }))
  }

  const getDisplayName = (p) => {
    if (lang === 'en' && p?.name_en) return p.name_en
    if (lang === 'ru' && p?.name_ru) return p.name_ru
    const override = p?.name && nameTranslations[p.name]?.[lang]
    if (override) return override
    return p?.name
  }
  const getDisplayDesc = (p) => {
    if (lang === 'en' && p?.description_en) return p.description_en
    if (lang === 'ru' && p?.description_ru) return p.description_ru
    const override = p?.description && descriptionTranslations[p.description]?.[lang]
    if (override) return override
    return p?.description
  }

  // Rasmlar — asosiy sahifa bilan bir xil mantiq + demo placeholder
  const baseImages = getDisplayImages(product)
  const images = variantImage ? [variantImage, ...baseImages.filter(u => u !== variantImage)] : baseImages

  // Sevimlilarga qo'shish
  const toggleFavMutation = useMutation({
    mutationFn: async () => {
      if (isFav) {
        await supabase.from('favorites').delete().eq('user_id', user.id).eq('product_id', id)
      } else {
        await supabase.from('favorites').insert({ user_id: user.id, product_id: id })
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] }),
  })

  // Savatga qo'shish
  const addToCartMutation = useMutation({
    mutationFn: async () => {
      const variantLabel = Object.values(selectedVariants).filter(Boolean).map(v => v.label).join(', ')
      const baseName = getDisplayName(product)
      const productName  = variantLabel ? `${baseName} (${variantLabel})` : baseName
      const { data: cartRows } = await supabase.from('cart_items')
        .select('id, quantity, product_name')
        .eq('user_id', user.id)
        .eq('product_id', id)
      const existing = cartRows?.find((r) => r.product_name === productName) ?? null
      const img = variantImage || product.image_url || getDisplayImages(product)[0]
      if (existing) {
        await supabase.from('cart_items')
          .update({
            quantity: existing.quantity + quantity,
            price: finalPrice,
            product_image: img,
            product_name: productName,
          })
          .eq('id', existing.id)
      } else {
        await supabase.from('cart_items').insert({
          user_id:       user.id,
          product_id:    id,
          product_name:  productName,
          product_image: img,
          price:         finalPrice,
          quantity,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartItemsQueryKey(user?.id) })
      toast.success(`${quantity}${t('countUnit')}${t('addedToCart')}`)
    },
    onError: () => toast.error(t('error')),
  })

  const handleShare = async () => {
    const name = getDisplayName(product)
    const desc = getDisplayDesc(product)
    const url  = window.location.href
    const text = `${name} — ${finalPrice.toLocaleString()} so'm\n${desc || ''}`
    if (navigator.share) {
      try {
        await navigator.share({ title: name, text, url })
      } catch {}
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      toast.success(t('linkCopied'))
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="h-80 bg-muted animate-pulse" />
        <div className="px-5 pt-4 space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-6 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-5">
        <p className="text-muted-foreground">{t('noProducts')}</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-primary text-sm">{t('back')}</button>
      </div>
    )
  }

  if (product.in_stock === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-5">
        <p className="text-muted-foreground">{t('productNotAvailable')}</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-primary text-sm">{t('back')}</button>
      </div>
    )
  }

  const displayName = getDisplayName(product)
  const displayDescription = getDisplayDesc(product)

  return (
    <>
      {/* pb-40 — pastki panel uchun joy */}
      <div className="pb-40">

        {/* Rasm — swipe bilan */}
        <div className="relative bg-muted/20">
          <motion.div
            className="aspect-[3000/4000] overflow-hidden touch-pan-y"
            drag={images.length > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (images.length <= 1) return
              const t = 60
              if (info.offset.x < -t && activeImg < images.length - 1) setActiveImg(i => i + 1)
              else if (info.offset.x > t && activeImg > 0) setActiveImg(i => i - 1)
            }}
          >
            {images.length > 0
              ? <img
                  src={images[activeImg]}
                  alt={displayName}
                  width={3000}
                  height={4000}
                  className="w-full h-full object-cover select-none"
                  draggable={false}
                  onError={(e) => onProductImageError(e, product, getDemoImages(product)[0])}
                />
              : <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-20 h-20 text-muted-foreground/20" />
                </div>
            }
          </motion.div>
          {/* Tugmalar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <button onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-card/90 backdrop-blur flex items-center justify-center shadow border border-border/30">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
              <button onClick={handleShare}
                className="w-9 h-9 rounded-full bg-card/90 backdrop-blur flex items-center justify-center shadow border border-border/30">
                <Share2 className="w-4 h-4" />
              </button>
              <button onClick={() => toggleFavMutation.mutate()}
                className="w-9 h-9 rounded-full bg-card/90 backdrop-blur flex items-center justify-center shadow border border-border/30">
                <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
              </button>
            </div>
          </div>
          {/* Rasm nuqtalari */}
          {images.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={`rounded-full transition-all ${i === activeImg ? 'w-4 h-2 bg-primary' : 'w-2 h-2 bg-white/60'}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-5 pt-5 space-y-4">

          {/* Nom, brand, reyting, narx */}
          <div>
            {product.brand && (
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">{product.brand}</p>
            )}
            <h1 className="text-xl font-extrabold text-foreground leading-tight">{displayName}</h1>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5">
                <Stars rating={avgRating} />
                <span className="text-sm font-bold text-foreground">{avgRating}</span>
                <span className="text-xs text-muted-foreground">({reviews.length} {t('reviews')})</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                <span>{displaySoldCount.toLocaleString()} {t('soldCount')}</span>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-primary mt-3">
              {finalPrice.toLocaleString()} so'm
              {variantPriceDiff !== 0 && (
                <span className="text-sm text-muted-foreground font-normal ml-2">
                  ({variantPriceDiff > 0 ? '+' : ''}{variantPriceDiff.toLocaleString()})
                </span>
              )}
            </p>
          </div>

          {/* Variantlar */}
          {hasVariants && (
            <div className="bg-card rounded-2xl border border-border/60 p-4">
              <VariantSelector variants={variants} selected={selectedVariants} onSelect={handleVariantSelect} />
              {!allSelected && (
                <div className="flex items-center gap-2 mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-700">{t('selectVariants')}</p>
                </div>
              )}
            </div>
          )}

          {/* Tavsif */}
          {displayDescription && (
            <div>
              <h2 className="text-sm font-bold text-foreground mb-2">{t('about')}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{displayDescription}</p>
            </div>
          )}

          {/* Reyting taqsimoti — faqat baho bo'lsa */}
          {reviews.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/60 p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-center">
                  <p className="text-4xl font-extrabold text-foreground">{avgRating}</p>
                  <Stars rating={avgRating} />
                  <p className="text-xs text-muted-foreground mt-1">{reviews.length} {t('ratingCount')}</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map(s => {
                    const count = reviews.filter(r => r.rating === s).length
                    const pct   = reviews.length ? (count / reviews.length) * 100 : 0
                    return (
                      <div key={s} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-3">{s}</span>
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-4 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* 3-xato: faqat sotib olganlar baholay oladi */}
              {hasPurchased && (
                <button onClick={() => setShowReviewModal(true)}
                  className="w-full py-2.5 border border-primary text-primary rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Star className="w-4 h-4" />
                  {myReview ? t('editRate') : t('rateBtn')}
                </button>
              )}
            </div>
          )}

          {/* Izohlar */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground">
                {t('reviews')} ({reviews.length})
              </h2>
              {/* 3-xato: faqat sotib olganlar, main pageda ko'rinmaydi */}
              {hasPurchased && !myReview && reviews.length === 0 && (
                <button onClick={() => setShowReviewModal(true)}
                  className="text-xs text-primary font-semibold flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" /> {t('leaveReview')}
                </button>
              )}
            </div>

            {reviews.length === 0 ? (
              <div className="text-center py-8 bg-muted/30 rounded-2xl">
                <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('noReviews')}</p>
                {hasPurchased && (
                  <button onClick={() => setShowReviewModal(true)} className="mt-2 text-xs text-primary font-semibold">
                    {t('rateFirst')}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((review, i) => (
                  <motion.div key={review.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`bg-card rounded-2xl border p-4 ${review.user_id === user?.id ? 'border-primary/30' : 'border-border/60'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                          <span className="text-xs font-bold text-primary">
                            {review.user_id === user?.id ? 'S' : 'F'}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {review.user_id === user?.id ? (
                              <span className="text-primary">Siz</span>
                            ) : (
                              'Foydalanuvchi'
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString('uz-UZ')}
                          </p>
                        </div>
                      </div>
                      <Stars rating={review.rating} />
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Pastki panel ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border-t border-border px-5 py-4 z-[60] shadow-lg">
        {/* Narx va jami */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground">{t('total')}</p>
            <p className="text-lg font-extrabold text-primary">
              {(finalPrice * quantity).toLocaleString()} so'm
            </p>
          </div>
          {/* Miqdor (takroran pastda ham) */}
          <div className="flex items-center gap-2">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-sm leading-none">−</button>
            <span className="text-sm font-bold w-5 text-center">{quantity}</span>
            <button onClick={() => setQuantity(q => q + 1)}
              className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm leading-none">+</button>
          </div>
        </div>
        {/* Tugmalar */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (hasVariants && !allSelected) { toast.error(t('selectVariants')); return }
              setShowGiftModal(true)
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-3 border border-border rounded-2xl text-sm font-semibold text-foreground active:scale-[0.98] transition-all"
          >
            🎁 {t('gift')}
          </button>
          <button
            onClick={() => {
              if (hasVariants && !allSelected) { toast.error(t('selectVariants')); return }
              addToCartMutation.mutate()
            }}
            disabled={addToCartMutation.isPending}
            className="flex-1 py-3 bg-primary text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all"
          >
            {addToCartMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ShoppingCart className="w-4 h-4" />
            }
            {t('addToCart')}
          </button>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showGiftModal && product && (
          <CreateGiftModal product={product}
            onClose={() => setShowGiftModal(false)}
            onCreated={(gift) => { setShowGiftModal(false); setCreatedGift(gift) }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {createdGift && (
          <GiftLinkModal gift={createdGift} onClose={() => setCreatedGift(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showReviewModal && (
          <ReviewModal productId={id} existingReview={myReview}
            onClose={() => setShowReviewModal(false)}
            onSaved={() => {
              setShowReviewModal(false)
              queryClient.invalidateQueries({ queryKey: ['reviews', id] })
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
