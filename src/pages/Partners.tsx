import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { useT } from '../i18n'
import { getBrandName } from '../brands'
import { LogoGrid } from '../components/LogoCarousel'

const NAVY = 'var(--nb-navy)'

export default function Partners() {
  const t = useT()
  const location = useLocation()
  const { partners, brands, activeBrands, lang } = useStore()
  const brandPartners = activeBrands.map(brand => ({
    id: brand.id,
    name: getBrandName(brand, lang),
    logo: brand.logo,
    url: brand.websiteUrl,
  }))
  const businessPartners = [...partners]
    .filter(partner => partner.active)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(partner => ({
      id: partner.id,
      name: partner.name,
      logo: partner.logo || brands.find(brand => brand.id === partner.brandId)?.logo || '',
      url: partner.url,
    }))
    .filter(partner => partner.logo)

  useEffect(() => {
    const sectionId = location.hash.slice(1)
    if (sectionId) requestAnimationFrame(() => document.getElementById(sectionId)?.scrollIntoView({ block: 'start' }))
  }, [location.hash])

  return (
    <div className="bg-white">
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-10 lg:py-14">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="font-ui text-[10px] tracking-[0.22em] uppercase font-700 mb-3" style={{ color: 'var(--nb-primary)' }}>OUR PARTNERS</div>
          <h1 className="font-display font-800 text-[28px] sm:text-[36px] leading-tight mb-3" style={{ color: NAVY }}>Our Partners</h1>
          <p className="font-ui text-[14px] leading-relaxed" style={{ color: 'var(--nb-text-secondary)' }}>Our authorised brands and business partners support industrial projects across Laos.</p>
        </div>

        <div id="brand-partners" className="scroll-mt-28">
          <div className="text-center mb-6">
            <h2 className="font-display font-700 text-[23px]" style={{ color: NAVY }}>Authorised Brand Partners</h2>
            <p className="font-ui text-[13px] mt-2" style={{ color: 'var(--nb-text-secondary)' }}>Trusted brands represented in our active product range.</p>
          </div>
          <LogoGrid ariaLabel="Authorised Brand Partners directory" items={brandPartners} />
        </div>

        <div id="business-partners" className="scroll-mt-28 mt-14 pt-12" style={{ borderTop: '1px solid var(--nb-border)' }}>
          <div className="text-center mb-6">
            <h2 className="font-display font-700 text-[23px]" style={{ color: NAVY }}>{t.footer.business_partners}</h2>
            <p className="font-ui text-[13px] mt-2" style={{ color: 'var(--nb-text-secondary)' }}>Our active business partners and authorized dealers.</p>
          </div>
          <LogoGrid ariaLabel={t.footer.business_partners} items={businessPartners} variant="business" />
        </div>
      </section>
    </div>
  )
}
