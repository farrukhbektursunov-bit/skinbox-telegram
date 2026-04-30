import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/api/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import toast from 'react-hot-toast'

function oauthErrorFromUrl() {
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const err =
    search.get('error_description') ||
    search.get('error') ||
    hash.get('error_description') ||
    hash.get('error')
  return err
}

export default function AuthCallback() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const { t } = useLang()
  const finishedRef = useRef(false)

  useEffect(() => {
    if (loading) return

    const errMsg = oauthErrorFromUrl()
    if (errMsg) {
      toast.error(decodeURIComponent(errMsg.replace(/\+/g, ' ')))
      navigate('/login', { replace: true })
      return
    }

    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    if (finishedRef.current) return
    finishedRef.current = true

    ;(async () => {
      try {
        const meta = user.user_metadata || {}
        const fullName = (
          meta.full_name ||
          meta.name ||
          [meta.given_name, meta.family_name].filter(Boolean).join(' ')
        ).trim()

        if (fullName) {
          await supabase.from('profiles').upsert({
            id: user.id,
            full_name: fullName,
            updated_at: new Date().toISOString(),
          })
        }

        localStorage.setItem('onboardingCompleted', 'true')
        toast.success(t('welcomeBack'))
        navigate('/shop', { replace: true })
      } catch {
        toast.error(t('error'))
        navigate('/login', { replace: true })
      }
    })()
  }, [loading, user, navigate, t])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  )
}
