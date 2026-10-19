import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useToast } from '../components/Toast'
import { ConfirmModal } from '../components/Modal'
import { useT } from '../i18n'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'

// Prototype quotation data — IDs match data.ts QUOTATIONS
const MOCK_QUOTATIONS: Record<string, {
  id: string; date: string; validUntil: string; status: string;
  items: { name: string; sku: string; qty: number; unit: string; unitPrice: number; totalPrice: number; leadTime?: string }[];
  subtotal: number; tax: string; total: number; notes: string;
}> = {
  'Q-2024-0018': {
    id: 'Q-2024-0018',
    date: '2024-11-10',
    validUntil: '2024-12-10',
    status: 'Quoted',
    items: [
      { name: 'Rotary Screw Generator Set', sku: 'PE-GEN-011', qty: 2, unit: 'unit', unitPrice: 68000, totalPrice: 136000, leadTime: '10–14 weeks' },
    ],
    subtotal: 136000,
    tax: 'VAT 10% — billed separately',
    total: 136000,
    notes: 'Prices are EXW Vientiane. Delivery to site available upon request. Lead times subject to stock confirmation at time of order.',
  },
  'Q-2024-0011': {
    id: 'Q-2024-0011',
    date: '2024-09-18',
    validUntil: '2024-10-18',
    status: 'Accepted',
    items: [
      { name: 'Industrial Robot Arm', sku: 'IM-ROB-004', qty: 3, unit: 'unit', unitPrice: 32000, totalPrice: 96000, leadTime: '12–16 weeks' },
    ],
    subtotal: 96000,
    tax: 'VAT 10% — billed separately',
    total: 96000,
    notes: 'Full technical documentation and factory test reports included.',
  },
  'Q-2024-0005': {
    id: 'Q-2024-0005',
    date: '2024-07-30',
    validUntil: '2024-08-30',
    status: 'Expired',
    items: [
      { name: 'Fire Suppression System', sku: 'SF-FIR-010', qty: 1, unit: 'unit', unitPrice: 12500, totalPrice: 12500, leadTime: '6–8 weeks' },
    ],
    subtotal: 12500,
    tax: 'VAT 10% — billed separately',
    total: 12500,
    notes: 'This quotation has expired. Please submit a new RFQ for current pricing.',
  },
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Quoted': { bg: '#f5f0ff', color: '#7c3aed' },
  'Pending Review': { bg: '#fef9ec', color: '#d97706' },
  'Accepted': { bg: '#ecfdf5', color: '#16a34a' },
  'Rejected': { bg: '#fef2f2', color: '#ef4444' },
  'Expired': { bg: '#f9fafb', color: '#6b7280' },
}

