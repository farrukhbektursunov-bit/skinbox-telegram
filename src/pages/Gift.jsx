import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/api/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, Gift, Copy, Check, Share2,
  Package, Clock, Truck, CheckCircle, X,
  Plus, ExternalLink
} from 'lucide-react'
import BottomSheet from '@/components/shop/BottomSheet'
import toast from 'react-hot-toast'

// ── Sovg'a yaratish modali ─────────────────────────────────────────
const GIFT_PAYMENT_METHODS = [
  { id: 'payme', labelKey: 'payme', icon: 'P', color: 'bg-blue-600' },
  { id: 'click', labelKey: 'click', icon: 'C', color: 'bg-orange-500' },
]

function CreateGiftModal({ product, onClose, onCreated }) {
  const { user } = useAuth()
  const { t } = useLang()
  const [step, setStep] = useState('details') // 'details' | 'payment' | 'processing'
  const [quantity, setQuantity] = useState(1)
  const [message, setMessage]   = useState('')
  const [paymentMethod, setPaymentMethod] = useState('payme')
  const [loading, setLoading]   = useState(false)

  const total = (product?.price || 0) * quantity

  const handlePayAndCreate = async () => {
    setLoading(true)
    setStep('processing')
    try {
      // Simulate payment processing (real app: call Payme/Click API)
      await new Promise(r => setTimeout(r, 1500))
      toast.success(t('giftPaymentSuccess'))

      const token = crypto.randomUUID?.()?.replace(/-/g, '') || `${Date.now()}${Math.random().toString(36).slice(2, 12)}`
      const { data, error } = await supabase
        .from('gifts')
        .insert({
          sender_id:     user.id,
          product_id:    product.id,
          product_name:  product.name,
          product_image: product.image_url,
          price:         product.price,
          quantity,
          message:       message.trim() || null,
          status:        'pending',
          token,
        })
        .select()
        .single()
      if (error) throw error
      toast.success(t('giftLinkCreated'))
      onCreated(data)
    } catch (err) {
      console.error(err)
      toast.error(t('error'))
      setStep('payment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md bg-card rounded-t-3xl flex flex-col" style={{ maxHeight: "90vh" }}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          {step === 'payment' ? (
            <button onClick={() => setStep('details')} disabled={loading}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : <div className="w-8" />}
          <h3 className="text-lg font-extrabold flex-1 text-center">{step === 'details' ? t('giftCreateTitle') : t('giftPaymentTitle')}</h3>
          <button onClick={onClose} disabled={loading} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-4" style={{ WebkitOverflowScrolling: "touch" }}>

        {step === 'processing' ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm font-semibold text-foreground">{t('creating')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('giftPaymentSuccess')}</p>
          </div>
        ) : step === 'payment' ? (
          <>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-2xl">
              {product.image_url
                ? <img src={product.image_url} alt={product.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0"><Package className="w-5 h-5 text-muted-foreground/40" /></div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                <p className="text-sm font-bold text-primary">{total.toLocaleString()} so'm</p>
              </div>
            </div>
            <p className="text-xs font-semibold text-muted-foreground">{t('selectPaymentMethod')}</p>
            <div className="grid grid-cols-2 gap-2">
              {GIFT_PAYMENT_METHODS.map(m => (
                <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all ${
                    paymentMethod === m.id ? 'border-primary bg-primary/5' : 'border-border bg-card'
                  }`}
                >
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-black ${m.color}`}>{m.icon}</span>
                  <span className="text-[10px] font-semibold">{t(m.labelKey)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-2xl mb-4">
              {product.image_url
                ? <img src={product.image_url} alt={product.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0"><Package className="w-6 h-6 text-muted-foreground/40" /></div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                <p className="text-sm font-bold text-primary">{product.price?.toLocaleString()} so'm</p>
              </div>
            </div>
            <div className="flex items-center justify-between bg-muted/50 rounded-xl p-3 mb-4">
              <span className="text-sm font-semibold text-foreground">{t('qty')}</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-lg font-bold">−</button>
                <span className="text-base font-bold w-6 text-center">{quantity}</span>
                <button onClick={() => setQuantity(q => q + 1)}
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-lg font-bold">+</button>
              </div>
            </div>
            <div className="mb-5">
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('giftMessageLabel')}</label>
              <textarea rows={2} value={message} onChange={e => setMessage(e.target.value)}
                placeholder={t('giftMessagePlaceholder')}
                className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
              />
            </div>
            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4">
              <span className="text-sm text-muted-foreground">{t('total')}:</span>
              <span className="text-base font-extrabold text-primary">{total.toLocaleString()} so'm</span>
            </div>
          </>
        )}

        </div>
        {step !== 'processing' && (
          <div className="px-6 pt-3 pb-6 flex-shrink-0 border-t border-border/40">
            {step === 'details' ? (
              <button onClick={() => setStep('payment')}
                className="w-full py-3.5 bg-primary text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <Gift className="w-4 h-4" />
                {t('continueToPayment')}
              </button>
            ) : (
              <button onClick={handlePayAndCreate} disabled={loading}
                className="w-full py-3.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                {loading ? null : <Gift className="w-4 h-4" />}
                {t('giftPayBtn')} — {total.toLocaleString()} so'm
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ── Link ko'rsatish modali ─────────────────────────────────────────
function GiftLinkModal({ gift, onClose }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  const giftUrl = `${window.location.origin}/claim-gift/${gift.token}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(giftUrl)
    setCopied(true)
    toast.success(t('linkCopied'))
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('giftForYouTitle'),
          text: `${gift.product_name} ${t('giftShareText')}`,
          url: giftUrl,
        })
      } catch {}
    } else {
      handleCopy()
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md bg-card rounded-t-3xl flex flex-col" style={{ maxHeight: "90vh" }}
      >
        {/* Konfetti emoji */}
        <div className="text-center mb-5">
          <div className="text-5xl mb-3">🎁</div>
          <h3 className="text-xl font-extrabold text-foreground">{t('giftReady')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('giftReadyDesc')}
          </p>
        </div>

        {/* Link */}
        <div className="bg-muted/50 rounded-2xl p-4 mb-4">
          <p className="text-xs text-muted-foreground mb-2 font-semibold">{t('giftLinkLabel')}</p>
          <div className="flex items-center gap-2 bg-card rounded-xl border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground flex-1 truncate">{giftUrl}</p>
            <button onClick={handleCopy}
              className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${copied ? 'bg-green-100' : 'bg-muted'}`}
            >
              {copied
                ? <Check className="w-3.5 h-3.5 text-green-600" />
                : <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </button>
          </div>
        </div>

        {/* Qanday ishlaydi */}
        <div className="bg-card rounded-2xl border border-border/60 p-4 mb-5 space-y-2.5">
          {[
            { icon: '1️⃣', textKey: 'giftStep1' },
            { icon: '2️⃣', textKey: 'giftStep2' },
            { icon: '3️⃣', textKey: 'giftStep3' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-base">{step.icon}</span>
              <p className="text-xs text-muted-foreground">{t(step.textKey)}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleCopy}
            className="flex items-center justify-center gap-2 py-3 border border-border rounded-xl text-sm font-semibold text-foreground"
          >
            <Copy className="w-4 h-4" /> {t('copyLink')}
          </button>
          <button onClick={handleShare}
            className="flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl text-sm font-semibold"
          >
            <Share2 className="w-4 h-4" /> {t('sendBtn')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Yuborilgan sovg'alar ro'yxati ──────────────────────────────────
const GIFT_STATUS = {
  pending:   { labelKey: 'giftStatusPending',    color: 'text-orange-500', bg: 'bg-orange-50', icon: Clock },
  claimed:   { labelKey: 'giftStatusClaimed',    color: 'text-blue-500',   bg: 'bg-blue-50',   icon: CheckCircle },
  delivered: { labelKey: 'giftStatusDelivered',  color: 'text-green-600',  bg: 'bg-green-50',  icon: CheckCircle },
  cancelled: { labelKey: 'giftStatusCancelled',  color: 'text-red-500',    bg: 'bg-red-50',    icon: X },
}

function GiftCard({ gift, t, lang }) {
  const [showLink, setShowLink] = useState(false)
  const giftUrl = `${window.location.origin}/claim-gift/${gift.token}`
  const st = GIFT_STATUS[gift.status] || GIFT_STATUS.pending
  const Icon = st.icon
  const locale = lang === 'en' ? 'en-US' : lang === 'ru' ? 'ru-RU' : 'uz-UZ'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(giftUrl)
    toast.success(t('linkCopied'))
  }

  return (
    <div className="bg-card rounded-2xl border border-border/60 p-4">
      <div className="flex items-start gap-3">
        {gift.product_image
          ? <img src={gift.product_image} alt={gift.product_name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
          : <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0"><Package className="w-6 h-6 text-muted-foreground/40" /></div>
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{gift.product_name}</p>
          <p className="text-xs text-muted-foreground">{gift.quantity}{t('giftQtyUnit')} • {gift.price?.toLocaleString()} so'm</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(gift.created_at).toLocaleDateString(locale)}
          </p>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${st.bg}`}>
          <Icon className={`w-3 h-3 ${st.color}`} />
          <span className={`text-[10px] font-semibold ${st.color}`}>{t(st.labelKey)}</span>
        </div>
      </div>

      {gift.message && (
        <p className="text-xs text-muted-foreground mt-2 italic">"{gift.message}"</p>
      )}

      {gift.status === 'pending' && (
        <button onClick={handleCopy}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <Copy className="w-3.5 h-3.5" /> {t('copyLink')}
        </button>
      )}

      {gift.status === 'claimed' && (
        <div className="mt-3 bg-muted/50 rounded-xl p-3 space-y-1">
          <p className="text-xs font-semibold text-foreground">{t('recipientLabel')}</p>
          <p className="text-xs text-muted-foreground">{gift.recipient_name}</p>
          <p className="text-xs text-muted-foreground">{gift.recipient_phone}</p>
          <p className="text-xs text-muted-foreground">{gift.recipient_address}</p>
        </div>
      )}
    </div>
  )
}

// ── Asosiy sahifa ─────────────────────────────────────────────────
export default function GiftSent() {
  const { user } = useAuth()
  const { t, lang } = useLang()
  const navigate = useNavigate()

  const { data: gifts = [], isLoading } = useQuery({
    queryKey: ['gifts', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('gifts').select('*')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
      return data || []
    },
    enabled: !!user,
  })

  return (
    <div>
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-lg font-extrabold flex-1">{t('sentGifts')}</span>
      </div>

      <div className="px-5 pt-4 pb-24 space-y-3">
        {isLoading
          ? [...Array(2)].map((_, i) => <div key={i} className="bg-muted rounded-2xl h-24 animate-pulse" />)
          : gifts.length === 0
            ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="text-6xl mb-4">🎁</div>
                <p className="text-base font-semibold text-foreground mb-1">{t('noGifts')}</p>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  {t('noGiftsDesc')}
                </p>
                <button onClick={() => navigate('/shop')}
                  className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold"
                >
                  {t('goToShop')}
                </button>
              </div>
            )
            : gifts.map(gift => <GiftCard key={gift.id} gift={gift} t={t} lang={lang} />)
        }
      </div>
    </div>
  )
}

// Bular boshqa komponentlar tomonidan ishlatiladi
export { CreateGiftModal, GiftLinkModal }
