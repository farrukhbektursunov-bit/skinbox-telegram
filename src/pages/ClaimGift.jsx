import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/api/supabase'
import { filterNameInput, filterPhoneInput, formatPhoneForSave, PHONE_PREFIX } from '@/lib/authUtils'
import { motion } from 'framer-motion'
import {
  Gift, Package, MapPin, Phone, User,
  CheckCircle, AlertCircle, Loader2, ShoppingBag
} from 'lucide-react'
import toast from 'react-hot-toast'

const REGIONS = [
  "Toshkent shahri","Toshkent viloyati","Samarqand","Buxoro",
  "Farg\'ona","Andijon","Namangan","Qashqadaryo","Surxondaryo",
  "Xorazm","Navoiy","Jizzax","Sirdaryo","Qoraqalpog\'iston"
]

export default function ClaimGift() {
  const { token } = useParams()
  const navigate  = useNavigate()
  const [step, setStep]   = useState('info')   // info | form | success
  const [form, setForm]   = useState({ full_name: '', phone: '', region: '', district: '', address: '' })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Sovg'a ma'lumotlarini olish
  const { data: gift, isLoading, error } = useQuery({
    queryKey: ['gift', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_gift_by_token', { p_token: token })
        .single()
      if (error) throw error
      return data
    },
  })

  // Sovg'ani qabul qilish
  const claimMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('claim_gift', {
        p_token: token,
        p_recipient_name: form.full_name.trim(),
        p_recipient_phone: formatPhoneForSave(form.phone),
        p_recipient_address: `${form.region}, ${form.district}, ${form.address}`,
      })
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Sovg\'a claim qilib bo\'linmadi')
      }
    },
    onSuccess: () => setStep('success'),
    onError:   () => toast.error('Xatolik yuz berdi'),
  })

  const handleClaim = async (e) => {
    e.preventDefault()
    if (!form.phone || form.phone.replace(/\D/g, '').length < 9) {
      toast.error('To\'liq telefon raqam kiriting')
      return
    }
    claimMutation.mutate()
  }

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  // Topilmadi
  if (error || !gift) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center">
        <AlertCircle className="w-16 h-16 text-destructive/50 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Sovg'a topilmadi</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Bu link noto'g'ri yoki muddati o'tgan bo'lishi mumkin.
        </p>
        <button onClick={() => navigate('/')}
          className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold"
        >
          Bosh sahifaga
        </button>
      </div>
    )
  }

  // Allaqachon qabul qilingan
  if (gift.status === 'claimed' || gift.status === 'delivered') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Sovg'a qabul qilingan</h2>
        <p className="text-sm text-muted-foreground">
          Bu sovg'a allaqachon qabul qilingan.
        </p>
      </div>
    )
  }

  // Muvaffaqiyat
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }}>
          <div className="text-7xl mb-5">🎁</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h2 className="text-2xl font-extrabold text-foreground mb-2">
            Tabriklaymiz! 🎉
          </h2>
          <p className="text-sm text-muted-foreground mb-2">
            <span className="font-semibold text-foreground">{gift.product_name}</span> yetkazib beriladi.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Tez orada operatorimiz siz bilan bog'lanadi.
          </p>

          {gift.message && (
            <div className="bg-card border border-border/60 rounded-2xl p-4 mb-6 max-w-xs mx-auto">
              <p className="text-xs text-muted-foreground mb-1">Jo'natuvchidan xabar:</p>
              <p className="text-sm text-foreground italic">"{gift.message}"</p>
            </div>
          )}

          <button onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-semibold"
          >
            <ShoppingBag className="w-4 h-4" />
            SkinBox do'koniga kirish
          </button>
        </motion.div>
      </div>
    )
  }

  // Ma'lumot ko'rsatish
  if (step === 'info') {
    return (
      <div className="min-h-screen bg-background px-5 py-10">
        <div className="max-w-sm mx-auto">

          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold text-foreground">SkinBox</span>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🎁</div>
              <h1 className="text-xl font-extrabold text-foreground">Sizga sovg'a!</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Kimdir sizga ajoyib sovg'a yubordi
              </p>
            </div>

            {/* Mahsulot */}
            <div className="bg-card rounded-2xl border border-border/60 p-4 mb-4 flex items-center gap-4">
              {gift.product_image
                ? <img src={gift.product_image} alt={gift.product_name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center flex-shrink-0"><Package className="w-8 h-8 text-muted-foreground/40" /></div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">{gift.product_brand}</p>
                <p className="text-base font-bold text-foreground">{gift.product_name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{gift.quantity} ta</p>
              </div>
            </div>

            {/* Xabar */}
            {gift.message && (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-4">
                <p className="text-xs text-muted-foreground mb-1 font-semibold">💌 Xabar:</p>
                <p className="text-sm text-foreground italic">"{gift.message}"</p>
              </div>
            )}

            <button onClick={() => setStep('form')}
              className="w-full py-4 bg-primary text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              <Gift className="w-5 h-5" />
              Sovg'ani qabul qilish
            </button>

            <p className="text-center text-xs text-muted-foreground mt-4">
              Manzilni kiriting — sovg'a yetkaziladi
            </p>
          </motion.div>
        </div>
      </div>
    )
  }

  // Manzil kiritish formasi
  return (
    <div className="min-h-screen bg-background px-5 py-8">
      <div className="max-w-sm mx-auto">

        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setStep('info')}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
          >
            ←
          </button>
          <h2 className="text-lg font-extrabold text-foreground flex-1">Manzilni kiriting</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
          Sovg'angiz qayerga yetkazilsin?
        </p>

        <form onSubmit={handleClaim} className="space-y-4">
          {/* Ism */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Ism Familya
            </label>
            <input required value={form.full_name} onChange={e => set('full_name', filterNameInput(e.target.value))}
              placeholder="Karimov Jasur"
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>

          {/* Telefon */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Telefon
            </label>
            <div className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border flex items-center">
              <span className="text-black dark:text-white shrink-0 pr-1">{PHONE_PREFIX}</span>
              <input required type="tel" value={form.phone} onChange={e => set('phone', filterPhoneInput(e.target.value).slice(0, 9))}
                placeholder="90 123 45 67" inputMode="numeric"
                className="flex-1 min-w-0 bg-transparent border-none outline-none focus:ring-0 text-sm"
              />
            </div>
          </div>

          {/* Viloyat */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Viloyat
            </label>
            <select required value={form.region} onChange={e => set('region', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 transition-all"
            >
              <option value="">Tanlang...</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Tuman */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Tuman / Shahar
            </label>
            <input required value={form.district} onChange={e => set('district', e.target.value)}
              placeholder="Chilonzor tumani"
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>

          {/* Ko'cha */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Ko'cha, uy, xonadon
            </label>
            <textarea required rows={2} value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="Bunyodkor ko'ch. 12-uy, 34-xonadon"
              className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
            />
          </div>

          <button type="submit" disabled={claimMutation.isPending}
            className="w-full py-4 bg-primary text-white rounded-2xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {claimMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Yuborilmoqda...</>
              : <><CheckCircle className="w-4 h-4" /> Tasdiqlash</>
            }
          </button>
        </form>
      </div>
    </div>
  )
}
