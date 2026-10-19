import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useT } from '../i18n'
import { useCommerce } from '../commerce/CommerceProvider'
import { getOrder } from '../commerce/engine'
import { StoredOrderDetail } from '../commerce/StoredOrderDetail'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'

// Prototype order data — IDs match data.ts ORDERS
const MOCK_ORDERS: Record<string, {
  id: string; date: string; status: string; items: { name: string; sku: string; qty: number; price: number }[];
  subtotal: number; shipping: string; total: number;
  delivery: { company: string; address: string; city: string; country: string };
  timeline: { label: string; date: string; done: boolean }[];
}> = {
  'NB-2024-0045': {
    id: 'NB-2024-0045',
    date: '2024-11-15',
    status: 'Delivered',
    items: [
      { name: 'High-Voltage Power Transformer', sku: 'EE-TRF-001', qty: 1, price: 28500 },
      { name: 'Heavy-Duty Power Cable', sku: 'CA-PWR-006', qty: 100, price: 185 },
    ],
    subtotal: 47000,
    shipping: 'Included',
    total: 47000,
    delivery: { company: 'Lao Power Co., Ltd.', address: '123 Industrial Zone, Ban Phontong', city: 'Vientiane', country: 'Lao PDR' },
    timeline: [
      { label: 'Order Placed', date: '15 Nov 2024', done: true },
      { label: 'Order Confirmed', date: '16 Nov 2024', done: true },
      { label: 'Processing', date: '19 Nov 2024', done: true },
      { label: 'Shipped', date: '25 Nov 2024', done: true },
      { label: 'Delivered', date: '28 Nov 2024', done: true },
    ],
  },
  'NB-2024-0031': {
    id: 'NB-2024-0031',
    date: '2024-10-03',
    status: 'Processing',
    items: [
      { name: 'Low Voltage MCC Panel', sku: 'EE-MCC-003', qty: 2, price: 9800 },
    ],
    subtotal: 19600,
    shipping: 'TBD',
    total: 19600,
    delivery: { company: 'Lao Power Co., Ltd.', address: '123 Industrial Zone, Ban Phontong', city: 'Vientiane', country: 'Lao PDR' },
    timeline: [
      { label: 'Order Placed', date: '03 Oct 2024', done: true },
      { label: 'Order Confirmed', date: '04 Oct 2024', done: true },
      { label: 'Processing', date: 'In progress', done: false },
      { label: 'Shipped', date: '—', done: false },
      { label: 'Delivered', date: '—', done: false },
    ],
  },
  'NB-2024-0019': {
    id: 'NB-2024-0019',
    date: '2024-08-22',
    status: 'Delivered',
    items: [
      { name: 'PPE Safety Helmet Set', sku: 'SF-PPE-005', qty: 50, price: 45 },
      { name: 'Digital Clamp Meter', sku: 'TE-CLM-007', qty: 5, price: 420 },
    ],
    subtotal: 4350,
    shipping: 'Included',
    total: 4350,
    delivery: { company: 'Lao Power Co., Ltd.', address: '123 Industrial Zone, Ban Phontong', city: 'Vientiane', country: 'Lao PDR' },
    timeline: [
      { label: 'Order Placed', date: '22 Aug 2024', done: true },
      { label: 'Order Confirmed', date: '23 Aug 2024', done: true },
      { label: 'Processing', date: '25 Aug 2024', done: true },
      { label: 'Shipped', date: '28 Aug 2024', done: true },
      { label: 'Delivered', date: '01 Sep 2024', done: true },
    ],
  },
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Delivered: { bg: '#ecfdf5', color: '#16a34a' },
  Processing: { bg: '#eff6ff', color: '#2563eb' },
  Shipped: { bg: '#fefce8', color: '#ca8a04' },
  Pending: { bg: '#f9fafb', color: '#6b7280' },
}

