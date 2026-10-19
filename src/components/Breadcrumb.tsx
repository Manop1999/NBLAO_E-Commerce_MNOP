import { Link } from 'react-router-dom'

const NAVY = 'var(--nb-navy)'

interface BreadcrumbItem {
  label: string
  to?: string
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1.5 font-ui text-[12px] flex-wrap" style={{ color: '#8f9faf' }}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span>/</span>}
          {item.to ? (
            <Link to={item.to} className="hover:text-[var(--nb-primary)] transition-colors no-underline">
              {item.label}
            </Link>
          ) : (
            <span style={{ color: NAVY }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
