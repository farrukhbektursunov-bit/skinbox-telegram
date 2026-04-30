import { Search, X } from 'lucide-react'
import { useLang } from '@/lib/LangContext'

export default function SearchBar({ value, onChange }) {
  const { t } = useLang()
  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-3 bg-muted/60 rounded-2xl px-4 py-3">
        <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        {value && (
          <button onClick={() => onChange('')}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  )
}
