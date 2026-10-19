import { useState, useEffect } from "react"
import { useToast } from "./Toast"
import BrandLogo from "./BrandLogo"
import LanguageSwitcher from "./LanguageSwitcher"
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom"
import { useStore } from "../store"
import { useT } from "../i18n"
import { getWhatsAppUrl, publicUrl } from "../content"
import { CurrencySelector } from "../commerce/ui"
import { useCT } from "../commerce/text"
import LogoCarousel from "./LogoCarousel"

const NAVY = "var(--nb-navy)"
const BLUE = "var(--nb-primary)"
const BLUE_H = "var(--nb-primary-deep)"
const GOLD = "var(--nb-gold)"

// ─── Icons ───────────────────────────────────────────────────────────────────
const SearchIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)
const CartIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
)
const UserIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)
const HomeIcon = () => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />
  </svg>
)
const CategoriesIcon = () => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)
const FlameIcon = () => (
  <svg
    width="27"
    height="27"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M13.6 2.4c.5 3.5-1 5.3-2.7 6.9-1.2 1.1-2 2.5-2 4.3 0 2.1 1.4 3.9 3.3 4.5-1.1-1.4-1-3.6.2-5 .4 1.5 1.5 2.6 2.6 3.4.7-.8 1.1-1.9 1.1-3 0-1.9-1.1-3.4-2.1-4.8 1.1.7 2.1 1.8 2.7 3.1.5-1 .7-2.2.5-3.5 2.2 1.7 3.5 4.2 3.5 7 0 4.5-3.7 8.1-8.2 8.1s-8.1-3.6-8.1-8.1c0-3.6 2.1-6.2 4.3-8.4 1.9-1.9 3.6-3.5 4.8-5.6Z"
      fill="currentColor"
    />
    <path
      d="M12.2 21.7c-1.8 0-3.3-1.4-3.3-3.3 0-1 .5-2 1.4-2.8.1 1.3.8 2.4 2 3.1.5-.7.7-1.5.7-2.4 1.5 1 2.4 2.4 2.4 3.8 0 .9-.4 1.6-.9 2.2-.7.3-1.5.5-2.3.5Z"
      fill="#fff2b8"
    />
  </svg>
)
const MenuIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)
const XIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const PhoneIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.37a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6z" />
  </svg>
)
const MailIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
)
const MapPinIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
)
const ChevronDown = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const NAV_ITEMS = [
  { labelKey: "home", to: "/" },
  { labelKey: "products", to: "/products" },
  { labelKey: "industries", to: "/industries" },
  { labelKey: "services", to: "/services" },
  { labelKey: "about", to: "/about" },
  { labelKey: "brands", to: "/partners" },
  { labelKey: "contact", to: "/contact" },
]

// ─── Logo ────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <Link to="/" className="flex items-center shrink-0 no-underline" aria-label="NB Lao home">
      <BrandLogo className="h-8 sm:h-10 lg:h-11" />
    </Link>
  )
}

function LangSwitcherHeader() {
  return <LanguageSwitcher />
}

