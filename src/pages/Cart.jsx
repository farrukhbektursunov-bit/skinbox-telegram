import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { cartItemsQueryKey, fetchCartItems } from '@/lib/cartItemsQuery'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { REGION_NAMES } from '@/lib/i18n'
import { getFirstImage, getDisplayImages, onProductImageError } from '@/lib/productImages'
import { ShoppingCart, Trash2, Plus, Minus, MapPin, Phone, User, FileText, ChevronLeft, Tag, Check, KeyRound, Wallet, CreditCard, Smartphone } from 'lucide-react'
import { motion } from 'framer-motion'
import BottomSheet from '@/components/shop/BottomSheet'
import toast from 'react-hot-toast'
import { filterNameInput, filterPhoneInput, parsePhoneForInput, formatPhoneForSave, PHONE_PREFIX } from '@/lib/authUtils'
import { buildClickPayUrl, isClickConfigured } from '@/lib/clickPay'
import { UZ_DELIVERY_REGIONS, computeDeliveryShipping } from '@/lib/uzRegions'

const INPUT = "w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"

/** PostgREST / Postgres xatosi — barcha matnni bir joyda (pattern va fallback uchun) */
function orderErrorFullText(err) {
  if (err == null) return ''
  const parts = []
  const push = (v) => {
    if (v == null) return
    if (typeof v === 'string' && v.trim()) parts.push(v.trim())
    else if (typeof v === 'number' && Number.isFinite(v)) parts.push(String(v))
  }
  push(err.code)
  push(err.message)
  push(err.details)
  push(err.hint)
  if (err.cause) {
    push(err.cause?.message)
    push(err.cause?.details)
  }
  return parts.join('\n')
}

