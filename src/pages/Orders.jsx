import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, Clock, Truck, CheckCircle, XCircle, ChevronDown, ChevronUp, ChevronLeft, Star, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

function StatusStepper({ status, t }) {
  const steps = ['pending', 'confirmed', 'delivering', 'delivered']
  const STATUS = {
    pending:    { label: t('pending'),    icon: Clock         },
    confirmed:  { label: t('confirmed'),  icon: CheckCircle   },
    delivering: { label: t('delivering'), icon: Truck         },
    delivered:  { label: t('delivered'),  icon: CheckCircle   },
    cancelled:  { label: t('cancelled'),  icon: XCircle       },
  }

  if (status === 'cancelled') return (
    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
      <XCircle className="w-4 h-4 text-red-500" />
      <span className="text-xs font-semibold text-red-500">{t('cancelled')}</span>
    </div>
  )

  const currentIdx = steps.indexOf(status)
  return (
    <div className="flex items-center gap-1 mt-3">
      {steps.map((step, i) => {
        const s    = STATUS[step]
        const Icon = s.icon
        const done = i <= currentIdx
        const current = i === currentIdx
        return (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${done ? 'bg-primary border-primary' : 'bg-muted border-border'}`}>
                <Icon className={`w-3.5 h-3.5 ${done ? 'text-white' : 'text-muted-foreground'}`} />
              </div>
              <span className={`text-[9px] mt-1 font-medium text-center leading-tight ${current ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mb-4 mx-0.5 rounded-full ${i < currentIdx ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Yulduzlar (baholash uchun)
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

// Baholash modali
function ReviewModal({ productId, productName, existingReview, onClose, onSaved }) {
  const { user } = useAuth()
  const { t } = useLang()
  const [rating, setRating] = useState(existingReview?.rating || 5)
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
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md bg-card rounded-t-3xl p-6 pb-[max(5rem,calc(1rem+env(safe-area-inset-bottom)))]"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-extrabold">{t('rateAfterDelivery')}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        {productName && <p className="text-sm text-muted-foreground mb-3 truncate">{productName}</p>}
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
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {loading ? t('saving') : t('rateBtn')}
        </button>
      </motion.div>
    </div>
  )
}

function OrderCard({ order, index, t, user, onReviewSaved }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [reviewModal, setReviewModal] = useState(null) // { productId, productName, existingReview }

  const productIds = (order.items || [])
    .map(i => i.product_id)
    .filter(Boolean)
  const uniqueProductIds = [...new Set(productIds)]

  const { data: myReviews = [] } = useQuery({
    queryKey: ['myReviewsForOrder', user?.id, uniqueProductIds],
    queryFn: async () => {
      if (uniqueProductIds.length === 0) return []
      const { data } = await supabase
        .from('reviews')
        .select('id, product_id, rating, comment')
        .eq('user_id', user.id)
        .in('product_id', uniqueProductIds)
      return data || []
    },
    enabled: !!user && order.status === 'delivered' && uniqueProductIds.length > 0,
  })

  const reviewedProductIds = new Set(myReviews.map(r => r.product_id))

  const date = new Date(order.created_at).toLocaleDateString('uz-UZ', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const STATUS_COLORS = {
    pending:    { color: 'text-orange-500', bg: 'bg-orange-50',  border: 'border-orange-200', icon: Clock         },
    confirmed:  { color: 'text-blue-500',   bg: 'bg-blue-50',    border: 'border-blue-200',   icon: CheckCircle   },
    delivering: { color: 'text-purple-500', bg: 'bg-purple-50',  border: 'border-purple-200', icon: Truck         },
    delivered:  { color: 'text-green-600',  bg: 'bg-green-50',   border: 'border-green-200',  icon: CheckCircle   },
    cancelled:  { color: 'text-red-500',    bg: 'bg-red-50',     border: 'border-red-200',    icon: XCircle       },
  }
  const st   = STATUS_COLORS[order.status] || STATUS_COLORS.pending
  const Icon = st.icon

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-card rounded-2xl border border-border/60 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-xs text-muted-foreground">{date}</p>
            <p className="text-sm font-bold text-foreground mt-0.5">
              {order.items?.length} {t('products')}
            </p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${st.bg} ${st.border}`}>
            <Icon className={`w-3.5 h-3.5 ${st.color}`} />
            <span className={`text-[11px] font-semibold ${st.color}`}>
              {STATUS_COLORS[order.status] ? t(order.status) : order.status}
            </span>
          </div>
        </div>
        <StatusStepper status={order.status} t={t} />
      </div>

      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 border-t border-border/50 text-sm hover:bg-muted/30 transition-colors"
      >
        <span className="font-semibold text-foreground">{order.total?.toLocaleString()} so'm</span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {open ? t('close') : t('details')}
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
              <div className="space-y-2">
                {(order.items || []).map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {item.product_id ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/product/${item.product_id}`)}
                        className="flex-shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        aria-label={t('details')}
                      >
                        {item.image ? (
                          <img src={item.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted" />
                        )}
                      </button>
                    ) : item.image ? (
                      <img src={item.image} alt={item.product_name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      {item.product_id ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/product/${item.product_id}`)}
                          className="text-left w-full text-xs font-semibold text-foreground truncate hover:text-primary hover:underline underline-offset-2"
                        >
                          {item.product_name}
                        </button>
                      ) : (
                        <p className="text-xs font-semibold text-foreground truncate">{item.product_name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{item.quantity} x {Number(item.price)?.toLocaleString()} so'm</p>
                    </div>
                    <p className="text-xs font-bold text-primary flex-shrink-0">
                      {(Number(item.price) * Number(item.quantity)).toLocaleString()} so'm
                    </p>
                  </div>
                ))}
              </div>
              {order.status === 'delivered' && uniqueProductIds.length > 0 && (
                <div className="rounded-xl border border-border/60 p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">{t('rateAfterDelivery')}</p>
                  <div className="flex flex-wrap gap-2">
                    {uniqueProductIds.map(pid => {
                      const item = order.items?.find(i => i.product_id === pid)
                      const existingReview = myReviews.find(r => r.product_id === pid)
                      const isRated = reviewedProductIds.has(pid)
                      return (
                        <div key={pid} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                          <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{item?.product_name || ''}</span>
                          {isRated ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {t('rated')}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setReviewModal({
                                productId: pid,
                                productName: item?.product_name,
                                existingReview,
                              })}
                              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              <Star className="w-3.5 h-3.5" />
                              {t('rateBtn')}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{t('recipient')}: </span>{order.full_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{t('phone')}: </span>{order.phone}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{t('address')}: </span>{order.address}
                </p>
                {order.note && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{t('note')}: </span>{order.note}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {reviewModal && (
        <AnimatePresence>
          <ReviewModal
            productId={reviewModal.productId}
            productName={reviewModal.productName}
            existingReview={reviewModal.existingReview}
            onClose={() => setReviewModal(null)}
            onSaved={() => {
              onReviewSaved?.()
              setReviewModal(null)
            }}
          />
        </AnimatePresence>
      )}
    </motion.div>
  )
}

export default function Orders() {
  const { user } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders').select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  return (
    <div>
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xl font-extrabold tracking-tight text-foreground flex-1">{t('ordersTitle')}</span>
      </div>

      {isLoading ? (
        <div className="px-5 pt-4 space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-muted rounded-2xl h-32 animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-5">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-base font-semibold text-foreground mb-1">{t('noOrders')}</p>
          <p className="text-sm text-muted-foreground text-center">{t('noOrdersDesc')}</p>
        </div>
      ) : (
        <div className="px-5 pt-4 pb-6 space-y-3">
          {orders.map((order, i) => (
            <OrderCard
              key={order.id}
              order={order}
              index={i}
              t={t}
              user={user}
              onReviewSaved={() => {
                queryClient.invalidateQueries({ queryKey: ['myReviewsForOrder'] })
                queryClient.invalidateQueries({ queryKey: ['reviews'] })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
