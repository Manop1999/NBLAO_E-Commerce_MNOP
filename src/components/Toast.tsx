import { createContext, useContext, useState, useCallback, useRef, ReactNode, createElement, useEffect } from 'react'
import { pushToast, toastDuration, type ToastState, type ToastType } from '../lib/toastQueue'

export type { ToastType }

interface ToastCtx {
  addToast: (message: string, type?: ToastType) => void
  removeToast: (id?: string) => void
}

const Ctx = createContext<ToastCtx | null>(null)

const NAVY = 'var(--nb-navy)'
const ICONS: Record<ToastType, string> = { success: '✓', error: '✕', warning: '!', info: 'i' }
const COLORS: Record<ToastType, string> = {
  success: '#166534',
  error: '#991B1B',
  warning: '#92400E',
  info: 'var(--nb-primary)',
}

const EXIT_MS = 180

function ToastItem({ toast, onRemove }: { toast: ToastState; onRemove: () => void }) {
  const color = COLORS[toast.type]
  const [leaving, setLeaving] = useState(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const dismiss = useCallback(() => {
    setLeaving(true)
    clearTimeout(exitTimer.current)
    exitTimer.current = setTimeout(onRemove, EXIT_MS)
  }, [onRemove])

  useEffect(() => {
    setLeaving(false)
    clearTimeout(exitTimer.current)
    const t = setTimeout(dismiss, toastDuration(toast.type))
    return () => clearTimeout(t)
  }, [dismiss, toast.type, toast.nonce, toast.id])

  useEffect(() => () => clearTimeout(exitTimer.current), [])

  const [title, detail] = toast.message.split('\n')

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      data-testid="app-toast"
      className={`${leaving ? 'nb-toast-out' : 'nb-toast'} rounded-md flex items-center gap-2.5 px-3 py-2.5 w-full shadow-lg bg-white`}
      style={{ border: '1px solid var(--nb-border)', borderLeft: `3px solid ${color}` }}
    >
      <span aria-hidden="true" className="font-display font-800 text-[12px] shrink-0 w-4 text-center" style={{ color }}>
        {ICONS[toast.type]}
      </span>
      <span className="font-ui text-[12.5px] flex-1 min-w-0 leading-snug" style={{ color: NAVY }}>
        <span className="block">
          {title}
          {toast.count > 1 && <span className="ml-1.5 font-700" style={{ color }}>×{toast.count}</span>}
        </span>
        {detail && <span data-i18n-skip className="block truncate text-[11.5px]" style={{ color: '#64748b' }}>{detail}</span>}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss notification"
        className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-sm font-ui text-[12px] leading-none hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[var(--nb-primary)]"
        style={{ color: '#64748b' }}
      >
        ✕
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const seq = useRef(0)

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    seq.current += 1
    const id = `t${seq.current}`
    setToast(prev => pushToast(prev, message, type, id))
  }, [])

  const removeToast = useCallback(() => setToast(null), [])

  // Every successful add-to-cart (card, detail page, compare, wishlist…) goes through the store,
  // which announces it here so the confirmation looks and sits the same everywhere.
  useEffect(() => {
    const onAdded = (e: Event) => {
      const d = (e as CustomEvent<{ name?: string; variantLabel?: string }>).detail
      const detail = [d?.name, d?.variantLabel].filter(Boolean).join(' — ')
      addToast(`Added to cart${detail ? `\n${detail}` : ''}`, 'success')
    }
    window.addEventListener('nblao:cart-added', onAdded)
    return () => window.removeEventListener('nblao:cart-added', onAdded)
  }, [addToast])

  return createElement(
    Ctx.Provider,
    { value: { addToast, removeToast } },
    children,
    createElement(
      'div',
      { className: 'nb-toast-region fixed z-[9999] flex justify-center pointer-events-none', 'aria-live': 'polite', 'aria-atomic': 'true' },
      toast
        ? createElement('div', { className: 'pointer-events-auto w-full max-w-[420px]' },
            createElement(ToastItem, { key: toast.id, toast, onRemove: removeToast }))
        : null
    )
  )
}

export const useToast = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
