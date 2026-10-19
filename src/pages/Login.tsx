import { useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { useToast } from '../components/Toast'
import { useT } from '../i18n'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const BLUE_H = 'var(--nb-primary-deep)'
const GOLD = 'var(--nb-gold)'

export default function Login() {
  const { login } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string })?.from || '/account'

  const t = useT()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remember, setRemember] = useState(false)

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(v => ({ ...v, [f]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password) { setError('Please enter your email and password.'); return }
    setError('')
    setLoading(true)
    const res = await login(form.email, form.password)
    setLoading(false)
    if (res.success) {
      addToast('Welcome back!', 'success')
      navigate(from, { replace: true })
    } else {
      setError(res.error || 'Login failed.')
    }
  }

  const inputClass = "rounded-md w-full font-ui text-[13px] px-3 py-2.5 outline-none transition-colors"
  const inputStyle = { border: '1px solid var(--nb-border)', color: NAVY, background: '#fff' }

  return (
    <div style={{ background: 'var(--nb-bg)', minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{ background: NAVY, padding: '10px 0' }}>
        <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <BrandLogo onDark className="h-8" />
          </Link>
          <Link to="/register" className="font-ui text-[12px] no-underline" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Create account
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px w-10" style={{ background: GOLD, opacity: 0.5 }} />
              <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>
                Customer Portal
              </span>
              <div className="h-px w-10" style={{ background: GOLD, opacity: 0.5 }} />
            </div>
            <h1 className="font-display font-800 text-[30px] leading-tight" style={{ color: NAVY }}>{t.auth.login_title}</h1>
            <p className="font-ui text-[13px] mt-2" style={{ color: 'var(--nb-text-secondary)' }}>
              Access your orders, quotations, and account.
            </p>
          </div>

          <div className="rounded-lg bg-white p-8" style={{ border: '1px solid var(--nb-border)' }}>
            {/* Demo hint */}
            <div className="rounded-md mb-5 px-4 py-3 font-ui text-[11px] leading-relaxed" style={{ background: 'var(--nb-bg)', border: '1px solid var(--nb-border)', color: 'var(--nb-text-secondary)' }}>
              <strong style={{ color: NAVY }}>Demo credentials:</strong>{' '}
              john.doe@company.com / demo123
            </div>

            {error && (
              <div className="rounded-md mb-4 px-4 py-3 font-ui text-[12px]" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>
                  {t.auth.email} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>
                  {t.auth.password} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    autoComplete="current-password"
                    className={inputClass}
                    style={{ ...inputStyle, paddingRight: 40 }}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 font-ui text-[11px]"
                    style={{ color: '#94a3b8' }}
                  >
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    style={{ accentColor: BLUE }}
                  />
                  <span className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>Remember me</span>
                </label>
                <Link to="/forgot-password" className="font-ui text-[12px] no-underline hover:underline" style={{ color: BLUE }}>
                  {t.auth.forgot_password}
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="rounded-md w-full font-ui text-[13px] font-600 py-3 text-white transition-colors disabled:opacity-60 mt-2"
                style={{ background: loading ? 'var(--nb-text-secondary)' : BLUE }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = BLUE_H }}
                onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = BLUE }}
              >
                {loading ? t.common.loading : t.auth.sign_in}
              </button>
            </form>

            <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid var(--nb-bg)' }}>
              <span className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>
                {t.auth.no_account}{' '}
                <Link to="/register" className="font-600 no-underline hover:underline" style={{ color: BLUE }}>
                  {t.auth.register_link}
                </Link>
              </span>
            </div>
          </div>

          <p className="text-center font-ui text-[11px] mt-5" style={{ color: '#94a3b8' }}>
            This is a prototype authentication system.{' '}
            <Link to="/" className="no-underline hover:underline" style={{ color: 'var(--nb-text-secondary)' }}>
              Back to website
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
