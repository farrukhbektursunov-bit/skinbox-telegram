import { useState } from 'react'
import { ChevronLeft, ChevronDown, ChevronUp, Phone, MessageCircle, Mail } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useLang } from '@/lib/LangContext'

const FAQ_KEYS = [
  { qKey: 'faqTrackQ', aKey: 'faqTrackA' },
  { qKey: 'faqDeliveryQ', aKey: 'faqDeliveryA' },
  { qKey: 'faqReturnQ', aKey: 'faqReturnA' },
  { qKey: 'faqPaymentQ', aKey: 'faqPaymentA' },
  { qKey: 'faqOriginalQ', aKey: 'faqOriginalA' },
  { qKey: 'faqMinOrderQ', aKey: 'faqMinOrderA' },
]

function FaqItem({ faq, index, t }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      className="border-b border-border/40 last:border-0"
    >
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-4 text-left">
        <span className="text-sm font-semibold text-foreground pr-4">{t(faq.qKey)}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{t(faq.aKey)}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Help() {
  const { t } = useLang()
  const navigate = useNavigate()

  const contactItems = [
    { icon: Phone,         labelKey: 'helpPhone',    value: '+998 71 123 45 67', href: 'tel:+998711234567',           color: 'bg-green-50 text-green-600'  },
    { icon: MessageCircle, labelKey: 'helpTelegram', value: '@skinbox_uz',         href: 'https://t.me/skinbox_uz',     color: 'bg-blue-50 text-blue-600'    },
    { icon: Mail,         labelKey: 'helpEmail',    value: 'info@skinbox.uz',    href: 'mailto:info@skinbox.uz',      color: 'bg-orange-50 text-orange-500'},
  ]

  return (
    <div>
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-lg font-extrabold flex-1">{t('help')}</span>
      </div>

      <div className="px-5 pt-5 pb-6 space-y-5">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{t('helpContact')}</p>
          <div className="bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
            {contactItems.map(({ icon: Icon, labelKey, value, href, color }) => (
              <a key={labelKey} href={href} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{t(labelKey)}</p>
                  <p className="text-sm font-semibold text-foreground">{value}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
          <p className="text-xs font-bold text-primary mb-2">{t('helpWorkHours')}</p>
          <p className="text-sm text-foreground">{t('helpWorkHoursDesc')}</p>
          <p className="text-sm text-muted-foreground">{t('helpWeekend')}</p>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{t('helpFaqTitle')}</p>
          <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
            {FAQ_KEYS.map((faq, i) => <FaqItem key={i} faq={faq} index={i} t={t} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
