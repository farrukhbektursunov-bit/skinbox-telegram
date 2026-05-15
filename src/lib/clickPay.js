/**
 * Click Checkout: https://docs.click.uz — to'lov sahifasiga yo'naltirish (maxfiy kalit yo'q).
 * Prepare/Complete: Supabase Edge Functions (click-prepare, click-complete).
 */
const PAY_BASE = 'https://my.click.uz/services/pay'

// Vercel/CI dan yopishgan yangi qator va probel belgilarini olib tashlash.
// (Aks holda URL ga `%0A` kirib qoladi va Click "Ошибка" qaytaradi.)
const cleanEnv = (v) => String(v ?? '').replace(/[\s\u00A0]+/g, '').trim()

export function getClickPublicConfig() {
  return {
    merchantId: cleanEnv(import.meta.env.VITE_CLICK_MERCHANT_ID),
    serviceId: cleanEnv(import.meta.env.VITE_CLICK_SERVICE_ID),
    merchantUserId: cleanEnv(import.meta.env.VITE_CLICK_MERCHANT_USER_ID),
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
  // #region agent log
  try {
    fetch('http://127.0.0.1:7729/ingest/5faedbbe-0012-4cc2-aeed-9c5d055b8eb0', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '58347f' },
      body: JSON.stringify({
        sessionId: '58347f',
        location: 'clickPay.js:buildClickPayUrl',
        message: 'env snapshot at build url time',
        data: {
          hypothesisId: 'H3,H5',
          hasMerchantId: !!merchantId,
          hasServiceId: !!serviceId,
          hasMerchantUserId: !!merchantUserId,
          merchantIdLen: String(merchantId || '').length,
          serviceIdLen: String(serviceId || '').length,
          amountInput: amountSoum,
          merchantTransIdSample: String(merchantTransId || '').slice(0, 16),
          hasReturnUrl: !!returnUrl,
        },
        timestamp: Date.now(),
      }),
      keepalive: true,
    }).catch(() => {})
  } catch {}
  // #endregion
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
