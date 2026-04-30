import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { cartItemsQueryKey, fetchCartItems } from '@/lib/cartItemsQuery'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { getFirstImage, getDisplayImages, onProductImageError } from '@/lib/productImages'
import { ShoppingCart, Trash2, Plus, Minus, MapPin, Phone, User, FileText, ChevronLeft, Tag, Check, KeyRound } from 'lucide-react'
import { motion } from 'framer-motion'
import BottomSheet from '@/components/shop/BottomSheet'
import toast from 'react-hot-toast'
import { filterNameInput, filterPhoneInput, parsePhoneForInput, formatPhoneForSave, PHONE_PREFIX } from '@/lib/authUtils'

const INPUT = "w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"

function OrderForm({ cartItems, subtotal, saleDiscount, shippingCost, productMap, onClose, onSuccess }) {
  const { user } = useAuth()
  const { t } = useLang()
  const [form, setForm] = useState({ full_name: '', phone: '', address: '', building_number: '', apartment_number: '', entrance_note: '', delivery_instruction: 'door', note: '' })
  const [loading, setLoading] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: defaultAddress } = useQuery({
    queryKey: ['defaultAddress', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .limit(1)
        .maybeSingle()
      return data
    },
    enabled: !!user,
  })
  useEffect(() => {
    if (defaultAddress) {
      const parts = [defaultAddress.region, defaultAddress.district, defaultAddress.address].filter(Boolean)
      const fullAddress = parts.join(', ')
      setForm(f => ({
        ...f,
        full_name: filterNameInput(defaultAddress.full_name || '') || f.full_name,
        phone: parsePhoneForInput(defaultAddress.phone || '') || f.phone,
        address: fullAddress || f.address,
        building_number: defaultAddress.building_number || f.building_number,
        apartment_number: defaultAddress.apartment_number || f.apartment_number,
        entrance_note: defaultAddress.entrance_note || defaultAddress.entrance_password || f.entrance_note,
        delivery_instruction: defaultAddress.delivery_instruction || 'door',
      }))
    }
  }, [defaultAddress])

  let couponDiscount = 0
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percent') {
      couponDiscount = Math.round(subtotal * appliedCoupon.value / 100)
    } else {
      couponDiscount = Math.min(appliedCoupon.value, subtotal)
    }
  }
  const total = Math.max(0, subtotal - couponDiscount + shippingCost)

  const applyCoupon = () => {
    const code = couponCode.trim().toUpperCase()
    if (!code) return
    const COUPONS = {
      SAVE10: { type: 'percent', value: 10 },
      SAVE20: { type: 'percent', value: 20 },
      FREE20: { type: 'fixed', value: 20000 },
      FREE50: { type: 'fixed', value: 50000 },
    }
    if (COUPONS[code]) {
      setAppliedCoupon({ code, ...COUPONS[code] })
      toast.success(t('saved'))
    } else {
      toast.error(t('couponInvalid'))
    }
  }

  const buildOrderAddress = () => {
    let addr = form.address
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
  const handleSubmit = async () => {
    if (!form.full_name || !form.phone || form.phone.length < 9 || !form.address) {
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

    setLoading(true)
    try {
      const { error } = await supabase.from('orders').insert({
        user_id: user.id,
        items: cartItems.map(i => ({
          product_id: i.product_id, product_name: i.product_name,
          image: i.product_image, price: Number(i.price), quantity: Number(i.quantity),
        })),
        total, status: 'pending',
        full_name: form.full_name, phone: formatPhoneForSave(form.phone),
        address: buildOrderAddress(), note: buildOrderNote(),
      })
      if (error) throw error
      onSuccess()
    } catch (e) {
      const msg = e?.message || e?.error?.message || ''
      if (String(msg).toLowerCase().includes('omborda') || String(msg).includes('stock')) {
        toast.error(t('insufficientStock'))
      } else {
        toast.error(t('error'))
      }
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
            {loading ? t('sending') : t('confirm')}
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
          <button onClick={applyCoupon}
            className="px-3 py-2 rounded-lg bg-muted text-sm font-semibold flex items-center gap-1.5 flex-shrink-0">
            <Tag className="w-4 h-4" /> {t('applyCoupon')}
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
  const { data: products = [] } = useQuery({
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
  })
  const productMap = Object.fromEntries(products.map(p => [p.id, p]))

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
    await supabase.from('cart_items').delete().eq('user_id', user.id)
    queryClient.invalidateQueries({ queryKey: cartItemsQueryKey(user?.id) })
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
  const selectedItems = !selectedIds ? cartItems : cartItems.filter(i => selectedIds.has(i.id))
  const isSelected = (id) => !selectedIds || selectedIds.has(id)

  const subtotal = selectedItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const SHIPPING_COST = 15000
  const FREE_SHIPPING_MIN = 200000
  const shippingCost = selectedItems.length === 0 ? 0 : (subtotal >= FREE_SHIPPING_MIN ? 0 : SHIPPING_COST)

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
            {cartItems.map((item, i) => {
              const stockCap =
                item.product_id && productMap[item.product_id] != null
                  ? Number(productMap[item.product_id].stock_quantity ?? 0)
                  : null
              const atStockMax = stockCap != null && item.quantity >= stockCap
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
                    {(item.price * item.quantity).toLocaleString()} so'm
                  </p>
                  <p className="text-xs text-muted-foreground">{item.price.toLocaleString()} × {item.quantity}</p>
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
              <button onClick={() => selectedItems.length > 0 && setShowOrder(true)}
                disabled={selectedItems.length === 0}
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
          shippingCost={shippingCost}
          productMap={productMap}
          onClose={() => setShowOrder(false)}
          onSuccess={handleOrderSuccess}
        />
      )}
    </>
  )
}
