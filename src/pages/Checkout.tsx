import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { useT } from '../i18n'
import { useAuth } from '../auth'
import { useCommerce } from '../commerce/CommerceProvider'
import { useCT, fill } from '../commerce/text'
import { useExplain, useIssueText } from '../commerce/ui'
import { AddressForm, AddressLines, EMPTY_ADDRESS } from '../commerce/AddressForm'
import { AddressInput, CommerceError, listAddresses, placeOrder, validateAddressInput, Order } from '../commerce/engine'
import { formatMinor } from '../commerce/money'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const BLUE_H = 'var(--nb-primary-deep)'
const GOLD = 'var(--nb-gold)'

const CheckCircleIcon = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)
const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
)


function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 flex items-center justify-center font-ui text-[12px] font-700"
              style={{ background: i <= current ? BLUE : 'var(--nb-border)', color: i <= current ? '#fff' : '#94a3b8' }}>
              {i < current ? '✓' : i + 1}
            </div>
            <div className="font-ui text-[10px] mt-1 hidden sm:block" style={{ color: i === current ? NAVY : '#94a3b8' }}>{step}</div>
          </div>
          {i < steps.length - 1 && <div className="w-12 sm:w-20 h-px mb-5" style={{ background: i < current ? BLUE : 'var(--nb-border)' }} />}
        </div>
      ))}
    </div>
  )
}

function FormGroup({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </span>
      {children}
    </label>
  )
}

