import { useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useToast } from '../components/Toast'
import { useT } from '../i18n'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const BLUE_H = 'var(--nb-primary-deep)'
const GOLD = 'var(--nb-gold)'

const inputClass = "rounded-md w-full font-ui text-[13px] px-3 py-2.5 outline-none transition-colors"
const inputStyle = { border: '1px solid var(--nb-border)', color: NAVY, background: '#fff' }

// Defined outside component so its identity is stable — prevents remounting on every keystroke
function Field({ label, name, type = 'text', placeholder, required = true, value, onChange }: {
  label: string; name: string; type?: string; placeholder?: string; required?: boolean
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div>
      <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className={inputClass}
        style={inputStyle}
        placeholder={placeholder}
        autoComplete={name === 'email' ? 'email' : name === 'phone' ? 'tel' : name === 'company' ? 'organization' : 'off'}
      />
    </div>
  )
}

export default function Register() {
  const t = useT()
  const { register } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    company: '', password: '', confirmPassword: '',
  })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(v => ({ ...v, [f]: e.target.value }))

  const validate = () => {
    if (!form.firstName || !form.lastName) return 'First and last name are required.'
    if (!form.email) return 'Email is required.'
    if (!form.phone) return 'Phone number is required.'
    if (!form.company) return 'Company name is required.'
    if (!form.password || form.password.length < 6) return 'Password must be at least 6 characters.'
    if (form.password !== form.confirmPassword) return 'Passwords do not match.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setLoading(true)
    const res = await register({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      company: form.company,
      password: form.password,
    })
    setLoading(false)
    if (res.success) {
      addToast('Account created! Welcome to NB LAO.', 'success')
      navigate('/account')
    } else {
      setError(res.error || 'Registration failed.')
    }
  }

  return (
    <div style={{ background: 'var(--nb-bg)', minHeight: '100vh' }}>
      <div style={{ background: NAVY, padding: '10px 0' }}>
        <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <BrandLogo onDark className="h-8" />
          </Link>
          <Link to="/login" className="font-ui text-[12px] no-underline" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Sign in
          </Link>
        </div>
      </div>

      <div className="flex items-start justify-center py-12 px-4">
        <div className="w-full max-w-[500px]">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px w-10" style={{ background: GOLD, opacity: 0.5 }} />
              <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>
                B2B Account
              </span>
              <div className="h-px w-10" style={{ background: GOLD, opacity: 0.5 }} />
            </div>
            <h1 className="font-display font-800 text-[30px] leading-tight" style={{ color: NAVY }}>{t.auth.register_title}</h1>
            <p className="font-ui text-[13px] mt-2" style={{ color: 'var(--nb-text-secondary)' }}>
              Register for access to quotes, orders, and industrial sourcing.
            </p>
          </div>

          <div className="rounded-lg bg-white p-8" style={{ border: '1px solid var(--nb-border)' }}>
            {error && (
              <div className="rounded-md mb-4 px-4 py-3 font-ui text-[12px]" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label={t.auth.full_name} name="firstName" placeholder="John" value={form.firstName} onChange={set('firstName')} />
                <Field label={t.auth.full_name} name="lastName" placeholder="Doe" value={form.lastName} onChange={set('lastName')} />
              </div>

              <Field label={t.auth.email} name="email" type="email" placeholder="john@company.com" value={form.email} onChange={set('email')} />
              <Field label={t.auth.phone} name="phone" placeholder="+856 20 XXXX XXXX" value={form.phone} onChange={set('phone')} />
              <Field label={t.auth.company} name="company" placeholder="ACME Industrial Ltd." value={form.company} onChange={set('company')} />

              <div className="pt-2" style={{ borderTop: '1px solid var(--nb-bg)' }}>
                <p className="font-ui text-[11px] mb-3" style={{ color: '#94a3b8' }}>Set a password for your account</p>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>
                      {t.auth.password} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={form.password}
                        onChange={set('password')}
                        className={inputClass}
                        style={{ ...inputStyle, paddingRight: 40 }}
                        placeholder="Min. 6 characters"
                        autoComplete="new-password"
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

                  <div>
                    <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>
                      {t.auth.confirm_password} <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={form.confirmPassword}
                      onChange={set('confirmPassword')}
                      className={inputClass}
                      style={inputStyle}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>

              <p className="font-ui text-[11px] leading-relaxed" style={{ color: '#94a3b8' }}>
                By creating an account you agree to our{' '}
                <Link to="/terms" className="no-underline hover:underline" style={{ color: 'var(--nb-text-secondary)' }}>Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" className="no-underline hover:underline" style={{ color: 'var(--nb-text-secondary)' }}>Privacy Policy</Link>.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="rounded-md w-full font-ui text-[13px] font-600 py-3 text-white transition-colors disabled:opacity-60 mt-1"
                style={{ background: loading ? 'var(--nb-text-secondary)' : BLUE }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = BLUE_H }}
                onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = BLUE }}
              >
                {loading ? '...' : t.auth.register}
              </button>
            </form>

            <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid var(--nb-bg)' }}>
              <span className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>
                {t.auth.have_account}{' '}
                <Link to="/login" className="font-600 no-underline hover:underline" style={{ color: BLUE }}>
                  {t.auth.sign_in_link}
                </Link>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
