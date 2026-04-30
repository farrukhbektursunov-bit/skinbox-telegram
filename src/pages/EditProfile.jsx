import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/api/supabase'
import { filterNameInput, filterPhoneInput, parsePhoneForInput, formatPhoneForSave, PHONE_PREFIX } from '@/lib/authUtils'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Camera, User, Phone, Mail, Calendar, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function EditProfile() {
  const { user } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileRef = useRef(null)

  const [avatarPreview, setAvatarPreview] = useState(null)
  const [avatarFile, setAvatarFile]       = useState(null)
  const [saving, setSaving]               = useState(false)
  const [form, setForm] = useState({
    full_name: '', phone: '', birth_date: '', gender: '',
  })

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()   // single() o'rniga maybeSingle — row yo'q bo'lsa null qaytaradi, xato bermaydi
      return data
    },
    enabled: !!user,
  })

  useEffect(() => {
    if (profile) {
      setForm({
        full_name:  profile.full_name  || '',
        phone:      parsePhoneForInput(profile.phone) || '',
        birth_date: profile.birth_date || '',
        gender:     profile.gender     || '',
      })
    }
  }, [profile])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Rasm hajmi 2MB dan oshmasin'); return }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error(t('nameRequired')); return }
    setSaving(true)
    try {
      let avatar_url = profile?.avatar_url || null

      if (avatarFile) {
        const ext  = avatarFile.name.split('.').pop()
        const path = `avatars/${user.id}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars').upload(path, avatarFile, { upsert: true })
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        avatar_url = urlData.publicUrl
      }

      const profileData = {
        id:         user.id,
        full_name:  form.full_name.trim(),
        phone:      formatPhoneForSave(form.phone) || null,
        birth_date: form.birth_date    || null,
        gender:     form.gender        || null,
        avatar_url,
        updated_at: new Date().toISOString(),
      }

      // Avval row bormi tekshirish
      const { data: existing } = await supabase
        .from('profiles').select('id').eq('id', user.id).maybeSingle()

      let error
      if (existing) {
        // Row bor — update
        const res = await supabase.from('profiles').update(profileData).eq('id', user.id)
        error = res.error
      } else {
        // Row yo'q — insert
        const res = await supabase.from('profiles').insert(profileData)
        error = res.error
      }

      if (error) throw error

      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      toast.success(t('saved'))
      navigate('/profile')
    } catch (err) {
      console.error('Save error:', err)
      toast.error(err.message || t('error'))
    } finally {
      setSaving(false)
    }
  }

  const currentAvatar = avatarPreview || profile?.avatar_url

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-lg font-extrabold flex-1">{t('editProfile')}</span>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? t('saving') : t('save')}
        </button>
      </div>

      <div className="px-5 pt-6 pb-10 space-y-5">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center border-4 border-card shadow-lg">
              {currentAvatar
                ? <img src={currentAvatar} alt="avatar" className="w-full h-full object-cover" />
                : <User className="w-10 h-10 text-primary" />
              }
            </div>
            <button onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center border-2 border-card shadow">
              <Camera className="w-4 h-4 text-white" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Click to change image</p>
        </div>

        {/* Email */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> {t('email')}
          </label>
          <div className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border text-sm text-muted-foreground flex items-center justify-between">
            <span className="truncate">{user?.email}</span>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full ml-2 flex-shrink-0">{t('cantChange')}</span>
          </div>
        </div>

        {/* Ism */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> {t('fullName')} *
          </label>
          <input value={form.full_name} onChange={e => set('full_name', filterNameInput(e.target.value))}
            placeholder="Karimov Jasur"
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>

        {/* Telefon */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> {t('phone')}
          </label>
          <div className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border flex items-center">
            <span className="text-black dark:text-white shrink-0 pr-1">{PHONE_PREFIX}</span>
            <input value={form.phone} onChange={e => set('phone', filterPhoneInput(e.target.value).slice(0, 9))}
              placeholder="90 123 45 67" type="tel" inputMode="numeric"
              className="flex-1 min-w-0 bg-transparent border-none outline-none focus:ring-0 text-sm"
            />
          </div>
        </div>

        {/* Tug'ilgan sana */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> {t('birthDate')}
          </label>
          <input type="date" value={form.birth_date}
            onChange={e => set('birth_date', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          />
        </div>

        {/* Jinsi */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{t('gender')}</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: '',       label: t('notSpecified') },
              { id: 'female', label: t('female') },
              { id: 'male',   label: t('male') },
            ].map(g => (
              <button key={g.id} type="button" onClick={() => set('gender', g.id)}
                className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  form.gender === g.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >{g.label}</button>
            ))}
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-60 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  )
}
