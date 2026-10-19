import { Link } from 'react-router-dom'
import { useT } from '../i18n'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const GOLD = 'var(--nb-gold)'

const services = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Technical Procurement & Sourcing',
    description: 'End-to-end industrial procurement for electrical, mechanical, and process equipment. We source from globally certified manufacturers and handle specification alignment, vendor qualification, and logistics to site.',
    bullets: ['Equipment specification support', 'Multi-vendor comparison', 'International logistics coordination', 'Customs clearance assistance'],
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Quotation & RFQ Management',
    description: 'Structured Request for Quotation workflow for complex multi-item projects. Our team reviews specifications, engages suppliers, and delivers competitive quotations with lead-time transparency.',
    bullets: ['Multi-product RFQ bundling', 'Technical review by engineers', 'Lead time & availability tracking', 'Quote validity guarantees'],
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Spare Parts & MRO Supply',
    description: 'Maintenance, Repair & Operations supply for industrial facilities. From circuit breakers and cable to PPE and instrumentation — stocked and available for fast dispatch to Vientiane and regional sites.',
    bullets: ['In-stock MRO inventory', 'Emergency sourcing capability', 'OEM and equivalent parts', 'Site delivery within Lao PDR'],
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: 'Project Material Packages',
    description: 'Turnkey material supply packages for construction and infrastructure projects. We coordinate bill-of-materials fulfilment, phased delivery scheduling, and on-site receiving support.',
    bullets: ['BOM review and gap analysis', 'Phased delivery scheduling', 'Progress tracking and reporting', 'Contractor coordination'],
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Technical Advisory',
    description: 'Pre-purchase technical consultation to ensure equipment compatibility with Lao grid standards, site conditions, and project specifications. Reduces procurement errors before they happen.',
    bullets: ['Specification review', 'Standards compliance (IEC/ANSI)', 'Equivalent product recommendations', 'Site condition assessment support'],
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: 'Document & Certification Support',
    description: 'Access test reports, calibration certificates, material certificates, and compliance documentation. Essential for regulated industries, government projects, and international contracts.',
    bullets: ['Factory acceptance test records', 'Material certificates (MTC)', 'Calibration certificates', 'Country of origin documentation'],
  },
]

export default function Services() {
  const t = useT()
  return (
    <div>
      {/* Hero */}
      <div style={{ background: NAVY, padding: '56px 0' }}>
        <div className="max-w-[1440px] mx-auto px-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-8" style={{ background: GOLD, opacity: 0.5 }} />
            <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>
              {t.services.title}
            </span>
          </div>
          <h1 className="font-display font-800 text-[40px] leading-tight text-white mb-4 max-w-[600px]">
            {t.services.title}
          </h1>
          <p className="font-ui text-[15px] leading-relaxed max-w-[560px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
            From single spare parts to full project material packages — NB LAO supports industrial,
            infrastructure, and energy sector projects throughout Lao PDR.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              to="/rfq"
              className="rounded-md font-ui text-[13px] font-600 px-6 py-2.5 text-white no-underline"
              style={{ background: BLUE }}
            >
              Submit RFQ
            </Link>
            <Link
              to="/products"
              className="rounded-md font-ui text-[13px] font-600 px-6 py-2.5 no-underline"
              style={{ border: '1px solid rgba(255,255,255,0.25)', color: '#fff', background: 'transparent' }}
            >
              Browse Products
            </Link>
          </div>
        </div>
      </div>

      {/* Services grid */}
      <div className="max-w-[1440px] mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s, i) => (
            <div key={i} className="rounded-lg bg-white p-7 flex flex-col" style={{ border: '1px solid var(--nb-border)' }}>
              <div className="w-12 h-12 flex items-center justify-center mb-5" style={{ background: '#EEF4FF', color: NAVY }}>
                {s.icon}
              </div>
              <h3 className="font-display font-700 text-[17px] mb-3" style={{ color: NAVY }}>{s.title}</h3>
              <p className="font-ui text-[13px] leading-[1.7] mb-4 flex-1" style={{ color: 'var(--nb-text-secondary)' }}>{s.description}</p>
              <ul className="space-y-1.5">
                {s.bullets.map((b, j) => (
                  <li key={j} className="flex items-start gap-2 font-ui text-[12px]" style={{ color: '#374151' }}>
                    <span className="mt-[5px] flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* CTA banner */}
      <div style={{ background: '#F0F5FF', borderTop: '1px solid var(--nb-border)', borderBottom: '1px solid var(--nb-border)' }}>
        <div className="max-w-[1440px] mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-display font-800 text-[24px] mb-2" style={{ color: NAVY }}>
              Have a project in mind?
            </h2>
            <p className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>
              Our sales team is ready to help you source the right equipment and materials.
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Link
              to="/rfq"
              className="rounded-md font-ui text-[13px] font-600 px-6 py-2.5 text-white no-underline"
              style={{ background: NAVY }}
            >
              Request a Quote
            </Link>
            <Link
              to="/contact"
              className="rounded-md font-ui text-[13px] font-600 px-6 py-2.5 no-underline"
              style={{ border: '1px solid var(--nb-border)', color: NAVY, background: '#fff' }}
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
