import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/api/supabase'
import { getAuthRateLimitMessage } from './authUtils'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    // Joriy sessionni server bilan tekshirish (cookie/Session spoofing oldini olish)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = (email, password, options = {}) =>
    supabase.auth.signUp({
      email: email?.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/shop`,
        data: options.metadata,
        ...options,
      },
    })

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email?.trim().toLowerCase(),
      password,
    })
    if (error) {
      const rateLimitMessage = getAuthRateLimitMessage(error)
      if (rateLimitMessage) {
        return { data: null, error: { message: rateLimitMessage } }
      }
    }
    return { data, error }
  }

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
