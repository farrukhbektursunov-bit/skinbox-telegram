// VariantSelector — faqat variantlar bo'lsa ko'rsatiladi

const TYPE_LABELS = {
  color:  'Rang',
  size:   'O\'lcham',
  volume: 'Hajm',
  weight: 'Og\'irlik',
  other:  'Tur',
}

// Rang doirasi
function ColorOption({ variant, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(variant)}
      disabled={!variant.in_stock}
      title={variant.label}
      className={`relative w-9 h-9 rounded-full border-2 transition-all
        ${selected ? 'border-foreground scale-110 shadow-md' : 'border-transparent'}
        ${!variant.in_stock ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
      `}
      style={{ backgroundColor: variant.color_hex || '#ccc' }}
    >
      {selected && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: isLight(variant.color_hex) ? '#000' : '#fff' }}
          />
        </span>
      )}
      {!variant.in_stock && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-full h-px bg-red-400 rotate-45 absolute" />
        </span>
      )}
    </button>
  )
}

// Rang yorug' yoki to'qligini aniqlash
function isLight(hex) {
  if (!hex) return true
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128
}

// Matn (hajm, o'lcham) tugma
function TextOption({ variant, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(variant)}
      disabled={!variant.in_stock}
      className={`relative px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all
        ${selected
          ? 'border-primary bg-primary text-white'
          : 'border-border bg-muted/50 text-foreground'
        }
        ${!variant.in_stock
          ? 'opacity-40 cursor-not-allowed line-through'
          : 'cursor-pointer hover:border-primary/50 active:scale-[0.96]'
        }
      `}
    >
      {variant.label}
      {variant.price_diff > 0 && (
        <span className={`text-[10px] ml-1 ${selected ? 'text-white/80' : 'text-muted-foreground'}`}>
          +{variant.price_diff.toLocaleString()}
        </span>
      )}
    </button>
  )
}

export default function VariantSelector({ variants = [], selected = {}, onSelect }) {
  if (!variants.length) return null

  // Variantlarni type bo'yicha guruhlash
  const groups = variants.reduce((acc, v) => {
    if (!acc[v.type]) acc[v.type] = []
    acc[v.type].push(v)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([type, items]) => {
        const currentSelected = selected[type]
        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-sm font-bold text-foreground">
                {TYPE_LABELS[type] || type}
              </span>
              {currentSelected && (
                <span className="text-sm text-muted-foreground">
                  — {currentSelected.label}
                  {currentSelected.price_diff > 0 && ` (+${currentSelected.price_diff.toLocaleString()} so'm)`}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {items
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(variant => (
                  type === 'color'
                    ? <ColorOption
                        key={variant.id}
                        variant={variant}
                        selected={currentSelected?.id === variant.id}
                        onSelect={v => onSelect(type, v)}
                      />
                    : <TextOption
                        key={variant.id}
                        variant={variant}
                        selected={currentSelected?.id === variant.id}
                        onSelect={v => onSelect(type, v)}
                      />
                ))
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}
