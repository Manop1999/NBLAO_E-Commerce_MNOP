export interface LogoCarouselItem {
  id: string
  name: string
  logo: string
  url?: string
}

interface LogoCarouselProps {
  items: LogoCarouselItem[]
  variant?: 'brand' | 'business'
  ariaLabel: string
  /** Show at most this many logos (full list stays available on /partners) */
  limit?: number
}

/** Complete partner directory grid; variants intentionally use different fixed column counts. */
export function LogoGrid({ items, ariaLabel, variant = 'brand', limit }: LogoCarouselProps) {
  const shown = typeof limit === 'number' ? items.slice(0, limit) : items
  return (
    <div className={`partner-logo-grid partner-logo-grid--${variant}`} role="list" aria-label={ariaLabel}>
      {shown.map(item => {
        const img = <img src={item.logo} alt={item.name} loading="lazy" />
        return (
          <div className="partner-logo-grid-item" role="listitem" key={item.id} title={item.name}>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer" aria-label={item.name}>{img}</a>
            ) : img}
          </div>
        )
      })}
    </div>
  )
}

/**
 * A separate, decorative presentation of the same partner records. The full
 * directory remains available through LogoGrid, so motion never hides logos.
 */
export default function LogoCarousel({ items, ariaLabel, variant = 'brand', limit }: LogoCarouselProps) {
  const shown = typeof limit === 'number' ? items.slice(0, limit) : items
  const marqueeRef = useRef<HTMLDivElement>(null)
  const primaryGroupRef = useRef<HTMLDivElement>(null)
  const [copyCount, setCopyCount] = useState(2)

  useLayoutEffect(() => {
    if (shown.length < 2) return

    const syncCopies = () => {
      const viewportWidth = marqueeRef.current?.clientWidth ?? 0
      const groupWidth = primaryGroupRef.current?.scrollWidth ?? 0
      if (!viewportWidth || !groupWidth) return
      setCopyCount(Math.max(2, Math.ceil(viewportWidth / groupWidth) + 1))
    }

    syncCopies()
    const observer = new ResizeObserver(syncCopies)
    if (marqueeRef.current) observer.observe(marqueeRef.current)
    return () => observer.disconnect()
  }, [shown.length, shown.map(item => item.id).join('|')])

  if (!shown.length) return null

  const strip = (copy: number) => shown.map(item => {
    const isPrimary = copy === 0
    const logo = <img src={item.logo} alt={isPrimary ? item.name : ''} loading="lazy" />
    return (
      <div className="partner-logo-marquee__item" role="listitem" key={`${copy}-${item.id}`} title={item.name}>
        {item.url
          ? <a href={item.url} target="_blank" rel="noreferrer" aria-label={isPrimary ? item.name : undefined} tabIndex={isPrimary ? undefined : -1}>{logo}</a>
          : logo}
      </div>
    )
  })

  return (
    <div ref={marqueeRef} className={`partner-logo-marquee partner-logo-marquee--${variant}`} role="region" aria-label={ariaLabel}>
      <div className={`partner-logo-marquee__track${shown.length > 1 ? ' is-animated' : ''}`} role="list" style={{ '--partner-marquee-shift': `${100 / copyCount}%` } as CSSProperties}>
        {Array.from({ length: shown.length > 1 ? copyCount : 1 }, (_, copy) => (
          <div ref={copy === 0 ? primaryGroupRef : undefined} className="partner-logo-marquee__group" aria-hidden={copy === 0 ? undefined : true} key={copy}>
            {strip(copy)}
          </div>
        ))}
      </div>
    </div>
  )
}
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
