/**
 * Click Checkout: https://docs.click.uz — to'lov sahifasiga yo'naltirish (maxfiy kalit yo'q).
 * Prepare/Complete: Supabase Edge Functions (click-prepare, click-complete).
 */
const PAY_BASE = 'https://my.click.uz/services/pay'

export function getClickPublicConfig() {
  return {
    merchantId: import.meta.env.VITE_CLICK_MERCHANT_ID || '',
    serviceId: import.meta.env.VITE_CLICK_SERVICE_ID || '',
    merchantUserId: import.meta.env.VITE_CLICK_MERCHANT_USER_ID || '',
  }
}

export function isClickConfigured() {
  const { merchantId, serviceId, merchantUserId } = getClickPublicConfig()
  return Boolean(merchantId && serviceId && merchantUserId)
}

/**
 * @param {object} p
 * @param {number} p.amountSoum — so'm (butun yoki kasr)
 * @param {string} p.merchantTransId — buyurtma UUID (orders.id) yoki sovg'a uchun gift:<gifts.id>
 * @param {string} [p.returnUrl] — to'lovdan keyin (to'liq URL)
 * @param {string} [p.cardType] — uzcard | humo
 */
export function buildClickPayUrl({ amountSoum, merchantTransId, returnUrl, cardType }) {
  const { merchantId, serviceId, merchantUserId } = getClickPublicConfig()
  if (!merchantId || !serviceId || !merchantUserId) {
    throw new Error('Click: VITE_CLICK_MERCHANT_ID / SERVICE_ID / MERCHANT_USER_ID sozlanmagan')
  }
  const amount = Number(amountSoum)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Click: noto\'g\'ri summa')
  }
  const params = new URLSearchParams({
    merchant_id: String(merchantId),
    merchant_user_id: String(merchantUserId),
    service_id: String(serviceId),
    amount: amount.toFixed(2),
    transaction_param: String(merchantTransId),
  })
  if (returnUrl) params.set('return_url', returnUrl)
  if (cardType) params.set('card_type', cardType)
  return `${PAY_BASE}?${params.toString()}`
}
