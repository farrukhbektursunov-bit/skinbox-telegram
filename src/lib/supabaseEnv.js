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

/** @supabase/supabase-js odatda "anon public" JWT (eyJ...) bilan ishlaydi */
export function isLikelySupabaseJwtAnonKey(key) {
  const k = String(key || '').trim()
  return k.startsWith('eyJ') && k.length > 80
}
