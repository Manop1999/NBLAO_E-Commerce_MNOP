import { Link } from 'react-router-dom'
import { useT } from '../i18n'
import { useStore } from '../store'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const GOLD = 'var(--nb-gold)'

const INDUSTRIES = [
  { name: 'Power & Energy', img: '/site-images/df0bbd67f314.jpg', desc: 'High-voltage equipment, transformers, and grid infrastructure.' },
  { name: 'Oil & Gas', img: '/site-images/b4cdb1afbd7f.jpg', desc: 'Pumps, valves, and pressure-rated industrial components.' },
  { name: 'Construction', img: '/site-images/cf40f0fd1621.jpg', desc: 'Heavy machinery, lifting equipment, and site safety solutions.' },
  { name: 'Manufacturing', img: '/site-images/e1506822243e.jpg', desc: 'Automation, conveyors, and precision engineering tools.' },
  { name: 'Mining', img: '/site-images/faccb7973b7e.jpg', desc: 'Extraction equipment, safety systems, and site infrastructure.' },
  { name: 'Water & Utilities', img: '/site-images/64446e0c5122.jpg', desc: 'Pumping stations, flow control, and treatment equipment.' },
]

const CERTS = [
  { label: 'ISO 9001:2015', sub: 'Quality Management' },
  { label: 'ISO 45001', sub: 'Occupational Health & Safety' },
  { label: 'CE Certified', sub: 'European Conformity' },
  { label: 'Authorised Distributor', sub: 'ABB, Siemens, Schneider' },
]

const STATS = [
  { value: '15+', label: 'Years of Operation' },
  { value: '800+', label: 'Product Lines' },
  { value: '200+', label: 'Active Clients' },
  { value: '12', label: 'Brand Partners' },
]