export default function QuotationDetail() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const { isAuthenticated } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [confirmAction, setConfirmAction] = useState<'accept' | 'reject' | null>(null)
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({})

  if (!isAuthenticated) {
    navigate('/login', { state: { from: `/account/quotations/${id}` }, replace: true })
    return null
  }

  const quotation = id ? MOCK_QUOTATIONS[id] : null

  if (!quotation) {
    return (
      <div style={{ background: 'var(--nb-bg)', minHeight: '60vh' }}>
        <div className="max-w-[1440px] mx-auto px-6 py-20 text-center">
          <h1 className="font-display font-800 text-[24px] mb-3" style={{ color: NAVY }}>{t.quotation.title}</h1>
          <p className="font-ui text-[13px] mb-6" style={{ color: 'var(--nb-text-secondary)' }}>Quotation <code>{id}</code> could not be found.</p>
          <Link to="/account?tab=quotations" className="font-ui text-[13px] font-600 no-underline" style={{ color: BLUE }}>
            ← {t.quotation.back}
          </Link>
        </div>
      </div>
    )
  }

  const currentStatus = localStatus[quotation.id] || quotation.status
  const sc = STATUS_COLORS[currentStatus] || { bg: '#f9fafb', color: '#6b7280' }
  const isActionable = currentStatus === 'Quoted' || currentStatus === 'Pending Review'

  const handleConfirm = (action: 'accept' | 'reject') => {
    const newStatus = action === 'accept' ? 'Accepted' : 'Rejected'
    setLocalStatus(p => ({ ...p, [quotation.id]: newStatus }))
    addToast(
      action === 'accept' ? 'Quotation accepted. Our team will contact you shortly.' : 'Quotation declined.',
      action === 'accept' ? 'success' : 'info'
    )
    setConfirmAction(null)
  }

  return (
    <div style={{ background: 'var(--nb-bg)' }}>
      <div style={{ background: 'var(--nb-bg)', borderBottom: '1px solid var(--nb-border)' }}>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-5">
          <div className="flex items-center gap-2 font-ui text-[12px] mb-3" style={{ color: '#94a3b8' }}>
            <Link to="/account" className="no-underline hover:underline" style={{ color: 'var(--nb-text-secondary)' }}>Account</Link>
            <span>›</span>
            <Link to="/account?tab=quotations" className="no-underline hover:underline" style={{ color: 'var(--nb-text-secondary)' }}>Quotations</Link>
            <span>›</span>
            <span>{quotation.id}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display font-800 text-[24px]" style={{ color: NAVY }}>Quotation {quotation.id}</h1>
              <p className="font-ui text-[12px] mt-1" style={{ color: 'var(--nb-text-secondary)' }}>
                Issued {quotation.date} · Valid until {quotation.validUntil}
              </p>
            </div>
            <span className="rounded-sm font-ui text-[12px] font-600 px-3 py-1.5 shrink-0" style={{ background: sc.bg, color: sc.color }}>
              {currentStatus}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Items */}
          <div className="rounded-lg bg-white" style={{ border: '1px solid var(--nb-border)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
              <h2 className="font-display font-700 text-[16px]" style={{ color: NAVY }}>Quoted Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--nb-surface)' }}>
                    {['Item', 'SKU', 'Qty', 'Unit Price', 'Lead Time', 'Total'].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-ui text-[11px] uppercase tracking-[0.08em]" style={{ color: '#94a3b8', borderBottom: '1px solid var(--nb-bg)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--nb-bg)' }}>
                      <td className="px-5 py-4 font-ui text-[13px] font-600" style={{ color: NAVY }}>{item.name}</td>
                      <td className="px-5 py-4 font-ui text-[12px]" style={{ color: '#94a3b8' }}>{item.sku}</td>
                      <td className="px-5 py-4 font-ui text-[13px]" style={{ color: '#374151' }}>{item.qty} {item.unit}</td>
                      <td className="px-5 py-4 font-ui text-[13px]" style={{ color: '#374151' }}>${item.unitPrice.toLocaleString()}</td>
                      <td className="px-5 py-4 font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>{item.leadTime || '—'}</td>
                      <td className="px-5 py-4 font-display font-700 text-[14px]" style={{ color: NAVY }}>${item.totalPrice.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 flex flex-col gap-2" style={{ background: 'var(--nb-surface)', borderTop: '1px solid var(--nb-bg)' }}>
              <div className="flex justify-between font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>
                <span>Subtotal</span><span>${quotation.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>
                <span>Tax</span><span>{quotation.tax}</span>
              </div>
              <div className="flex justify-between font-display font-700 text-[15px] pt-2" style={{ color: NAVY, borderTop: '1px solid #e5e7eb' }}>
                <span>Quote Total</span><span>${quotation.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quotation.notes && (
            <div className="rounded-lg bg-white p-6" style={{ border: '1px solid var(--nb-border)' }}>
              <h3 className="font-display font-700 text-[14px] mb-2" style={{ color: NAVY }}>Terms & Notes</h3>
              <p className="font-ui text-[13px] leading-relaxed" style={{ color: 'var(--nb-text-secondary)' }}>{quotation.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {isActionable && (
            <div className="rounded-lg bg-white p-6" style={{ border: '1px solid var(--nb-border)' }}>
              <h3 className="font-display font-700 text-[14px] mb-2" style={{ color: NAVY }}>Respond to Quotation</h3>
              <p className="font-ui text-[12px] mb-4" style={{ color: 'var(--nb-text-secondary)' }}>
                Accept to proceed to order placement, or decline if you no longer require this quote.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setConfirmAction('accept')}
                  className="rounded-md w-full font-ui text-[13px] font-600 py-2.5 text-white"
                  style={{ background: '#16a34a' }}
                >
                  Accept Quotation
                </button>
                <button
                  onClick={() => setConfirmAction('reject')}
                  className="rounded-md w-full font-ui text-[13px] font-600 py-2.5"
                  style={{ border: '1px solid #fecaca', color: '#ef4444', background: '#fff' }}
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-white p-6" style={{ border: '1px solid var(--nb-border)' }}>
            <h3 className="font-display font-700 text-[14px] mb-3" style={{ color: NAVY }}>Quote Details</h3>
            <div className="flex flex-col gap-2">
              {[
                ['Quotation #', quotation.id],
                ['Date', quotation.date],
                ['Valid Until', quotation.validUntil],
                ['Status', currentStatus],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-3">
                  <span className="font-ui text-[12px]" style={{ color: '#94a3b8' }}>{l}</span>
                  <span className="font-ui text-[12px] font-600 text-right" style={{ color: NAVY }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-white p-6" style={{ border: '1px solid var(--nb-border)' }}>
            <h3 className="font-display font-700 text-[14px] mb-2" style={{ color: NAVY }}>Questions?</h3>
            <p className="font-ui text-[12px] mb-3" style={{ color: 'var(--nb-text-secondary)' }}>Contact our sales team with your quotation number.</p>
            <Link to="/contact" className="rounded-md block font-ui text-[12px] font-600 py-2 text-center no-underline"
              style={{ border: '1px solid var(--nb-border)', color: NAVY, background: '#fff' }}>
              Contact Sales
            </Link>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmAction === 'accept'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleConfirm('accept')}
        title="Accept Quotation"
        message="By accepting this quotation you confirm your intent to proceed with the order. Our sales team will contact you to finalise payment terms and delivery arrangements."
        confirmLabel="Confirm Acceptance"
        confirmDanger={false}
      />

      <ConfirmModal
        open={confirmAction === 'reject'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleConfirm('reject')}
        title="Decline Quotation"
        message="Are you sure you want to decline this quotation? This action cannot be undone."
        confirmLabel="Decline Quotation"
        confirmDanger={true}
      />
    </div>
  )
}