// ─── Mobile Nav Drawer ────────────────────────────────────────────────────────
function MobileDrawer({ t }: { t: ReturnType<typeof useT> }) {
  const { activeDrawer, setActiveDrawer, lang, setLang } = useStore()
  const ct = useCT()
  const open = activeDrawer === "nav"
  const onClose = () => setActiveDrawer(null)

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open])

  const navLinks = NAV_ITEMS.filter(
    (i) => i.labelKey !== "home" && i.labelKey !== "products",
  )
  const navT = t.nav as Record<string, string>

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60]"
        style={{
          background: "rgba(0,0,0,0.45)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 200ms ease-out",
        }}
        onClick={onClose}
      />

      {/* Drawer — slides from left */}
      <div
        className="fixed top-0 left-0 bottom-0 z-[70] flex flex-col w-[300px] max-w-[86vw]"
        style={{
          background: "#fff",
          boxShadow: "4px 0 24px rgba(0,0,0,0.18)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          visibility: open ? "visible" : "hidden",
          transition: `transform 300ms ease-out, visibility 0s linear ${open ? "0s" : "300ms"}`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--nb-border)" }}
        >
          <Logo />
          <button onClick={onClose} className="p-1" style={{ color: NAVY }}>
            <XIcon />
          </button>
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto">
          {/* Home */}
          <NavLink
            to="/"
            end
            onClick={onClose}
            className={({ isActive }) => `nb-drawer-link${isActive ? " is-active" : ""}`}
          >
            {t.nav.home}
          </NavLink>

          <NavLink
            to="/products"
            onClick={onClose}
            className={({ isActive }) => `nb-drawer-link${isActive ? " is-active" : ""}`}
          >
            {t.nav.products}
          </NavLink>

          {/* Remaining nav items */}
          {navLinks.map((item) => (
            <NavLink
              key={item.labelKey}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `nb-drawer-link${isActive ? " is-active" : ""}`}
            >
              {navT[item.labelKey]}
            </NavLink>
          ))}
          <NavLink
            to="/account"
            onClick={onClose}
            className={({ isActive }) => `nb-drawer-link${isActive ? " is-active" : ""}`}
          >
            {t.nav.account}
          </NavLink>
        </div>

        <div className="px-5 pt-4 pb-2" style={{ borderTop: "1px solid var(--nb-border)" }}>
          <div className="font-ui text-[11px] font-600 mb-2" style={{ color: "var(--nb-text-secondary)" }}>
            {ct.currency}
          </div>
          <CurrencySelector variant="drawer" />
        </div>
        {/* Persistent language control */}
        <div
          className="px-5 pt-4"
          style={{
            borderTop: "1px solid var(--nb-border)",
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
          }}
        >
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div
              className="font-ui text-[11px] font-600"
              style={{ color: "var(--nb-text-secondary)" }}
            >
              {t.language.label}
            </div>
            <LanguageSwitcher variant="drawer" />
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────
export function Header() {
  const [search, setSearch] = useState("")
  const { cartCount, setActiveDrawer, customerService } = useStore()
  const navigate = useNavigate()
  const t = useT()
  const navT = t.nav as Record<string, string>
  const { addToast } = useToast()

  useEffect(() => {
    const onVariantRequired = (e: Event) => {
      const id = (e as CustomEvent<{ id: number }>).detail?.id
      addToast("Please choose product options first", "info")
      if (id != null) navigate(`/products/${id}`)
    }
    window.addEventListener("nblao:variant-required", onVariantRequired)
    return () => window.removeEventListener("nblao:variant-required", onVariantRequired)
  }, [addToast, navigate])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/products?search=${encodeURIComponent(search.trim())}`)
      setSearch("")
    }
  }

  return (
    <>
      {/* ── Utility bar — DESKTOP ONLY ──────────────────────────────────────── */}
      <div className="hidden xl:block" style={{ background: "#0080FF" }}>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-[7px] flex items-center justify-between">
          <div className="flex items-center gap-5">
            <a
              href={`tel:${customerService.phone.replace(/\s/g, "")}`}
              className="flex items-center gap-1.5 font-ui text-[11px]"
              style={{ color: NAVY }}
            >
              <PhoneIcon /> {customerService.phone}
            </a>
            <a
              href={`mailto:${customerService.email}`}
              className="flex items-center gap-1.5 font-ui text-[11px]"
              style={{ color: NAVY }}
            >
              <MailIcon /> {customerService.email}
            </a>
          </div>
          <div className="flex items-center gap-4">
            <span
              className="font-ui text-[10px] tracking-[0.16em] uppercase"
              style={{ color: NAVY }}
            >
              Industrial Supply · Vientiane, Laos PDR
            </span>
            <Link
              to="/admin"
              className="font-ui text-[10px] tracking-wide"
              style={{ color: NAVY }}
            >
              {t.nav.admin}
            </Link>
          </div>
        </div>
      </div>

      <header
        className="sticky top-0 left-0 right-0 z-[60]"
        style={{ boxShadow: "0 1px 0 var(--nb-border)" }}
      >
        {/* ── Main header ──────────────────────────────────────────────────────── */}
        <div
          className="bg-white relative"
          style={{ borderBottom: "1px solid #eaecf0" }}
        >
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
            {/* Header row */}
            <div className="flex items-center h-[56px] xl:h-[62px] gap-2 sm:gap-3 lg:gap-6">
              <button
                className="xl:hidden shrink-0"
                style={{ color: NAVY }}
                onClick={() => setActiveDrawer("nav")}
                aria-label="Open navigation"
              >
                <MenuIcon />
              </button>
              <Logo />

              <form
                onSubmit={handleSearch}
                className="xl:hidden flex-1 min-w-0"
              >
                <div
                  className="rounded-lg flex items-center gap-1.5 px-2 h-8 sm:h-9"
                  style={{
                    border: "1px solid var(--nb-border)",
                    background: "var(--nb-bg)",
                  }}
                >
                  <span className="text-[#94a3b8] shrink-0" aria-hidden="true">
                    <SearchIcon />
                  </span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t.header.search_placeholder}
                    className="rounded-md w-full min-w-0 bg-transparent font-ui text-[11px] sm:text-[13px] outline-none"
                    style={{ color: NAVY }}
                  />
                </div>
              </form>

              {/* Desktop nav */}
              <nav className="hidden xl:flex items-center gap-0 flex-1 justify-center">
                {NAV_ITEMS.map((item) => (
                  <div key={item.labelKey} className="relative">
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => `nb-nav-link${isActive ? " is-active" : ""}`}
                      end={item.to === "/"}
                    >
                      {navT[item.labelKey]}
                    </NavLink>
                  </div>
                ))}
              </nav>

              {/* Desktop actions: Search + Account + Cart + Lang */}
              <div className="hidden xl:flex items-center gap-3 shrink-0">
                {/* Persistent search box */}
                <form onSubmit={handleSearch} className="shrink-0">
                  <div
                    className="rounded-lg flex items-center gap-2 px-3 py-1.5 w-[240px]"
                    style={{
                      border: "1px solid var(--nb-border)",
                      background: "var(--nb-bg)",
                    }}
                  >
                    <span className="text-[#94a3b8] shrink-0">
                      <SearchIcon />
                    </span>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t.header.search_placeholder}
                      className="rounded-md flex-1 bg-transparent font-ui text-[13px] outline-none"
                      style={{ color: NAVY }}
                    />
                  </div>
                </form>
                <Link
                  to="/account"
                  className="text-[#94a3b8] hover:text-[var(--nb-navy)] transition-colors"
                >
                  <UserIcon />
                </Link>
                <Link
                  to="/cart"
                  className="relative text-[#94a3b8] hover:text-[var(--nb-navy)] transition-colors"
                >
                  <CartIcon />
                  {cartCount > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-white text-[9px] font-700 rounded-full"
                      style={{ background: BLUE }}
                    >
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </Link>
                {/* Language switcher — replaces RFQ button */}
                <CurrencySelector />
                <LangSwitcherHeader />
              </div>

              <div className="xl:hidden flex items-center gap-2 shrink-0">
                <Link
                  to="/account"
                  className="hidden md:flex w-9 h-9 items-center justify-center shrink-0"
                  style={{ color: "#94a3b8" }}
                  aria-label={t.nav.account}
                >
                  <UserIcon />
                </Link>
                <Link
                  to="/cart"
                  className="relative w-9 h-9 flex items-center justify-center shrink-0"
                  style={{ color: "#94a3b8" }}
                  aria-label={t.nav.cart}
                >
                  <CartIcon />
                  {cartCount > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center text-white text-[9px] font-700 rounded-full"
                      style={{ background: BLUE }}
                    >
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </Link>
                <div className="hidden md:block">
                  <LangSwitcherHeader />
                </div>
                <div className="hidden md:block">
                  <CurrencySelector />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile/tablet drawer */}
        <MobileDrawer t={t} />
      </header>
    </>
  )
}

function MobileBottomNavigation() {
  const { cartCount } = useStore()
  const t = useT()
  const items = [
    { label: t.nav.home, to: "/", icon: <HomeIcon />, end: true },
    {
      label: t.products.all_categories,
      to: "/products",
      icon: <CategoriesIcon />,
    },
    { label: "SALES", to: "/sales", icon: <FlameIcon />, sales: true },
    { label: t.nav.cart, to: "/cart", icon: <CartIcon />, count: cartCount },
    { label: t.nav.account, to: "/account", icon: <UserIcon /> },
  ]

  return (
    <nav
      className="mobile-bottom-navigation fixed inset-x-0 bottom-0 z-50 md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="mobile-bottom-navigation__items">
        {items.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `mobile-bottom-navigation__item${
                item.sales ? " mobile-bottom-navigation__item--sales" : ""
              }${isActive ? " is-active" : ""}`
            }
            aria-label={item.label}
          >
            {item.sales ? (
              <>
                <span className="mobile-bottom-navigation__sales-badge">
                  {item.icon}
                </span>
                <span className="mobile-bottom-navigation__sales-label">
                  {item.label}
                </span>
              </>
            ) : (
              <>
                <span className="mobile-bottom-navigation__icon">
                  {item.icon}
                  {item.count && item.count > 0 ? (
                    <span className="mobile-bottom-navigation__count">
                      {item.count > 9 ? "9+" : item.count}
                    </span>
                  ) : null}
                </span>
                <span className="mobile-bottom-navigation__label">
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function FooterSection({
  title,
  children,
  alwaysOpen = false,
}: {
  title: string
  children: React.ReactNode
  alwaysOpen?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      className="md:border-none"
    >
      {!alwaysOpen && (
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between py-3 md:hidden"
          style={{ background: "transparent", color: "#fff" }}
        >
          <span className="font-display font-700 text-[11px] tracking-[0.18em] uppercase">
            {title}
          </span>
          <span
            style={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          >
            <ChevronDown size={14} />
          </span>
        </button>
      )}
      <h4
        className={`${
          alwaysOpen ? "block pt-4 md:pt-0" : "hidden md:block"
        } font-display font-700 text-[11px] tracking-[0.18em] uppercase mb-3 text-white`}
      >
        {title}
      </h4>
      <div className={open || alwaysOpen ? "pb-3" : ""}>
        <div className={`md:block ${open || alwaysOpen ? "block" : "hidden"}`}>
          {children}
        </div>
      </div>
    </div>
  )
}

function WhatsAppIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  )
}

function ContactChannelIcon({
  channel,
}: {
  channel: "whatsapp" | "line" | "facebook" | "wechat" | "tiktok"
}) {
  if (channel === "facebook")
    return (
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
      </svg>
    )
  if (channel === "tiktok")
    return (
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    )
  if (channel === "whatsapp") return <WhatsAppIcon size={18} />
  if (channel === "wechat")
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z" />
      </svg>
    )
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  )
}

export function Footer() {
  const t = useT()
  const location = useLocation()
  const { customerService, partners, brands, lang } = useStore()
  const activePartners = [...partners]
    .filter((partner) => partner.active)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((partner) => ({
      ...partner,
      resolvedLogo:
        partner.logo ||
        brands.find((brand) => brand.id === partner.brandId)?.logo ||
        "",
    }))
    .filter((partner) => partner.resolvedLogo)
  const address =
    lang === "lo" && customerService.addressLo
      ? customerService.addressLo
      : customerService.addressEn
  const socialLinks = [
    {
      label: "WhatsApp",
      channel: "whatsapp" as const,
      url: getWhatsAppUrl(customerService.whatsapp),
    },
    { label: "LINE", channel: "line" as const, url: publicUrl(customerService.line) },
    {
      label: "Facebook",
      channel: "facebook" as const,
      url: publicUrl(customerService.facebook),
    },
    {
      label: "WeChat",
      channel: "wechat" as const,
      url: publicUrl(customerService.wechat),
    },
    {
      label: "TikTok",
      channel: "tiktok" as const,
      url: publicUrl(customerService.tiktok),
    },
  ].filter((item) => item.url)
  return (
    <footer style={{ background: "var(--nb-navy)", color: "#b8c8d8" }}>
      <div
        className="h-[2px]"
        style={{
          background: `linear-gradient(90deg, ${GOLD} 0%, var(--nb-gold-deep) 30%, transparent 100%)`,
        }}
      />

      {location.pathname !== "/partners" && location.pathname !== "/" && activePartners.length > 0 && (
        <div
          className="bg-white"
          style={{ borderBottom: "1px solid var(--nb-border)" }}
        >
          <div className="max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-12 py-4 sm:py-5">
            <div className="flex items-center justify-between gap-4 mb-1.5 sm:mb-2">
              <h3
                className="font-display font-700 text-[11px] tracking-[0.18em] uppercase"
                style={{ color: NAVY }}
              >
                {t.footer.business_partners}
              </h3>
              <Link
                to="/partners#business-partners"
                className="font-ui text-[10px] no-underline"
                style={{ color: BLUE }}
              >
                {t.common.view_all} →
              </Link>
            </div>
            <LogoCarousel
              variant="business"
              limit={10}
              ariaLabel={t.footer.business_partners}
              items={activePartners.map((partner) => ({
                id: partner.id,
                name: partner.name,
                logo: partner.resolvedLogo,
                url: partner.url,
              }))}
            />
          </div>
        </div>
      )}

      <div className="max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-12 py-8 lg:py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[200px_1fr_1fr_1fr_1.35fr] gap-0 md:gap-8 lg:gap-9">
          {/* Brand */}
          <div className="mb-6 md:mb-0">
            <div className="mb-4">
              <BrandLogo onDark className="h-10" />
            </div>
            <p className="font-ui text-[12px] leading-[1.7] mb-4">
              {t.footer.tagline}
            </p>
          </div>

          {/* Products */}
          <FooterSection title={t.footer.products}>
            <ul className="flex flex-col gap-1.5">
              {[
                "Electrical Equipment",
                "Industrial Machinery",
                "Power & Energy",
                "Tools & Equipment",
                "Safety & Fire Protection",
                "Cables & Accessories",
              ].map((item) => (
                <li key={item}>
                  <Link
                    to={`/products?category=${encodeURIComponent(item)}`}
                    className="font-ui text-[12px] hover:text-white transition-colors no-underline"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </FooterSection>

          {/* Company */}
          <FooterSection title={t.footer.company}>
            <ul className="flex flex-col gap-1.5">
              {[
                { label: t.footer.about, to: "/about" },
                { label: t.footer.industries, to: "/industries" },
                { label: t.footer.our_services, to: "/services" },
                { label: t.footer.brand_partners, to: "/partners" },
                { label: t.footer.contact, to: "/contact" },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="font-ui text-[12px] hover:text-white transition-colors no-underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </FooterSection>

          {/* Quick Access */}
          <FooterSection title={t.footer.quick_access}>
            <ul className="flex flex-col gap-1.5">
              {[
                { label: t.footer.rfq, to: "/rfq" },
                { label: t.footer.my_orders, to: "/account?tab=orders" },
                {
                  label: t.footer.my_quotations,
                  to: "/account?tab=quotations",
                },
                { label: t.footer.wishlist, to: "/account?tab=wishlist" },
                { label: t.footer.support, to: "/contact" },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="font-ui text-[12px] hover:text-white transition-colors no-underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </FooterSection>

          <FooterSection title={t.footer.customer_service} alwaysOpen>
            <div className="flex flex-col gap-2">
              {publicUrl(customerService.mapUrl) ? (
                <a
                  href={publicUrl(customerService.mapUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-2 font-ui text-[12px] hover:text-white"
                >
                  <span className="mt-0.5 shrink-0" style={{ color: GOLD }}>
                    <MapPinIcon />
                  </span>
                  {address}
                </a>
              ) : (
                <span className="flex items-start gap-2 font-ui text-[12px]">
                  <span className="mt-0.5 shrink-0" style={{ color: GOLD }}>
                    <MapPinIcon />
                  </span>
                  {address}
                </span>
              )}
              {customerService.phone && (
                <a
                  href={`tel:${customerService.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-2 font-ui text-[12px] hover:text-white"
                >
                  <span style={{ color: GOLD }}>
                    <PhoneIcon />
                  </span>
                  {customerService.phone}
                </a>
              )}
              {customerService.email && (
                <a
                  href={`mailto:${customerService.email}`}
                  className="flex items-center gap-2 font-ui text-[12px] hover:text-white"
                >
                  <span style={{ color: GOLD }}>
                    <MailIcon />
                  </span>
                  {customerService.email}
                </a>
              )}
              {socialLinks.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {socialLinks.map((item) => {
                    return (
                      <a
                        key={item.label}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={item.label}
                        title={item.label}
                        className="footer-social-link h-9 w-9 flex items-center justify-center rounded-full text-white no-underline"
                      >
                        <ContactChannelIcon channel={item.channel} />
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          </FooterSection>
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-[1440px] mx-auto px-5 sm:px-6 lg:px-12 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-ui text-[11px]" data-i18n-skip>
            © {new Date().getFullYear()} NB Lao Sole Co., Ltd. {t.footer.rights}
          </p>
          <div className="flex gap-5">
            <Link
              to="/privacy"
              className="font-ui text-[11px] hover:text-white transition-colors no-underline"
            >
              {t.footer.privacy}
            </Link>
            <Link
              to="/terms"
              className="font-ui text-[11px] hover:text-white transition-colors no-underline"
            >
              {t.footer.terms}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

function WhatsAppButton() {
  const { customerService } = useStore()
  const url = getWhatsAppUrl(customerService.whatsapp)
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="whatsapp-float fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] sm:right-6 sm:bottom-6 z-40 w-[64px] h-[64px] sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center text-white shadow-xl"
      aria-label="Contact us on WhatsApp"
    >
      <WhatsAppIcon size={36} />
    </a>
  )
}

export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col pb-[84px] md:pb-0">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
      <MobileBottomNavigation />
    </div>
  )
}

export default PageLayout
