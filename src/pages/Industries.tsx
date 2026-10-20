import { Link } from 'react-router-dom'
import { assetUrl } from '../lib/assetUrl'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const GOLD = 'var(--nb-gold)'

const INDUSTRIES = [
  { name: 'Power & Energy', image: '/site-images/df0bbd67f314.jpg', description: 'High-voltage equipment, transformers, and grid infrastructure.', category: 'Power & Energy' },
  { name: 'Oil & Gas', image: '/site-images/b4cdb1afbd7f.jpg', description: 'Pumps, valves, and pressure-rated industrial components.', category: 'Industrial Machinery' },
  { name: 'Construction', image: '/site-images/cf40f0fd1621.jpg', description: 'Heavy machinery, lifting equipment, and site safety solutions.', category: 'Tools & Equipment' },
  { name: 'Manufacturing', image: '/site-images/e1506822243e.jpg', description: 'Automation, conveyors, and precision engineering tools.', category: 'Industrial Machinery' },
  { name: 'Mining', image: '/site-images/faccb7973b7e.jpg', description: 'Extraction equipment, safety systems, and site infrastructure.', category: 'Safety & Fire Protection' },
  { name: 'Water & Utilities', image: '/site-images/64446e0c5122.jpg', description: 'Pumping stations, flow control, and treatment equipment.', category: 'Industrial Machinery' },
]

export default function Industries() {
  return (
    <div style={{ background: 'var(--nb-bg)' }}>
      <section className="relative overflow-hidden" style={{ background: NAVY }}>
        <img src={assetUrl("/site-images/578c95d1df8b.jpg")} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        <div className="relative max-w-[1440px] mx-auto px-6 lg:px-16 py-16 lg:py-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-[2px]" style={{ background: GOLD }} />
            <span className="font-ui text-[11px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>Industries</span>
          </div>
          <h1 className="font-display font-800 text-[36px] lg:text-[48px] leading-[1.08] text-white mb-4">Industries We Serve</h1>
          <p className="font-ui text-[15px] leading-relaxed max-w-xl" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Equipment and supply support for the industrial sectors represented across NB LAO&apos;s product range.
          </p>
        </div>
      </section>

      <section className="max-w-[1440px] mx-auto px-6 lg:px-16 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {INDUSTRIES.map(industry => (
            <article key={industry.name} className="rounded-lg bg-white flex flex-col overflow-hidden" style={{ border: '1px solid var(--nb-border)' }}>
              <img src={assetUrl(industry.image)} alt={industry.name} className="w-full h-48 object-cover" />
              <div className="p-5 flex flex-col flex-1">
                <h2 className="font-display font-700 text-[20px] mb-2" style={{ color: NAVY }}>{industry.name}</h2>
                <p className="font-ui text-[13px] leading-relaxed mb-5 flex-1" style={{ color: 'var(--nb-text-secondary)' }}>{industry.description}</p>
                <div className="flex flex-wrap gap-3">
                  <Link to={`/products?category=${encodeURIComponent(industry.category)}`} className="font-ui text-[12px] font-600 no-underline" style={{ color: BLUE }}>
                    Related products →
                  </Link>
                  <Link to="/services" className="font-ui text-[12px] font-600 no-underline" style={{ color: NAVY }}>
                    Our services →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
