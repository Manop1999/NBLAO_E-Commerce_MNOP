import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { useT } from '../i18n'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const BLUE_H = 'var(--nb-primary-deep)'
const GOLD = 'var(--nb-gold)'

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
)
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)
const MinusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
)
const CheckCircleIcon = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)
const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
)

const STEPS = ['Products', 'Company Info', 'Requirements', 'Review', 'Submitted']

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 flex items-center justify-center font-ui text-[12px] font-700"
              style={{ background: i <= current ? BLUE : 'var(--nb-border)', color: i <= current ? '#fff' : '#94a3b8' }}>
              {i < current ? '✓' : i + 1}
            </div>
            <div className="font-ui text-[9px] mt-1 hidden sm:block text-center w-16" style={{ color: i === current ? NAVY : '#94a3b8' }}>{s}</div>
          </div>
          {i < STEPS.length - 1 && <div className="w-8 sm:w-14 h-px mb-5" style={{ background: i < current ? BLUE : 'var(--nb-border)' }} />}
        </div>
      ))}
    </div>
  )
}

const inputStyle = { border: '1px solid var(--nb-border)', color: 'var(--nb-navy)', background: '#fff', padding: '10px 12px', width: '100%', fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none' }

function FormGroup({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {children}
    </div>
  )
}

export default function RFQ() {
  const t = useT()
  const { rfqItems, addToRFQ, removeFromRFQ, clearRFQ, products } = useStore()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({})
  const [addProductId, setAddProductId] = useState('')

  const [company, setCompany] = useState({ name: '', contact: '', email: '', phone: '', position: '', address: '' })
  const setC = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCompany(c => ({ ...c, [f]: e.target.value }))

  const [req, setReq] = useState({ deliveryDate: '', deliveryLocation: '', budget: '', notes: '', attach: '' })
  const setR = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setReq(r => ({ ...r, [f]: e.target.value }))

  const [rfqNum] = useState(`RFQ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`)

  const rk = (i: { id: number; variantId?: string }) => `${i.id}:${i.variantId ?? ''}`
  const getQty = (i: { id: number; variantId?: string }) => qtyMap[rk(i)] ?? rfqItems.find(r => rk(r) === rk(i))?.qty ?? 1
  const setQty = (i: { id: number; variantId?: string }, qty: number) => setQtyMap(m => ({ ...m, [rk(i)]: Math.max(1, qty) }))

  const handleAddProduct = () => {
    const p = products.find(prod => prod.id === Number(addProductId))
    if (p) {
      addToRFQ({ id: p.id, name: p.name, sku: p.sku, img: p.img, category: p.category })
      setAddProductId('')
    }
  }

  const handleSubmit = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      clearRFQ()
      setStep(4)
    }, 1800)
  }

  // Submitted
  if (step === 4) {
    return (
      <div style={{ background: 'var(--nb-bg)', minHeight: '70vh' }}>
        <div className="max-w-[600px] mx-auto px-6 py-16 text-center">
          <div className="mb-6" style={{ color: BLUE }}><CheckCircleIcon /></div>
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-6 h-px" style={{ background: GOLD }} />
            <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>{t.rfq.success}</span>
            <div className="w-6 h-px" style={{ background: GOLD }} />
          </div>
          <h1 className="font-display font-800 text-[32px] mb-4" style={{ color: NAVY }}>{t.rfq.success}</h1>
          <p className="font-ui text-[14px] leading-relaxed mb-2" style={{ color: 'var(--nb-text-secondary)' }}>
            {t.rfq.success_desc}
          </p>
          <div className="rounded-lg bg-white p-5 my-8" style={{ border: '1px solid var(--nb-border)' }}>
            <div className="flex items-center justify-between py-2">
              <span className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>RFQ Reference</span>
              <span className="font-display font-700 text-[15px]" style={{ color: NAVY }}>{rfqNum}</span>
            </div>
            <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid var(--nb-bg)' }}>
              <span className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>Company</span>
              <span className="font-ui text-[13px]" style={{ color: NAVY }}>{company.name || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid var(--nb-bg)' }}>
              <span className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>Expected Response</span>
              <span className="font-ui text-[13px]" style={{ color: NAVY }}>Within 24 hours</span>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/account?tab=quotations" className="rounded-md font-ui text-[13px] font-600 px-6 py-3 text-white no-underline" style={{ background: BLUE }}>View My Quotations</Link>
            <Link to="/products" className="rounded-md font-ui text-[13px] font-600 px-6 py-3 no-underline" style={{ border: `1px solid ${NAVY}`, color: NAVY }}>Continue Shopping</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--nb-bg)', minHeight: '70vh' }}>
      <div className="bg-white" style={{ borderBottom: '1px solid var(--nb-border)' }}>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-5 h-px" style={{ background: GOLD }} />
            <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: BLUE }}>B2B Procurement</span>
          </div>
          <h1 className="font-display font-800 text-[32px]" style={{ color: NAVY }}>{t.rfq.title}</h1>
          <p className="font-ui text-[13px] mt-1" style={{ color: 'var(--nb-text-secondary)' }}>{t.rfq.subtitle}</p>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-6 py-10">
        <StepBar current={step} />

        <div className="rounded-lg bg-white p-7" style={{ border: '1px solid var(--nb-border)' }}>
          {/* Step 0: Products */}
          {step === 0 && (
            <div>
              <h2 className="font-display font-700 text-[20px] mb-6" style={{ color: NAVY }}>Products for Quotation</h2>

              {rfqItems.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📋</div>
                  <p className="font-ui text-[14px] mb-6" style={{ color: 'var(--nb-text-secondary)' }}>{t.rfq.empty}</p>
                  <Link to="/products" className="rounded-md font-ui text-[13px] font-600 px-6 py-3 text-white no-underline" style={{ background: BLUE }}>{t.rfq.browse_products}</Link>
                </div>
              ) : (
                <div>
                  {/* Product list */}
                  <div className="mb-6">
                    {rfqItems.map(item => (
                      <div key={rk(item)} className="flex items-center gap-4 py-4" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
                        <div className="rounded-md overflow-hidden shrink-0" style={{ width: 64, height: 48, background: 'var(--nb-bg)' }}>
                          <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-display font-700 text-[14px]" style={{ color: NAVY }}>{item.name}</div>
                          <div className="font-ui text-[11px]" style={{ color: '#8f9faf' }}>SKU: {item.sku}{item.variantLabel ? ` · ${item.variantLabel}` : ''}</div>
                        </div>
                        <div className="rounded-md overflow-hidden flex items-center shrink-0" style={{ border: '1px solid var(--nb-border)' }}>
                          <button onClick={() => setQty(item, getQty(item) - 1)} className="rounded-sm px-2.5 py-2 hover:bg-slate-50"><MinusIcon /></button>
                          <span className="font-ui text-[13px] font-600 px-3" style={{ color: NAVY }}>{getQty(item)}</span>
                          <button onClick={() => setQty(item, getQty(item) + 1)} className="rounded-sm px-2.5 py-2 hover:bg-slate-50"><PlusIcon /></button>
                        </div>
                        <button onClick={() => removeFromRFQ(item.id, item.variantId)} className="text-[#94a3b8] hover:text-[#ef4444] transition-colors shrink-0">
                          <TrashIcon />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add more products */}
                  <div className="flex gap-2 mb-6">
                    <select value={addProductId} onChange={e => setAddProductId(e.target.value)}
                      className="rounded-md flex-1 font-ui text-[13px] px-3 py-2.5 outline-none"
                      style={{ border: '1px solid var(--nb-border)', color: NAVY, background: '#fff' }}>
                      <option value="">+ Add another product...</option>
                      {products.filter(p => !rfqItems.find(r => r.id === p.id)).map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                    <button onClick={handleAddProduct} disabled={!addProductId}
                      className="rounded-md font-ui text-[12px] font-600 px-4 py-2.5 text-white disabled:opacity-40 transition-colors"
                      style={{ background: BLUE }}>
                      <PlusIcon />
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <button onClick={() => setStep(1)} className="rounded-md font-ui text-[13px] font-600 px-8 py-3 text-white" style={{ background: BLUE }}>
                      Next: Company Info →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Company */}
          {step === 1 && (
            <div>
              <h2 className="font-display font-700 text-[20px] mb-6" style={{ color: NAVY }}>Company Information</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <FormGroup label="Company Name" required><input className="rounded-md" value={company.name} onChange={setC('name')} style={inputStyle} /></FormGroup>
                <FormGroup label="Contact Person" required><input className="rounded-md" value={company.contact} onChange={setC('contact')} style={inputStyle} /></FormGroup>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <FormGroup label="Business Email" required><input className="rounded-md" type="email" value={company.email} onChange={setC('email')} style={inputStyle} /></FormGroup>
                <FormGroup label="Phone Number" required><input className="rounded-md" value={company.phone} onChange={setC('phone')} style={inputStyle} /></FormGroup>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <FormGroup label="Job Title / Position"><input className="rounded-md" value={company.position} onChange={setC('position')} style={inputStyle} /></FormGroup>
                <FormGroup label="Company Address"><input className="rounded-md" value={company.address} onChange={setC('address')} style={inputStyle} /></FormGroup>
              </div>
              <div className="flex gap-3 justify-between mt-6">
                <button onClick={() => setStep(0)} className="rounded-md font-ui text-[13px] font-600 px-6 py-3" style={{ border: `1px solid ${NAVY}`, color: NAVY }}>← Back</button>
                <button onClick={() => setStep(2)} disabled={!company.name || !company.contact || !company.email}
                  className="rounded-md font-ui text-[13px] font-600 px-8 py-3 text-white disabled:opacity-40" style={{ background: BLUE }}>
                  Next: Requirements →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Requirements */}
          {step === 2 && (
            <div>
              <h2 className="font-display font-700 text-[20px] mb-6" style={{ color: NAVY }}>Project Requirements</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <FormGroup label="Required By Date"><input className="rounded-md" type="date" value={req.deliveryDate} onChange={setR('deliveryDate')} style={inputStyle} /></FormGroup>
                <FormGroup label="Delivery Location"><input className="rounded-md" value={req.deliveryLocation} onChange={setR('deliveryLocation')} style={inputStyle} /></FormGroup>
              </div>
              <FormGroup label="Estimated Budget (USD)">
                <input className="rounded-md" type="number" value={req.budget} onChange={setR('budget')} placeholder="Optional" style={{ ...inputStyle, marginBottom: 16 }} />
              </FormGroup>
              <FormGroup label="Additional Requirements / Notes">
                <textarea className="rounded-md" value={req.notes} onChange={setR('notes')} rows={4}
                  placeholder="Describe your project, technical requirements, special conditions, certifications needed, etc."
                  style={{ ...inputStyle, resize: 'vertical' }} />
              </FormGroup>

              {/* File attachment */}
              <div className="rounded-lg mt-4 p-4 flex items-center gap-3" style={{ border: '1px dashed var(--nb-border)', background: 'var(--nb-surface)' }}>
                <FileIcon />
                <div>
                  <div className="font-ui text-[13px] font-600" style={{ color: NAVY }}>Attach Documents</div>
                  <div className="font-ui text-[11px]" style={{ color: '#8f9faf' }}>Technical specs, drawings, or project documents (PDF, DWG, XLSX)</div>
                </div>
                <button className="rounded-md ml-auto font-ui text-[12px] font-600 px-4 py-2" style={{ border: '1px solid var(--nb-border)', color: '#475569' }}>Browse</button>
              </div>

              <div className="flex gap-3 justify-between mt-6">
                <button onClick={() => setStep(1)} className="rounded-md font-ui text-[13px] font-600 px-6 py-3" style={{ border: `1px solid ${NAVY}`, color: NAVY }}>← Back</button>
                <button onClick={() => setStep(3)} className="rounded-md font-ui text-[13px] font-600 px-8 py-3 text-white" style={{ background: BLUE }}>
                  Review & Submit →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div>
              <h2 className="font-display font-700 text-[20px] mb-6" style={{ color: NAVY }}>Review & Submit</h2>

              {/* Summary blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="rounded-lg p-4" style={{ background: 'var(--nb-bg)', border: '1px solid var(--nb-border)' }}>
                  <div className="font-display font-700 text-[12px] tracking-wide mb-2" style={{ color: NAVY }}>Company</div>
                  <div className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>{company.name}</div>
                  <div className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>{company.contact} · {company.position}</div>
                  <div className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>{company.email}</div>
                  <div className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>{company.phone}</div>
                </div>
                <div className="rounded-lg p-4" style={{ background: 'var(--nb-bg)', border: '1px solid var(--nb-border)' }}>
                  <div className="font-display font-700 text-[12px] tracking-wide mb-2" style={{ color: NAVY }}>Requirements</div>
                  {req.deliveryDate && <div className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>Required by: {req.deliveryDate}</div>}
                  {req.deliveryLocation && <div className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>Delivery: {req.deliveryLocation}</div>}
                  {req.budget && <div className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>Budget: ${Number(req.budget).toLocaleString()} USD</div>}
                </div>
              </div>

              {/* Products table */}
              <div className="mb-6">
                <div className="font-display font-700 text-[13px] tracking-wide mb-3" style={{ color: NAVY }}>Products ({rfqItems.length})</div>
                <div className="rounded-lg bg-white" style={{ border: '1px solid var(--nb-border)' }}>
                  <div className="grid grid-cols-[1fr_80px] px-5 py-2.5 font-ui text-[10px] font-700 tracking-widest uppercase" style={{ background: 'var(--nb-surface)', borderBottom: '1px solid var(--nb-border)', color: '#8f9faf' }}>
                    <span>Product</span><span className="text-right">Qty</span>
                  </div>
                  {rfqItems.map(item => (
                    <div key={rk(item)} className="grid grid-cols-[1fr_80px] items-center px-5 py-3" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
                      <div>
                        <div className="font-ui text-[13px] font-600" style={{ color: NAVY }}>{item.name}</div>
                        <div className="font-ui text-[11px]" style={{ color: '#8f9faf' }}>SKU: {item.sku}{item.variantLabel ? ` · ${item.variantLabel}` : ''}</div>
                      </div>
                      <div className="text-right font-display font-700 text-[14px]" style={{ color: NAVY }}>{getQty(item)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {req.notes && (
                <div className="rounded-lg mb-6 p-4" style={{ background: 'var(--nb-bg)', border: '1px solid var(--nb-border)' }}>
                  <div className="font-display font-700 text-[12px] tracking-wide mb-2" style={{ color: NAVY }}>Additional Notes</div>
                  <p className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>{req.notes}</p>
                </div>
              )}

              <div className="flex gap-3 justify-between">
                <button onClick={() => setStep(2)} className="rounded-md font-ui text-[13px] font-600 px-6 py-3" style={{ border: `1px solid ${NAVY}`, color: NAVY }}>← Back</button>
                <button onClick={handleSubmit} disabled={submitting}
                  className="rounded-md font-ui text-[13px] font-600 px-10 py-3 text-white disabled:opacity-60 transition-all"
                  style={{ background: submitting ? 'var(--nb-text-secondary)' : BLUE }}>
                  {submitting ? '...' : t.rfq.submit}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info sidebar */}
        <div className="rounded-lg mt-6 bg-white p-5" style={{ border: '1px solid var(--nb-border)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-px" style={{ background: GOLD }} />
            <span className="font-ui text-[10px] tracking-[0.2em] uppercase font-600" style={{ color: 'var(--nb-text-secondary)' }}>How It Works</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { step: '01', title: 'Submit RFQ', desc: 'Fill in your product requirements and company information.' },
              { step: '02', title: 'Team Reviews', desc: 'Our sales team reviews and prepares a custom quotation within 24h.' },
              { step: '03', title: 'Receive Quote', desc: 'You receive a detailed quotation with pricing, availability, and terms.' },
            ].map(item => (
              <div key={item.step} className="flex gap-3">
                <div className="font-display font-800 text-[18px] shrink-0" style={{ color: GOLD }}>{item.step}</div>
                <div>
                  <div className="font-display font-700 text-[13px] mb-1" style={{ color: NAVY }}>{item.title}</div>
                  <div className="font-ui text-[12px] leading-relaxed" style={{ color: 'var(--nb-text-secondary)' }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