const inputStyle = { border: '1px solid var(--nb-border)', color: NAVY, background: '#fff', padding: '10px 12px', width: '100%', fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none' }

export default function Checkout() {
  const t = useT()
  const ct = useCT()
  const explain = useExplain()
  const issueText = useIssueText()
  const { user } = useAuth()
  const { cart, clearCart } = useStore()
  const { quote, fmt, currency, db, run, applyStock, actor } = useCommerce()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [placed, setPlaced] = useState<{ order: Order; duplicate: boolean } | null>(null)
  const idemKey = useRef(globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  const [contact, setContact] = useState({
    name: user ? `${user.firstName} ${user.lastName}`.trim() : '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    company: user?.company ?? '',
  })
  const saved = useMemo(() => (actor?.role === 'customer' ? listAddresses(db, actor) : []), [db, actor])
  const defaultSaved = saved.find(a => a.isDefault) ?? saved[0]
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'saved' | 'new' | null>(null)
  const effectiveMode = mode ?? (saved.length ? 'saved' : 'new')
  const selectedId = pickedId && saved.some(a => a.id === pickedId) ? pickedId : defaultSaved?.id
  const [newAddr, setNewAddr] = useState<AddressInput>({
    ...EMPTY_ADDRESS,
    recipientName: user ? `${user.firstName} ${user.lastName}`.trim() : '',
    phone: user?.phone ?? '',
    company: user?.company ?? '',
  })
  const [saveNew, setSaveNew] = useState(false)
  const [addrErrors, setAddrErrors] = useState<Record<string, string>>({})
  const [payment, setPayment] = useState('bank-transfer')
  const [notes, setNotes] = useState('')
  const [redeem, setRedeem] = useState(0)

  const chosen = effectiveMode === 'saved' ? saved.find(a => a.id === selectedId) : undefined
  const countryCode = chosen?.countryCode ?? newAddr.countryCode

  const q = quote({
    currency: currency.code,
    lines: cart.map(i => ({ productId: i.id, variantId: i.variantId, qty: i.qty })),
    countryCode: step >= 1 ? countryCode : undefined,
    redeemPoints: redeem,
    customerId: user?.id,
  })

  const contactOk = contact.name.trim() && /^\S+@\S+\.\S+$/.test(contact.email) && contact.phone.trim()

  const goReview = () => {
    if (effectiveMode === 'new') {
      const errs = validateAddressInput(newAddr)
      setAddrErrors(errs)
      if (Object.keys(errs).length) return
    } else if (!chosen) {
      setError(ct.errors.address_required)
      return
    }
    setError('')
    setStep(2)
  }

  const handleSubmit = () => {
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const result = run((d, a, c, now) =>
        placeOrder(d, a, c, {
          idempotencyKey: idemKey.current,
          currency: currency.code,
          lines: cart.map(i => ({ productId: i.id, variantId: i.variantId, qty: i.qty })),
          addressId: effectiveMode === 'saved' ? chosen?.id : undefined,
          newAddress: effectiveMode === 'new' ? newAddr : undefined,
          saveNewAddress: effectiveMode === 'new' && saveNew,
          redeemPoints: redeem,
          paymentMethod: payment,
          notes,
          contact,
        }, now),
      )
      applyStock(result.stockDeltas)
      clearCart()
      setPlaced({ order: result.order, duplicate: result.duplicate })
      setStep(3)
    } catch (e) {
      if (e instanceof CommerceError && e.code === 'address_invalid') {
        setAddrErrors((e.params?.errors as Record<string, string>) ?? {})
        setStep(1)
      }
      setError(explain(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (cart.length === 0 && step < 3) {
    return (
      <div className="py-24 text-center">
        <h2 className="font-display font-700 text-[28px] mb-4" style={{ color: NAVY }}>{ct.checkout.empty}</h2>
        <Link to="/products" className="rounded-md font-ui text-[13px] font-600 px-6 py-3 text-white no-underline" style={{ background: BLUE }}>{ct.checkout.browse}</Link>
      </div>
    )
  }

  if (step === 3 && placed) {
    const o = placed.order
    const money = (n: number) => formatMinor(n, { code: o.currency, symbol: o.currencySymbol, decimals: o.currencyDecimals })
    return (
      <div style={{ background: 'var(--nb-bg)', minHeight: '70vh' }}>
        <div className="max-w-[600px] mx-auto px-6 py-16 text-center">
          <div className="mb-6 flex justify-center" style={{ color: '#16a34a' }}><CheckCircleIcon /></div>
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-6 h-px" style={{ background: GOLD }} />
            <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>{t.checkout.order_success}</span>
            <div className="w-6 h-px" style={{ background: GOLD }} />
          </div>
          <h1 className="font-display font-800 text-[32px] mb-4" style={{ color: NAVY }}>{ct.checkout.thank_you}</h1>
          <p className="font-ui text-[14px] leading-relaxed mb-2" style={{ color: 'var(--nb-text-secondary)' }}>{t.checkout.order_success_desc}</p>
          {placed.duplicate && <p className="font-ui text-[12px]" style={{ color: '#92400e' }}>{ct.checkout.duplicate_note}</p>}
          <div className="rounded-lg bg-white p-5 my-8 text-left" style={{ border: '1px solid var(--nb-border)' }}>
            {[
              [ct.checkout.order_number, o.id],
              [ct.checkout.status, ct.status[o.status]],
              [ct.checkout.payment, ct.status[o.paymentStatus]],
              [ct.checkout.currency_line, o.currency],
              [ct.checkout.shipping, o.shippingStatus === 'calculated' ? money(o.shippingMinor) : ct.checkout.shipping_tbc],
              [ct.checkout.total, money(o.totalMinor)],
            ].map(([k, v], i) => (
              <div key={k} className="flex items-center justify-between py-2 gap-4" style={i ? { borderTop: '1px solid var(--nb-bg)' } : undefined}>
                <span className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>{k}</span>
                <span className="font-display font-700 text-[14px] text-right" style={{ color: NAVY }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to={`/account/orders/${o.id}`} className="rounded-md font-ui text-[13px] font-600 px-6 py-3 text-white no-underline" style={{ background: BLUE }}>{ct.checkout.view_order}</Link>
            <Link to="/products" className="rounded-md font-ui text-[13px] font-600 px-6 py-3 no-underline" style={{ border: `1px solid ${NAVY}`, color: NAVY }}>{ct.checkout.continue_shopping}</Link>
          </div>
        </div>
      </div>
    )
  }

  const rule = q.loyalty.rule
  const blocked = !q.valid
  const money = (n: number) => fmt(n)
  const nameOf = (id?: number) => cart.find(c => c.id === id)?.name ?? ''
  const statusList = rule?.eligibleStatuses.map(s => ct.status[s]).join(', ') ?? ''

  return (
    <div style={{ background: 'var(--nb-bg)', minHeight: '70vh' }}>
      <div className="bg-white" style={{ borderBottom: '1px solid var(--nb-border)' }}>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-8">
          <h1 className="font-display font-800 text-[32px]" style={{ color: NAVY }}>{t.checkout.title}</h1>
        </div>
      </div>

      <div className="max-w-[1000px] mx-auto px-6 py-10">
        <StepIndicator current={step} steps={ct.checkout.steps} />

        <div className="grid lg:grid-cols-[1fr_320px] gap-7">
          <div className="rounded-lg bg-white p-5 sm:p-7" style={{ border: '1px solid var(--nb-border)' }}>
            {error && (
              <div role="alert" className="rounded-lg mb-5 p-3 font-ui text-[13px]" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>{error}</div>
            )}

            {step === 0 && (
              <div>
                <h2 className="font-display font-700 text-[20px] mb-6" style={{ color: NAVY }}>{ct.checkout.customer_info}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <FormGroup label={t.checkout.full_name} required><input className="rounded-md" value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} style={inputStyle} autoComplete="name" /></FormGroup>
                  <FormGroup label={t.checkout.company}><input className="rounded-md" value={contact.company} onChange={e => setContact({ ...contact, company: e.target.value })} style={inputStyle} /></FormGroup>
                  <FormGroup label={t.checkout.email} required><input className="rounded-md" type="email" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} style={inputStyle} autoComplete="email" /></FormGroup>
                  <FormGroup label={t.checkout.phone} required><input className="rounded-md" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} style={inputStyle} autoComplete="tel" /></FormGroup>
                </div>
                <div className="mt-6 flex justify-end">
                  <button onClick={() => setStep(1)} disabled={!contactOk}
                    className="rounded-md flex items-center gap-2 font-ui text-[13px] font-600 px-8 py-3 text-white transition-colors disabled:opacity-40"
                    style={{ background: BLUE }}>
                    {ct.checkout.next_delivery} <ArrowRightIcon />
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="font-display font-700 text-[20px] mb-5" style={{ color: NAVY }}>{ct.checkout.delivery_info}</h2>
                {saved.length > 0 && (
                  <div className="flex gap-2 mb-5" role="tablist">
                    {(['saved', 'new'] as const).map(m => (
                      <button key={m} type="button" role="tab" aria-selected={effectiveMode === m} onClick={() => { setMode(m); setError('') }}
                        className="rounded-md font-ui text-[12px] font-600 px-4 py-2"
                        style={{ background: effectiveMode === m ? NAVY : '#fff', color: effectiveMode === m ? '#fff' : NAVY, border: `1px solid ${NAVY}` }}>
                        {m === 'saved' ? ct.checkout.saved_addresses : ct.checkout.use_new}
                      </button>
                    ))}
                  </div>
                )}
                {effectiveMode === 'saved' ? (
                  <div className="flex flex-col gap-3" role="radiogroup" aria-label={ct.checkout.saved_addresses}>
                    {saved.map(a => (
                      <label key={a.id} className="rounded-md flex gap-3 p-4 cursor-pointer" style={{ border: `1px solid ${a.id === selectedId ? BLUE : 'var(--nb-border)'}`, background: a.id === selectedId ? 'var(--nb-light-blue)' : '#fff' }}>
                        <input type="radio" name="addr" checked={a.id === selectedId} onChange={() => setPickedId(a.id)} style={{ accentColor: BLUE }} className="mt-1" />
                        <div className="min-w-0">
                          <div className="font-display font-700 text-[14px] mb-1" style={{ color: NAVY }}>
                            {a.label}
                            {a.isDefault && <span className="rounded-sm ml-2 font-ui text-[10px] px-1.5 py-0.5 text-white" style={{ background: GOLD }}>{ct.address.default}</span>}
                          </div>
                          <AddressLines a={a} />
                        </div>
                      </label>
                    ))}
                    <Link to="/account?tab=addresses" className="font-ui text-[12px] no-underline" style={{ color: BLUE }}>{ct.checkout.manage_addresses}</Link>
                  </div>
                ) : (
                  <div>
                    {saved.length === 0 && <p className="font-ui text-[12px] mb-4" style={{ color: 'var(--nb-text-secondary)' }}>{ct.checkout.no_saved}</p>}
                    <AddressForm value={newAddr} onChange={setNewAddr} errors={addrErrors} />
                    <label className="flex items-center gap-2 mt-4 font-ui text-[13px]" style={{ color: NAVY }}>
                      <input type="checkbox" checked={saveNew} onChange={e => setSaveNew(e.target.checked)} style={{ accentColor: BLUE }} />
                      {ct.checkout.save_address}
                    </label>
                  </div>
                )}
                <div className="mt-5">
                  <FormGroup label={ct.checkout.notes}>
                    <textarea className="rounded-md" value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  </FormGroup>
                </div>
                <div className="mt-6 flex gap-3 justify-between">
                  <button onClick={() => setStep(0)} className="rounded-md font-ui text-[13px] font-600 px-6 py-3" style={{ border: `1px solid ${NAVY}`, color: NAVY }}>← {ct.checkout.back}</button>
                  <button onClick={goReview} className="rounded-md flex items-center gap-2 font-ui text-[13px] font-600 px-8 py-3 text-white" style={{ background: BLUE }}>
                    {ct.checkout.next_review} <ArrowRightIcon />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="font-display font-700 text-[20px] mb-6" style={{ color: NAVY }}>{ct.checkout.review_title}</h2>

                <div className="rounded-lg mb-5 p-4" style={{ background: 'var(--nb-bg)', border: '1px solid var(--nb-border)' }}>
                  <div className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>
                    {contact.name} · {contact.email} · {contact.phone}{contact.company && ` · ${contact.company}`}
                  </div>
                  <div className="font-display font-700 text-[13px] mt-3 mb-1" style={{ color: NAVY }}>{ct.checkout.delivery_to}</div>
                  <AddressLines a={chosen ?? newAddr} />
                </div>

                <div className="mb-5">
                  <div className="font-display font-700 text-[13px] mb-3" style={{ color: NAVY }}>
                    {ct.checkout.currency_line}: <span style={{ color: BLUE }}>{currency.code}</span>
                  </div>
                  {q.lines.map(l => (
                    <div key={`${l.productId}:${l.variantId ?? ''}`} className="flex items-center justify-between py-3 gap-3" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
                      <div className="min-w-0">
                        <div className="font-ui text-[13px] font-600" style={{ color: NAVY }}>{l.name}{l.variantLabel ? ` — ${l.variantLabel}` : ''}</div>
                        <div className="font-ui text-[11px]" style={{ color: '#8f9faf' }}>
                          {l.qty} × {l.price.ok ? money(l.unitMinor) : ct.price_unavailable} · SKU: {l.sku}
                        </div>
                      </div>
                      <span className="font-display font-700 text-[14px] shrink-0" style={{ color: NAVY }}>{l.price.ok ? money(l.lineTotalMinor) : '—'}</span>
                    </div>
                  ))}
                </div>

                {/* Loyalty redemption */}
                <div className="rounded-lg mb-5 p-4" style={{ border: '1px solid var(--nb-border)' }}>
                  <div className="font-display font-700 text-[13px] mb-2" style={{ color: NAVY }}>{ct.checkout.redeem_title}</div>
                  {q.loyalty.available ? (
                    <>
                      <p className="font-ui text-[12px] mb-1" style={{ color: 'var(--nb-text-secondary)' }}>
                        {fill(ct.checkout.redeem_available, { points: q.loyalty.balance.toLocaleString() })} · {fill(ct.checkout.redeem_value, { value: money(rule?.pointValueMinor ?? 0) })}
                      </p>
                      <p className="font-ui text-[12px] mb-3" style={{ color: 'var(--nb-text-secondary)' }}>
                        {fill(ct.checkout.redeem_limits, { min: q.loyalty.minPoints, max: q.loyalty.maxPoints })}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <input className="rounded-md" type="number" min={0} step={1} aria-label={ct.checkout.redeem_title} value={redeem || ''} placeholder="0"
                          onChange={e => setRedeem(Math.max(0, Math.floor(Number(e.target.value) || 0)))} style={{ ...inputStyle, width: 130 }} />
                        <button type="button" onClick={() => setRedeem(q.loyalty.maxPoints)} className="rounded-md font-ui text-[12px] font-600 px-3 py-2.5" style={{ border: `1px solid ${NAVY}`, color: NAVY }}>{ct.checkout.redeem_use_max}</button>
                        {redeem > 0 && <button type="button" onClick={() => setRedeem(0)} className="font-ui text-[12px] px-3 py-2.5" style={{ color: '#b91c1c' }}>{ct.checkout.redeem_remove}</button>}
                      </div>
                    </>
                  ) : (
                    <p className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>{ct.checkout.redeem_none}</p>
                  )}
                  {rule?.enabled && (
                    <p className="font-ui text-[11px] mt-3" style={{ color: '#8f9faf' }}>{fill(ct.checkout.earn_note, { statuses: statusList, code: currency.code })}</p>
                  )}
                </div>

                <div className="mb-6">
                  <div className="font-display font-700 text-[13px] mb-2" style={{ color: NAVY }}>{ct.checkout.payment_method}</div>
                  {[['bank-transfer', ct.checkout.bank_transfer], ['company-account', ct.checkout.company_account], ['cash', ct.checkout.cod]].map(([m, label]) => (
                    <label key={m} className="flex items-center gap-3 py-2 cursor-pointer">
                      <input type="radio" name="payment" value={m} checked={payment === m} onChange={() => setPayment(m)} style={{ accentColor: BLUE }} />
                      <span className="font-ui text-[13px]" style={{ color: NAVY }}>{label}</span>
                    </label>
                  ))}
                  <p className="font-ui text-[11px] mt-1" style={{ color: '#8f9faf' }}>{ct.checkout.payment_pending}</p>
                </div>

                {blocked && (
                  <div role="alert" className="rounded-lg mb-4 p-3 font-ui text-[12px]" style={{ background: '#fef9ec', color: '#92400e', border: '1px solid #f3dca0' }}>
                    <p className="font-600 mb-1">{ct.checkout.fix_items}</p>
                    <ul className="list-disc pl-4">
                      {q.issues.slice(0, 6).map((i, n) => <li key={n}>{issueText(i.code, { name: nameOf(i.productId) })}</li>)}
                    </ul>
                  </div>
                )}

                <div className="flex gap-3 justify-between">
                  <button onClick={() => setStep(1)} className="rounded-md font-ui text-[13px] font-600 px-6 py-3" style={{ border: `1px solid ${NAVY}`, color: NAVY }}>← {ct.checkout.back}</button>
                  <button onClick={handleSubmit} disabled={submitting || blocked}
                    className="rounded-md flex items-center gap-2 font-ui text-[13px] font-600 px-8 py-3 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: BLUE }}>
                    {submitting ? ct.checkout.placing : t.checkout.place_order}
                    {!submitting && <ArrowRightIcon />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Order summary sidebar */}
          <div>
            <div className="rounded-lg bg-white p-5 sticky top-[110px]" style={{ border: '1px solid var(--nb-border)' }}>
              <h3 className="font-display font-700 text-[16px] mb-1 pb-3" style={{ color: NAVY, borderBottom: '1px solid var(--nb-bg)' }}>{t.checkout.order_summary}</h3>
              <p className="font-ui text-[11px] mb-3 mt-2" style={{ color: '#8f9faf' }}>{ct.checkout.currency_line}: <strong style={{ color: NAVY }}>{currency.code}</strong></p>
              <div className="flex flex-col gap-3 mb-4">
                {q.lines.map(l => (
                  <div key={`${l.productId}:${l.variantId ?? ''}`} className="flex justify-between gap-2">
                    <span className="font-ui text-[12px] leading-snug flex-1" style={{ color: 'var(--nb-text-secondary)' }}>{l.name}{l.variantLabel ? ` — ${l.variantLabel}` : ''} ×{l.qty}</span>
                    <span className="font-ui text-[12px] font-600 shrink-0" style={{ color: NAVY }}>{l.price.ok ? money(l.lineTotalMinor) : ct.price_unavailable}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 py-3 font-ui text-[12px]" style={{ borderTop: '1px solid var(--nb-border)', color: 'var(--nb-text-secondary)' }}>
                <div className="flex justify-between"><span>{ct.checkout.subtotal}</span><span style={{ color: NAVY }}>{money(q.subtotalMinor)}</span></div>
                {q.loyalty.discountMinor > 0 && (
                  <div className="flex justify-between"><span>{ct.checkout.points_discount}</span><span style={{ color: '#16a34a' }}>−{money(q.loyalty.discountMinor)}</span></div>
                )}
                <div className="flex justify-between">
                  <span>{ct.checkout.shipping}</span>
                  <span style={{ color: NAVY }}>
                    {step < 1 ? ct.cart.shipping_next : q.shipping.status === 'calculated' ? money(q.shipping.amountMinor) : ct.checkout.shipping_tbc}
                  </span>
                </div>
                <div className="flex justify-between"><span>{ct.checkout.tax}</span><span>{ct.checkout.tax_none}</span></div>
              </div>
              {step >= 1 && q.shipping.status === 'to_be_confirmed' && (
                <p className="font-ui text-[11px] mb-3" style={{ color: '#92400e' }}>{ct.checkout.shipping_tbc_note}</p>
              )}
              {step >= 1 && q.shipping.status === 'ineligible' && (
                <p className="font-ui text-[11px] mb-3" style={{ color: '#b91c1c' }}>{issueText('destination_ineligible')}</p>
              )}
              <div className="flex justify-between py-3" style={{ borderTop: '2px solid var(--nb-border)' }}>
                <span className="font-display font-700 text-[14px]" style={{ color: NAVY }}>{ct.checkout.total}</span>
                <span className="font-display font-700 text-[20px]" style={{ color: NAVY }}>{money(q.totalMinor)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
