import { useState, useEffect } from 'react'
import { ChevronLeft, Bell, Package, Tag, Star, Megaphone, Mail } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useLang } from '@/lib/LangContext'
import { supabase } from '@/api/supabase'

const NOTIF_SETTINGS = [
  { id: 'orders',     icon: Package,    labelKey: 'notifOrderStatus',      descKey: 'notifOrderStatusDesc',  defaultOn: true  },
  { id: 'promotions', icon: Tag,        labelKey: 'notifPromotions',       descKey: 'notifPromotionsDesc',   defaultOn: true  },
  { id: 'reviews',    icon: Star,       labelKey: 'notifReviewReminder',   descKey: 'notifReviewReminderDesc', defaultOn: false },
  { id: 'news',       icon: Megaphone,  labelKey: 'notifNews',             descKey: 'notifNewsDesc',          defaultOn: false },
]

export default function Notifications() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [settings, setSettings] = useState(
    Object.fromEntries(NOTIF_SETTINGS.map(n => [n.id, n.defaultOn]))
  )
  const [broadcasts, setBroadcasts] = useState([])
  const [broadcastsLoading, setBroadcastsLoading] = useState(true)

  const toggle = (id) => setSettings(p => ({ ...p, [id]: !p[id] }))

  useEffect(() => {
    if (!supabase) return
    const fetchBroadcasts = async () => {
      const { data, error } = await supabase
        .from('admin_broadcasts')
        .select('id, title, body, type, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      if (!error) setBroadcasts(data || [])
      setBroadcastsLoading(false)
    }
    fetchBroadcasts()
  }, [])

  const formatDate = (raw) => {
    if (!raw) return ''
    const d = new Date(raw)
    return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div>
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-lg font-extrabold flex-1">{t('notifications')}</span>
      </div>

      <div className="px-5 pt-5 pb-6">
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-5 flex gap-3">
          <Bell className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('notifDesc')}
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
          {NOTIF_SETTINGS.map((n, i) => {
            const Icon = n.icon
            const on = settings[n.id]
            return (
              <motion.div key={n.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 px-4 py-4"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${on ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t(n.labelKey)}</p>
                  <p className="text-xs text-muted-foreground truncate">{t(n.descKey)}</p>
                </div>
                <button onClick={() => toggle(n.id)}
                  className={`w-11 h-6 rounded-full transition-all flex-shrink-0 relative ${on ? 'bg-primary' : 'bg-muted'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${on ? 'left-5' : 'left-0.5'}`} />
                </button>
              </motion.div>
            )
          })}
        </div>

        {broadcasts.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              {t('notifAdminBroadcasts')}
            </h3>
            <div className="space-y-3">
              {broadcasts.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card rounded-2xl border border-border/60 p-4"
                >
                  <p className="text-sm font-semibold text-foreground">{b.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{b.body}</p>
                  <p className="text-xs text-muted-foreground/70 mt-2">{formatDate(b.created_at)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {!broadcastsLoading && broadcasts.length === 0 && (
          <p className="text-xs text-muted-foreground mt-4 text-center">{t('notifNoBroadcasts')}</p>
        )}
      </div>
    </div>
  )
}
