import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/api/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { motion } from 'framer-motion'
import { MapPin, Plus, Trash2, Star, ChevronLeft, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BottomSheet from '@/components/shop/BottomSheet'
import toast from 'react-hot-toast'
import { REGION_NAMES } from '@/lib/i18n'
import { filterNameInput, filterPhoneInput, parsePhoneForInput, formatPhoneForSave, PHONE_PREFIX } from '@/lib/authUtils'

const REGIONS = [
  "Toshkent shahri","Toshkent viloyati","Samarqand","Buxoro",
  "Farg'ona","Andijon","Namangan","Qashqadaryo","Surxondaryo",
  "Xorazm","Navoiy","Jizzax","Sirdaryo","Qoraqalpog'iston"
]

const INPUT = "w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"

const ADDRESS_TITLES = [
  { key: 'home', labelKey: 'addressHome' },
  { key: 'work', labelKey: 'addressWork' },
  { key: 'other', labelKey: 'addressOther' },
]
const TITLE_MAP = { home: 'addressHome', work: 'addressWork', other: 'addressOther', Uy: 'addressHome', Ish: 'addressWork', "Boshqa": 'addressOther' }
const TITLE_TO_KEY = { Uy: 'home', Ish: 'work', Boshqa: 'other', home: 'home', work: 'work', other: 'other' }

function AddressForm({ onClose, onSaved, t, editAddress: initial, lang }) {
  const { user } = useAuth()
  const [f, setF] = useState(() => {
    if (initial) {
      const key = TITLE_TO_KEY[initial.title] || 'other'
      return {
        title: key,
        full_name: filterNameInput(initial.full_name || ''),
        phone: parsePhoneForInput(initial.phone || ''),
        region: initial.region || '',
        district: initial.district || '',
        address: initial.address || '',
        building_number: initial.building_number || '',
        apartment_number: initial.apartment_number || '',
        entrance_note: initial.entrance_note || initial.entrance_password || '',
        delivery_instruction: initial.delivery_instruction || 'door',
      }
    }
    return { title: 'home', full_name: '', phone: '', region: '', district: '', address: '', building_number: '', apartment_number: '', entrance_note: '', delivery_instruction: 'door' }
  })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    const digits = (f.phone || '').replace(/\D/g, '')
    if (digits.length < 9) {
      toast.error(t('enterFullPhone'))
      return
    }
    setLoading(true)
    try {
      const payload = { ...f, phone: formatPhoneForSave(f.phone) }
      if (initial?.id) {
        const { error } = await supabase.from('addresses').update(payload).eq('id', initial.id).eq('user_id', user.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('addresses').insert({ ...payload, user_id: user.id })
        if (error) throw error
      }
      toast.success(t('addressSaved'))
      onSaved()
    } catch { toast.error(t('error')) }
    finally { setLoading(false) }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={initial ? t('editAddress') : t('newAddress')}
      footer={
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-3.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-60"
        >
          {loading ? t('saving') : t('save')}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          {ADDRESS_TITLES.map(({ key, labelKey }) => (
            <button key={key} type="button" onClick={() => set('title', key)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                f.title === key ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-border'
              }`}
            >{t(labelKey)}</button>
          ))}
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('fullName')}</label>
          <input value={f.full_name} onChange={e => set('full_name', filterNameInput(e.target.value))}
            placeholder={t('namePlaceholder')} type="text" className={INPUT} required />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('phone')}</label>
          <div className={INPUT + " flex items-center px-0"}>
            <span className="pl-4 text-black dark:text-white shrink-0">{PHONE_PREFIX}</span>
            <input value={f.phone} onChange={e => set('phone', filterPhoneInput(e.target.value).slice(0, 9))}
              placeholder="90 123 45 67" type="tel" inputMode="numeric" required
              className="flex-1 min-w-0 py-3 pr-4 bg-transparent border-none outline-none focus:ring-0"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('regionLabel')}</label>
          <select required value={f.region} onChange={e => set('region', e.target.value)}
            className={INPUT}>
            <option value="">{t('selectRegion')}</option>
            {REGIONS.map(r => <option key={r} value={r}>{REGION_NAMES[lang]?.[r] ?? r}</option>)}
          </select>
        </div>

        {[
          { k: 'district',  label: t('districtLabel'), ph: 'Chilonzor',    type: 'text', req: true },
          { k: 'address',   label: t('streetLabel'), ph: t('streetPh'),    type: 'text', req: true },
          { k: 'building_number', label: t('buildingNumber'), ph: t('buildingNumberPh'), type: 'text', req: false },
          { k: 'apartment_number', label: t('apartmentNumber'), ph: t('apartmentNumberPh'), type: 'text', req: false },
          { k: 'entrance_note', label: t('entrancePassword'), ph: t('entrancePasswordPh'), type: 'text', req: false },
        ].map(({ k, label, ph, type, req }) => (
          <div key={k}>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{label}</label>
            <input value={f[k]} onChange={e => set(k, e.target.value)}
              placeholder={ph} type={type} className={INPUT}
              required={req} />
          </div>
        ))}

        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('deliveryInstruction')}</label>
          <select value={f.delivery_instruction} onChange={e => set('delivery_instruction', e.target.value)}
            className={INPUT}>
            <option value="door">{t('deliveryLeaveAtDoor')}</option>
            <option value="security">{t('deliveryLeaveWithSecurity')}</option>
            <option value="post">{t('deliveryLeaveAtPost')}</option>
          </select>
        </div>
      </div>
    </BottomSheet>
  )
}

export default function Addresses() {
  const { user } = useAuth()
  const { t, lang } = useLang()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [editingAddress, setEditingAddress] = useState(null)

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['addresses', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('addresses').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false })
      return data || []
    },
    enabled: !!user,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => { await supabase.from('addresses').delete().eq('id', id) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['addresses', user?.id] }); toast.success(t('removed')) },
  })

  const defaultMutation = useMutation({
    mutationFn: async (id) => {
      await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id)
      await supabase.from('addresses').update({ is_default: true }).eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addresses', user?.id] })
      toast.success(t('primarySet'))
    },
  })

  return (
    <>
      <div>
        <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-lg font-extrabold flex-1">{t('myAddresses')}</span>
          <button onClick={() => { setEditingAddress(null); setShowForm(true) }} className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-6 space-y-3">
          {isLoading ? [...Array(2)].map((_, i) => <div key={i} className="bg-muted rounded-2xl h-24 animate-pulse" />) :
           addresses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                <MapPin className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">{t('noAddress')}</p>
              <p className="text-xs text-muted-foreground mb-4">{t('addAddressForDelivery')}</p>
              <button onClick={() => { setEditingAddress(null); setShowForm(true) }} className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold">
                + {t('addAddress')}
              </button>
            </div>
          ) : addresses.map((addr, i) => (
            <motion.div key={addr.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`bg-card rounded-2xl border p-4 ${addr.is_default ? 'border-primary/40' : 'border-border/60'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${addr.is_default ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    {t(TITLE_MAP[addr.title] || 'addressOther')}
                  </span>
                  {addr.is_default && <span className="text-xs text-primary font-semibold">{t('primary')}</span>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => { setEditingAddress(addr); setShowForm(true) }}
                    className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center"
                    title={t('editAddress')}>
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  {!addr.is_default && (
                    <button onClick={() => defaultMutation.mutate(addr.id)}
                      className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center"
                      title={t('setAsPrimary')}>
                      <Star className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                  <button onClick={() => deleteMutation.mutate(addr.id)}
                    className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-0.5">
                <p className="text-sm font-semibold text-foreground">{addr.full_name}</p>
                <p className="text-xs text-muted-foreground">{addr.phone}</p>
                <p className="text-xs text-muted-foreground">{(REGION_NAMES[lang]?.[addr.region] ?? addr.region)}, {addr.district}</p>
                <p className="text-xs text-muted-foreground">
                  {addr.address}
                  {addr.building_number && `, ${t('buildingNumber')}: ${addr.building_number}`}
                  {addr.apartment_number && `, ${t('apartmentNumber')}: ${addr.apartment_number}`}
                </p>
                {addr.delivery_instruction && (
                  <p className="text-xs text-primary font-medium">
                    {addr.delivery_instruction === 'door' && t('deliveryLeaveAtDoor')}
                    {addr.delivery_instruction === 'security' && t('deliveryLeaveWithSecurity')}
                    {addr.delivery_instruction === 'post' && t('deliveryLeaveAtPost')}
                  </p>
                )}
                {!addr.is_default && (
                  <button onClick={() => defaultMutation.mutate(addr.id)}
                    className="mt-2 text-xs font-semibold text-primary">
                    ★ {t('setAsPrimary')}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {showForm && (
        <AddressForm
          t={t}
          lang={lang}
          editAddress={editingAddress}
          onClose={() => { setShowForm(false); setEditingAddress(null) }}
          onSaved={() => {
            setShowForm(false)
            setEditingAddress(null)
            queryClient.invalidateQueries({ queryKey: ['addresses', user?.id] })
          }}
        />
      )}
    </>
  )
}