export default function OrderDetail() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const { db, actor } = useCommerce()

  if (!isAuthenticated) {
    navigate('/login', { state: { from: `/account/orders/${id}` }, replace: true })
    return null
  }

  const stored = id && actor ? getOrder(db, actor, id) : undefined
  if (stored) return <StoredOrderDetail order={stored} />

  const order = id ? MOCK_ORDERS[id] : null

  if (!order) {
    return (
      <div style={{ background: 'var(--nb-bg)', minHeight: '60vh' }}>
        <div className="max-w-[1440px] mx-auto px-6 py-20 text-center">
          <h1 className="font-display font-800 text-[24px] mb-3" style={{ color: NAVY }}>{t.order.title}</h1>
          <p className="font-ui text-[13px] mb-6" style={{ color: 'var(--nb-text-secondary)' }}>Order <code>{id}</code> could not be found.</p>
          <Link to="/account?tab=orders" className="font-ui text-[13px] font-600 no-underline" style={{ color: BLUE }}>
            ← {t.order.back}
          </Link>
        </div>
      </div>
    )
  }

  const sc = STATUS_COLORS[order.status] || { bg: '#f9fafb', color: '#6b7280' }

  return (
    <div style={{ background: 'var(--nb-bg)' }}>
      <div style={{ background: 'var(--nb-bg)', borderBottom: '1px solid var(--nb-border)' }}>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-5">
          <div className="flex items-center gap-2 font-ui text-[12px] mb-3" style={{ color: '#94a3b8' }}>
            <Link to="/account" className="no-underline hover:underline" style={{ color: 'var(--nb-text-secondary)' }}>{t.account.title}</Link>
            <span>›</span>
            <Link to="/account?tab=orders" className="no-underline hover:underline" style={{ color: 'var(--nb-text-secondary)' }}>{t.account.orders}</Link>
            <span>›</span>
            <span>{order.id}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display font-800 text-[24px]" style={{ color: NAVY }}>Order {order.id}</h1>
              <p className="font-ui text-[12px] mt-1" style={{ color: 'var(--nb-text-secondary)' }}>Placed {order.date}</p>
            </div>
            <span className="rounded-sm font-ui text-[12px] font-600 px-3 py-1.5 shrink-0" style={{ background: sc.bg, color: sc.color }}>
              {order.status}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Items */}
          <div className="rounded-lg bg-white" style={{ border: '1px solid var(--nb-border)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
              <h2 className="font-display font-700 text-[16px]" style={{ color: NAVY }}>{t.order.items}</h2>
            </div>
            <div>
              {order.items.map((item, i) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
                  <div>
                    <p className="font-ui text-[13px] font-600" style={{ color: NAVY }}>{item.name}</p>
                    <p className="font-ui text-[12px] mt-0.5" style={{ color: '#94a3b8' }}>{item.sku} · Qty: {item.qty}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-700 text-[14px]" style={{ color: NAVY }}>
                      ${(item.price * item.qty).toLocaleString()}
                    </p>
                    <p className="font-ui text-[11px]" style={{ color: '#94a3b8' }}>
                      @${item.price.toLocaleString()} ea.
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 flex flex-col gap-2" style={{ borderTop: '1px solid var(--nb-bg)', background: 'var(--nb-surface)' }}>
              <div className="flex justify-between font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>
                <span>{t.order.subtotal}</span><span>${order.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>
                <span>{t.order.shipping_fee}</span><span>{order.shipping}</span>
              </div>
              <div className="flex justify-between font-display font-700 text-[15px] pt-2" style={{ color: NAVY, borderTop: '1px solid #e5e7eb' }}>
                <span>{t.order.total}</span><span>${order.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg bg-white" style={{ border: '1px solid var(--nb-border)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
              <h2 className="font-display font-700 text-[16px]" style={{ color: NAVY }}>{t.order.status}</h2>
            </div>
            <div className="px-6 py-5">
              <div className="flex flex-col gap-0">
                {order.timeline.map((step, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-700"
                        style={{ background: step.done ? BLUE : 'var(--nb-bg)', color: step.done ? '#fff' : '#94a3b8' }}>
                        {step.done ? '✓' : '○'}
                      </div>
                      {i < order.timeline.length - 1 && (
                        <div className="w-px flex-1 mt-1 mb-1" style={{ background: step.done ? BLUE : '#e5e7eb', minHeight: 24 }} />
                      )}
                    </div>
                    <div className="pb-5">
                      <p className="font-ui text-[13px] font-600" style={{ color: step.done ? NAVY : '#94a3b8' }}>{step.label}</p>
                      <p className="font-ui text-[11px]" style={{ color: '#94a3b8' }}>{step.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-white p-6" style={{ border: '1px solid var(--nb-border)' }}>
            <h3 className="font-display font-700 text-[14px] mb-3" style={{ color: NAVY }}>Delivery Address</h3>
            <p className="font-ui text-[13px] font-600" style={{ color: NAVY }}>{order.delivery.company}</p>
            <p className="font-ui text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--nb-text-secondary)' }}>
              {order.delivery.address}<br />
              {order.delivery.city}<br />
              {order.delivery.country}
            </p>
          </div>

          <div className="rounded-lg bg-white p-6" style={{ border: '1px solid var(--nb-border)' }}>
            <h3 className="font-display font-700 text-[14px] mb-3" style={{ color: NAVY }}>Need Help?</h3>
            <p className="font-ui text-[12px] mb-4" style={{ color: 'var(--nb-text-secondary)' }}>
              Questions about this order? Contact our team with your order number.
            </p>
            <Link to="/contact" className="rounded-md block font-ui text-[12px] font-600 py-2 text-center no-underline"
              style={{ border: '1px solid var(--nb-border)', color: NAVY, background: '#fff' }}>
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
