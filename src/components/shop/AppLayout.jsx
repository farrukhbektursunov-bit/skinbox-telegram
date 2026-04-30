import { Outlet, NavLink } from 'react-router-dom'
import { ShoppingBag, Grid2x2, ShoppingCart, Heart, User } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cartItemsQueryKey, fetchCartItems } from '@/lib/cartItemsQuery'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'

export default function AppLayout() {
  const { user } = useAuth()
  const { t } = useLang()

  const navItems = [
    { to: '/shop',       icon: ShoppingBag,  label: t('shop')      },
    { to: '/categories', icon: Grid2x2,      label: t('categories') },
    { to: '/cart',       icon: ShoppingCart, label: t('cart')      },
    { to: '/favorites',  icon: Heart,        label: t('favorites') },
    { to: '/profile',    icon: User,         label: t('profile')   },
  ]

  const { data: cartItems = [] } = useQuery({
    queryKey: cartItemsQueryKey(user?.id),
    queryFn: () => fetchCartItems(user.id),
    enabled: !!user?.id,
    staleTime: 0,
  })

  const cartCount = cartItems.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0)

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
      <main className="flex-1 min-h-0 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card/90 backdrop-blur-xl border-t border-border/50 z-50">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              end={to !== '/categories'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all ${isActive ? 'text-primary' : 'text-muted-foreground'}`
              }
            >
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={2} />
                {to === '/cart' && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
