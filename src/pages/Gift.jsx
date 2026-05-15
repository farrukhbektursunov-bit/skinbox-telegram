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
  Plus, ExternalLink, CreditCard, Smartphone,
  MessageCircle
} from 'lucide-react'
import BottomSheet from '@/components/shop/BottomSheet'
import toast from 'react-hot-toast'
import { buildClickPayUrl, isClickConfigured } from '@/lib/clickPay'

// ── Sovg'a yaratish modali ─────────────────────────────────────────
// Eslatma: Payme provayderi bilan shartnoma hali rasmiylashtirilmagan —
// foydalanuvchi tanlay oladi, lekin yuborilganda `paymeUnavailable` toast
// ko'rsatiladi va so'rov yuborilmaydi (`handlePayAndCreate` da tekshiriladi).
// Cart sahifasidagi to'lov ro'yxati bilan bir xil ko'rinishni saqlash uchun ham
// ikkala variant ham UI da ko'rsatiladi.

// Kuchli token: SubtleCrypto random bytes → hex. UUID fallback emas, balki
// crypto.getRandomValues() ishlatadi. Faqat juda eski (HTTPS bo'lmagan) brauzerlarda
// fallback bo'ladi va u ham faqat ogohlantirish bilan.
function generateGiftToken() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    }
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '')
    }
  } catch {}
  // Eski brauzerlar uchun fallback — bu yo'l qaytib qoluvchi.
  // Date.now() + Math.random() taxmin qilinishi mumkin, shu uchun bir nechta
  // manbalarni aralashtirish ham foyda bermaydi. Tavsiya: zamonaviy brauzer talab qilish.
  throw new Error('Secure random not available — brauzeringizni yangilang')
}

