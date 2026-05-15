/**
 * Supabase Vite env tekshiruvi (UI va dev ogohlantirishlari uchun)
 */
export function getSupabaseEnvIssue() {
  const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
  const key = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

  if (!url || !key) return 'invalid'

  if (url.includes('your-project.supabase.co') || key === 'your-public-anon-key') {
    return 'invalid'
  }

  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' || !/\.supabase\.co$/i.test(u.hostname)) return 'invalid'
  } catch {
    return 'invalid'
  }

  if (key.length < 20) return 'invalid'

  return null
}

/**
 * Supabase API kalit formatlari:
 *   - Eski (JWT): "eyJ..." bilan boshlanadi
 *   - Yangi (2024+): "sb_publishable_..." (anon) yoki "sb_secret_..." (service role)
 * Ikkalasi ham qabul qilinadi.
 */
export function isLikelySupabaseJwtAnonKey(key) {
  const k = String(key || '').trim()
  if (k.startsWith('eyJ') && k.length > 80) return true
  if (k.startsWith('sb_publishable_') && k.length > 25) return true
  return false
}
