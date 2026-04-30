import { useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { supabase } from '@/api/supabase'
import { ShoppingBag, Eye, EyeOff, Mail, User, ArrowLeft, CheckCircle, Shield, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  validatePasswordStrength,
  validateEmail,
  sanitizeName,
  filterNameInput,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PW_MSG_KEYS,
} from '@/lib/authUtils'

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

// ── Kirish usulini tanlash ─────────────────────────────────────────
function MethodSelect({ onSelect, onGoogle, googleLoading }) {
  const { t } = useLang()
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={googleLoading}
        onClick={onGoogle}
        className="w-full flex items-center gap-4 p-4 bg-muted/50 border border-border rounded-2xl hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.98] disabled:opacity-60"
      >
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-border/60 shadow-sm">
          <GoogleIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-foreground">{t('googleMethod')}</p>
          <p className="text-xs text-muted-foreground">{t('googleMethodDesc')}</p>
        </div>
      </button>

      <button
        onClick={() => onSelect('email')}
        className="w-full flex items-center gap-4 p-4 bg-muted/50 border border-border rounded-2xl hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.98]"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <Mail className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-foreground">{t('emailMethod')}</p>
          <p className="text-xs text-muted-foreground">{t('emailMethodDesc')}</p>
        </div>
      </button>
    </div>
  )
}

// Parol kuchliligi ko'rsatkichi
function PasswordStrengthBar({ password }) {
  const { t } = useLang()
  const { score, valid } = validatePasswordStrength(password)
  if (!password) return null
  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= score
                ? valid
                  ? 'bg-green-500'
                  : i <= 2
                  ? 'bg-red-400'
                  : 'bg-amber-400'
                : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        {valid ? (
          <>
            <ShieldCheck className="w-3 h-3 text-green-600" /> {t('passwordStrong')}
          </>
        ) : (
          <>
            <Shield className="w-3 h-3" /> {t('passwordRequirements')}
          </>
        )}
      </p>
    </div>
  )
}

