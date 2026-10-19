import { useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { useToast } from '../components/Toast'

const DARK = '#070f1e'
const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const GOLD = 'var(--nb-gold)'

export default function AdminLogin() {
  const { adminLogin } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(v => ({ ...v, [f]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password) { setError('Enter email and password.'); return }
    setError('')
    setLoading(true)
    const res = await adminLogin(form.email, form.password)
    setLoading(false)
    if (res.success) {
      addToast('Admin access granted.', 'success')
      navigate('/admin', { replace: true })
    } else {
      setError(res.error || 'Invalid credentials.')
    }
  }

  const inputClass = "rounded-md w-full font-ui text-[13px] px-3 py-2.5 outline-none"
  const inputStyle = { border: '1px solid rgba(255,255,255,0.1)', color: '#fff', background: 'rgba(255,255,255,0.06)' }

  return (
    <div style={{ background: DARK, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-8">
          <div className="mb-4 flex justify-center"><BrandLogo onDark className="h-12" /></div>
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-px w-8" style={{ background: GOLD, opacity: 0.3 }} />
            <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD, opacity: 0.7 }}>
              Admin Portal
            </span>
            <div className="h-px w-8" style={{ background: GOLD, opacity: 0.3 }} />
          </div>
          <h1 className="font-display font-800 text-[24px] text-white">Administration</h1>
        </div>

        <div className="rounded-lg p-8" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="rounded-md mb-5 px-4 py-3 font-ui text-[11px] leading-relaxed" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', color: 'rgba(212,175,55,0.8)' }}>
            <strong>Demo:</strong> admin@nblao.la / admin123
          </div>

          {error && (
            <div className="rounded-md mb-4 px-4 py-3 font-ui text-[12px]" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block font-ui text-[11px] font-600 mb-1.5 uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                className={inputClass}
                style={inputStyle}
                placeholder="admin@nblao.la"
              />
            </div>

            <div>
              <label className="block font-ui text-[11px] font-600 mb-1.5 uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  className={inputClass}
                  style={{ ...inputStyle, paddingRight: 44 }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 font-ui text-[11px]"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-md w-full font-ui text-[13px] font-600 py-3 text-white transition-colors disabled:opacity-50 mt-2"
              style={{ background: loading ? '#334155' : BLUE }}
            >
              {loading ? 'Authenticating…' : 'Sign In to Admin'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="font-ui text-[11px] no-underline hover:underline" style={{ color: 'rgba(255,255,255,0.3)' }}>
            ← Back to public site
          </Link>
        </div>
      </div>
    </div>
  )
}
