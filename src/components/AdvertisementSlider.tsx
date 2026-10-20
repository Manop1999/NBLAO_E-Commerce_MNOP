import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Advertisement } from '../content'
import { assetUrl } from '../lib/assetUrl'

const AUTO_MS = 5500
const RESUME_MS = 4000
const DURATION_MS = 600
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DRAG_START_PX = 6

interface Props {
  ads: Advertisement[]
  prevLabel: string
  nextLabel: string
  dotLabel: (index: number) => string
  renderChevron: (direction: 'left' | 'right') => React.ReactNode
}

export default function AdvertisementSlider({ ads, prevLabel, nextLabel, dotLabel, renderChevron }: Props) {
  const n = ads.length
  const multi = n > 1
  const slides = multi ? [ads[n - 1], ...ads, ads[0]] : ads
  const adKey = ads.map(ad => `${ad.id}:${ad.image}`).join('|')

  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(multi ? 1 : 0)
  const settleRef = useRef<number | undefined>(undefined)
  const autoRef = useRef<number | undefined>(undefined)
  const hoverRef = useRef(false)
  const drag = useRef({ active: false, captured: false, id: -1, startX: 0, startY: 0, dx: 0, base: 0, width: 1, samples: [] as { x: number; t: number }[], moved: false })
  const goToRef = useRef<(pos: number, resumeDelay?: number) => void>(() => {})
  const [active, setActive] = useState(0)
  const [ratio, setRatio] = useState<number | null>(null)

  const apply = useCallback((dx: number, animate: boolean) => {
    const track = trackRef.current
    if (!track) return
    track.style.transition = animate ? `transform ${DURATION_MS}ms ${EASING}` : 'none'
    track.style.transform = `translate3d(calc(${-posRef.current * 100}% + ${dx}px), 0, 0)`
  }, [])

  const syncActive = useCallback(() => {
    setActive(multi ? (posRef.current - 1 + n) % n : 0)
  }, [multi, n])

  const scheduleAuto = useCallback((delay: number) => {
    window.clearTimeout(autoRef.current)
    if (!multi) return
    autoRef.current = window.setTimeout(() => {
      if (drag.current.active || hoverRef.current || document.hidden) {
        if (!drag.current.active && !hoverRef.current) scheduleAuto(AUTO_MS)
        return
      }
      goToRef.current(posRef.current + 1)
    }, delay)
  }, [multi])

  const settle = useCallback(() => {
    // After landing on a cloned edge slide, jump to its twin without animation.
    if (multi) {
      if (posRef.current === 0) posRef.current = n
      else if (posRef.current === n + 1) posRef.current = 1
    }
    apply(0, false)
    syncActive()
  }, [apply, multi, n, syncActive])

  const goTo = useCallback((pos: number, resumeDelay = AUTO_MS) => {
    if (!multi) return
    window.clearTimeout(settleRef.current)
    // Finish any in-flight wrap before starting a new move.
    if (posRef.current === 0 || posRef.current === n + 1) settle()
    posRef.current = Math.max(0, Math.min(n + 1, pos))
    // Force the browser to commit the non-animated start before animating.
    void trackRef.current?.offsetWidth
    apply(0, true)
    setActive((posRef.current - 1 + n) % n)
    settleRef.current = window.setTimeout(settle, DURATION_MS + 30)
    scheduleAuto(resumeDelay)
  }, [apply, multi, n, scheduleAuto, settle])

  goToRef.current = goTo

  // Reset only when the eligible campaign set actually changes.
  useEffect(() => {
    posRef.current = multi ? 1 : 0
    apply(0, false)
    syncActive()
    scheduleAuto(AUTO_MS)
    return () => {
      window.clearTimeout(autoRef.current)
      window.clearTimeout(settleRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adKey])

  // Stable banner region: aspect ratio comes from the first campaign image, so height never changes between slides.
  useEffect(() => {
    let cancelled = false
    setRatio(null)
    if (!ads[0]) return
    const img = new Image()
    img.onload = () => { if (!cancelled && img.naturalWidth) setRatio(img.naturalWidth / img.naturalHeight) }
    img.src = assetUrl(ads[0].image)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adKey])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!multi || (event.pointerType === 'mouse' && event.button !== 0)) return
    const d = drag.current
    const viewport = viewportRef.current!
    const track = trackRef.current!
    d.width = viewport.clientWidth || 1
    // Grab a slide that is mid-transition from its current visual position.
    const m = new DOMMatrixReadOnly(getComputedStyle(track).transform)
    window.clearTimeout(settleRef.current)
    let base = m.m41 + posRef.current * d.width
    if (posRef.current === 0) { posRef.current = n; base += n * d.width }
    else if (posRef.current === n + 1) { posRef.current = 1; base -= n * d.width }
    Object.assign(d, { active: true, captured: false, id: event.pointerId, startX: event.clientX, startY: event.clientY, dx: base, base, samples: [{ x: event.clientX, t: performance.now() }], moved: false })
    apply(base, false)
    window.clearTimeout(autoRef.current)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d.active || event.pointerId !== d.id) return
    const moveX = event.clientX - d.startX
    if (!d.captured) {
      if (Math.abs(moveX) < DRAG_START_PX) return
      if (Math.abs(event.clientY - d.startY) > Math.abs(moveX)) return
      d.captured = true
      d.moved = true
      try { viewportRef.current?.setPointerCapture(event.pointerId) } catch { /* pointer already released */ }
    }
    d.dx = d.base + moveX
    d.samples.push({ x: event.clientX, t: performance.now() })
    if (d.samples.length > 6) d.samples.shift()
    apply(d.dx, false)
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current
    if (!d.active || event.pointerId !== d.id) return
    d.active = false
    if (viewportRef.current?.hasPointerCapture(event.pointerId)) viewportRef.current.releasePointerCapture(event.pointerId)
    if (!d.captured) { scheduleAuto(AUTO_MS); return }
    const first = d.samples[0]
    const last = d.samples[d.samples.length - 1]
    const velocity = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0
    const offset = d.dx
    let target = posRef.current
    if (!cancelled && (Math.abs(offset) > d.width * 0.2 || Math.abs(velocity) > 0.5)) {
      const direction = Math.abs(velocity) > 0.5 ? Math.sign(velocity) : Math.sign(offset)
      target = posRef.current - direction
    }
    // Animate from the released offset to the target.
    apply(offset, false)
    void trackRef.current?.offsetWidth
    goTo(target, RESUME_MS)
  }

  // A drag must never open the campaign link.
  const onClickCapture = (event: React.MouseEvent) => {
    if (drag.current.moved) {
      event.preventDefault()
      event.stopPropagation()
      drag.current.moved = false
    }
  }

  const controlClick = (fn: () => void) => () => {
    fn()
  }

  return (
    <div
      className="advertisement-slider relative"
      onPointerEnter={event => { if (event.pointerType === 'mouse') { hoverRef.current = true; window.clearTimeout(autoRef.current) } }}
      onPointerLeave={event => {
        if (event.pointerType === 'mouse') { hoverRef.current = false; if (!drag.current.active) scheduleAuto(RESUME_MS) }
      }}
    >
      <div
        ref={viewportRef}
        className="advertisement-viewport"
        style={{ aspectRatio: ratio ?? 3.2 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={event => endDrag(event, false)}
        onPointerCancel={event => endDrag(event, true)}
        onClickCapture={onClickCapture}
        onDragStart={event => event.preventDefault()}
      >
        <div ref={trackRef} className="advertisement-track" style={{ transform: `translate3d(${-posRef.current * 100}%, 0, 0)` }}>
          {slides.map((ad, index) => {
            const content = <img src={assetUrl(ad.image)} alt="" draggable={false} className="advertisement-slide__art" />
            const clone = multi && (index === 0 || index === n + 1)
            const key = `${ad.id}-${index}`
            if (!ad.destinationUrl) return <div key={key} aria-hidden={clone || undefined} className="advertisement-slide">{content}</div>
            return ad.destinationUrl.startsWith('/')
              ? <Link key={key} to={ad.destinationUrl} draggable={false} tabIndex={clone ? -1 : undefined} aria-hidden={clone || undefined} className="advertisement-slide no-underline">{content}</Link>
              : <a key={key} href={ad.destinationUrl} target="_blank" rel="noreferrer" draggable={false} tabIndex={clone ? -1 : undefined} aria-hidden={clone || undefined} className="advertisement-slide no-underline">{content}</a>
          })}
        </div>
      </div>
      {multi && (
        <>
          <button type="button" onClick={controlClick(() => goTo(posRef.current - 1))} aria-label={prevLabel}
            className="advertisement-slider__control absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center bg-white">
            {renderChevron('left')}
          </button>
          <button type="button" onClick={controlClick(() => goTo(posRef.current + 1))} aria-label={nextLabel}
            className="advertisement-slider__control absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center bg-white">
            {renderChevron('right')}
          </button>
          <div className="absolute right-4 bottom-3 z-20 flex gap-1.5">
            {ads.map((ad, index) => (
              <button
                key={ad.id}
                type="button"
                onClick={() => goTo(index + 1)}
                className="h-1.5 transition-all"
                style={{ width: index === active ? 24 : 8, background: index === active ? 'var(--nb-gold)' : 'rgba(255,255,255,0.55)' }}
                aria-label={dotLabel(index)}
                aria-current={index === active}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