export default function About() {
  const t = useT()
  const { lang, leadership } = useStore()
  const activeLeadership = [...leadership].filter(item => item.active).sort((a, b) => a.displayOrder - b.displayOrder)
  const ownerMessages = activeLeadership.filter(item => item.section === 'owner')
  const management = activeLeadership.filter(item => item.section === 'management')
  const expertise = activeLeadership.filter(item => item.section === 'expertise')
  const team = activeLeadership.filter(item => item.section === 'team')
  const localized = (en: string, lo: string) => lang === 'lo' && lo ? lo : en
  return (
    <div style={{ background: 'var(--nb-bg)' }}>
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: NAVY, minHeight: 320 }}>
        <div className="absolute inset-0">
          <img src="/site-images/578c95d1df8b.jpg" alt="Industrial" className="w-full h-full object-cover opacity-20" />
        </div>
        <div className="relative max-w-[1440px] mx-auto px-6 lg:px-16 py-20">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-[2px]" style={{ background: GOLD }} />
            <span className="font-ui text-[11px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>{t.about.title}</span>
          </div>
          <h1 className="font-display font-800 text-[48px] leading-[1.08] text-white mb-5">
            Laos' Most Trusted<br />Industrial Supplier
          </h1>
          <p className="font-ui text-[15px] leading-relaxed max-w-xl" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Since 2009, NB Lao has equipped Laos' most demanding industrial projects with world-class equipment, technical expertise, and unmatched after-sales support.
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <div className="bg-white" style={{ borderBottom: '1px solid var(--nb-border)' }}>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--nb-bg)]">
            {STATS.map(s => (
              <div key={s.label} className="py-6 px-8 text-center">
                <div className="font-display font-800 text-[36px] leading-none mb-1" style={{ color: NAVY }}>{s.value}</div>
                <div className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mission / Vision */}
      <section className="max-w-[1440px] mx-auto px-6 lg:px-16 py-16">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-[2px]" style={{ background: GOLD }} />
              <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>Our Story</span>
            </div>
            <h2 className="font-display font-800 text-[32px] leading-[1.15] mb-5" style={{ color: NAVY }}>
              Building Laos' Industrial Future
            </h2>
            <p className="font-ui text-[14px] leading-relaxed mb-4" style={{ color: 'var(--nb-text-secondary)' }}>
              NB Lao Sole Co., Ltd. was founded with a singular vision: to bridge the gap between global industrial excellence and Laos' rapidly growing infrastructure demands. Starting as a small electrical components distributor in Vientiane, we have grown into the country's most comprehensive industrial supply partner.
            </p>
            <p className="font-ui text-[14px] leading-relaxed mb-4" style={{ color: 'var(--nb-text-secondary)' }}>
              Today, we maintain authorised distributor agreements with 12 of the world's leading industrial brands, a technical team of 45+ specialists, and a warehouse exceeding 5,000 m² fully stocked with critical inventory.
            </p>
            <p className="font-ui text-[14px] leading-relaxed" style={{ color: 'var(--nb-text-secondary)' }}>
              Our clients include power generation companies, construction conglomerates, mining operations, and government infrastructure projects across Laos and the Greater Mekong Subregion.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {[
              { label: 'Mission', text: 'To empower Laos\' industries with reliable, certified equipment and the technical knowledge to operate it safely and efficiently.' },
              { label: 'Vision', text: 'To be Southeast Asia\'s most trusted industrial supply partner, connecting regional markets with world-class technology.' },
              { label: 'Values', text: 'Quality without compromise. Service beyond the sale. Partnerships built on integrity and long-term commitment.' },
            ].map(v => (
              <div key={v.label} className="rounded-lg bg-white p-6" style={{ border: '1px solid var(--nb-border)' }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-3 h-3 shrink-0" style={{ background: GOLD }} />
                  <span className="font-display font-700 text-[16px]" style={{ color: NAVY }}>{v.label}</span>
                </div>
                <p className="font-ui text-[13px] leading-relaxed" style={{ color: 'var(--nb-text-secondary)' }}>{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="bg-white" style={{ borderTop: '1px solid var(--nb-border)', borderBottom: '1px solid var(--nb-border)' }}>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-16">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-6 h-[2px]" style={{ background: GOLD }} />
              <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>Sectors We Serve</span>
              <div className="w-6 h-[2px]" style={{ background: GOLD }} />
            </div>
            <h2 className="font-display font-800 text-[30px]" style={{ color: NAVY }}>Industries We Serve</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {INDUSTRIES.map(ind => (
              <div key={ind.name} className="rounded-md overflow-hidden group" style={{ border: '1px solid var(--nb-border)' }}>
                <div className="overflow-hidden" style={{ height: 160 }}>
                  <img src={ind.img} alt={ind.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="rounded-lg p-4 bg-white">
                  <div className="font-display font-700 text-[14px] mb-1.5" style={{ color: NAVY }}>{ind.name}</div>
                  <p className="font-ui text-[12px] leading-relaxed" style={{ color: 'var(--nb-text-secondary)' }}>{ind.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="bg-white" style={{ borderTop: '1px solid var(--nb-border)', borderBottom: '1px solid var(--nb-border)' }}>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-14">
          <div className="text-center mb-8">
            <h2 className="font-display font-800 text-[28px]" style={{ color: NAVY }}>Certifications & Compliance</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CERTS.map(c => (
              <div key={c.label} className="rounded-lg text-center p-6" style={{ border: `1px solid var(--nb-border)`, background: 'var(--nb-surface)' }}>
                <div className="rounded-md overflow-hidden w-8 h-8 mx-auto mb-3 flex items-center justify-center" style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}40` }}>
                  <div className="w-3 h-3" style={{ background: GOLD }} />
                </div>
                <div className="font-display font-700 text-[14px] mb-1" style={{ color: NAVY }}>{c.label}</div>
                <div className="font-ui text-[11px]" style={{ color: 'var(--nb-text-secondary)' }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {(ownerMessages.length > 0 || management.length > 0 || expertise.length > 0 || team.length > 0) && <section className="max-w-[1440px] mx-auto px-6 lg:px-16 py-14">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-6 h-[2px]" style={{ background: GOLD }} />
            <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>Leadership</span>
            <div className="w-6 h-[2px]" style={{ background: GOLD }} />
          </div>
          <h2 className="font-display font-800 text-[30px]" style={{ color: NAVY }}>Our Leadership Team</h2>
        </div>
        {ownerMessages.map(item => <div key={item.id} className="rounded-lg grid md:grid-cols-[240px_1fr] bg-white mb-6" style={{ border: '1px solid var(--nb-border)' }}>
          {item.image && <img src={item.image} alt={localized(item.nameEn, item.nameLo)} className="w-full h-64 md:h-full object-cover object-top" />}
          <div className="p-6 md:p-8">
            <div className="font-ui text-[10px] uppercase tracking-[0.18em] mb-2" style={{ color: GOLD }}>Message From Owner</div>
            <h3 className="font-display font-700 text-[20px]" style={{ color: NAVY }}>{localized(item.nameEn, item.nameLo)}</h3>
            <div className="font-ui text-[12px] mb-4" style={{ color: BLUE }}>{localized(item.positionEn, item.positionLo)}</div>
            <p className="font-ui text-[13px] leading-relaxed" style={{ color: 'var(--nb-text-secondary)' }}>{localized(item.messageEn, item.messageLo)}</p>
          </div>
        </div>)}
        {expertise.length > 0 && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {expertise.map(item => <div key={item.id} className="rounded-lg bg-white p-5" style={{ border: '1px solid var(--nb-border)' }}>
            {item.image && <img src={item.image} alt="" className="w-full h-32 object-cover mb-4" />}
            <h3 className="font-display font-700 text-[16px]" style={{ color: NAVY }}>{localized(item.titleEn || item.nameEn, item.titleLo || item.nameLo)}</h3>
            {localized(item.positionEn, item.positionLo) && <div className="font-ui text-[11px] mt-1" style={{ color: BLUE }}>{localized(item.positionEn, item.positionLo)}</div>}
            <p className="font-ui text-[12px] leading-relaxed mt-2" style={{ color: 'var(--nb-text-secondary)' }}>{localized(item.descriptionEn, item.descriptionLo)}</p>
          </div>)}
        </div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...management, ...team].map(item => (
            <div key={item.id} className="rounded-lg bg-white overflow-hidden" style={{ border: '1px solid var(--nb-border)' }}>
              {item.image && <div className="rounded-md h-52 overflow-hidden">
                <img src={item.image} alt={localized(item.nameEn, item.nameLo)} className="w-full h-full object-cover object-top" />
              </div>
              }
              <div className="p-4" style={{ borderTop: `2px solid ${GOLD}` }}>
                <div className="font-display font-700 text-[14px] leading-snug mb-1" style={{ color: NAVY }}>{localized(item.nameEn, item.nameLo)}</div>
                <div className="font-ui text-[11px]" style={{ color: BLUE }}>{localized(item.positionEn, item.positionLo)}</div>
                {localized(item.descriptionEn, item.descriptionLo) && <p className="font-ui text-[11px] leading-relaxed mt-2" style={{ color: 'var(--nb-text-secondary)' }}>{localized(item.descriptionEn, item.descriptionLo)}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>}

      {/* CTA */}
      <section className="py-14" style={{ background: NAVY }}>
        <div className="max-w-[900px] mx-auto px-6 text-center">
          <h2 className="font-display font-800 text-[32px] text-white mb-4">Ready to Work With Us?</h2>
          <p className="font-ui text-[14px] mb-8" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Contact our sales team to discuss your project requirements, request a quotation, or schedule a technical consultation.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/contact" className="rounded-md font-ui text-[13px] font-600 px-8 py-3.5 text-white no-underline" style={{ background: BLUE }}>Get In Touch</Link>
            <Link to="/rfq" className="rounded-md font-ui text-[13px] font-600 px-8 py-3.5 no-underline" style={{ border: `1px solid ${GOLD}`, color: GOLD }}>Request a Quote</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
