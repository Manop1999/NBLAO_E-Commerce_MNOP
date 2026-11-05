/*
 * Staff sign-in steps after a correct password (API mode only). The server decides the step (session stage);
 * this screen only shows the matching form and re-reads the session afterwards:
 *   MFA_REQUIRED             → enter an authenticator code or a recovery code
 *   PASSWORD_CHANGE_REQUIRED → choose a new password
 *   MFA_ENROLLMENT_REQUIRED  → set up an authenticator app (QR code or key), confirm, save recovery codes
 *
 * Secrets shown here (setup key, QR code, recovery codes) are displayed once, kept in component memory only,
 * excluded from page translation and never written to storage.
 */
import { useState } from 'react'
import { useAuth, type StaffSession } from '../auth'
import { authApi, describeError } from '../auth/apiClient'

const GOLD = 'var(--nb-gold)'
const BLUE = 'var(--nb-primary)'

const inputClass = 'rounded-md w-full font-ui text-[13px] px-3 py-2.5 outline-none'
const inputStyle = { border: '1px solid rgba(255,255,255,0.1)', color: '#fff', background: 'rgba(255,255,255,0.06)' }
const labelClass = 'block font-ui text-[11px] font-600 mb-1.5 uppercase tracking-[0.08em]'
const labelStyle = { color: 'rgba(255,255,255,0.5)' }

function ErrorBox({ message }: { message: string }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-md mb-4 px-4 py-3 font-ui text-[12px]" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
      {message}
    </div>
  )
}

function SubmitButton({ busy, label, busyLabel = 'Please wait…' }: { busy: boolean; label: string; busyLabel?: string }) {
  return (
    <button type="submit" disabled={busy} className="rounded-md w-full font-ui text-[13px] font-600 py-3 text-white disabled:opacity-50 mt-2" style={{ background: busy ? '#334155' : BLUE }}>
      {busy ? busyLabel : label}
    </button>
  )
}

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-display font-700 text-[18px] text-white mb-1.5">{title}</h2>
      <p className="font-ui text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{text}</p>
    </div>
  )
}

function VerifyStep() {
  const { refreshStaff } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!code.trim()) return setError('Enter the 6-digit code from your authenticator app, or a recovery code.')
    setBusy(true)
    setError('')
    try {
      await authApi.post('/auth/staff/mfa/verify', { code: code.trim() }, 'staff')
      setCode('')
      await refreshStaff()
    } catch (err) {
      setError(describeError(err))
      // A revoked session (too many wrong codes) sends the user back to the sign-in form.
      await refreshStaff()
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Heading title="Two-factor verification" text="Open your authenticator app and enter the current 6-digit code for NB LAO. If you lost your phone, enter one of your recovery codes instead." />
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} style={labelStyle} htmlFor="mfa-code">Authentication code</label>
        <input id="mfa-code" value={code} onChange={e => setCode(e.target.value)} inputMode="text" autoComplete="one-time-code" maxLength={20} className={inputClass} style={inputStyle} placeholder="123456" data-i18n-skip />
      </div>
      <SubmitButton busy={busy} label="Verify" />
    </form>
  )
}

function PasswordStep() {
  const { refreshStaff } = useAuth()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(v => ({ ...v, [field]: e.target.value }))
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.currentPassword || !form.newPassword) return setError('Enter your current and your new password.')
    if ([...form.newPassword].length < 12) return setError('Use at least 12 characters.')
    if (form.newPassword !== form.confirm) return setError('Passwords do not match.')
    setBusy(true)
    setError('')
    try {
      await authApi.post('/auth/staff/password', { currentPassword: form.currentPassword, newPassword: form.newPassword }, 'staff')
      setForm({ currentPassword: '', newPassword: '', confirm: '' })
      await refreshStaff()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Heading title="Choose a new password" text="Please replace your initial password before continuing. Use at least 12 characters; a passphrase of several words works well." />
      <ErrorBox message={error} />
      <div>
        <label className={labelClass} style={labelStyle} htmlFor="pw-current">Current Password</label>
        <input id="pw-current" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} className={inputClass} style={inputStyle} />
      </div>
      <div>
        <label className={labelClass} style={labelStyle} htmlFor="pw-new">New Password</label>
        <input id="pw-new" type="password" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} className={inputClass} style={inputStyle} />
      </div>
      <div>
        <label className={labelClass} style={labelStyle} htmlFor="pw-confirm">Confirm New Password</label>
        <input id="pw-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} className={inputClass} style={inputStyle} />
      </div>
      <SubmitButton busy={busy} label="Save new password" />
    </form>
  )
}

interface Enrollment {
  manualKey: string
  qrCode: string
}

