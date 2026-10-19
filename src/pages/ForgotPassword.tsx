import { useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import { Link } from 'react-router-dom'
import { useT } from '../i18n'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const BLUE_H = 'var(--nb-primary-deep)'
const GOLD = 'var(--nb-gold)'

export default function ForgotPassword() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div style={{ background: 'var(--nb-bg)', minHeight: '100vh' }}>
      <div style={{ background: NAVY, padding: '10px 0' }}>
        <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <BrandLogo onDark className="h-8" />
          </Link>
          <Link to="/login" className="font-ui text-[12px] no-underline" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Back to sign in
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-center py-20 px-4">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px w-10" style={{ background: GOLD, opacity: 0.5 }} />
              <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>
                Account Recovery
              </span>
              <div className="h-px w-10" style={{ background: GOLD, opacity: 0.5 }} />
            </div>
            <h1 className="font-display font-800 text-[28px] leading-tight" style={{ color: NAVY }}>
              {submitted ? 'Check Your Email' : t.auth.reset_title}
            </h1>
          </div>

          <div className="rounded-lg bg-white p-8" style={{ border: '1px solid var(--nb-border)' }}>
            {submitted ? (
              <div className="text-center">
                <div className="rounded-md overflow-hidden w-14 h-14 mx-auto mb-5 flex items-center justify-center" style={{ background: '#ecfdf5', border: '1px solid #bbf7d0' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17L4 12" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="font-ui text-[13px] leading-relaxed mb-6" style={{ color: 'var(--nb-text-secondary)' }}>
                  If an account exists for <strong style={{ color: NAVY }}>{email}</strong>,
                  you will receive a password reset link within a few minutes.
                </p>
                <p className="font-ui text-[11px] mb-6" style={{ color: '#94a3b8' }}>
                  This is a prototype — no email is actually sent.
                </p>
                <Link
                  to="/login"
                  className="rounded-md block w-full font-ui text-[13px] font-600 py-3 text-white text-center no-underline transition-colors"
                  style={{ background: BLUE }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = BLUE_H}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = BLUE}
                >
                  Return to Sign In
                </Link>
              </div>
            ) : (
              <>
                <p className="font-ui text-[13px] mb-5 leading-relaxed" style={{ color: 'var(--nb-text-secondary)' }}>
                  {t.auth.reset_desc}
                </p>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div>
                    <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>
                      {t.auth.email} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                      className="rounded-md w-full font-ui text-[13px] px-3 py-2.5 outline-none"
                      style={{ border: '1px solid var(--nb-border)', color: NAVY, background: '#fff' }}
                      placeholder="your@email.com"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="rounded-md w-full font-ui text-[13px] font-600 py-3 text-white transition-colors disabled:opacity-60"
                    style={{ background: loading || !email ? 'var(--nb-text-secondary)' : BLUE }}
                    onMouseEnter={e => { if (!loading && email) (e.currentTarget as HTMLElement).style.background = BLUE_H }}
                    onMouseLeave={e => { if (!loading && email) (e.currentTarget as HTMLElement).style.background = BLUE }}
                  >
                    {loading ? '...' : t.auth.send_reset}
                  </button>
                </form>

                <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid var(--nb-bg)' }}>
                  <Link to="/login" className="font-ui text-[12px] font-600 no-underline hover:underline" style={{ color: BLUE }}>
                    ← {t.auth.back_login}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