// ── Email forma ────────────────────────────────────────────────────
function EmailForm({ isSignUp, onBack }) {
  const { signIn, signUp } = useAuth()
  const { t } = useLang()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [fullName, setFullName]   = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [showResendBanner, setShowResendBanner] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (loading) return
    const cleanEmail = email?.trim().toLowerCase()
    const cleanName = sanitizeName(fullName)
    if (!validateEmail(cleanEmail)) {
      toast.error(t('invalidEmail'))
      return
    }
    if (isSignUp) {
      const pwCheck = validatePasswordStrength(password)
      if (!pwCheck.valid) {
        const msgKey = pwCheck.messages?.[0]
        const text = msgKey === PW_MSG_KEYS.MIN_CHARS
          ? t('pwMinChars').replace('{n}', PASSWORD_MIN_LENGTH)
          : (msgKey ? t(msgKey) : t('passwordInvalid'))
        toast.error(text)
        return
      }
      if (password.length > PASSWORD_MAX_LENGTH) {
        toast.error(t('passwordTooLong'))
        return
      }
      if (!cleanName && isSignUp) {
        toast.error(t('nameRequired'))
        return
      }
    }
    setLoading(true)
    try {
      if (isSignUp) {
        const { data, error } = await signUp(cleanEmail, password, {
          metadata: { full_name: cleanName },
        })
        if (error) throw error
        if (data?.user) {
          await supabase.from('profiles').upsert({
            id:        data.user.id,
            full_name: cleanName,
            updated_at: new Date().toISOString(),
          })
        }
        setEmailSent(true)
      } else {
        const { error } = await signIn(cleanEmail, password)
        if (error) {
          if (error.message.includes('Ko\'p urinishlar')) throw new Error(error.message)
          if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
            setShowResendBanner(true)
            throw new Error(t('emailNotConfirmed'))
          }
          throw new Error(t('wrongCredentials'))
        }
        setShowResendBanner(false)
        toast.success(t('welcomeBack'))
      }
    } catch (err) {
      toast.error(err.message || t('error'))
    } finally {
      setLoading(false)
    }
  }, [email, password, fullName, isSignUp, loading, signIn, signUp, t])

  // Email tasdiqlash ekrani
  if (emailSent) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-base font-extrabold text-foreground mb-2">{t('confirmEmail')}</h3>
        <p className="text-sm text-muted-foreground mb-1">
          <span className="font-semibold text-foreground">{email}</span> {t('confirmEmailSent')}.
        </p>
        <p className="text-xs text-muted-foreground mb-6">{t('checkSpam')}</p>
        <button
          onClick={onBack}
          className="w-full py-3 bg-primary text-white rounded-xl text-sm font-semibold"
        >
          {t('goToLogin')}
        </button>
      </div>
    )
  }

  const handleResendConfirmation = useCallback(async () => {
    const cleanEmail = email?.trim().toLowerCase()
    if (!cleanEmail || !validateEmail(cleanEmail)) return
    setResendLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: { emailRedirectTo: `${window.location.origin}/shop` },
      })
      if (error) throw error
      toast.success(t('resendConfirmationSent'))
      setShowResendBanner(false)
    } catch (err) {
      toast.error(err.message || t('error'))
    } finally {
      setResendLoading(false)
    }
  }, [email, t])

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Email tasdiqlanmagan – qayta yuborish */}
      {showResendBanner && !isSignUp && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">{t('emailNotConfirmed')}</p>
          <button
            type="button"
            onClick={handleResendConfirmation}
            disabled={resendLoading}
            className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline disabled:opacity-60"
          >
            {resendLoading ? t('sending') : t('resendConfirmation')}
          </button>
        </div>
      )}
      {/* Ism (faqat ro'yxatdan o'tishda) */}
      {isSignUp && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> {t('fullName')}
          </label>
          <input
            required
            autoComplete="name"
            maxLength={64}
            value={fullName}
            onChange={e => setFullName(filterNameInput(e.target.value))}
            placeholder={t('namePlaceholder')}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>
      )}

      {/* Email */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" /> {t('email')}
        </label>
        <input
          type="email"
          required
          autoComplete={isSignUp ? 'email' : 'email'}
          maxLength={254}
          value={email}
          onChange={e => setEmail(e.target.value.slice(0, 254))}
          placeholder="email@example.com"
          className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
        />
      </div>

      {/* Parol */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
          {t('password')}
        </label>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            required
            minLength={isSignUp ? PASSWORD_MIN_LENGTH : 1}
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={e => setPassword(e.target.value.slice(0, PASSWORD_MAX_LENGTH))}
            placeholder="••••••••"
            className="w-full px-4 py-3 pr-11 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          />
          <button type="button" aria-label={showPass ? t('hidePassword') : t('showPassword')}
            onClick={() => setShowPass(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {isSignUp && <PasswordStrengthBar password={password} />}
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-3.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-60 active:scale-[0.98] transition-all"
      >
        {loading ? t('loading') : isSignUp ? t('signupBtn') : t('loginBtn')}
      </button>
    </form>
  )
}

// ── Asosiy Login sahifasi ──────────────────────────────────────────
export default function Login() {
  const { user } = useAuth()
  const { t } = useLang()
  const [method, setMethod]   = useState(null)   // null | 'email'
  const [isSignUp, setIsSignUp] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const signInWithGoogle = useCallback(async () => {
    setGoogleLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: 'select_account',
          },
        },
      })
      if (error) throw error
    } catch (err) {
      toast.error(err.message || t('googleSignInError'))
      setGoogleLoading(false)
    }
  }, [t])

  if (user) return <Navigate to="/shop" replace />

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">SkinBox</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('shopTagline')}</p>
        </div>

        <div className="bg-card rounded-3xl border border-border/60 p-6 shadow-sm">

          {/* Kirish / Ro'yxat tab */}
          <div className="flex bg-muted rounded-xl p-1 mb-5">
            <button
              onClick={() => { setIsSignUp(false); setMethod(null) }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                !isSignUp ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {t('loginTitle')}
            </button>
            <button
              onClick={() => { setIsSignUp(true); setMethod(null) }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                isSignUp ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {t('signupTitle')}
            </button>
          </div>

          {/* Usul tanlanmagan */}
          {!method && (
            <>
              <p className="text-sm font-semibold text-foreground mb-3">
                {isSignUp ? t('howSignUp') : t('howSignIn')}
              </p>
              <MethodSelect
                onSelect={setMethod}
                onGoogle={signInWithGoogle}
                googleLoading={googleLoading}
              />
            </>
          )}

          {/* Email forma */}
          {method === 'email' && (
            <>
              <button onClick={() => setMethod(null)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4 hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> {t('back')}
              </button>
              <EmailForm isSignUp={isSignUp} onBack={() => { setMethod(null); setIsSignUp(false) }} />
            </>
          )}

        </div>
      </div>
    </div>
  )
}
