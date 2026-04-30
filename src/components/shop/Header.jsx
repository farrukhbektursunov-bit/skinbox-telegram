import { useNavigate } from 'react-router-dom'
import { ShoppingBag, ChevronLeft } from 'lucide-react'

export default function Header({ title, showBack, backTo = '/shop', noSticky }) {
  const navigate = useNavigate()
  const stickyClass = noSticky ? '' : 'sticky top-0 z-40'

  if (title && showBack) {
    return (
      <div className={`${stickyClass} bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4 flex items-center gap-3`}>
        <button onClick={() => navigate(backTo)}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xl font-extrabold tracking-tight text-foreground flex-1">{title}</span>
      </div>
    )
  }

  return (
    <div className={`${stickyClass} bg-card/80 backdrop-blur-xl border-b border-border/50 px-5 py-4 flex items-center gap-2`}>
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
        <ShoppingBag className="w-4 h-4 text-white" />
      </div>
      <span className="text-lg font-extrabold tracking-tight text-foreground">SkinBox</span>
    </div>
  )
}
