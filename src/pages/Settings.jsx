import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Moon, Sun, Monitor, Globe, Lock, Trash2, Shield, ChevronLeft } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import { LANGUAGES } from '@/lib/i18n'
import { supabase } from '@/api/supabase'
import toast from 'react-hot-toast'
import { validatePasswordStrength, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, PW_MSG_KEYS } from '@/lib/authUtils'

export default function Settings() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { lang, changeLang, t } = useLang()
  const { theme, setTheme } = useTheme()
  const [showPassModal, setShowPassModal] = useState(false)

  const THEME_OPTIONS = [
    { id: 'light',  labelKey: 'themeLight',  icon: Sun     },
    { id: 'dark',   labelKey: 'themeDark',   icon: Moon    },
    { id: 'system', labelKey: 'themeSystem', icon: Monitor },
  ]

  const handleChangePassword = () => {
    setShowPassModal(true)
  }

  const handleDeleteAccount = () => {
    toast.error(t('deleteContactToast'))
  }

  return (
    <div>
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-lg font-extrabold flex-1">{t('settingsTitle')}</span>
      </div>

      <div className="px-5 pt-5 pb-6 space-y-5">

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            {t('appearance')}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map(({ id, labelKey, icon: Icon }) => (
              <button key={id} onClick={() => setTheme(id)}
                className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${
                  theme === id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold">{t(labelKey)}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2 px-1">
            {t('themeSystemDesc')}
          </p>
        </div>

        {/* Til */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            {t('language')}
          </p>
          <div className="bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
            {LANGUAGES.map(l => (
              <button key={l.id} onClick={() => changeLang(l.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors"
              >
                <span className="text-xl">{l.flag}</span>
                <span className="flex-1 text-sm font-medium text-foreground text-left">{l.label}</span>
                {lang === l.id && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Xavfsizlik */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            {t('security')}
          </p>
          <div className="bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
            <button onClick={handleChangePassword}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Lock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">{t('changePassword')}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </button>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                <Shield className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{t('twoFactor')}</p>
                <p className="text-xs text-muted-foreground">{t('comingSoon')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* O'chirish */}
        <button onClick={handleDeleteAccount}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl border border-destructive/30 hover:bg-destructive/5 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-destructive" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-destructive">{t('deleteAccount')}</p>
            <p className="text-xs text-muted-foreground">{t('deleteAccountDesc')}</p>
          </div>
        </button>

        <p className="text-center text-xs text-muted-foreground">SkinBox v1.0.0</p>
      </div>

      {/* Parol o'zgartirish modali */}
      {showPassModal && <ChangePasswordModal onClose={() => setShowPassModal(false)} t={t} />}
    </div>
  )
}

// ── Parol o'zgartirish modali ─────────────────────────────────────
function ChangePasswordModal({ onClose, t }) {
  const [step, setStep]         = useState('choice') // choice | email | newpass
  const [newPass, setNewPass]   = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [showNew, setShowNew]   = useState(false)
  const [showConf, setShowConf] = useState(false)

  const handleSendEmail = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: window.location.origin + '/reset-password',
      })
      if (error) throw error
      toast.success(t('passwordResetSent'))
      onClose()
    } catch { toast.error(t('error')) }
    finally { setLoading(false) }
  }

  const handleChangePass = async (e) => {
    e.preventDefault()
    const pwCheck = validatePasswordStrength(newPass)
    if (!pwCheck.valid) {
      const msgKey = pwCheck.messages?.[0]
      const text = msgKey === PW_MSG_KEYS.MIN_CHARS
        ? t('pwMinChars').replace('{n}', PASSWORD_MIN_LENGTH)
        : (msgKey ? t(msgKey) : t('passwordTooShort'))
      toast.error(text)
      return
    }
    if (newPass !== confirm) { toast.error(t('passwordsDontMatch')); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass })
      if (error) throw error
      toast.success(t('passwordChanged'))
      onClose()
    } catch { toast.error(t('error')) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card rounded-t-3xl flex flex-col" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <h2 className="text-lg font-extrabold text-foreground">{t('changePasswordTitle')}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <span className="text-lg leading-none">×</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-4">
          {/* Yangi parol kiritish (agar session active bo'lsa) */}
          <form onSubmit={handleChangePass} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                {t('newPassword')}
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value.slice(0, PASSWORD_MAX_LENGTH))}
                  placeholder={t('minPassword')}
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                  {showNew ? t('hidePassword') : t('showPassword')}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                {t('confirmPassword')}
              </label>
              <div className="relative">
                <input
                  type={showConf ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value.slice(0, PASSWORD_MAX_LENGTH))}
                  placeholder={t('confirmPasswordPh')}
                  required
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
                />
                <button type="button" onClick={() => setShowConf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                  {showConf ? t('hidePassword') : t('showPassword')}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-60">
              {loading ? t('saving') : t('savePassword')}
            </button>
          </form>

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{t('orLabel')}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email orqali reset */}
          <button onClick={handleSendEmail} disabled={loading}
            className="w-full py-3 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted/30 transition-colors">
            {t('resetViaEmail')}
          </button>
          <p className="text-xs text-muted-foreground text-center">
            {t('resetEmailDesc')}
          </p>
        </div>
      </div>
    </div>
  )
}
