import { createContext, useContext, useState, useEffect } from 'react'
import { translations } from './i18n'

const LangContext = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() =>
    localStorage.getItem('lang') || 'uz'
  )

  useEffect(() => {
    document.documentElement.lang = lang === 'uz' ? 'uz' : lang === 'ru' ? 'ru' : 'en'
  }, [lang])

  const changeLang = (l) => {
    setLang(l)
    localStorage.setItem('lang', l)
  }

  const t = (key) => translations[lang]?.[key] ?? translations['uz']?.[key] ?? key

  return (
    <LangContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside LangProvider')
  return ctx
}
