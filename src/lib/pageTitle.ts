/* Browser-tab titles per route. Paths are router paths, i.e. without the GitHub Pages base. */
export const SITE_TITLE = 'NB LAO — Industrial Equipment & Supply'

// Longest prefixes first, so /admin/login wins over /admin and /account/orders over /account.
const SECTION_TITLES: [string, string][] = [
  ['/admin/login', 'Admin Sign In'],
  ['/admin', 'Admin'],
  ['/account/orders', 'Order Details'],
  ['/account/quotations', 'Quotation Details'],
  ['/account', 'My Account'],
  ['/products', 'Products'],
  ['/cart', 'Cart'],
  ['/checkout', 'Checkout'],
  ['/rfq', 'Request a Quote'],
  ['/compare', 'Compare Products'],
  ['/services', 'Services'],
  ['/industries', 'Industries'],
  ['/privacy', 'Privacy Policy'],
  ['/terms', 'Terms'],
  ['/about', 'About Us'],
  ['/partners', 'Partners'],
  ['/contact', 'Contact'],
  ['/sales', 'Sales'],
  ['/login', 'Sign In'],
  ['/register', 'Create Account'],
  ['/forgot-password', 'Reset Password'],
]

export function pageTitleFor(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return SITE_TITLE
  const match = SECTION_TITLES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))
  return match ? `${match[1]} | NB LAO` : `Page Not Found | NB LAO`
}
