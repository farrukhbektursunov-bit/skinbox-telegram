import { motion } from 'framer-motion'
import {
  User, Package, Heart, Settings, LogOut, ChevronRight, ChevronLeft,
  Bell, HelpCircle, MapPin, CreditCard, Edit2, Phone, Calendar
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/api/supabase'
import toast from 'react-hot-toast'

export default function Profile() {
  const { user, signOut } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, phone, birth_date, gender')
        .eq('id', user.id)
        .maybeSingle()
      return data
    },
    enabled: !!user,
  })

  const handleLogout = async () => {
    await signOut()
    toast.success(t('loggedOut'))
    navigate('/login')
  }

  const menuGroups = [
    {
      title: t('myOrders'),
      items: [
        { label: t('myOrders'),  icon: Package,    path: '/orders',    color: 'bg-blue-50 text-blue-600'    },
        { label: t('favorites'), icon: Heart,      path: '/profile/favorites', color: 'bg-red-50 text-red-500'      },
      ],
    },
    {
      title: t('paymentMethods'),
      items: [
        { label: t('myAddresses'),     icon: MapPin,     path: '/addresses',       color: 'bg-green-50 text-green-600'   },
        { label: t('paymentMethods'),  icon: CreditCard, path: '/payment-methods', color: 'bg-purple-50 text-purple-600' },
      ],
    },
    {
      title: t('settings'),
      items: [
        { label: t('notifications'), icon: Bell,       path: '/notifications', color: 'bg-orange-50 text-orange-500' },
        { label: t('help'),          icon: HelpCircle, path: '/help',          color: 'bg-cyan-50 text-cyan-600'     },
        { label: t('settings'),      icon: Settings,   path: '/settings',      color: 'bg-slate-100 text-slate-600'  },
      ],
    },
  ]

  const birthFormatted = profile?.birth_date
    ? new Date(profile.birth_date).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <div>
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/shop')}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xl font-extrabold tracking-tight text-foreground flex-1">{t('profileTitle')}</span>
      </div>

      {/* Foydalanuvchi kartasi */}
      <div className="px-5 pt-5 pb-4">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border/60 p-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0 border-2 border-primary/20">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                : <User className="w-7 h-7 text-primary" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-foreground truncate">
                {profile?.full_name || t('profileTitle')}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                {profile?.phone && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" /> {profile.phone}
                  </span>
                )}
                {birthFormatted && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" /> {birthFormatted}
                  </span>
                )}
              </div>
            </div>
            <Link to="/edit-profile"
              className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Edit2 className="w-4 h-4 text-primary" />
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Menu */}
      <div className="px-5 space-y-4 pb-6">
        {menuGroups.map((group, gi) => (
          <div key={gi}>
            <div className="bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
              {group.items.map((item, i) => {
                const Icon = item.icon
                return (
                  <motion.div key={item.label}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (gi * 3 + i) * 0.04 }}
                  >
                    <Link to={item.path}
                      className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors active:scale-[0.98]"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.color}`}>
                        <Icon className="w-4 h-4" strokeWidth={2} />
                      </div>
                      <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </div>
        ))}

        <button onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3.5 w-full bg-card rounded-2xl border border-border/60 hover:border-destructive/30 transition-all active:scale-[0.98]"
        >
          <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
            <LogOut className="w-4 h-4 text-destructive" />
          </div>
          <span className="flex-1 text-left text-sm font-medium text-destructive">{t('logout')}</span>
        </button>

        <p className="text-center text-xs text-muted-foreground pt-1">SkinBox v1.0.0</p>
      </div>
    </div>
  )
}
