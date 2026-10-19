import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '../i18n'
import { useStore } from '../store'
import { getWhatsAppUrl, publicUrl } from '../content'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const GOLD = 'var(--nb-gold)'

const inputStyle = {
  border: '1px solid var(--nb-border)', color: NAVY, background: '#fff',
  padding: '10px 12px', width: '100%', fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none',
}

const DEPTS = ['General Enquiries', 'Sales & Quotations', 'Technical Support', 'Procurement / Vendors']

export default function Contact() {
  const t = useT()
  const { customerService, lang } = useStore()
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '', department: 'General Enquiries', subject: '', message: '',
  })
  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(v => ({ ...v, [f]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setTimeout(() => { setSubmitting(false); setSent(true) }, 1400)
  }

  return (
    <div style={{ background: 'var(--nb-bg)' }}>
      {/* Page header */}
      <div className="bg-white" style={{ borderBottom: '1px solid var(--nb-border)' }}>
        <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-[2px]" style={{ background: GOLD }} />
            <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>{t.contact.title}</span>
          </div>
          <h1 className="font-display font-800 text-[40px]" style={{ color: NAVY }}>{t.contact.title}</h1>
          <p className="font-ui text-[14px] mt-2" style={{ color: 'var(--nb-text-secondary)' }}>
            {t.contact.subtitle}
          </p>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-16 py-12">
        <div className="grid lg:grid-cols-[1fr_380px] gap-10">
          {/* Contact form */}
          <div className="rounded-lg bg-white p-8" style={{ border: '1px solid var(--nb-border)' }}>
            {sent ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-md overflow-hidden w-12 h-12 flex items-center justify-center mb-5" style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}` }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h2 className="font-display font-800 text-[24px] mb-3" style={{ color: NAVY }}>{t.common.success}</h2>
                <p className="font-ui text-[14px] mb-6" style={{ color: 'var(--nb-text-secondary)' }}>
                  {t.contact.success}
                </p>
                <button onClick={() => setSent(false)} className="rounded-md font-ui text-[13px] font-600 px-6 py-2.5" style={{ border: `1px solid ${NAVY}`, color: NAVY }}>
                  {t.contact.send}
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-display font-700 text-[22px] mb-6" style={{ color: NAVY }}>Send Us a Message</h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>{t.contact.name} <span style={{ color: '#ef4444' }}>*</span></label>
                      <input className="rounded-md" value={form.name} onChange={set('name')} required style={inputStyle} />
                    </div>
                    <div>
                      <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>Company Name</label>
                      <input className="rounded-md" value={form.company} onChange={set('company')} style={inputStyle} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>{t.contact.email} <span style={{ color: '#ef4444' }}>*</span></label>
                      <input className="rounded-md" type="email" value={form.email} onChange={set('email')} required style={inputStyle} />
                    </div>
                    <div>
                      <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>Phone Number</label>
                      <input className="rounded-md" value={form.phone} onChange={set('phone')} style={inputStyle} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>Department</label>
                      <select className="rounded-md" value={form.department} onChange={set('department')} style={inputStyle}>
                        {DEPTS.map(department => <option key={department} value={department}>{department}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>{t.contact.subject} <span style={{ color: '#ef4444' }}>*</span></label>
                      <input className="rounded-md" value={form.subject} onChange={set('subject')} required style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>{t.contact.message} <span style={{ color: '#ef4444' }}>*</span></label>
                    <textarea className="rounded-md" value={form.message} onChange={set('message')} required rows={5} style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>
                  <div className="flex justify-end pt-2">
                    <button type="submit" disabled={submitting}
                      className="rounded-md font-ui text-[13px] font-600 px-8 py-3 text-white disabled:opacity-60"
                      style={{ background: BLUE }}>
                      {submitting ? t.common.loading : t.contact.send}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-5">
            <div className="rounded-lg bg-white p-6" style={{ border: '1px solid var(--nb-border)' }}>
              <div className="font-display font-700 text-[15px] mb-4 pb-3" style={{ color: NAVY, borderBottom: `2px solid ${GOLD}` }}>
                Customer Service
              </div>
              <div className="flex flex-col gap-3">
                <div className="font-ui text-[12px] leading-relaxed" style={{ color: 'var(--nb-text-secondary)' }}>{lang === 'lo' && customerService.addressLo ? customerService.addressLo : customerService.addressEn}</div>
                {customerService.phone && <a href={`tel:${customerService.phone.replace(/\s/g, '')}`} className="font-ui text-[12px] font-600 no-underline" style={{ color: BLUE }}>{customerService.phone}</a>}
                {customerService.email && <a href={`mailto:${customerService.email}`} className="font-ui text-[12px] font-600 no-underline" style={{ color: BLUE }}>{customerService.email}</a>}
                {publicUrl(customerService.mapUrl) && <a href={publicUrl(customerService.mapUrl)} target="_blank" rel="noreferrer" className="font-ui text-[12px] font-600 no-underline" style={{ color: BLUE }}>Open map</a>}
                {getWhatsAppUrl(customerService.whatsapp) && <a href={getWhatsAppUrl(customerService.whatsapp)} target="_blank" rel="noreferrer" className="font-ui text-[12px] font-600 no-underline" style={{ color: BLUE }}>WhatsApp customer service</a>}
              </div>
            </div>

            {/* RFQ shortcut */}
            <div className="p-5" style={{ background: NAVY }}>
              <div className="font-display font-700 text-[16px] text-white mb-2">Need a Quotation?</div>
              <p className="font-ui text-[12px] mb-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Submit a Request for Quotation and our team will respond within 24 hours.
              </p>
              <Link to="/rfq" className="rounded-md block text-center font-ui text-[12px] font-600 py-2.5 no-underline" style={{ background: GOLD, color: NAVY }}>
                Submit RFQ →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
