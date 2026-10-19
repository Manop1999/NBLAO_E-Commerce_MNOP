export interface Brand {
  id: string
  name: string
  nameEn: string
  nameLo: string
  logo: string
  active: boolean
  displayOrder: number
  websiteUrl: string
  description: string
}

export const DEFAULT_BRANDS: Brand[] = [
  { id: 'brand-siemens', name: 'Siemens', nameEn: 'Siemens', nameLo: '', logo: '/brands/siemens.svg', active: true, displayOrder: 1, websiteUrl: 'https://www.siemens.com', description: '' },
  { id: 'brand-abb', name: 'ABB', nameEn: 'ABB', nameLo: '', logo: '/brands/abb.svg', active: true, displayOrder: 2, websiteUrl: 'https://global.abb', description: '' },
  { id: 'brand-schneider-electric', name: 'Schneider Electric', nameEn: 'Schneider Electric', nameLo: '', logo: '/brands/schneider-electric.svg', active: true, displayOrder: 3, websiteUrl: 'https://www.se.com', description: '' },
  { id: 'brand-eaton', name: 'Eaton', nameEn: 'Eaton', nameLo: '', logo: '/brands/eaton.svg', active: true, displayOrder: 4, websiteUrl: 'https://www.eaton.com', description: '' },
  { id: 'brand-legrand', name: 'Legrand', nameEn: 'Legrand', nameLo: '', logo: '/brands/legrand.svg', active: true, displayOrder: 5, websiteUrl: 'https://www.legrand.com', description: '' },
  { id: 'brand-mitsubishi-electric', name: 'Mitsubishi Electric', nameEn: 'Mitsubishi Electric', nameLo: '', logo: '/brands/mitsubishi-electric.svg', active: true, displayOrder: 6, websiteUrl: 'https://www.mitsubishielectric.com', description: '' },
  { id: 'brand-bosch', name: 'Bosch', nameEn: 'Bosch', nameLo: '', logo: '/brands/bosch.svg', active: true, displayOrder: 7, websiteUrl: 'https://www.bosch.com', description: '' },
  { id: 'brand-fluke', name: 'Fluke', nameEn: 'Fluke', nameLo: '', logo: '/brands/fluke.svg', active: true, displayOrder: 8, websiteUrl: 'https://www.fluke.com', description: '' },
  { id: 'brand-3m', name: '3M', nameEn: '3M', nameLo: '', logo: '/brands/3m.svg', active: true, displayOrder: 9, websiteUrl: 'https://www.3m.com', description: '' },
  { id: 'brand-parker', name: 'Parker', nameEn: 'Parker', nameLo: '', logo: '/brands/parker.svg', active: true, displayOrder: 10, websiteUrl: 'https://www.parker.com', description: '' },
  { id: 'brand-festo', name: 'Festo', nameEn: 'Festo', nameLo: '', logo: '/brands/festo.svg', active: true, displayOrder: 11, websiteUrl: 'https://www.festo.com', description: '' },
  { id: 'brand-panasonic', name: 'Panasonic', nameEn: 'Panasonic', nameLo: '', logo: '/brands/panasonic.svg', active: true, displayOrder: 12, websiteUrl: 'https://www.panasonic.com', description: '' },
  { id: 'brand-honeywell', name: 'Honeywell', nameEn: 'Honeywell', nameLo: '', logo: '', active: false, displayOrder: 13, websiteUrl: 'https://www.honeywell.com', description: 'Product brand retained for existing product relationships.' },
  { id: 'brand-hilti', name: 'Hilti', nameEn: 'Hilti', nameLo: '', logo: '', active: false, displayOrder: 14, websiteUrl: 'https://www.hilti.com', description: 'Product brand retained for existing product relationships.' },
]

export const sortBrands = (brands: Brand[]) =>
  [...brands].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))

export const getActiveBrands = (brands: Brand[]) =>
  sortBrands(brands).filter((brand) => brand.active && Boolean(brand.logo))

export const getBrand = (brands: Brand[], brandId: string) =>
  brands.find((brand) => brand.id === brandId)

export const getBrandName = (brand: Brand | undefined, lang: 'en' | 'lo' | 'th' = 'en') => {
  if (!brand) return 'Unknown brand'
  return lang === 'lo' && brand.nameLo ? brand.nameLo : brand.nameEn || brand.name
}