/** Used for first enrolment (forced for Super Admin, Admin and Manager). */
export function EnrollStep({ onFinished, onCodesShown }: { onFinished?: () => void; onCodesShown?: () => void }) {
  const { refreshStaff } = useAuth()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [code, setCode] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    setBusy(true)
    setError('')
    try {
      setEnrollment(await authApi.post<Enrollment>('/auth/staff/mfa/enroll/start', {}, 'staff'))
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const confirm = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the 6-digit code shown in your authenticator app.')
    setBusy(true)
    setError('')
    try {
      const result = await authApi.post<{ recoveryCodes: string[] }>('/auth/staff/mfa/enroll/confirm', { code: code.trim() }, 'staff')
      onCodesShown?.()
      setEnrollment(null)
      setCode('')
      setCodes(result.recoveryCodes)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  const finish = async () => {
    setCodes(null)
    await refreshStaff()
    onFinished?.()
  }

  if (codes) {
    return (
      <div className="flex flex-col gap-4">
        <Heading title="Save your recovery codes" text="Each code works once if you lose access to your authenticator app. Store them somewhere safe, such as a password manager. They will not be shown again." />
        <ol data-i18n-skip className="grid grid-cols-2 gap-2 font-mono text-[13px] rounded-md p-4" style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
          {codes.map(value => <li key={value}>{value}</li>)}
        </ol>
        <button type="button" onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))} className="rounded-md font-ui text-[12px] py-2" style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.75)' }}>
          Copy codes
        </button>
        <label className="flex items-start gap-2 font-ui text-[12px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
          <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} style={{ accentColor: BLUE, marginTop: 2 }} />
          <span>I have saved my recovery codes</span>
        </label>
        <button type="button" disabled={!saved} onClick={() => void finish()} className="rounded-md w-full font-ui text-[13px] font-600 py-3 text-white disabled:opacity-40" style={{ background: BLUE }}>
          Continue
        </button>
      </div>
    )
  }

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-4">
        <Heading title="Set up two-factor authentication" text="Your role requires two-factor authentication. Install an authenticator app (for example Google Authenticator, Microsoft Authenticator or Authy) on your phone, then continue." />
        <ErrorBox message={error} />
        <button type="button" disabled={busy} onClick={() => void start()} className="rounded-md w-full font-ui text-[13px] font-600 py-3 text-white disabled:opacity-50" style={{ background: BLUE }}>
          {busy ? 'Please wait…' : 'Set up authenticator'}
        </button>
      </div>
    )
  }

  // Only ever a data: URL of an SVG image; anything else is not rendered.
  const qrDataUrl = enrollment.qrCode.startsWith('data:image/svg+xml;base64,') ? enrollment.qrCode : undefined

  return (
    <form onSubmit={confirm} className="flex flex-col gap-4">
      <Heading title="Scan the QR code" text="Scan this code with your authenticator app, or enter the setup key by hand. Then type the 6-digit code the app shows." />
      <ErrorBox message={error} />
      <div className="flex justify-center">
        {/* Server-generated SVG as a data: URL (no network request, nothing stored). */}
        <img src={qrDataUrl} alt="QR code for your authenticator app" width={176} height={176} className="rounded-md" style={{ background: '#fff', padding: 8 }} />
      </div>
      <div>
        <div className={labelClass} style={labelStyle}>Setup key</div>
        <code data-i18n-skip className="block rounded-md px-3 py-2.5 font-mono text-[13px] break-all select-all" style={{ background: 'rgba(255,255,255,0.06)', color: GOLD, border: '1px solid rgba(255,255,255,0.1)' }}>
          {enrollment.manualKey}
        </code>
      </div>
      <div>
        <label className={labelClass} style={labelStyle} htmlFor="enroll-code">6-digit code</label>
        <input id="enroll-code" value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={inputClass} style={inputStyle} placeholder="123456" data-i18n-skip />
      </div>
      <SubmitButton busy={busy} label="Confirm and enable" />
    </form>
  )
}

/**
 * Renders the step the server asks for. While freshly issued recovery codes are on screen, the enrolment step
 * stays mounted even though the session is already FULL, and `onHold(true)` tells the caller not to navigate.
 */
export default function StaffStageFlow({ staff, onHold }: { staff: StaffSession; onHold?: (hold: boolean) => void }) {
  const { adminLogout } = useAuth()
  const [showingCodes, setShowingCodes] = useState(false)
  const hold = (value: boolean) => {
    setShowingCodes(value)
    onHold?.(value)
  }
  return (
    <div>
      <div className="font-ui text-[11px] mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
        Signed in as <span data-i18n-skip style={{ color: 'rgba(255,255,255,0.75)' }}>{staff.email}</span>
      </div>
      {!showingCodes && staff.stage === 'MFA_REQUIRED' && <VerifyStep />}
      {!showingCodes && staff.stage === 'PASSWORD_CHANGE_REQUIRED' && <PasswordStep />}
      {(showingCodes || staff.stage === 'MFA_ENROLLMENT_REQUIRED') && <EnrollStep onCodesShown={() => hold(true)} onFinished={() => hold(false)} />}
      <button type="button" onClick={() => void adminLogout()} className="mt-5 w-full font-ui text-[12px] no-underline hover:underline" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Cancel and sign out
      </button>
    </div>
  )
}
