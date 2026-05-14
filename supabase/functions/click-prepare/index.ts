import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { jsonResponse, md5PrepareSign, parseClickPost } from '../_shared/click.ts'

const REQUIRED = [
  'click_trans_id',
  'service_id',
  'click_paydoc_id',
  'merchant_trans_id',
  'amount',
  'action',
  'error',
  'error_note',
  'sign_time',
  'sign_string',
] as const

const GIFT_PREFIX = 'gift:'

function parseGiftMerchantTransId(value: string): string | null {
  return value.startsWith(GIFT_PREFIX) ? value.slice(GIFT_PREFIX.length) : null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: -8, error_note: 'Method not allowed' }, 405)
  }

  const secretKey = Deno.env.get('CLICK_SECRET_KEY') || ''
  const serviceIdExpected = Deno.env.get('CLICK_SERVICE_ID') || ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!secretKey || !serviceIdExpected || !supabaseUrl || !serviceKey) {
    console.error('click-prepare: missing env (CLICK_SECRET_KEY, CLICK_SERVICE_ID, SUPABASE_*)')
    return jsonResponse({ error: -9, error_note: 'Server configuration error' }, 500)
  }

  const body = await parseClickPost(req)
  for (const k of REQUIRED) {
    if (body[k] === undefined || body[k] === '') {
      return jsonResponse({ error: -8, error_note: 'Missing required parameters in the request' })
    }
  }

  const click_trans_id = body.click_trans_id
  const service_id = body.service_id
  const merchant_trans_id = body.merchant_trans_id
  const amount = body.amount
  const action = body.action
  const sign_time = body.sign_time
  const sign_string = body.sign_string

  if (service_id !== String(serviceIdExpected)) {
    return jsonResponse({ error: -3, error_note: 'Invalid service' })
  }

  const expectedSign = md5PrepareSign({
    click_trans_id,
    service_id,
    secretKey,
    merchant_trans_id,
    amount,
    action,
    sign_time,
  })
  if (expectedSign !== sign_string) {
    return jsonResponse({ error: -1, error_note: 'SIGN CHECK FAILED!' })
  }

  if (Number(action) !== 0) {
    return jsonResponse({ error: -3, error_note: 'Invalid action' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: existing } = await supabase
    .from('click_payment_prepare')
    .select('id, order_id, gift_id, amount')
    .eq('click_trans_id', Number(click_trans_id))
    .maybeSingle()

  if (existing) {
    const existingMerchantTransId = existing.gift_id ? `${GIFT_PREFIX}${existing.gift_id}` : existing.order_id
    if (existingMerchantTransId !== merchant_trans_id) {
      return jsonResponse({ error: -6, error_note: 'Transaction does not exist' })
    }
    if (Math.abs(Number(existing.amount) - Number(amount)) > 0.01) {
      return jsonResponse({ error: -2, error_note: 'Incorrect parameter amount' })
    }
    return jsonResponse({
      error: 0,
      error_note: 'Success',
      click_trans_id,
      merchant_trans_id,
      merchant_prepare_id: existing.id,
    })
  }

  const giftId = parseGiftMerchantTransId(merchant_trans_id)
  if (giftId) {
    const { data: gift, error: giftErr } = await supabase
      .from('gifts')
      .select('id, sender_id, price, quantity, status')
      .eq('id', giftId)
      .maybeSingle()

    if (giftErr || !gift) {
      return jsonResponse({ error: -5, error_note: 'User does not exist' })
    }

    if (gift.status !== 'awaiting_payment') {
      if (gift.status === 'pending' || gift.status === 'claimed' || gift.status === 'delivered') {
        return jsonResponse({ error: -4, error_note: 'Already paid' })
      }
      return jsonResponse({ error: -5, error_note: 'Gift not available for payment' })
    }

    const giftTotal = Number(gift.price) * Number(gift.quantity)
    const payAmount = Number(amount)
    if (!Number.isFinite(giftTotal) || !Number.isFinite(payAmount) || Math.abs(giftTotal - payAmount) > 0.01) {
      return jsonResponse({ error: -2, error_note: 'Incorrect parameter amount' })
    }

    const { data: inserted, error: insErr } = await supabase
      .from('click_payment_prepare')
      .insert({
        gift_id: gift.id,
        user_id: gift.sender_id,
        click_trans_id: Number(click_trans_id),
        click_paydoc_id: Number(body.click_paydoc_id),
        amount: payAmount,
      })
      .select('id')
      .single()

    if (insErr || !inserted?.id) {
      console.error('click-prepare gift insert', insErr)
      return jsonResponse({ error: -9, error_note: 'Failed to save payment' })
    }

    return jsonResponse({
      error: 0,
      error_note: 'Success',
      click_trans_id,
      merchant_trans_id,
      merchant_prepare_id: inserted.id,
    })
  }

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, user_id, total, status')
    .eq('id', merchant_trans_id)
    .maybeSingle()

  if (orderErr || !order) {
    return jsonResponse({ error: -5, error_note: 'User does not exist' })
  }

  if (order.status !== 'awaiting_payment') {
    if (order.status === 'pending' || order.status === 'confirmed') {
      return jsonResponse({ error: -4, error_note: 'Already paid' })
    }
    return jsonResponse({ error: -5, error_note: 'Order not available for payment' })
  }

  const orderTotal = Number(order.total)
  const payAmount = Number(amount)
  if (!Number.isFinite(orderTotal) || !Number.isFinite(payAmount) || Math.abs(orderTotal - payAmount) > 0.01) {
    return jsonResponse({ error: -2, error_note: 'Incorrect parameter amount' })
  }

  const { data: inserted, error: insErr } = await supabase
    .from('click_payment_prepare')
    .insert({
      order_id: order.id,
      user_id: order.user_id,
      click_trans_id: Number(click_trans_id),
      click_paydoc_id: Number(body.click_paydoc_id),
      amount: payAmount,
    })
    .select('id')
    .single()

  if (insErr || !inserted?.id) {
    console.error('click-prepare insert', insErr)
    return jsonResponse({ error: -9, error_note: 'Failed to save payment' })
  }

  return jsonResponse({
    error: 0,
    error_note: 'Success',
    click_trans_id,
    merchant_trans_id,
    merchant_prepare_id: inserted.id,
  })
})
