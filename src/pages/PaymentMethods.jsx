import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/api/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { motion } from 'framer-motion'
import { CreditCard, Plus, Trash2, Star, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BottomSheet from '@/components/shop/BottomSheet'
import toast from 'react-hot-toast'

const CARD_TYPES = [
  { id: 'uzcard',     label: 'UzCard',     color: 'from-blue-500 to-blue-700'   },
  { id: 'humo',       label: 'Humo',       color: 'from-green-500 to-green-700' },
  { id: 'visa',       label: 'Visa',       color: 'from-slate-700 to-slate-900' },
  { id: 'mastercard', label: 'Mastercard', color: 'from-orange-500 to-red-600'  },
]

const INPUT = "w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"

function CardForm({ onClose, onSaved }) {
  const { user } = useAuth()
  const { t } = useLang()
  const [f, setF] = useState({
    card_type: 'uzcard', card_number: '', card_name: '',
    expiry: '', cvc: '', card_password: '',
  })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const formatCard = (val) => val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
  const formatExpiry = (val) => {
    const v = val.replace(/\D/g, '').slice(0, 4)
    if (v.length >= 2) return v.slice(0, 2) + '/' + v.slice(2)
    return v
  }
  const formatCvc = (val) => val.replace(/\D/g, '').slice(0, 4)
  const formatPassword = (val) => val.replace(/\D/g, '').slice(0, 4)

  const handleSave = async (e) => {
    e.preventDefault()
    const digits = f.card_number.replace(/\D/g, '')
    if (digits.length < 16) { toast.error(t('cardNumberIncomplete')); return }

    const [mm, yy] = f.expiry.replace(/\D/g, '').length === 4
      ? [parseInt(f.expiry.slice(0, 2), 10), parseInt(f.expiry.slice(2), 10)]
      : [0, 0]
    const year = yy < 100 ? 2000 + yy : yy
    const now = new Date()
    if (mm < 1 || mm > 12) { toast.error(t('expiryInvalid')); return }
    if (year < now.getFullYear() || (year === now.getFullYear() && mm < now.getMonth() + 1)) {
      toast.error(t('expiryInvalid'))
      return
    }

    const cvcClean = f.cvc.replace(/\D/g, '')
    if (cvcClean.length < 3 || cvcClean.length > 4) { toast.error(t('cvcInvalid')); return }

    const pwdClean = f.card_password.replace(/\D/g, '')
    if (pwdClean.length !== 4) { toast.error(t('passwordInvalid')); return }

    setLoading(true)
    try {
      const { error } = await supabase.from('payment_methods').insert({
        user_id: user.id,
        card_type: f.card_type,
        card_last4: digits.slice(-4),
        card_name: f.card_name.toUpperCase(),
        expiry_month: mm,
        expiry_year: year,
        cvc: cvcClean,
        card_password: pwdClean,
      })
      if (error) throw error
      toast.success(t('cardSaved'))
      onSaved()
    } catch (err) {
      console.error(err)
      toast.error(err?.message || t('error'))
    } finally { setLoading(false) }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t('addCard')}
      footer={
        <button onClick={handleSave} disabled={loading}
          className="w-full py-3.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-60">
          {loading ? t('saving') : t('save')}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {CARD_TYPES.map(ct => (
            <button key={ct.id} type="button" onClick={() => set('card_type', ct.id)}
              className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                f.card_type === ct.id ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-border'
              }`}>{ct.label}</button>
          ))}
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t('cardNumber')}</label>
          <input required value={f.card_number} onChange={e => set('card_number', formatCard(e.target.value))}
            placeholder="0000 0000 0000 0000" maxLength={19} className={INPUT + " tracking-widest"} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t('cardHolder')}</label>
          <input required value={f.card_name} onChange={e => set('card_name', e.target.value.toUpperCase())}
            placeholder="KARIMOV JASUR" className={INPUT + " uppercase tracking-wider"} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t('cardExpiry')}</label>
            <input required value={f.expiry} onChange={e => set('expiry', formatExpiry(e.target.value))}
              placeholder={t('cardExpiryPh')} maxLength={5} className={INPUT + " tracking-widest"} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t('cardCvc')}</label>
            <input required value={f.cvc} onChange={e => set('cvc', formatCvc(e.target.value))}
              placeholder={t('cardCvcPh')} maxLength={4} type="password" inputMode="numeric"
              className={INPUT + " tracking-widest"} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t('cardPassword')}</label>
          <input required value={f.card_password} onChange={e => set('card_password', formatPassword(e.target.value))}
            placeholder={t('cardPasswordPh')} maxLength={4} type="password" inputMode="numeric"
            className={INPUT + " tracking-widest"} />
        </div>
      </div>
    </BottomSheet>
  )
}

function CardView({ card, onDelete, onDefault }) {
  const { t } = useLang()
  const ct = CARD_TYPES.find(c => c.id === card.card_type) || CARD_TYPES[0]
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className={`bg-gradient-to-br ${ct.color} rounded-2xl p-5 text-white mb-2 relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -translate-y-10 translate-x-10" />
        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm font-bold">{ct.label}</span>
            {card.is_default && <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{t('primary')}</span>}
          </div>
          <p className="text-lg font-bold tracking-widest mb-3">•••• •••• •••• {card.card_last4}</p>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-wider">{card.card_name}</p>
            {(card.expiry_month || card.expiry_year) && (
              <span className="text-xs opacity-80">
                {String(card.expiry_month || 0).padStart(2, '0')}/{card.expiry_year ? String(card.expiry_year).slice(-2) : ''}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        {!card.is_default && (
          <button onClick={() => onDefault(card.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-muted rounded-xl text-xs font-semibold text-muted-foreground">
            <Star className="w-3.5 h-3.5" /> {t('makeDefault')}
          </button>
        )}
        <button onClick={() => onDelete(card.id)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-destructive/10 rounded-xl text-xs font-semibold text-destructive">
          <Trash2 className="w-3.5 h-3.5" /> {t('deleteCard')}
        </button>
      </div>
    </motion.div>
  )
}

export default function PaymentMethods() {
  const { user } = useAuth()
  const { t } = useLang()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState('payme')

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['paymentMethods', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('payment_methods').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false })
      return data || []
    },
    enabled: !!user,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => { await supabase.from('payment_methods').delete().eq('id', id) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['paymentMethods', user?.id] }); toast.success(t('cardDeleted')) },
  })

  const defaultMutation = useMutation({
    mutationFn: async (id) => {
      await supabase.from('payment_methods').update({ is_default: false }).eq('user_id', user.id)
      await supabase.from('payment_methods').update({ is_default: true }).eq('id', id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['paymentMethods', user?.id] }),
  })

  const DIGITAL = [
    { id: 'payme', label: t('payme'), desc: t('paymeDesc'),
      icon: <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg">P</div> },
    { id: 'click', label: t('click'), desc: t('clickDesc'),
      icon: <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-lg">C</div> },
  ]

  return (
    <>
      <div>
        <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-lg font-extrabold flex-1">{t('paymentTitle')}</span>
        </div>

        <div className="px-5 pt-4 pb-6 space-y-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {t('selectPaymentMethod')}
            </p>
            <div className="bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
              {DIGITAL.map(m => (
                <button key={m.id} onClick={() => setSelectedMethod(m.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors">
                  {m.icon}
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedMethod === m.id ? 'border-primary bg-primary' : 'border-border'
                  }`}>
                    {selectedMethod === m.id && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('myCards')}</p>
              <button onClick={() => setShowForm(true)} className="text-xs text-primary font-semibold flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> {t('addCard')}
              </button>
            </div>
            {isLoading ? <div className="bg-muted rounded-2xl h-32 animate-pulse" /> :
             cards.length === 0 ? (
              <div className="flex flex-col items-center py-8 bg-muted/30 rounded-2xl">
                <CreditCard className="w-10 h-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">{t('noCards')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cards.map(card => (
                  <CardView key={card.id} card={card}
                    onDelete={id => deleteMutation.mutate(id)}
                    onDefault={id => defaultMutation.mutate(id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <CardForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            queryClient.invalidateQueries({ queryKey: ['paymentMethods', user?.id] })
          }}
        />
      )}
    </>
  )
}