function CreateGiftModal({ product, onClose, onCreated }) {
  const { user } = useAuth()
  const { t } = useLang()
  const [step, setStep] = useState('details') // 'details' | 'payment' | 'processing'
  const [quantity, setQuantity] = useState(1)
  const [message, setMessage]   = useState('')
  // Sovg'a yaratish endi faqat online to'lov bilan: Click yoki Payme.
  // Naqd (COD) varianti olib tashlandi — sovg'ani sender oldindan to'laydi.
  const [paymentMethod, setPaymentMethod] = useState('click')
  const [loading, setLoading]   = useState(false)

  const total = (product?.price || 0) * quantity

  const handlePayAndCreate = async () => {
    // Payme provayderi bilan shartnoma yo'q — foydalanuvchini ogohlantirib chiqamiz.
    if (paymentMethod === 'payme') {
      toast.error(t('paymeUnavailable'))
      return
    }
    if (paymentMethod !== 'click') {
      // Faqat Click qo'llab-quvvatlanadi (Payme tayyor emas, COD olib tashlangan).
      toast.error(t('selectPaymentMethod'))
      return
    }
    if (!isClickConfigured()) {
      toast.error(t('clickNotConfigured'))
      return
    }

    setLoading(true)
    setStep('processing')
    try {
      let token
      try {
        token = generateGiftToken()
      } catch (e) {
        toast.error(e?.message || t('error'))
        setStep('payment')
        return
      }

      // Click oqimi: sovg'a 'awaiting_payment' bilan yoziladi, keyin my.click.uz ga o'tiladi.
      // To'lov tasdiqlangach, click-complete edge-function uni 'pending' ga o'zgartiradi
      // va link ulashishga tayyor bo'ladi.
      const { data, error } = await supabase
        .from('gifts')
        .insert({
          sender_id:      user.id,
          product_id:     product.id,
          product_name:   product.name,
          product_image:  product.image_url,
          price:          product.price,
          quantity,
          message:        message.trim() || null,
          status:         'awaiting_payment',
          token,
          payment_method: 'click',
        })
        .select()
        .single()
      if (error) throw error

      const returnUrl = `${window.location.origin}/payment/click-return?gift_id=${encodeURIComponent(data.id)}`
      const payUrl = buildClickPayUrl({
        amountSoum: total,
        merchantTransId: `gift:${data.id}`,
        returnUrl,
      })
      window.location.assign(payUrl)
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
            <div className="bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
              {[
                // Sovg'a uchun faqat online to'lov: naqd (COD) bu yerda yo'q.
                { id: 'click', label: t('paymentClick'), desc: t('paymentClickDesc'), icon: <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center"><CreditCard className="w-4 h-4 text-white" /></div> },
                { id: 'payme', label: t('payme'),        desc: t('paymeDesc'),        icon: <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center"><Smartphone className="w-4 h-4 text-white" /></div> },
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  {m.icon}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{m.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-tight truncate">{m.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    paymentMethod === m.id ? 'border-primary bg-primary' : 'border-border'
                  }`}>
                    {paymentMethod === m.id && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
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
// Telegram brand SVG (paper plane in circle) — lucide brand ikonlarini bermaydi.
function TelegramIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  )
}

// WhatsApp brand SVG
function WhatsAppIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  )
}

function GiftLinkModal({ gift, onClose }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  // Token majburiy — agar yo'q bo'lsa, link `undefined` deb yoziladi va qabul qiluvchi
  // sahifasida "Sovg'a topilmadi" chiqadi. Bunga yo'l qo'ymaymiz: avval ogohlantirib,
  // modalni yopamiz.
  if (!gift?.token) {
    console.error('[GiftLinkModal] gift.token missing:', gift)
    return null
  }
  const giftUrl = `${window.location.origin}/claim-gift/${gift.token}`
  const shareText = `${gift.product_name} ${t('giftShareText')}`
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(giftUrl)
      } else {
        // Fallback uchun: clipboard API ishlamasa, oddiy textarea trigi.
        const ta = document.createElement('textarea')
        ta.value = giftUrl
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      toast.success(t('linkCopied'))
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Clipboard write failed:', err)
      toast.error(t('error'))
    }
  }

  // Native OS share sheet (telefon/planshetda — Telegram, Instagram, kontaktlar va h.k.).
  // Desktop brauzerlarda odatda mavjud emas, shu uchun pastdagi tezkor tugmalarni qoldiramiz.
  const handleNativeShare = async () => {
    if (!canNativeShare) {
      toast(t('shareNotSupported'))
      return
    }
    try {
      await navigator.share({
        title: t('giftForYouTitle'),
        text: shareText,
        url: giftUrl,
      })
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('navigator.share failed:', err)
      }
    }
  }

  // Deep links — har bir messenger uchun kontaktlar ro'yxati ochiladi.
  // Telegram: rasmiy "share" sahifasi (`t.me/share/url`). Mobilda Telegram ilovasi ochiladi,
  // u erda kontaktlar ro'yxati ko'rinadi.
  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(giftUrl)}&text=${encodeURIComponent(shareText)}`
  // WhatsApp: `wa.me/?text=...` — kontaktlar ro'yxati ochiladi.
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${giftUrl}`)}`
  // SMS: qurilmaning ichki xabar ilovasi.
  const smsHref = `sms:?&body=${encodeURIComponent(`${shareText}\n${giftUrl}`)}`

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-md bg-card rounded-t-3xl flex flex-col" style={{ maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-end px-4 pt-4 pb-2 flex-shrink-0">
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
            aria-label="close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                aria-label={t('copyLink')}
              >
                {copied
                  ? <Check className="w-3.5 h-3.5 text-green-600" />
                  : <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                }
              </button>
            </div>
          </div>

          {/* Tezkor ulashish — qaysi ilova orqali yuborishni tanlash */}
          <p className="text-xs font-semibold text-muted-foreground mb-2">{t('shareVia')}</p>
          <div className="grid grid-cols-4 gap-2 mb-5">
            <a
              href={telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-border hover:bg-muted/40 transition-colors active:scale-[0.97]"
            >
              <div className="w-10 h-10 rounded-full bg-[#229ED9] flex items-center justify-center text-white">
                <TelegramIcon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">Telegram</span>
            </a>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-border hover:bg-muted/40 transition-colors active:scale-[0.97]"
            >
              <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white">
                <WhatsAppIcon className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">WhatsApp</span>
            </a>
            <a
              href={smsHref}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-border hover:bg-muted/40 transition-colors active:scale-[0.97]"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                <MessageCircle className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-semibold text-foreground">SMS</span>
            </a>
            <button
              type="button"
              onClick={canNativeShare ? handleNativeShare : handleCopy}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-border hover:bg-muted/40 transition-colors active:scale-[0.97]"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground">
                {canNativeShare ? <Share2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </div>
              <span className="text-[11px] font-semibold text-foreground">
                {canNativeShare ? t('shareMore') : t('copyLink')}
              </span>
            </button>
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
              className="flex items-center justify-center gap-2 py-3 border border-border rounded-xl text-sm font-semibold text-foreground active:scale-[0.98] transition-transform"
            >
              <Copy className="w-4 h-4" /> {t('copyLink')}
            </button>
            <button onClick={canNativeShare ? handleNativeShare : () => window.open(telegramHref, '_blank', 'noopener,noreferrer')}
              className="flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform"
            >
              <Share2 className="w-4 h-4" /> {t('sendBtn')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Yuborilgan sovg'alar ro'yxati ──────────────────────────────────
const GIFT_STATUS = {
  awaiting_payment: { labelKey: 'giftStatusAwaitingPayment', color: 'text-amber-500', bg: 'bg-amber-50', icon: Clock },
  pending:   { labelKey: 'giftStatusPending',    color: 'text-orange-500', bg: 'bg-orange-50', icon: Clock },
  claimed:   { labelKey: 'giftStatusClaimed',    color: 'text-blue-500',   bg: 'bg-blue-50',   icon: CheckCircle },
  delivered: { labelKey: 'giftStatusDelivered',  color: 'text-green-600',  bg: 'bg-green-50',  icon: CheckCircle },
  cancelled: { labelKey: 'giftStatusCancelled',  color: 'text-red-500',    bg: 'bg-red-50',    icon: X },
}

function GiftCard({ gift, t, lang }) {
  const giftUrl = `${window.location.origin}/claim-gift/${gift.token}`
  const st = GIFT_STATUS[gift.status] || GIFT_STATUS.pending
  const Icon = st.icon
  const locale = lang === 'en' ? 'en-US' : lang === 'ru' ? 'ru-RU' : 'uz-UZ'
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const shareText = `${gift.product_name} ${t('giftShareText')}`

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(giftUrl)
      } else {
        const ta = document.createElement('textarea')
        ta.value = giftUrl
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      toast.success(t('linkCopied'))
    } catch (err) {
      console.error('Clipboard write failed:', err)
      toast.error(t('error'))
    }
  }

  const handleShare = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({ title: t('giftForYouTitle'), text: shareText, url: giftUrl })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
      }
    }
    // Fallback: Telegram share oynasini ochamiz (kontaktlar ro'yxati bilan).
    const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(giftUrl)}&text=${encodeURIComponent(shareText)}`
    window.open(telegramHref, '_blank', 'noopener,noreferrer')
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
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={handleCopy}
            className="flex items-center justify-center gap-2 py-2 border border-border rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> {t('copyLink')}
          </button>
          <button onClick={handleShare}
            className="flex items-center justify-center gap-2 py-2 bg-primary text-white rounded-xl text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            <Share2 className="w-3.5 h-3.5" /> {t('sendBtn')}
          </button>
        </div>
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
