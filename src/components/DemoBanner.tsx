/*
 * Site-wide notice that this build is a prototype. Shown unless the build sets VITE_DEMO_MODE=false.
 * It is not sticky, so it never covers the sticky header or the floating contact button.
 */
export const isDemoMode = () => import.meta.env.VITE_DEMO_MODE !== 'false'

export default function DemoBanner() {
  if (!isDemoMode()) return null
  return (
    <div role="note" style={{ background: 'var(--nb-gold)', color: 'var(--nb-navy)' }}>
      <p className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-1.5 font-ui text-[11px] leading-snug text-center">
        Demo website: products, prices and stock are sample data. Orders and quote requests are not sent to NB LAO.
      </p>
    </div>
  )
}
