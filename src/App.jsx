import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { LangProvider } from '@/lib/LangContext'
import { ThemeProvider } from '@/lib/ThemeContext'
import { queryClient } from '@/lib/queryClient'
import AppLayout from '@/components/shop/AppLayout'
import Shop from '@/pages/Shop'
import Categories from '@/pages/Categories'
import CategoryProducts from '@/pages/CategoryProducts'
import Cart from '@/pages/Cart'
import Favorites from '@/pages/Favorites'
import Profile from '@/pages/Profile'
import EditProfile from '@/pages/EditProfile'
import SearchPage from '@/pages/SearchPage'
import Orders from '@/pages/Orders'
import Addresses from '@/pages/Addresses'
import PaymentMethods from '@/pages/PaymentMethods'
import Notifications from '@/pages/Notifications'
import Help from '@/pages/Help'
import Settings from '@/pages/Settings'
import ProductDetail from '@/pages/ProductDetail'
import GiftSent from '@/pages/Gift'
import ClaimGift from '@/pages/ClaimGift'
import Login from '@/pages/Login'
import Welcome from '@/pages/Welcome'
import AuthCallback from '@/pages/AuthCallback'

function ProtectedRoutes() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/"                  element={<Navigate to="/shop" replace />} />
        <Route path="/shop"              element={<Shop />} />
        <Route path="/categories"        element={<Categories />} />
        <Route path="/categories/:categoryId" element={<CategoryProducts />} />
        <Route path="/cart"              element={<Cart />} />
        <Route path="/favorites"         element={<Favorites />} />
        <Route path="/profile/favorites" element={<Favorites fromProfile />} />
        <Route path="/orders"            element={<Orders />} />
        <Route path="/profile"           element={<Profile />} />
        <Route path="/edit-profile"      element={<EditProfile />} />
        <Route path="/addresses"         element={<Addresses />} />
        <Route path="/payment-methods"   element={<PaymentMethods />} />
        <Route path="/notifications"     element={<Notifications />} />
        <Route path="/help"              element={<Help />} />
        <Route path="/settings"          element={<Settings />} />
        <Route path="/product/:id"       element={<ProductDetail />} />
        <Route path="/gifts-sent"        element={<GiftSent />} />
        <Route path="/search"            element={<SearchPage />} />
      </Route>
    </Routes>
  )
}

function OnboardingGate({ children }) {
  const location = useLocation()
  const completed = localStorage.getItem('onboardingCompleted') === 'true'
  const isClaimGift = location.pathname.startsWith('/claim-gift/')
  const isWelcome = location.pathname === '/welcome'
  const isAuthCallback = location.pathname === '/auth/callback'

  if (!isClaimGift && !isWelcome && !isAuthCallback && !completed) {
    return <Navigate to="/welcome" replace />
  }
  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <OnboardingGate>
                <Routes>
                  <Route path="/claim-gift/:token" element={<ClaimGift />} />
                  <Route path="/welcome"             element={<Welcome />} />
                  <Route path="/login"               element={<Login />} />
                  <Route path="/auth/callback"       element={<AuthCallback />} />
                  <Route path="/*"                   element={<ProtectedRoutes />} />
                </Routes>
              </OnboardingGate>
            </BrowserRouter>
            <Toaster position="top-center"
              toastOptions={{ style: { borderRadius: '12px', fontSize: '14px' } }} />
          </QueryClientProvider>
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  )
}
