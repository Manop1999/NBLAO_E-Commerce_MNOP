const Star = ({ filled, size }: { filled: boolean; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={filled ? '#D4AF37' : 'none'} stroke={filled ? '#D4AF37' : '#B6C2CF'} strokeWidth="1.6" strokeLinejoin="round">
    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8L12 2.5z" />
  </svg>
)

export function StarDisplay({ value, size = 14 }: { value: number; size?: number }) {
  const rounded = Math.round(value)
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} filled={n <= rounded} size={size} />)}
    </span>
  )
}

export function StarInput({ value, onChange, size = 28, disabled }: { value: number; onChange: (v: number) => void; size?: number; disabled?: boolean }) {
  const focusStar = (el: HTMLElement | null, n: number) => {
    const next = Math.min(5, Math.max(1, n))
    onChange(next)
    ;(el?.parentElement?.children[next - 1] as HTMLElement | undefined)?.focus()
  }
  return (
    <div role="radiogroup" aria-label="Rating" aria-disabled={disabled || undefined} className="inline-flex gap-1" style={disabled ? { opacity: 0.45 } : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          disabled={disabled}
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          tabIndex={value === n || (!value && n === 1) ? 0 : -1}
          onClick={() => onChange(n)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); focusStar(e.currentTarget, (value || 0) + 1) }
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); focusStar(e.currentTarget, (value || 2) - 1) }
          }}
          className="rounded-sm p-0.5 focus-visible:outline-2 focus-visible:outline-[var(--nb-primary)] disabled:cursor-not-allowed"
        >
          <Star filled={n <= value} size={size} />
        </button>
      ))}
    </div>
  )
}
