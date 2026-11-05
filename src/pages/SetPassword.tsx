/*
 * /account/set-password#<token> — one page for customer invitations, staff setup links and password reset
 * links (API mode). The token travels in the URL fragment, which browsers never send to a server, and is removed
 * from the address bar as soon as the page has read it, so it does not stay in history or bookmarks.
 *
 * Setting the password never signs anyone in: an invited customer's account then awaits approval, and staff
 * sign in normally (with 2FA where enrolled or required).
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import { useAuth } from '../auth'
import { ApiRequestError, authApi, describeError } from '../auth/apiClient'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const GOLD = 'var(--nb-gold)'

const inputClass = 'rounded-md w-full font-ui text-[13px] px-3 py-2.5 outline-none'
const inputStyle = { border: '1px solid var(--nb-border)', color: NAVY, background: '#fff' }

interface TokenInfo {
  purpose: 'INVITATION' | 'PASSWORD_RESET'
  account: 'staff' | 'customer'
  email: string
}

declare global {
  interface Window {
    /** Set by the inline script in index.html, which removes the token from the address bar before anything loads. */
    __nblaoAccountLinkToken?: string
  }
}

// Kept in memory only (React may run state initialisers twice in development).
let lastToken = ''

/**
 * Takes the one-time token: normally already moved out of the address bar by index.html; as a fallback (for
 * example after client-side navigation to a link) reads the fragment and strips it here.
 */
function takeTokenFromUrl(): string {
  const early = window.__nblaoAccountLinkToken
  if (early) {
    lastToken = early
    delete window.__nblaoAccountLinkToken
  }
  const fromHash = window.location.hash.replace(/^#/, '')
  if (fromHash) {
    lastToken = fromHash
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  }
  return lastToken
}

export default function SetPassword() {
  const { source } = useAuth()
  const [token] = useState(() => (source === 'api' ? takeTokenFromUrl() : ''))
  const [info, setInfo] = useState<TokenInfo | null>(null)
  const [state, setState] = useState<'checking' | 'invalid' | 'form' | 'done'>(token ? 'checking' : 'invalid')
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    authApi
      .post<TokenInfo>('/auth/account-token/inspect', { token })
      .then(result => {
        if (cancelled) return
        setInfo(result)
        setState('form')
      })
      .catch(() => {
        if (!cancelled) setState('invalid')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if ([...form.password].length < 12) return setError('Use at least 12 characters.')
    if (form.password !== form.confirm) return setError('Passwords do not match.')
    setBusy(true)
    setError('')
    try {
      await authApi.post('/auth/account-token/complete', { token, password: form.password })
      setForm({ password: '', confirm: '' })
      lastToken = ''
      setState('done')
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'invalid_token') {
        lastToken = ''
        setState('invalid')
      }
      else setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const invitation = info?.purpose === 'INVITATION'
  const signInPath = info?.account === 'staff' ? '/admin/login' : '/login'
  const title = state === 'done' ? 'Password saved' : invitation ? 'Set up your account' : 'Choose a new password'

  return (
    <div style={{ background: 'var(--nb-bg)', minHeight: '100vh' }}>
      <div style={{ background: NAVY, padding: '10px 0' }}>
        <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <BrandLogo onDark className="h-8" />
          </Link>
        </div>
      </div>
      <div className="flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px w-10" style={{ background: GOLD, opacity: 0.5 }} />
              <span className="font-ui text-[10px] tracking-[0.22em] uppercase font-600" style={{ color: GOLD }}>Account Security</span>
              <div className="h-px w-10" style={{ background: GOLD, opacity: 0.5 }} />
            </div>
            <h1 className="font-display font-800 text-[28px] leading-tight" style={{ color: NAVY }}>{title}</h1>
          </div>
          <div className="rounded-lg bg-white p-8" style={{ border: '1px solid var(--nb-border)' }}>
            {source !== 'api' && (
              <p className="font-ui text-[13px] leading-relaxed" style={{ color: 'var(--nb-text-secondary)' }}>
                Account links are not available in this prototype. Please contact NB LAO.
              </p>
            )}
            {source === 'api' && state === 'checking' && <p className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>Checking your link…</p>}
            {source === 'api' && state === 'invalid' && (
              <div className="font-ui text-[13px] leading-relaxed" style={{ color: 'var(--nb-text-secondary)' }}>
                <p className="mb-4">This link is invalid or has expired. Each link works only once. Please ask NB LAO for a new link.</p>
                <Link to="/" className="font-600 no-underline hover:underline" style={{ color: BLUE }}>Back to website</Link>
              </div>
            )}
            {source === 'api' && state === 'form' && info && (
              <form onSubmit={submit} className="flex flex-col gap-4">
                <p className="font-ui text-[13px] leading-relaxed" style={{ color: 'var(--nb-text-secondary)' }}>
                  {invitation ? 'Choose a password for your NB LAO account:' : 'Choose a new password for:'}{' '}
                  <strong data-i18n-skip style={{ color: NAVY }}>{info.email}</strong>
                </p>
                {error && (
                  <div role="alert" className="rounded-md px-4 py-3 font-ui text-[12px]" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>{error}</div>
                )}
                <div>
                  <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }} htmlFor="sp-new">New Password</label>
                  <input id="sp-new" type="password" autoComplete="new-password" value={form.password} onChange={e => setForm(v => ({ ...v, password: e.target.value }))} className={inputClass} style={inputStyle} placeholder="Min. 12 characters" />
                </div>
                <div>
                  <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }} htmlFor="sp-confirm">Confirm New Password</label>
                  <input id="sp-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={e => setForm(v => ({ ...v, confirm: e.target.value }))} className={inputClass} style={inputStyle} />
                </div>
                <button type="submit" disabled={busy} className="rounded-md w-full font-ui text-[13px] font-600 py-3 text-white disabled:opacity-60" style={{ background: BLUE }}>
                  {busy ? 'Please wait…' : 'Save password'}
                </button>
              </form>
            )}
            {source === 'api' && state === 'done' && (
              <div className="font-ui text-[13px] leading-relaxed" style={{ color: 'var(--nb-text-secondary)' }}>
                <p className="mb-4">
                  {invitation && info?.account === 'customer'
                    ? 'Your password is saved. Your account now awaits approval by NB LAO; you can already sign in to see its status.'
                    : 'Your password is saved. You can now sign in. Any other signed-in sessions were signed out.'}
                </p>
                <Link to={signInPath} className="rounded-md block w-full font-600 py-3 text-white text-center no-underline" style={{ background: BLUE }}>Go to sign in</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
