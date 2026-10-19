export interface Advertisement {
  id: string
  placement: 'main' | 'side'
  titleEn: string
  titleLo: string
  descriptionEn: string
  descriptionLo: string
  ctaEn: string
  ctaLo: string
  image: string
  destinationUrl: string
  active: boolean
  displayOrder: number
  startDate: string
  endDate: string
}

export interface CustomerServiceSettings {
  addressEn: string
  addressLo: string
  mapUrl: string
  phone: string
  email: string
  whatsapp: string
  line: string
  facebook: string
  wechat: string
  tiktok: string
  /** set once an Admin saves the form; stops defaults from being applied over their choices */
  userConfigured?: boolean
}

export interface Partner {
  id: string
  name: string
  logo: string
  brandId?: string
  url: string
  active: boolean
  displayOrder: number
}

export type LeadershipSection = 'owner' | 'management' | 'expertise' | 'team'

export interface LeadershipItem {
  id: string
  section: LeadershipSection
  image: string
  nameEn: string
  nameLo: string
  positionEn: string
  positionLo: string
  titleEn: string
  titleLo: string
  descriptionEn: string
  descriptionLo: string
  messageEn: string
  messageLo: string
  active: boolean
  displayOrder: number
}

export const LEGACY_DEFAULT_AD_ID = 'ad-power-solutions'

const campaign = (n: number): Advertisement => ({
  id: `ad-campaign-00${n}`,
  placement: 'main',
  titleEn: `Campaign ${n}`,
  titleLo: '',
  descriptionEn: '',
  descriptionLo: '',
  ctaEn: '',
  ctaLo: '',
  image: `/advertisements/test00${n}.png`,
  destinationUrl: '',
  active: true,
  displayOrder: n,
  startDate: '',
  endDate: '',
})

export const DEFAULT_ADVERTISEMENTS: Advertisement[] = [campaign(1), campaign(2), campaign(3)]

export const DEFAULT_CUSTOMER_SERVICE: CustomerServiceSettings = {
  addressEn: '123 Industrial Zone, Saysettha, Vientiane, Laos PDR',
  addressLo: '123 ເຂດອຸດສາຫະກຳ, ໄຊເສດຖາ, ວຽງຈັນ, ສປປ ລາວ',
  mapUrl: '',
  phone: '+856 20 5237 1258',
  email: 'info@nblaosolelao.com',
  whatsapp: '+8562052371258',
  line: '',
  facebook: '',
  wechat: '',
  tiktok: '',
}

export const DEFAULT_PARTNERS: Partner[] = [
  { id: 'partner-siemens', name: 'Siemens', logo: '', brandId: 'brand-siemens', url: '', active: true, displayOrder: 1 },
  { id: 'partner-abb', name: 'ABB', logo: '', brandId: 'brand-abb', url: '', active: true, displayOrder: 2 },
  { id: 'partner-schneider', name: 'Schneider Electric', logo: '', brandId: 'brand-schneider-electric', url: '', active: true, displayOrder: 3 },
  { id: 'partner-eaton', name: 'Eaton', logo: '', brandId: 'brand-eaton', url: '', active: true, displayOrder: 4 },
  { id: 'partner-legrand', name: 'Legrand', logo: '', brandId: 'brand-legrand', url: '', active: true, displayOrder: 5 },
  { id: 'partner-mitsubishi', name: 'Mitsubishi Electric', logo: '', brandId: 'brand-mitsubishi-electric', url: '', active: true, displayOrder: 6 },
]

