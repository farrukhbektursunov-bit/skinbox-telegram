import { useNavigate } from 'react-router-dom'
import { Sun, Moon, Monitor, ShoppingBag } from 'lucide-react'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import { LANGUAGES } from '@/lib/i18n'

const THEME_OPTIONS = [
  { id: 'light',  labelKey: 'themeLight',  icon: Sun     },
  { id: 'dark',   labelKey: 'themeDark',   icon: Moon    },
  { id: 'system', labelKey: 'themeSystem', icon: Monitor },
]

export default function Welcome() {
  const navigate = useNavigate()
  const { lang, changeLang, t } = useLang()
  const { theme, setTheme } = useTheme()

  const handleContinue = () => {
    localStorage.setItem('onboardingCompleted', 'true')
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm flex flex-col items-center">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/25">
            <ShoppingBag className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">{t('welcomeTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-2 text-center">{t('welcomeSubtitle')}</p>
        </div>

        <div className="w-full space-y-6">
          {/* Til */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {t('selectLanguage')}
            </p>
            <div className="bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
              {LANGUAGES.map(l => (
                <button
                  key={l.id}
                  onClick={() => changeLang(l.id)}
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

          {/* Kun-tun rejimi */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {t('selectTheme')}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map(({ id, labelKey, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTheme(id)}
                  className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all ${
                    theme === id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/30'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-semibold">{t(labelKey)}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2 px-1">{t('themeSystemDesc')}</p>
          </div>

          <button
            onClick={handleContinue}
            className="w-full py-3.5 bg-primary text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
          >
            {t('getStarted')}
          </button>
        </div>
      </div>
    </div>
  )
}
