// Universal BottomSheet komponenti — scroll + saqlash tugmasi har doim ko'rinadi
import { motion, AnimatePresence } from 'framer-motion'

export default function BottomSheet({ open, onClose, title, children, footer }) {
  if (!open) return null
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex justify-center">
        <div className="w-full max-w-md h-full relative flex flex-col justify-end">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

          {/* Sheet */}
          <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative z-10 w-full max-h-[92vh] min-h-0 bg-card rounded-t-3xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 bg-border rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-border/40">
            <h2 className="text-base font-extrabold text-foreground">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
            >
              <span className="text-lg font-bold leading-none text-muted-foreground">×</span>
            </button>
          </div>

          {/* Scroll content — min-h-0 ensures footer stays visible */}
          <div
            className="flex-1 min-h-0 overflow-y-auto px-5 py-4"
            style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
          >
            {children}
          </div>

          {/* Footer — always visible, safe area for notched devices */}
          {footer && (
            <div className="flex-shrink-0 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border/40 bg-card">
              {footer}
            </div>
          )}
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  )
}
