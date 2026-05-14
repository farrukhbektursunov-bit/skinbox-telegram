import CryptoJS from 'npm:crypto-js@4.2.0'

export function md5PrepareSign(parts: {
  click_trans_id: string
  service_id: string
  secretKey: string
  merchant_trans_id: string
  amount: string
  action: string
  sign_time: string
}): string {
  const raw =
    parts.click_trans_id +
    parts.service_id +
    parts.secretKey +
    parts.merchant_trans_id +
    parts.amount +
    parts.action +
    parts.sign_time
  return String(CryptoJS.MD5(raw))
}

export function md5CompleteSign(parts: {
  click_trans_id: string
  service_id: string
  secretKey: string
  merchant_trans_id: string
  merchant_prepare_id: string
  amount: string
  action: string
  sign_time: string
}): string {
  const raw =
    parts.click_trans_id +
    parts.service_id +
    parts.secretKey +
    parts.merchant_trans_id +
    parts.merchant_prepare_id +
    parts.amount +
    parts.action +
    parts.sign_time
  return String(CryptoJS.MD5(raw))
}

export async function parseClickPost(req: Request): Promise<Record<string, string>> {
  const raw = await req.text()
  const ct = (req.headers.get('content-type') || '').toLowerCase()
  if (ct.includes('application/json')) {
    try {
      const j = JSON.parse(raw || '{}') as Record<string, unknown>
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(j)) {
        if (v == null) continue
        out[k] = typeof v === 'string' ? v : String(v)
      }
      return out
    } catch {
      return {}
    }
  }
  const sp = new URLSearchParams(raw)
  const out: Record<string, string> = {}
  sp.forEach((v, k) => {
    out[k] = v
  })
  return out
}

export function jsonResponse(
  body: Record<string, string | number | null>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  })
}