function OrderForm({ cartItems, subtotal, saleDiscount, productMap, onClose, onSuccess }) {
  const { user } = useAuth()
  const { t, lang } = useLang()
  const [form, setForm] = useState({
    full_name: '', phone: '', region: '', address: '', building_number: '', apartment_number: '',
    entrance_note: '', delivery_instruction: 'door', note: '',
  })
  const [loading, setLoading] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [payMode, setPayMode] = useState('click')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // MUHIM: Cart komponentidagi `defaultAddress` query bilan to'qnashmasligi uchun
  // alohida query key (`defaultAddressFull`) ishlatamiz — bu yerda barcha maydonlar
  // (full_name, phone, district, ...) kerak.
  const { data: defaultAddress } = useQuery({
    queryKey: ['defaultAddressFull', user?.id],
    queryFn: async () => {
      // Avval default manzilni izlaymiz, agar topilmasa eng so'nggi qo'shilganini olamiz.
      // Shu sababli foydalanuvchi manzil kiritgan bo'lsa ham (lekin "asosiy" deb belgilamagan
      // bo'lsa), buyurtma forma avtomatik to'ldiriladi.
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data
    },
    enabled: !!user,
  })
  useEffect(() => {
    if (defaultAddress) {
      const parts = [defaultAddress.district, defaultAddress.address].filter(Boolean)
      const lineAddress = parts.join(', ')
      setForm(f => ({
        ...f,
        full_name: filterNameInput(defaultAddress.full_name || '') || f.full_name,
        phone: parsePhoneForInput(defaultAddress.phone || '') || f.phone,
        region: defaultAddress.region || f.region,
        address: lineAddress || f.address,
        building_number: defaultAddress.building_number || f.building_number,
        apartment_number: defaultAddress.apartment_number || f.apartment_number,
        entrance_note: defaultAddress.entrance_note || defaultAddress.entrance_password || f.entrance_note,
        delivery_instruction: defaultAddress.delivery_instruction || 'door',
      }))
    }
  }, [defaultAddress])

  const { data: shippingSettings } = useQuery({
    queryKey: ['appSettings', 'shipping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['shipping_cost', 'shipping_cost_tashkent', 'shipping_cost_regions', 'free_shipping_min'])
      if (error) {
        console.warn('[OrderForm] app_settings:', error.message)
        return null
      }
      const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]))
      const parseNum = (v) => {
        if (v == null) return null
        if (typeof v === 'number' && Number.isFinite(v)) return v
        const n = Number(v)
        return Number.isFinite(n) ? n : null
      }
      const legacy = parseNum(map.shipping_cost) ?? 15000
      return {
        costTashkent: parseNum(map.shipping_cost_tashkent) ?? legacy,
        costRegions: parseNum(map.shipping_cost_regions) ?? legacy,
        freeShippingMin: parseNum(map.free_shipping_min) ?? 200000,
      }
    },
    staleTime: 5_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  // Eslatma: Kupon va jami narx server tomonida (DB trigger / RPC) majburlanadi.
  // Bu yerdagi qiymatlar faqat UI ko'rsatish (preview) uchun — yakuniy hisob serverdan keladi.
  const couponDiscount = appliedCoupon?.discount ?? 0
  const shippingCost = computeDeliveryShipping({
    subtotalLessDiscount: subtotal - couponDiscount,
    region: form.region,
    freeShippingMin: shippingSettings?.freeShippingMin ?? 200000,
    costTashkent: shippingSettings?.costTashkent ?? 15000,
    costRegions: shippingSettings?.costRegions ?? 15000,
  })
  const total = Math.max(0, subtotal - couponDiscount + shippingCost)

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase()
    if (!code || couponLoading) return
    setCouponLoading(true)
    try {
      const { data, error } = await supabase
        .rpc('validate_coupon', { p_code: code, p_subtotal: subtotal })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      if (row?.valid) {
        setAppliedCoupon({
          code: row.code,
          type: row.type,
          value: Number(row.value || 0),
          discount: Number(row.discount || 0),
        })
        toast.success(t('saved'))
      } else {
        setAppliedCoupon(null)
        toast.error(t('couponInvalid'))
      }
    } catch {
      setAppliedCoupon(null)
      toast.error(t('couponInvalid'))
    } finally {
      setCouponLoading(false)
    }
  }

  const buildOrderAddress = () => {
    let addr = [form.region, form.address].filter(Boolean).join(', ')
    if (form.building_number || form.apartment_number) {
      const extras = [form.building_number && `${t('buildingNumber')}: ${form.building_number}`, form.apartment_number && `${t('apartmentNumber')}: ${form.apartment_number}`].filter(Boolean)
      addr = addr ? `${addr}, ${extras.join(', ')}` : extras.join(', ')
    }
    return addr
  }
  const buildOrderNote = () => {
    const parts = []
    if (form.delivery_instruction) {
      const labels = { door: t('deliveryLeaveAtDoor'), security: t('deliveryLeaveWithSecurity'), post: t('deliveryLeaveAtPost') }
      parts.push(labels[form.delivery_instruction] || form.delivery_instruction)
    }
    if (form.entrance_note) parts.push(`${t('entrancePassword')}: ${form.entrance_note}`)
    if (form.note) parts.push(form.note)
    return parts.length ? parts.join('. ') : null
  }

  const orderErrorToast = (err) => {
    const full = orderErrorFullText(err)
    const msg = full.toLowerCase()

    if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed')) {
      toast.error(t('authConnectionFailed'))
      return
    }
    if (msg.includes('schema "net" does not exist') || msg.includes(`schema 'net' does not exist`) || msg.includes('pg_net')) {
      toast.error(t('orderErrorPgNet'))
      return
    }
    if (msg.includes('app.service_role_key') || (msg.includes('unrecognized configuration parameter') && msg.includes('service_role'))) {
      toast.error(t('orderErrorBadGuc'))
      return
    }
    if (
      msg.includes('row-level security') ||
      msg.includes('violates row-level security') ||
      msg.includes('rls') ||
      msg.includes('permission denied') ||
      msg.includes('new row violates row-level security policy')
    ) {
      toast.error(t('orderErrorRLS'))
      return
    }
    if (
      msg.includes('pgrst116') ||
      msg.includes('contains 0 rows') ||
      msg.includes('incorrect number of rows') ||
      msg.includes('json object requested') ||
      (msg.includes('0 rows') && msg.includes('single')) ||
      msg.includes('client_no_row') ||
      msg.includes('insert returned no rows')
    ) {
      toast.error(t('orderErrorNoRowReturned'))
      return
    }
    if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
      toast.error(t('orderErrorDuplicate'))
      return
    }
    if (msg.includes('violates foreign key') || msg.includes('foreign key constraint')) {
      toast.error(t('orderErrorProductRemoved'))
      return
    }
    if (msg.includes('omborda') || msg.includes('stock') || msg.includes('yetarli')) {
      toast.error(t('insufficientStock'))
      return
    }
    if (msg.includes('mahsulot topilmadi') || msg.includes('invalid input syntax for type uuid')) {
      toast.error(t('orderErrorProductRemoved'))
      return
    }
    if (msg.includes('orders_status_check') || (msg.includes('check constraint') && msg.includes('status'))) {
      toast.error(t('orderErrorDbStatus'))
      return
    }
    if (msg.includes("noto'g'ri summa") || msg.includes('click:')) {
      toast.error(t('clickRequiresPositiveTotal'))
      return
    }

    // Texnik DB matnini foydalanuvchiga ko'rsatmaslik uchun faqat developer console'ga yozamiz.
    if (full) console.error('[Cart] order error:', full)
    toast.error(t('error'))
  }

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error(t('orderErrorSession'))
      return
    }
    if (!form.full_name || !form.phone || form.phone.length < 9 || !form.region || !form.address) {
      toast.error(t('fillRequiredFields')); return
    }
    for (const i of cartItems) {
      if (!i.product_id) continue
      const p = productMap?.[i.product_id]
      const stock = Number(p?.stock_quantity ?? 0)
      if (stock < Number(i.quantity)) {
        toast.error(t('insufficientStock'))
        return
      }
      if (p?.in_stock === false) {
        toast.error(t('insufficientStock'))
        return
      }
    }

    // Payme provayderi bilan shartnoma hali yo'q — foydalanuvchini ogohlantirib,
    // buyurtmani yubormaymiz. (Click/COD ishlaydigan variantlar sifatida qoladi.)
    if (payMode === 'payme') {
      toast.error(t('paymeUnavailable'))
      return
    }

    if (payMode === 'click' && !isClickConfigured()) {
      toast.error(t('clickNotConfigured'))
      return
    }

    if (payMode === 'click' && total <= 0) {
      toast.error(t('clickRequiresPositiveTotal'))
      return
    }

    if (!Number.isFinite(total)) {
      toast.error(t('error'))
      return
    }

    setLoading(true)
    try {
      const orderStatus = payMode === 'click' ? 'awaiting_payment' : 'pending'
      // MUHIM: `total`, `subtotal`, `shipping_cost`, `discount_total` va `items[].price`
      // server tomonida BEFORE INSERT trigger (`aa_orders_recompute_total`) tomonidan qayta hisoblanadi.
      // Klient yuborgan narxlar e'tiborga olinmaydi — DB dan o'qiladi.
      const { data: insertedRows, error } = await supabase.from('orders').insert({
        user_id: user.id,
        items: cartItems.map(i => ({
          product_id: i.product_id, product_name: i.product_name,
          image: i.product_image, quantity: Number(i.quantity),
        })),
        total: 0, status: orderStatus,
        payment_method: payMode === 'click' ? 'click' : 'cod',
        coupon_code: appliedCoupon?.code || null,
        full_name: form.full_name, phone: formatPhoneForSave(form.phone),
        delivery_region: form.region,
        address: buildOrderAddress(), note: buildOrderNote(),
      }).select('id, total')
      if (error) throw error
      const inserted = Array.isArray(insertedRows) ? insertedRows[0] : null
      if (!inserted?.id) {
        const synthetic = {
          message: 'INSERT returned no rows',
          details: 'PostgREST select after insert: empty array. Often RLS SELECT on public.orders or insert rolled back.',
          hint: 'Supabase: policies on orders for INSERT + SELECT (own rows).',
          code: 'CLIENT_NO_ROW',
        }
        throw synthetic
      }

      if (payMode === 'click') {
        // Click uchun summa server qaytargan `total` dan olinadi (klient hisob-kitobi emas).
        const serverTotal = Number(inserted.total)
        if (!Number.isFinite(serverTotal) || serverTotal <= 0) {
          toast.error(t('clickRequiresPositiveTotal'))
          return
        }
        try {
          const returnUrl = `${window.location.origin}/payment/click-return?order_id=${encodeURIComponent(inserted.id)}`
          const payUrl = buildClickPayUrl({
            amountSoum: serverTotal,
            merchantTransId: inserted.id,
            returnUrl,
          })
          window.location.assign(payUrl)
        } catch {
          toast.error(t('error'))
        }
        return
      }

      onSuccess()
    } catch (e) {
      orderErrorToast(e)
    }
    finally { setLoading(false) }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t('orderInfo')}
      footer={
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">{t('totalPayment')}:</span>
            <span className="text-base font-extrabold text-primary">{total.toLocaleString()} so'm</span>
          </div>
          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-3.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-60">
            {loading ? t('sending') : payMode === 'click' ? t('payWithClick') : t('confirm')}
          </button>
        </div>
      }
    >
      <div className="mb-6 p-4 bg-muted/30 rounded-xl space-y-2">
        {cartItems.map(item => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-muted-foreground truncate flex-1 mr-2">{item.product_name} × {item.quantity}</span>
            <span className="font-semibold flex-shrink-0">{(item.price * item.quantity).toLocaleString()} so'm</span>
          </div>
        ))}
        <div className="flex justify-between text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">{t('subtotal')}</span>
          <span className="font-semibold">{subtotal.toLocaleString()} so'm</span>
        </div>
        {saleDiscount > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('saleDiscount')} ✓</span>
            <span>-{saleDiscount.toLocaleString()} so'm</span>
          </div>
        )}
        <div className="flex gap-2 items-center pt-2">
          <input
            value={couponCode}
            onChange={e => setCouponCode(e.target.value)}
            placeholder={t('coupon')}
            className="flex-1 px-3 py-2 rounded-lg bg-muted/50 border border-border text-sm outline-none focus:border-primary/50"
          />
          <button onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()}
            className="px-3 py-2 rounded-lg bg-muted text-sm font-semibold flex items-center gap-1.5 flex-shrink-0 disabled:opacity-60">
            <Tag className="w-4 h-4" /> {couponLoading ? '…' : t('applyCoupon')}
          </button>
        </div>
        {appliedCoupon && (
          <div className="flex justify-between text-sm text-green-600 items-center">
            <span>{t('couponDiscount')} ({appliedCoupon.code})
              <button type="button" onClick={() => setAppliedCoupon(null)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
            </span>
            <span>-{couponDiscount.toLocaleString()} so'm</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{shippingCost === 0 ? t('shippingFree') : t('shipping')}</span>
          <span className="font-semibold">{shippingCost === 0 ? '0' : shippingCost.toLocaleString()} so'm</span>
        </div>
        <div className="flex justify-between text-base pt-2 border-t border-border">
          <span className="font-bold">{t('total')}</span>
          <span className="font-extrabold text-primary">{total.toLocaleString()} so'm</span>
        </div>
      </div>
      <div className="mb-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">{t('selectPaymentMethod')}</p>
        <div className="bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
          {[
            { id: 'cod',   label: t('paymentCod'),   desc: t('paymentCodDesc'),   icon: <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><Wallet className="w-4 h-4 text-foreground" /></div> },
            { id: 'payme', label: t('payme'),        desc: t('paymeDesc'),        icon: <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center"><Smartphone className="w-4 h-4 text-white" /></div> },
            { id: 'click', label: t('paymentClick'), desc: t('paymentClickDesc'), icon: <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center"><CreditCard className="w-4 h-4 text-white" /></div> },
          ].map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPayMode(m.id)}
              className="w-full flex items-center gap-3 px-3 py-3 hover:bg-muted/30 transition-colors text-left"
            >
              {m.icon}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{m.label}</p>
                <p className="text-[11px] text-muted-foreground leading-tight truncate">{m.desc}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                payMode === m.id ? 'border-primary bg-primary' : 'border-border'
              }`}>
                {payMode === m.id && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> {t('fullName')}
          </label>
          <input value={form.full_name} onChange={e => set('full_name', filterNameInput(e.target.value))}
            placeholder={t('namePlaceholder')} type="text" className={INPUT} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> {t('phone')}
          </label>
          <div className={INPUT + " flex items-center px-0"}>
            <span className="pl-4 text-black dark:text-white shrink-0">{PHONE_PREFIX}</span>
            <input value={form.phone} onChange={e => set('phone', filterPhoneInput(e.target.value).slice(0, 9))}
              placeholder="90 123 45 67" type="tel" inputMode="numeric"
              className="flex-1 min-w-0 py-3 pr-4 bg-transparent border-none outline-none focus:ring-0"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> {t('regionLabel')}
          </label>
          <select value={form.region} onChange={e => set('region', e.target.value)} className={INPUT}>
            <option value="">{t('regionLabel')}…</option>
            {UZ_DELIVERY_REGIONS.map((r) => (
              <option key={r} value={r}>{REGION_NAMES[lang]?.[r] ?? r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> {t('address')}
          </label>
          <textarea rows={2} value={form.address} onChange={e => set('address', e.target.value)}
            placeholder={t('addressPlaceholder')}
            className={INPUT + " resize-none"} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('buildingNumber')}</label>
            <input value={form.building_number} onChange={e => set('building_number', e.target.value)}
              placeholder={t('buildingNumberPh')} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('apartmentNumber')}</label>
            <input value={form.apartment_number} onChange={e => set('apartment_number', e.target.value)}
              placeholder={t('apartmentNumberPh')} className={INPUT} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" /> {t('entrancePassword')}
          </label>
          <input value={form.entrance_note} onChange={e => set('entrance_note', e.target.value)}
            placeholder={t('entrancePasswordPh')} className={INPUT} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('deliveryInstruction')}</label>
          <select value={form.delivery_instruction} onChange={e => set('delivery_instruction', e.target.value)}
            className={INPUT}>
            <option value="door">{t('deliveryLeaveAtDoor')}</option>
            <option value="security">{t('deliveryLeaveWithSecurity')}</option>
            <option value="post">{t('deliveryLeaveAtPost')}</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> {t('note')}
          </label>
          <input value={form.note} onChange={e => set('note', e.target.value)}
            placeholder={t('notePlaceholder')} className={INPUT} />
        </div>
      </div>
    </BottomSheet>
  )
}

export default function Cart() {
  const { user } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showOrder, setShowOrder] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const hasLoadedFromStorage = useRef(false)
  const skipNextSave = useRef(false)

  const { data: cartItems = [], isLoading, isError } = useQuery({
    queryKey: cartItemsQueryKey(user?.id),
    queryFn: () => fetchCartItems(user.id),
    enabled: !!user?.id,
    retry: 1,
  })

  const productIds = cartItems.filter(i => i.product_id).map(i => i.product_id)
  const { data: products = [], isPending: cartProductsPending, isError: cartProductsError } = useQuery({
    queryKey: ['productsForCart', productIds],
    queryFn: async () => {
      if (productIds.length === 0) return []
      const { data } = await supabase
        .from('products')
        .select('id, price, sale_price, image_url, images, category, stock_quantity, in_stock')
        .in('id', productIds)
      return data || []
    },
    enabled: productIds.length > 0,
    // Admin tomonidan narx o'zgartirilsa, cart sahifasida darhol ko'rinishi uchun.
    staleTime: 5_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
  const productMap = Object.fromEntries(products.map(p => [p.id, p]))
  const cartPricingReady = productIds.length === 0 || (!cartProductsPending && !cartProductsError)

  // Joriy mahsulot narxini olish (admin panel orqali o'zgartirilgan bo'lishi mumkin).
  // DB trigger (aa_orders_recompute_total) buyurtma yozilishida products.price/sale_price
  // dan foydalanadi, shuning uchun bu yerda ham xuddi shu mantiq amal qiladi.
  const getCurrentItemPrice = (item) => {
    if (!item?.product_id) return Number(item?.price ?? 0)
    const p = productMap[item.product_id]
    if (!p) return Number(item?.price ?? 0)
    const base = Number(p.price ?? 0)
    const sale = p.sale_price != null ? Number(p.sale_price) : null
    return sale != null && sale < base ? sale : base
  }

  // Cart_items.price ni joriy narxga avtomatik sinxronlash — shunda boshqa sahifalarda ham
  // (Topbar mini-cart, ProductDetail.jsx) bir xil narx ko'rinadi.
  const priceSyncedRef = useRef(new Set())
  useEffect(() => {
    if (!user?.id || cartItems.length === 0 || products.length === 0) return
    const updates = []
    for (const item of cartItems) {
      if (!item.product_id) continue
      const current = getCurrentItemPrice(item)
      if (!Number.isFinite(current) || current <= 0) continue
      if (Math.abs(current - Number(item.price)) < 0.5) continue
      const key = `${item.id}:${current}`
      if (priceSyncedRef.current.has(key)) continue
      priceSyncedRef.current.add(key)
      updates.push(
        supabase.from('cart_items')
          .update({ price: current })
          .eq('id', item.id)
          .eq('user_id', user.id),
      )
    }
    if (updates.length > 0) {
      Promise.all(updates).then(() => {
        queryClient.invalidateQueries({ queryKey: cartItemsQueryKey(user?.id) })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, products, user?.id])

  const updateMutation = useMutation({
    mutationFn: async ({ id, quantity }) => {
      const { error } = await supabase.from('cart_items').update({ quantity }).eq('id', id).eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cartItemsQueryKey(user?.id) }),
    onError: () => toast.error(t('error')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('cart_items').delete().eq('id', id).eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('removed')); queryClient.invalidateQueries({ queryKey: cartItemsQueryKey(user?.id) }) },
    onError: () => toast.error(t('error')),
  })

  const clearCart = async () => {
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id)
      if (error) throw error
    } catch (err) {
      console.error('clearCart:', err)
      toast.error(t('error'))
    } finally {
      queryClient.invalidateQueries({ queryKey: cartItemsQueryKey(user?.id) })
    }
  }

  // Load selection from localStorage when returning to cart (only once per mount)
  useEffect(() => {
    if (!user || hasLoadedFromStorage.current || isLoading) return
    hasLoadedFromStorage.current = true
    if (cartItems.length === 0) return
    try {
      const key = `skinbox_cart_selection_${user.id}`
      const saved = localStorage.getItem(key)
      if (saved) {
        const ids = JSON.parse(saved)
        const validIds = ids.filter((id) => cartItems.some((i) => i.id === id))
        setSelectedIds(new Set(validIds))
        skipNextSave.current = true
      }
    } catch {}
  }, [user?.id, cartItems, isLoading])

  // Save selection to localStorage when it changes (after initial load to avoid overwriting)
  useEffect(() => {
    if (!user || !hasLoadedFromStorage.current) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    const key = `skinbox_cart_selection_${user.id}`
    const idsToSave =
      selectedIds === null
        ? cartItems.map((i) => i.id)
        : [...selectedIds].filter((id) => cartItems.some((i) => i.id === id))
    localStorage.setItem(key, JSON.stringify(idsToSave))
  }, [user?.id, selectedIds, cartItems])

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const current = prev ?? new Set(cartItems.map(i => i.id))
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next.size === cartItems.length ? null : next
    })
  }
  const selectAll = () => setSelectedIds(null)
  const deselectAll = () => setSelectedIds(new Set())
  // cart_items dagi narxni joriy products narxi bilan almashtirib derived array yaratamiz.
  // OrderForm va ro'yxat ko'rinishi shu yangilangan narxlardan foydalanadi.
  const cartItemsWithCurrentPrice = cartItems.map((i) => ({
    ...i,
    price: getCurrentItemPrice(i),
  }))
  const selectedItems = !selectedIds
    ? cartItemsWithCurrentPrice
    : cartItemsWithCurrentPrice.filter(i => selectedIds.has(i.id))
  const isSelected = (id) => !selectedIds || selectedIds.has(id)

  const subtotal = selectedItems.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0)

  const { data: defaultAddress } = useQuery({
    queryKey: ['defaultAddress', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('addresses')
        .select('region')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data
    },
    enabled: !!user?.id,
  })

  // Yetkazib berish narxi sozlamalari — admin panel orqali boshqariladi.
  // Server (DB trigger) yakuniy hisobni shu jadvaldan o'qib amalga oshiradi.
  const { data: shippingSettings } = useQuery({
    queryKey: ['appSettings', 'shipping'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['shipping_cost', 'shipping_cost_tashkent', 'shipping_cost_regions', 'free_shipping_min'])
      if (error) {
        console.warn('[Cart] app_settings o\'qishda xato:', error.message)
        return null
      }
      const map = Object.fromEntries((data || []).map(r => [r.key, r.value]))
      const parseNum = (v) => {
        if (v == null) return null
        if (typeof v === 'number' && Number.isFinite(v)) return v
        const n = Number(v)
        return Number.isFinite(n) ? n : null
      }
      const legacy = parseNum(map.shipping_cost) ?? 15000
      return {
        costTashkent: parseNum(map.shipping_cost_tashkent) ?? legacy,
        costRegions: parseNum(map.shipping_cost_regions) ?? legacy,
        freeShippingMin: parseNum(map.free_shipping_min) ?? 200000,
      }
    },
    staleTime: 5_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
  const shippingCost =
    selectedItems.length === 0
      ? 0
      : computeDeliveryShipping({
          subtotalLessDiscount: subtotal,
          region: defaultAddress?.region || '',
          freeShippingMin: shippingSettings?.freeShippingMin ?? 200000,
          costTashkent: shippingSettings?.costTashkent ?? 15000,
          costRegions: shippingSettings?.costRegions ?? 15000,
        })

  let saleDiscount = 0
  for (const item of selectedItems) {
    if (!item.product_id) continue
    const p = productMap[item.product_id]
    if (p?.sale_price != null && Number(p.sale_price) < Number(p.price)) {
      saleDiscount += (Number(p.price) - Number(p.sale_price)) * item.quantity
    }
  }

  const total = selectedItems.length === 0 ? 0 : Math.max(0, subtotal + shippingCost)

  const handleOrderSuccess = async () => {
    if (selectedItems.length > 0) {
      for (const item of selectedItems) {
        await supabase.from('cart_items').delete().eq('id', item.id).eq('user_id', user.id)
      }
      queryClient.invalidateQueries({ queryKey: cartItemsQueryKey(user?.id) })
    }
    setShowOrder(false)
    toast.success(t('orderSuccess'))
    queryClient.invalidateQueries({ queryKey: ['orders', user?.id] })
    queryClient.invalidateQueries({ queryKey: ['products'] })
    queryClient.invalidateQueries({ queryKey: ['productsForCart'] })
  }

  return (
    <>
      <div className="min-h-full bg-background">
        <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/shop')}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xl font-extrabold text-foreground flex-1">{t('cartTitle')}</span>
        </div>

        {isError ? (
          <div className="flex flex-col items-center justify-center py-20 px-5">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <ShoppingCart className="w-8 h-8 text-destructive/60" />
            </div>
            <p className="text-base font-semibold text-foreground mb-1">{t('error')}</p>
            <p className="text-sm text-muted-foreground text-center mb-4">{t('cartLoadError')}</p>
            <button onClick={() => queryClient.invalidateQueries({ queryKey: cartItemsQueryKey(user?.id) })}
              className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold">
              {t('retry')}
            </button>
          </div>
        ) : isLoading ? (
          <div className="px-5 pt-4 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="bg-muted rounded-2xl h-24 animate-pulse" />)}
          </div>
        ) : cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-5">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <ShoppingCart className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground mb-1">{t('cartEmpty')}</p>
            <p className="text-sm text-muted-foreground text-center">{t('cartEmptyDesc')}</p>
          </div>
        ) : (
          <div className="px-5 pt-4 pb-24 space-y-3">
            <div className="flex items-center justify-between">
              <button onClick={selectAll} className="text-sm text-primary font-semibold">
                {t('selectAll')}
              </button>
              <button onClick={deselectAll} className="text-sm text-muted-foreground font-semibold hover:text-foreground">
                {t('deselectAll')}
              </button>
            </div>
            {cartItemsWithCurrentPrice.map((item, i) => {
              const stockCap =
                item.product_id && productMap[item.product_id] != null
                  ? Number(productMap[item.product_id].stock_quantity ?? 0)
                  : null
              const atStockMax = stockCap != null && item.quantity >= stockCap
              const storedPrice = Number(cartItems.find(ci => ci.id === item.id)?.price ?? item.price)
              const priceChanged = Math.abs(storedPrice - Number(item.price)) > 0.5
              return (
              <motion.div key={item.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => toggleSelect(item.id)}
                className={`flex items-center gap-3 p-4 bg-card rounded-2xl border-2 cursor-pointer transition-colors ${
                  isSelected(item.id) ? 'border-primary bg-primary/5' : 'border-border/60 opacity-70'
                }`}
              >
                <button type="button" onClick={e => { e.stopPropagation(); toggleSelect(item.id) }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
                    isSelected(item.id) ? 'bg-primary border-primary text-white' : 'border-muted-foreground'
                  }`}>
                  {isSelected(item.id) && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                </button>
                {(() => {
                  const product = productMap[item.product_id]
                  const fromDb = product && (getFirstImage(product) || getDisplayImages(product)[0])
                  const imageUrl =
                    fromDb ||
                    (item.product_image && String(item.product_image).trim()) ||
                    getDisplayImages({ category: product?.category || 'cleansers' })[0]
                  const imgProduct = product || { image_url: item.product_image, category: null, images: [] }
                  const openProduct = (e) => {
                    e.stopPropagation()
                    if (item.product_id) navigate(`/product/${item.product_id}`)
                  }
                  const thumbClass = 'w-16 h-16 rounded-xl object-cover flex-shrink-0 min-w-[64px] min-h-[64px]'
                  if (item.product_id) {
                    return (
                      <button
                        type="button"
                        onClick={openProduct}
                        className="flex-shrink-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        aria-label={t('details')}
                      >
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.product_name}
                            className={thumbClass}
                            onError={(e) =>
                              onProductImageError(
                                e,
                                imgProduct,
                                getDisplayImages({ category: product?.category || 'cleansers' })[0],
                              )
                            }
                          />
                        ) : (
                          <div className={`${thumbClass} bg-muted flex items-center justify-center`}>
                            <ShoppingCart className="w-6 h-6 text-muted-foreground/40" />
                          </div>
                        )}
                      </button>
                    )
                  }
                  return imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={item.product_name}
                      className={thumbClass}
                      onError={(e) =>
                        onProductImageError(
                          e,
                          imgProduct,
                          getDisplayImages({ category: product?.category || 'cleansers' })[0],
                        )
                      }
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-muted flex-shrink-0 flex items-center justify-center">
                      <ShoppingCart className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  )
                })()}
                <div className="flex-1 min-w-0">
                  {item.product_id ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/product/${item.product_id}`)
                      }}
                      className="text-left w-full text-sm font-semibold text-foreground truncate hover:text-primary hover:underline underline-offset-2"
                    >
                      {item.product_name}
                    </button>
                  ) : (
                    <p className="text-sm font-semibold text-foreground truncate">{item.product_name}</p>
                  )}
                  <p className="text-sm text-primary font-bold mt-0.5">
                    {(Number(item.price) * Number(item.quantity)).toLocaleString()} so'm
                    {priceChanged && (
                      <span className="ml-1 text-[10px] text-muted-foreground line-through font-normal">
                        {(storedPrice * Number(item.quantity)).toLocaleString()}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Number(item.price).toLocaleString()} × {item.quantity}
                    {priceChanged && (
                      <span className="ml-1 text-[10px] text-amber-600 font-semibold">
                        narx yangilandi
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <button type="button" onClick={e => { e.stopPropagation(); item.quantity > 1
                      ? updateMutation.mutate({ id: item.id, quantity: item.quantity - 1 })
                      : deleteMutation.mutate(item.id) }}
                      className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                    <button type="button" onClick={e => {
                      e.stopPropagation()
                      if (atStockMax) { toast.error(t('insufficientStock')); return }
                      updateMutation.mutate({ id: item.id, quantity: item.quantity + 1 })
                    }}
                      disabled={atStockMax}
                      className="w-7 h-7 rounded-full bg-muted flex items-center justify-center disabled:opacity-40">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <button type="button" onClick={e => { e.stopPropagation(); deleteMutation.mutate(item.id) }}
                  className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </motion.div>
            )
            })}

            {/* Place Order — ixcham qator */}
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {selectedItems.length} {t('itemsUnit')} • {total.toLocaleString()} {t('currency')}
                </p>
              </div>
              <button onClick={() => selectedItems.length > 0 && cartPricingReady && setShowOrder(true)}
                disabled={selectedItems.length === 0 || !cartPricingReady}
                className="py-3 px-6 bg-primary text-white rounded-xl text-sm font-semibold active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
                {t('orderBtn')}
              </button>
            </div>
          </div>
        )}
      </div>

      {showOrder && selectedItems.length > 0 && (
        <OrderForm
          cartItems={selectedItems}
          subtotal={subtotal}
          saleDiscount={saleDiscount}
          productMap={productMap}
          onClose={() => setShowOrder(false)}
          onSuccess={handleOrderSuccess}
        />
      )}
    </>
  )
}
