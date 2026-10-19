import { useEffect, ReactNode } from 'react'

const NAVY = 'var(--nb-navy)'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: number
  hideClose?: boolean
}

export function Modal({ open, onClose, title, children, maxWidth = 520, hideClose = false }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      style={{ background: 'rgba(5,14,28,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-lg bg-white w-full relative flex flex-col max-h-[90vh]"
        style={{ maxWidth, border: '1px solid var(--nb-border)', boxShadow: '0 8px 40px rgba(5,14,28,0.18)' }}
      >
        {(title || !hideClose) && (
          <div
            className="flex items-center justify-between px-7 py-5 shrink-0"
            style={{ borderBottom: '1px solid var(--nb-border)' }}
          >
            {title && (
              <h2 className="font-display font-700 text-[18px]" style={{ color: NAVY }}>
                {title}
              </h2>
            )}
            {!hideClose && (
              <button
                onClick={onClose}
                className="ml-auto font-ui text-[18px] leading-none text-[#94a3b8] hover:text-[#475569] transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto flex-1 px-7 py-6">{children}</div>
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  confirmDanger?: boolean
  loading?: boolean
}

export function ConfirmModal({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', confirmDanger = false, loading = false
}: ConfirmModalProps) {
  const BLUE = 'var(--nb-primary)'
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={420}>
      <p className="font-ui text-[14px] leading-[1.75] mb-7" style={{ color: 'var(--nb-text-secondary)' }}>{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          disabled={loading}
          className="rounded-md font-ui text-[13px] font-600 px-6 py-2.5 transition-all disabled:opacity-40"
          style={{ border: '1px solid var(--nb-border)', color: '#475569' }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="rounded-md font-ui text-[13px] font-600 px-6 py-2.5 text-white transition-all disabled:opacity-60"
          style={{ background: confirmDanger ? '#ef4444' : BLUE }}
        >
          {loading ? 'Processing…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
