import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { ORDERS, QUOTATIONS } from '../data'
import { useAuth } from '../auth'
import { useToast } from '../components/Toast'
import { ConfirmModal } from '../components/Modal'
import { getBrandName } from '../brands'
import { AddressBook, LoyaltyPanel, StoredOrders, useMyOrders, useMyPoints, OrderStatusBadge, orderMoney } from '../commerce/AccountPanels'
import { ProductPrice } from '../commerce/ui'
import { useCommerce } from '../commerce/CommerceProvider'
import { useCT } from '../commerce/text'
import { assetUrl } from '../lib/assetUrl'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const GOLD = 'var(--nb-gold)'

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
)
const OrderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
)
const QuoteIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)
const HeartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)
const AddressIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
)
const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)
const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const NAV_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: <UserIcon /> },
  { id: 'orders', label: 'My Orders', icon: <OrderIcon /> },
  { id: 'quotations', label: 'Quotations', icon: <QuoteIcon /> },
  { id: 'wishlist', label: 'Wishlist', icon: <HeartIcon /> },
  { id: 'profile', label: 'My Profile', icon: <AddressIcon /> },
  { id: 'password', label: 'Change Password', icon: <LockIcon /> },
]

const STATUS_COLORS: Record<string, string> = {
  'Delivered': '#16a34a',
  'Processing': 'var(--nb-primary)',
  'Pending': '#d97706',
  'Cancelled': '#ef4444',
  'Quoted': '#7c3aed',
  'Accepted': '#16a34a',
  'Rejected': '#ef4444',
  'Expired': '#94a3b8',
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#94a3b8'
  return (
    <span className="rounded-sm font-ui text-[10px] font-700 tracking-wide px-2.5 py-1" style={{ background: `${color}18`, color }}>
      {status}
    </span>
  )
}

