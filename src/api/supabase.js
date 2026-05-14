import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnvIssue, isLikelySupabaseJwtAnonKey } from '@/lib/supabaseEnv'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (import.meta.env.DEV) {
  const issue = getSupabaseEnvIssue()
  if (issue) {
    console.warn(
      '[SkinBox] Supabase .env: VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY to‘liq va to‘g‘ri bo‘lishi kerak (https://xxxx.supabase.co).'
    )
  } else if (supabaseAnonKey && !isLikelySupabaseJwtAnonKey(supabaseAnonKey)) {
    console.warn(
      '[SkinBox] VITE_SUPABASE_ANON_KEY odatda JWT bo‘lib eyJ bilan boshlanadi. Supabase → Project Settings → API → anon public kalitni nusxalang. Boshqa formatda bo‘lsa, kirish/ro‘yxat ishlamasligi mumkin.'
    )
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