export const DEFAULT_LEADERSHIP: LeadershipItem[] = [
  {
    id: 'leader-bounkhong',
    section: 'team',
    image: '/site-images/345e73efccf1.jpg',
    nameEn: 'Mr. Bounkhong Phommasack',
    nameLo: '',
    positionEn: 'Chief Executive Officer',
    positionLo: '',
    titleEn: '',
    titleLo: '',
    descriptionEn: '',
    descriptionLo: '',
    messageEn: '',
    messageLo: '',
    active: true,
    displayOrder: 1,
  },
  {
    id: 'leader-khamla',
    section: 'team',
    image: '/site-images/649924e68bdf.jpg',
    nameEn: 'Ms. Khamla Sysouphanh',
    nameLo: '',
    positionEn: 'Head of Sales & Partnerships',
    positionLo: '',
    titleEn: '',
    titleLo: '',
    descriptionEn: '',
    descriptionLo: '',
    messageEn: '',
    messageLo: '',
    active: true,
    displayOrder: 2,
  },
  {
    id: 'leader-somphong',
    section: 'team',
    image: '/site-images/20c1d8176894.jpg',
    nameEn: 'Mr. Somphong Viravong',
    nameLo: '',
    positionEn: 'Technical Director',
    positionLo: '',
    titleEn: '',
    titleLo: '',
    descriptionEn: '',
    descriptionLo: '',
    messageEn: '',
    messageLo: '',
    active: true,
    displayOrder: 3,
  },
  {
    id: 'leader-naly',
    section: 'team',
    image: '/site-images/a635d4424526.jpg',
    nameEn: 'Ms. Naly Keovongsa',
    nameLo: '',
    positionEn: 'Operations Manager',
    positionLo: '',
    titleEn: '',
    titleLo: '',
    descriptionEn: '',
    descriptionLo: '',
    messageEn: '',
    messageLo: '',
    active: true,
    displayOrder: 4,
  },
]

export const getActiveAdvertisements = (advertisements: Advertisement[], now = new Date()) =>
  [...advertisements]
    .filter((ad) => {
      if (!ad.active) return false
      const starts = !ad.startDate || new Date(`${ad.startDate}T00:00:00`) <= now
      const ends = !ad.endDate || new Date(`${ad.endDate}T23:59:59`) >= now
      return starts && ends
    })
    .sort((a, b) => a.displayOrder - b.displayOrder)

export const normalizePhone = (phone: string) => phone.replace(/[^\d]/g, '')

export const isValidHttpUrl = (value: string) => {
  try {
    const u = new URL(value.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** E.164 allows at most 15 digits; fewer than 8 cannot be a dialable international number. */
export const isValidPhone = (value: string) => {
  const digits = normalizePhone(value)
  return /^[+\d\s().-]+$/.test(value.trim()) && digits.length >= 8 && digits.length <= 15
}

export const getWhatsAppUrl = (value: string) => {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return isValidHttpUrl(trimmed) ? trimmed : ''
  if (!isValidPhone(trimmed)) return ''
  return `https://wa.me/${normalizePhone(trimmed)}`
}

/** Public links must be real http(s) URLs; anything else (blank, javascript:, junk) is dropped. */
export const publicUrl = (value: string) => (value && isValidHttpUrl(value) ? value.trim() : '')

export function validateCustomerService(form: CustomerServiceSettings): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!form.phone.trim()) errors.phone = 'Enter a phone number.'
  else if (!isValidPhone(form.phone)) errors.phone = 'Use 8–15 digits, optionally starting with +.'
  if (!form.email.trim()) errors.email = 'Enter an email address.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
  if (form.whatsapp.trim() && !getWhatsAppUrl(form.whatsapp)) errors.whatsapp = 'Enter an international number such as +8562052371258, or an https://wa.me/… link.'
  for (const key of ['mapUrl', 'line', 'facebook', 'wechat', 'tiktok'] as const) {
    if (form[key].trim() && !isValidHttpUrl(form[key])) errors[key] = 'Enter a full link starting with https://'
  }
  return errors
}

/**
 * Applies new defaults to settings that were persisted before an Admin ever saved them.
 * Non-empty values are never replaced; an Admin-saved record is returned untouched.
 */
export function migrateCustomerService(stored: CustomerServiceSettings): CustomerServiceSettings {
  if (stored.userConfigured) return stored
  const next = { ...DEFAULT_CUSTOMER_SERVICE, ...stored }
  if (!stored.whatsapp?.trim()) next.whatsapp = DEFAULT_CUSTOMER_SERVICE.whatsapp
  if (stored.phone === '+856 20 5555 6789') next.phone = DEFAULT_CUSTOMER_SERVICE.phone
  return next
}
