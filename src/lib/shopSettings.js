import { useEffect, useState } from 'react'
import { supabase } from '@/api/supabase'

export const DEFAULT_SHOP_NAME = 'SkinBox'
const STORAGE_KEY = 'shopSettings.v1'

let cached = null
let inflight = null
const listeners = new Set()

function readCached() {
  if (cached) return cached
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        cached = {
          shop_name: typeof parsed.shop_name === 'string' && parsed.shop_name
            ? parsed.shop_name
            : DEFAULT_SHOP_NAME,
          shop_phone: typeof parsed.shop_phone === 'string' ? parsed.shop_phone : '',
        }
        return cached
      }
    }
  } catch {
    /* ignore */
  }
  cached = { shop_name: DEFAULT_SHOP_NAME, shop_phone: '' }
  return cached
}

function settingToString(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  return ''
}

async function fetchSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key,value')
    .in('key', ['shop_name', 'shop_phone'])
  if (error) throw error
  const rows = data || []
  const by = (k) => rows.find((r) => r.key === k)?.value
  return {
    shop_name: settingToString(by('shop_name')) || DEFAULT_SHOP_NAME,
    shop_phone: settingToString(by('shop_phone')),
  }
}

function setCache(next) {
  cached = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  listeners.forEach((cb) => {
    try {
      cb(next)
    } catch {
      /* ignore */
    }
  })
}

export function getShopSettingsSync() {
  return readCached()
}

export async function refreshShopSettings() {
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const next = await fetchSettings()
      setCache(next)
      return next
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export function useShopSettings() {
  const [state, setState] = useState(() => readCached())

  useEffect(() => {
    let cancelled = false
    const cb = (next) => {
      if (!cancelled) setState(next)
    }
    listeners.add(cb)
    refreshShopSettings().catch(() => {
      /* offline / RLS — kesh qiymati ishlatiladi */
    })
    return () => {
      cancelled = true
      listeners.delete(cb)
    }
  }, [])

  return state
}
