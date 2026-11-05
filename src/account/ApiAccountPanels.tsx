/*
 * Customer account panels for API mode (Phase 1E): the profile and status come from the server session, and
 * the password change goes to the server (which signs out every other session). Orders, quotations, addresses
 * and loyalty keep their local demo data until Phase 1F.
 */
import { useState } from 'react'
import { useAuth } from '../auth'
import { authApi, describeError } from '../auth/apiClient'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const inputStyle = { border: '1px solid var(--nb-border)', color: 'var(--nb-navy)', background: '#fff', padding: '10px 12px', width: '100%', fontFamily: 'Inter, sans-serif', fontSize: 13, outline: 'none' }

export function AccountStatusBanner() {
  const { user, source } = useAuth()
  if (source !== 'api' || user?.status !== 'PENDING') return null
  return (
    <div role="status" className="rounded-md mb-5 px-4 py-3 font-ui text-[13px] leading-relaxed" style={{ background: '#fef3c7', border: '1px solid #f3dca0', color: '#92400e' }}>
      <strong className="font-600">Your account is awaiting approval.</strong> NB LAO reviews new business accounts before trade features are enabled. You can keep browsing, comparing products and requesting quotes in the meantime.
    </div>
  )
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }}>{label}</div>
      <div className="rounded-md font-ui text-[13px]" style={{ ...inputStyle, background: 'var(--nb-surface)' }} data-i18n-skip>{value || '—'}</div>
    </div>
  )
}

export function ApiProfile() {
  const { user } = useAuth()
  if (!user) return null
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
  return (
    <div>
      <h2 className="font-display font-700 text-[22px] mb-6" style={{ color: NAVY }}>My Profile</h2>
      <AccountStatusBanner />
      <div className="rounded-lg bg-white p-7" style={{ border: '1px solid var(--nb-border)' }}>
        <div className="flex items-center gap-5 mb-8 pb-6" style={{ borderBottom: '1px solid var(--nb-bg)' }}>
          <div className="w-16 h-16 flex items-center justify-center font-display font-800 text-white text-[24px]" style={{ background: NAVY }} data-i18n-skip>{initials}</div>
          <div>
            <div className="font-display font-700 text-[18px]" style={{ color: NAVY }} data-i18n-skip>{user.firstName} {user.lastName}</div>
            <div className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }} data-i18n-skip>{user.email}</div>
            <div className="font-ui text-[12px] mt-1" style={{ color: '#94a3b8' }}>
              {user.status === 'ACTIVE' ? 'Approved account' : 'Awaiting approval'}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <ReadOnly label="First Name" value={user.firstName} />
          <ReadOnly label="Last Name" value={user.lastName} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <ReadOnly label="Email" value={user.email} />
          <ReadOnly label="Phone" value={user.phone} />
        </div>
        <ReadOnly label="Company" value={user.company} />
        <p className="font-ui text-[12px] mt-5" style={{ color: '#94a3b8' }}>To change these details, please contact NB LAO.</p>
      </div>
    </div>
  )
}

export function ApiPasswordChange() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(v => ({ ...v, [field]: e.target.value }))
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setDone(false)
    if (!form.currentPassword || !form.newPassword) return setError('Enter your current and your new password.')
    if ([...form.newPassword].length < 12) return setError('Use at least 12 characters.')
    if (form.newPassword !== form.confirm) return setError('Passwords do not match.')
    setBusy(true)
    setError('')
    try {
      await authApi.post('/auth/customer/password', { currentPassword: form.currentPassword, newPassword: form.newPassword }, 'customer')
      // The server rotated this session; read the new CSRF token before the next change.
      await authApi.get<{ csrfToken: string }>('/auth/customer/session').then(body => authApi.setCsrf('customer', body.csrfToken))
      setForm({ currentPassword: '', newPassword: '', confirm: '' })
      setDone(true)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <h2 className="font-display font-700 text-[22px] mb-6" style={{ color: NAVY }}>Change Password</h2>
      <form onSubmit={submit} className="rounded-lg bg-white p-7 max-w-md" style={{ border: '1px solid var(--nb-border)' }}>
        {error && <div role="alert" className="rounded-md mb-4 px-4 py-3 font-ui text-[12px]" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>{error}</div>}
        {done && <div role="status" className="rounded-md mb-4 px-4 py-3 font-ui text-[12px]" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>Password updated. Other devices were signed out.</div>}
        <div className="flex flex-col gap-4 mb-6">
          <div>
            <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }} htmlFor="acc-pw-current">Current Password</label>
            <input id="acc-pw-current" className="rounded-md" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} style={inputStyle} />
          </div>
          <div>
            <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }} htmlFor="acc-pw-new">New Password</label>
            <input id="acc-pw-new" className="rounded-md" type="password" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} style={inputStyle} placeholder="Min. 12 characters" />
          </div>
          <div>
            <label className="block font-ui text-[12px] font-600 mb-1.5" style={{ color: NAVY }} htmlFor="acc-pw-confirm">Confirm New Password</label>
            <input id="acc-pw-confirm" className="rounded-md" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} style={inputStyle} />
          </div>
        </div>
        <button type="submit" disabled={busy} className="rounded-md font-ui text-[13px] font-600 px-6 py-2.5 text-white disabled:opacity-60" style={{ background: BLUE }}>
          {busy ? 'Please wait…' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