function Dashboard() {
  const { wishlist } = useStore()
  const stored = useMyOrders()
  const points = useMyPoints()
  return (
    <div>
      <h2 className="font-display font-700 text-[22px] mb-6" style={{ color: NAVY }}>Account Dashboard</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Orders', value: ORDERS.length + stored.length, color: BLUE },
          { label: 'Active Quotations', value: 2, color: '#7c3aed' },
          { label: 'Wishlist Items', value: wishlist.length, color: '#d97706' },
          { label: 'Loyalty Points', value: points.toLocaleString(), color: GOLD },
        ].map(s => (
          <div key={s.label} className="rounded-lg bg-white p-5" style={{ border: '1px solid var(--nb-border)' }}>
            <div className="font-display font-800 text-[28px] leading-none mb-1" style={{ color: s.color }}>{s.value}</div>
            <div className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-700 text-[16px]" style={{ color: NAVY }}>Recent Orders</h3>
        </div>
        {stored.length > 0 && (
          <div className="rounded-lg bg-white mb-3" style={{ border: '1px solid var(--nb-border)' }}>
            {stored.slice(0, 3).map(o => (
              <div key={o.id} className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
                <div>
                  <div className="font-ui text-[13px] font-600" style={{ color: NAVY }}>{o.id}</div>
                  <div className="font-ui text-[11px]" style={{ color: '#8f9faf' }}>{o.createdAt.slice(0, 10)} · {o.currency}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-display font-700 text-[14px]" style={{ color: NAVY }}>{orderMoney(o, o.totalMinor)}</span>
                  <OrderStatusBadge status={o.status} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-lg bg-white" style={{ border: '1px solid var(--nb-border)' }}>
          {ORDERS.slice(0, 3).map(order => (
            <div key={order.id} className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
              <div>
                <div className="font-ui text-[13px] font-600" style={{ color: NAVY }}>{order.id}</div>
                <div className="font-ui text-[11px]" style={{ color: '#8f9faf' }}>{order.date} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-display font-700 text-[14px]" style={{ color: NAVY }}>${order.total.toLocaleString()} USD</span>
                <StatusBadge status={order.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/products" className="rounded-md p-4 bg-white no-underline hover:bg-[var(--nb-surface)] transition-colors" style={{ border: '1px solid var(--nb-border)' }}>
          <div className="font-display font-700 text-[14px] mb-1" style={{ color: NAVY }}>Browse Products</div>
          <div className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>Explore our full catalogue</div>
        </Link>
        <Link to="/rfq" className="rounded-md p-4 bg-white no-underline hover:bg-[var(--nb-surface)] transition-colors" style={{ border: '1px solid var(--nb-border)' }}>
          <div className="font-display font-700 text-[14px] mb-1" style={{ color: NAVY }}>Request a Quote</div>
          <div className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>Get competitive pricing</div>
        </Link>
      </div>
    </div>
  )
}

function Orders() {
  return (
    <div>
      <h2 className="font-display font-700 text-[22px] mb-4" style={{ color: NAVY }}>My Orders</h2>
      <StoredOrders />
      <div className="rounded-lg bg-white" style={{ border: '1px solid var(--nb-border)' }}>
        {/* Desktop header */}
        <div className="hidden md:grid grid-cols-[1fr_90px_80px_110px_80px_100px] px-5 py-3 font-ui text-[10px] font-700 tracking-widest uppercase"
          style={{ borderBottom: '1px solid var(--nb-border)', color: '#8f9faf', background: 'var(--nb-surface)' }}>
          <span>Order</span><span>Date</span><span>Items</span><span className="text-right">Total</span><span className="text-right">Status</span><span className="text-right">Action</span>
        </div>
        {ORDERS.map(order => (
          <div key={order.id}>
            {/* Desktop row */}
            <div className="hidden md:grid grid-cols-[1fr_90px_80px_110px_80px_100px] items-center px-5 py-3.5 gap-2" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
              <div>
                <div className="font-display font-700 text-[13px]" style={{ color: NAVY }}>{order.id}</div>
                <div className="font-ui text-[11px] mt-0.5 truncate" style={{ color: '#8f9faf' }}>
                  {order.items.map(i => i.name).join(', ')}
                </div>
              </div>
              <div className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>{order.date}</div>
              <div className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</div>
              <div className="font-display font-700 text-[14px] text-right" style={{ color: NAVY }}>${order.total.toLocaleString()} USD</div>
              <div className="text-right"><StatusBadge status={order.status} /></div>
              <div className="text-right">
                <Link to={`/account/orders/${order.id}`} className="rounded-sm font-ui text-[11px] font-600 no-underline px-3 py-1.5" style={{ background: BLUE, color: '#fff' }}>
                  Details →
                </Link>
              </div>
            </div>

            {/* Mobile compact card */}
            <div className="md:hidden px-4 py-3" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-display font-700 text-[13px]" style={{ color: NAVY }}>{order.id}</div>
                  <div className="font-ui text-[11px] mt-0.5" style={{ color: '#8f9faf' }}>{order.date} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}</div>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-display font-700 text-[15px]" style={{ color: NAVY }}>${order.total.toLocaleString()} USD</span>
                <Link to={`/account/orders/${order.id}`} className="rounded-sm font-ui text-[11px] font-600 no-underline px-3 py-1.5" style={{ background: BLUE, color: '#fff' }}>
                  View Details →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Quotations() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-700 text-[22px]" style={{ color: NAVY }}>My Quotations</h2>
        <Link to="/rfq" className="rounded-md font-ui text-[12px] font-600 px-3 py-2 text-white no-underline" style={{ background: BLUE }}>New RFQ</Link>
      </div>
      <div className="rounded-lg bg-white" style={{ border: '1px solid var(--nb-border)' }}>
        {QUOTATIONS.map(q => (
          <div key={q.id} style={{ borderBottom: '1px solid var(--nb-border)' }}>
            {/* Summary row */}
            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="min-w-0">
                  <div className="font-display font-700 text-[13px]" style={{ color: NAVY }}>{q.id}</div>
                  <div className="font-ui text-[11px] mt-0.5 truncate" style={{ color: '#8f9faf' }}>
                    {q.items.map(i => i.name).join(', ')}
                  </div>
                </div>
                <StatusBadge status={q.status} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <div>
                  <span className="font-display font-700 text-[15px]" style={{ color: NAVY }}>${q.total.toLocaleString()}</span>
                  <span className="font-ui text-[11px] ml-2" style={{ color: q.status === 'Expired' ? '#ef4444' : '#8f9faf' }}>
                    Valid: {q.validUntil}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {q.status === 'Quoted' && (
                    <button className="rounded-sm font-ui text-[11px] font-600 px-3 py-1.5 text-white" style={{ background: '#16a34a' }}>Accept</button>
                  )}
                  <Link to={`/account/quotations/${q.id}`} className="rounded-sm font-ui text-[11px] font-600 px-3 py-1.5 text-white no-underline" style={{ background: BLUE }}>
                    View →
                  </Link>
                </div>
              </div>
            </div>

            {/* Items detail — desktop scrollable */}
            <div className="px-4 pb-3 overflow-x-auto" style={{ background: 'var(--nb-surface)' }}>
              {q.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-1.5 min-w-0">
                  <span className="font-ui text-[11px] flex-1 min-w-0 truncate" style={{ color: 'var(--nb-text-secondary)' }}>{item.name}</span>
                  <span className="font-ui text-[11px] shrink-0" style={{ color: '#8f9faf' }}>×{item.qty}</span>
                  <span className="font-ui text-[11px] shrink-0" style={{ color: 'var(--nb-text-secondary)' }}>${item.unitPrice.toLocaleString()}/u</span>
                  <span className="font-ui text-[11px] font-600 shrink-0" style={{ color: NAVY }}>${item.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Wishlist() {
  const { wishlist, toggleWishlist, addToCart, getBrandById, lang, products } = useStore()
  const items = products.filter(p => wishlist.includes(p.id))
  const { priceFor } = useCommerce()

  if (items.length === 0) {
    return (
      <div>
        <h2 className="font-display font-700 text-[22px] mb-6" style={{ color: NAVY }}>My Wishlist</h2>
        <div className="rounded-lg bg-white py-16 text-center" style={{ border: '1px solid var(--nb-border)' }}>
          <div className="text-4xl mb-4">🤍</div>
          <p className="font-ui text-[14px] mb-5" style={{ color: 'var(--nb-text-secondary)' }}>Your wishlist is empty. Save products for later.</p>
          <Link to="/products" className="rounded-md font-ui text-[13px] font-600 px-6 py-3 text-white no-underline" style={{ background: BLUE }}>Browse Products</Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="font-display font-700 text-[22px] mb-4" style={{ color: NAVY }}>My Wishlist ({items.length})</h2>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {items.map(p => (
          <div key={p.id} className="rounded-lg bg-white flex flex-col" style={{ border: '1px solid var(--nb-border)' }}>
            <div className="overflow-hidden" style={{ height: 110, background: 'var(--nb-bg)', flexShrink: 0 }}>
              <img src={assetUrl(p.img || '/product-placeholder.svg')} alt={p.name} className="w-full h-full object-contain"
                onError={event => { event.currentTarget.src = assetUrl('/product-placeholder.svg') }} />
            </div>
            <div className="p-3 flex flex-col flex-1">
              <div className="font-ui text-[9px] font-700 tracking-wide uppercase mb-0.5" style={{ color: BLUE }}>{getBrandName(getBrandById(p.brandId), lang)}</div>
              <Link to={`/products/${p.id}`} className="no-underline flex-1">
                <div className="font-display font-700 text-[12px] leading-snug mb-1.5 hover:text-[var(--nb-primary)] transition-colors line-clamp-2" style={{ color: NAVY }}>{p.name}</div>
              </Link>
              <ProductPrice product={p} size="sm" className="mb-2" />
              <div className="flex gap-1.5">
                <button disabled={!priceFor(p).ok || p.stock <= 0} onClick={() => addToCart({ id: p.id, name: p.name, sku: p.sku, price: p.price, img: p.img, category: p.category, brand: getBrandName(getBrandById(p.brandId), lang), stock: p.stock })}
                  className="rounded-sm flex-1 font-ui text-[10px] font-600 py-1.5 text-white disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: BLUE }}>
                  Add to Cart
                </button>
                <button onClick={() => toggleWishlist(p.id)} className="rounded-sm font-ui text-[10px] font-600 px-2 py-1.5" style={{ border: '1px solid #ef4444', color: '#ef4444' }}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Profile() {
  const inputStyle = { border: '1px solid var(--nb-border)', color: 'var(--nb-navy)', background: '#fff', padding: '10px 12px', width: '100%', fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none' }
  return (
    <div>
      <h2 className="font-display font-700 text-[22px] mb-6" style={{ color: NAVY }}>My Profile</h2>
      <div className="rounded-lg bg-white p-7" style={{ border: '1px solid var(--nb-border)' }}>
        <div className="flex items-center gap-5 mb-8 pb-6" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
          <div className="w-16 h-16 flex items-center justify-center font-display font-800 text-white text-[24px]" style={{ background: NAVY }}>
            JD
          </div>
          <div>
            <div className="font-display font-700 text-[18px]" style={{ color: NAVY }}>John Doe</div>
            <div className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>john.doe@company.com · Procurement Manager</div>
            <div className="font-ui text-[12px] mt-1" style={{ color: '#94a3b8' }}>Member since January 2023</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>First Name</label>
            <input className="rounded-md" defaultValue="John" style={inputStyle} />
          </div>
          <div>
            <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>Last Name</label>
            <input className="rounded-md" defaultValue="Doe" style={inputStyle} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>Email</label>
            <input className="rounded-md" defaultValue="john.doe@company.com" style={inputStyle} />
          </div>
          <div>
            <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>Phone</label>
            <input className="rounded-md" defaultValue="+856 20 1234 5678" style={inputStyle} />
          </div>
        </div>
        <div className="mb-6">
          <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>Company</label>
          <input className="rounded-md" defaultValue="Lao Power Co., Ltd." style={inputStyle} />
        </div>
        <button className="rounded-md font-ui text-[13px] font-600 px-6 py-2.5 text-white" style={{ background: BLUE }}>Save Changes</button>
      </div>
    </div>
  )
}

function PasswordChange() {
  const inputStyle = { border: '1px solid var(--nb-border)', color: 'var(--nb-navy)', background: '#fff', padding: '10px 12px', width: '100%', fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none' }
  return (
    <div>
      <h2 className="font-display font-700 text-[22px] mb-6" style={{ color: NAVY }}>Change Password</h2>
      <div className="rounded-lg bg-white p-7 max-w-md" style={{ border: '1px solid var(--nb-border)' }}>
        <div className="flex flex-col gap-4 mb-6">
          <div>
            <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>Current Password</label>
            <input className="rounded-md" type="password" style={inputStyle} />
          </div>
          <div>
            <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>New Password</label>
            <input className="rounded-md" type="password" style={inputStyle} />
          </div>
          <div>
            <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>Confirm New Password</label>
            <input className="rounded-md" type="password" style={inputStyle} />
          </div>
        </div>
        <button className="rounded-md font-ui text-[13px] font-600 px-6 py-2.5 text-white" style={{ background: BLUE }}>Update Password</button>
      </div>
    </div>
  )
}

const CONTENT: Record<string, React.ReactNode> = {
  dashboard: <Dashboard />,
  orders: <Orders />,
  quotations: <Quotations />,
  wishlist: <Wishlist />,
  addresses: <AddressBook />,
  loyalty: <LoyaltyPanel />,
  profile: <Profile />,
  password: <PasswordChange />,
}

export default function Account() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dashboard')
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const { user, logout } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const ct = useCT()
  const tabs = [
    ...NAV_TABS.slice(0, 4),
    { id: 'addresses', label: ct.address.title, icon: <AddressIcon /> },
    { id: 'loyalty', label: ct.loyalty.title, icon: <HeartIcon /> },
    ...NAV_TABS.slice(4),
  ]

  const handleLogout = () => {
    logout()
    addToast('You have been signed out.', 'info')
    navigate('/')
  }

  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Account'

  return (
    <div style={{ background: 'var(--nb-bg)', minHeight: '70vh' }}>
      <div className="bg-white" style={{ borderBottom: '1px solid var(--nb-border)' }}>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-8">
          <h1 className="font-display font-800 text-[32px]" style={{ color: NAVY }}>My Account</h1>
          <p className="font-ui text-[13px] mt-1" style={{ color: 'var(--nb-text-secondary)' }}>
            Welcome back, {displayName}{user?.company ? ` · ${user.company}` : ''}
          </p>
        </div>
      </div>

      {/* Mobile account navigation — compact select + logout */}
      <div className="lg:hidden bg-white px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--nb-border)' }}>
        <select
          value={activeTab}
          onChange={e => setActiveTab(e.target.value)}
          className="flex-1 font-ui text-[13px] px-3 py-2 outline-none"
          style={{ border: '1px solid var(--nb-border)', color: NAVY, background: '#fff', borderRadius: 10 }}>
          {tabs.map(tab => (
            <option key={tab.id} value={tab.id}>{tab.label}</option>
          ))}
        </select>
        <button onClick={() => setShowLogoutConfirm(true)}
          className="rounded-md flex items-center gap-1.5 font-ui text-[12px] font-600 px-3 py-2 shrink-0"
          style={{ border: '1px solid #fecaca', color: '#ef4444', background: '#fff' }}>
          <LogoutIcon /> Out
        </button>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 py-6 lg:py-8">
        <div className="grid lg:grid-cols-[220px_1fr] gap-7">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="rounded-lg bg-white" style={{ border: '1px solid var(--nb-border)' }}>
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="rounded-md w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors"
                  style={{
                    borderBottom: '1px solid var(--nb-bg)',
                    background: activeTab === tab.id ? 'var(--nb-light-blue)' : 'transparent',
                    color: activeTab === tab.id ? BLUE : '#475569',
                    borderLeft: `3px solid ${activeTab === tab.id ? BLUE : 'transparent'}`,
                  }}>
                  <span style={{ color: activeTab === tab.id ? BLUE : '#94a3b8' }}>{tab.icon}</span>
                  <span className="font-ui text-[13px] font-500">{tab.label}</span>
                </button>
              ))}
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="rounded-md w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-red-50 transition-colors"
                style={{ color: '#ef4444' }}>
                <LogoutIcon />
                <span className="font-ui text-[13px] font-500">Log Out</span>
              </button>
            </div>
          </aside>

          {/* Content */}
          <main>
            {CONTENT[activeTab] || <Dashboard />}
          </main>
        </div>
      </div>

      <ConfirmModal
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Sign Out"
        message="Are you sure you want to sign out of your account?"
        confirmLabel="Sign Out"
        confirmDanger={false}
      />
    </div>
  )
}
