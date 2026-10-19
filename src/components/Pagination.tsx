const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'

interface PaginationProps {
  page: number
  totalPages: number
  onPage: (page: number) => void
  itemsPerPage?: number
  totalItems?: number
  onItemsPerPage?: (n: number) => void
}

export function Pagination({ page, totalPages, onPage, itemsPerPage, totalItems }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  const startItem = totalItems != null && itemsPerPage != null ? (page - 1) * itemsPerPage + 1 : null
  const endItem = totalItems != null && itemsPerPage != null ? Math.min(page * itemsPerPage, totalItems) : null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-5">
      {totalItems != null && startItem != null && endItem != null && (
        <span className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>
          Showing {startItem}–{endItem} of {totalItems} product{totalItems !== 1 ? 's' : ''}
        </span>
      )}
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="rounded-sm font-ui text-[12px] font-600 px-3 py-1.5 transition-colors disabled:opacity-30"
          style={{ border: '1px solid var(--nb-border)', color: NAVY, background: '#fff' }}
        >
          ← Prev
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="font-ui text-[12px] px-2" style={{ color: '#94a3b8' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className="rounded-sm font-ui text-[12px] font-600 w-8 h-8 flex items-center justify-center transition-colors"
              style={{
                background: p === page ? BLUE : '#fff',
                color: p === page ? '#fff' : NAVY,
                border: `1px solid ${p === page ? BLUE : 'var(--nb-border)'}`,
              }}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="rounded-sm font-ui text-[12px] font-600 px-3 py-1.5 transition-colors disabled:opacity-30"
          style={{ border: '1px solid var(--nb-border)', color: NAVY, background: '#fff' }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
