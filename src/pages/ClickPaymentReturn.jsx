import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/api/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { cartItemsQueryKey } from '@/lib/cartItemsQuery'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

export default function ClickPaymentReturn() {
  const { user } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const orderId = params.get('order_id')
  const giftId = params.get('gift_id')
  const [state, setState] = useState('loading')
  const clearedCart = useRef(false)
  const isGiftPayment = Boolean(giftId)

  useEffect(() => {
    if (!user?.id || (!orderId && !giftId)) {
      setState('fail')
      return
    }
    let cancelled = false
    const poll = async () => {
      if (giftId) {
        const { data, error } = await supabase
          .from('gifts')
          .select('id, status')
          .eq('id', giftId)
          .eq('sender_id', user.id)
          .maybeSingle()
        if (cancelled) return
        if (error || !data) {
          setState('fail')
          return
        }
        if (data.status === 'pending' || data.status === 'claimed' || data.status === 'delivered') {
          setState('ok')
          return
        }
        if (data.status === 'awaiting_payment') {
          setState('pending')
          return
        }
        if (data.status === 'cancelled') {
          setState('fail')
          return
        }
        setState('ok')
        return
      }

      const { data, error } = await supabase
        .from('orders')
        .select('id, status')
        .eq('id', orderId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (error || !data) {
        setState('fail')
        return
      }
      if (data.status === 'pending' || data.status === 'confirmed') {
        setState('ok')
        return
      }
      if (data.status === 'awaiting_payment') {
        setState('pending')
        return
      }
      if (data.status === 'cancelled') {
        setState('fail')
        return
      }
      setState('ok')
    }
    poll()
    const id = setInterval(poll, 2500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [user?.id, orderId, giftId])

  useEffect(() => {
    if (state !== 'ok' || !user?.id || !orderId || clearedCart.current) return
    clearedCart.current = true
    ;(async () => {
      const { data: order } = await supabase.from('orders').select('items').eq('id', orderId).eq('user_id', user.id).maybeSingle()
      const items = order?.items
      if (!Array.isArray(items)) return
      const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))]
      for (const pid of productIds) {
        await supabase.from('cart_items').delete().eq('user_id', user.id).eq('product_id', pid)
      }
      queryClient.invalidateQueries({ queryKey: cartItemsQueryKey(user.id) })
      queryClient.invalidateQueries({ queryKey: ['orders', user.id] })
    })()
  }, [state, user?.id, orderId, queryClient])

  useEffect(() => {
    if (state !== 'ok' || !user?.id || !giftId) return
    queryClient.invalidateQueries({ queryKey: ['gifts', user.id] })
  }, [state, user?.id, giftId, queryClient])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center space-y-4">
        {state === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">{t('clickReturnChecking')}</p>
          </>
        )}
        {state === 'pending' && (
          <>
            <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-foreground">{t('clickReturnPending')}</p>
            <p className="text-xs text-muted-foreground">{t('clickReturnPendingHint')}</p>
          </>
        )}
        {state === 'ok' && (
          <>
            <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
            <p className="text-base font-extrabold text-foreground">{t('clickReturnSuccess')}</p>
            <button
              type="button"
              onClick={() => navigate(isGiftPayment ? '/gifts-sent' : '/orders')}
              className="w-full py-3.5 bg-primary text-white rounded-xl text-sm font-semibold"
            >
              {isGiftPayment ? t('sentGifts') : t('myOrders')}
            </button>
          </>
        )}
        {state === 'fail' && (
          <>
            <XCircle className="w-14 h-14 text-destructive mx-auto" />
            <p className="text-base font-extrabold text-foreground">{t('clickReturnFail')}</p>
            <button
              type="button"
              onClick={() => navigate(isGiftPayment ? '/gifts-sent' : '/cart')}
              className="w-full py-3.5 bg-muted text-foreground rounded-xl text-sm font-semibold"
            >
              {isGiftPayment ? t('sentGifts') : t('cartTitle')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
