import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { jsonResponse, md5CompleteSign, parseClickPost } from '../_shared/click.ts'

const REQUIRED = [
  'click_trans_id',
  'service_id',
  'merchant_trans_id',
  'merchant_prepare_id',
  'amount',
  'action',
  'error',
  'error_note',
  'sign_time',
  'sign_string',
] as const

const GIFT_PREFIX = 'gift:'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: -8, error_note: 'Method not allowed' }, 405)
  }

  const secretKey = Deno.env.get('CLICK_SECRET_KEY') || ''
  const serviceIdExpected = Deno.env.get('CLICK_SERVICE_ID') || ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!secretKey || !serviceIdExpected || !supabaseUrl || !serviceKey) {
    console.error('click-complete: missing env')
    return jsonResponse({ error: -9, error_note: 'Server configuration error' }, 500)
  }

  const body = await parseClickPost(req)
  for (const k of REQUIRED) {
    if (body[k] === undefined || body[k] === '') {
      return jsonResponse({ error: -8, error_note: 'Error in request from Click' })
    }
  }

  const click_trans_id = body.click_trans_id
  const service_id = body.service_id
  const merchant_trans_id = body.merchant_trans_id
  const merchant_prepare_id = body.merchant_prepare_id
  const amount = body.amount
  const action = body.action
  const sign_time = body.sign_time
  const sign_string = body.sign_string
  const clickPaymentError = Number(body.error)

  if (service_id !== String(serviceIdExpected)) {
    return jsonResponse({ error: -3, error_note: 'Invalid service' })
  }

  const expectedSign = md5CompleteSign({
    click_trans_id,
    service_id,
    secretKey,
    merchant_trans_id,
    merchant_prepare_id,
    amount,
    action,
    sign_time,
  })
  if (expectedSign !== sign_string) {
    return jsonResponse({ error: -1, error_note: 'SIGN CHECK FAILED!' })
  }

  if (Number(action) !== 1) {
    return jsonResponse({ error: -3, error_note: 'Invalid action' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: row, error: rowErr } = await supabase
    .from('click_payment_prepare')
    .select('id, order_id, gift_id, user_id, amount, completed_at, cancelled_at')
    .eq('id', Number(merchant_prepare_id))
    .maybeSingle()

  if (rowErr || !row) {
    return jsonResponse({ error: -6, error_note: 'Transaction does not exist' })
  }

  const rowMerchantTransId = row.gift_id ? `${GIFT_PREFIX}${row.gift_id}` : row.order_id
  if (rowMerchantTransId !== merchant_trans_id) {
    return jsonResponse({ error: -6, error_note: 'Transaction does not exist' })
  }

  if (row.completed_at) {
    return jsonResponse({ error: -4, error_note: 'Already paid' })
  }

  if (row.cancelled_at) {
    return jsonResponse({ error: -9, error_note: 'Transaction cancelled' })
  }

  const rowAmount = Number(row.amount)
  const payAmount = Number(amount)
  if (Math.abs(rowAmount - payAmount) > 0.01) {
    return jsonResponse({ error: -2, error_note: 'Incorrect parameter amount' })
  }

  if (clickPaymentError !== 0) {
    const { error: canErr } = await supabase
      .from('click_payment_prepare')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('id', row.id)

    if (canErr) {
      console.error('click-complete cancel prepare', canErr)
    }

    if (row.gift_id) {
      const { error: giftErr } = await supabase
        .from('gifts')
        .update({ status: 'cancelled' })
        .eq('id', row.gift_id)
        .eq('status', 'awaiting_payment')

      if (giftErr) {
        console.error('click-complete cancel gift', giftErr)
        return jsonResponse({ error: -7, error_note: 'Failed to cancel gift' })
      }
    } else {
      const { error: ordErr } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', row.order_id)
        .eq('status', 'awaiting_payment')

      if (ordErr) {
        console.error('click-complete cancel order', ordErr)
        return jsonResponse({ error: -7, error_note: 'Failed to cancel order' })
      }
    }

    return jsonResponse({
      error: -9,
      error_note: 'Transaction cancelled',
      click_trans_id,
      merchant_trans_id,
      merchant_confirm_id: row.id,
    })
  }

  const now = new Date().toISOString()
  const { error: prepUpd } = await supabase
    .from('click_payment_prepare')
    .update({ completed_at: now })
    .eq('id', row.id)

  if (prepUpd) {
    console.error('click-complete prepare update', prepUpd)
    return jsonResponse({ error: -7, error_note: 'Failed to update payment' })
  }

  if (row.gift_id) {
    const { error: giftUpd } = await supabase
      .from('gifts')
      .update({ status: 'pending' })
      .eq('id', row.gift_id)
      .eq('status', 'awaiting_payment')

    if (giftUpd) {
      console.error('click-complete gift update', giftUpd)
      return jsonResponse({ error: -7, error_note: 'Failed to update gift' })
    }
  } else {
    const { error: ordUpd } = await supabase
      .from('orders')
      .update({ status: 'pending' })
      .eq('id', row.order_id)
      .eq('status', 'awaiting_payment')

    if (ordUpd) {
      console.error('click-complete order update', ordUpd)
      return jsonResponse({ error: -7, error_note: 'Failed to update user' })
    }
  }

  return jsonResponse({
    error: 0,
    error_note: 'Success',
    click_trans_id,
    merchant_trans_id,
    merchant_confirm_id: row.id,
  })
})
