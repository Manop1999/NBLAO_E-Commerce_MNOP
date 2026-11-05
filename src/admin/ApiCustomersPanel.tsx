/*
 * Admin Portal → Customers in API mode (Phase 1E): approval, rejection, suspension, reactivation, team/owner
 * assignment, invitations and password reset links.
 *
 * The server is the only authority: it filters the list to the signed-in staff member's scope (Sales see only
 * their own customers, Managers their team plus unassigned ones), checks every permission again, refuses an
 * approval by the person who sent or requested the invitation, and asks for a fresh 2FA code before status
 * decisions, invitations, invitation-request decisions and reset links (the same operation is retried after the
 * confirmation). Buttons are hidden here only for convenience; hiding is never the protection.
 *
 * Managers request invitations; Admins and Super Admins review the requests and issue the invitation links. A
 * request never reveals whether the email already has an account (the requester only sees Submitted/Processed).
 *
 * One-time links are shown once in a dialog, kept in memory only, and excluded from page translation.
 */
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth'
import { ApiRequestError, authApi, describeError } from '../auth/apiClient'
import { Modal } from '../components/Modal'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'

type CustomerStatus = 'INVITED' | 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED'

interface AdminCustomer {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string
  companyName: string
  status: CustomerStatus
  createdAt: string
  statusReason: string | null
  team: { id: string; name: string } | null
  assignedStaff: { id: string; displayName: string } | null
  /** Returned to Super Admins only. */
  invitedById?: string | null
  invitedByMe: boolean
  /** True when the signed-in staff member requested this customer's invitation. */
  requestedByMe: boolean
  approvedAt: string | null
}

/** Reviewers see the real status; requesters only SUBMITTED / PROCESSED. */
type RequestStatus = 'PENDING' | 'ISSUED' | 'DECLINED' | 'SUBMITTED' | 'PROCESSED'

interface InvitationRequestRow {
  id: string
  email: string
  firstName: string
  lastName: string
  companyName: string
  team: { id: string; name: string } | null
  status: RequestStatus
  createdAt: string
  /** Reviewers only. */
  requestedBy?: { id: string; displayName: string; role: string } | null
  requestedByMe?: boolean
  existingCustomer?: { id: string; status: CustomerStatus; team: { id: string; name: string } | null } | null
}

const REQUEST_LABELS: Record<RequestStatus, string> = {
  PENDING: 'Awaiting review',
  ISSUED: 'Invitation issued',
  DECLINED: 'Declined',
  SUBMITTED: 'Awaiting review',
  PROCESSED: 'Processed',
}

interface CustomerPage {
  items: AdminCustomer[]
  total: number
  page: number
  pageSize: number
}

interface IssuedLink {
  path: string
  expiresAt: string
}

interface AssignmentOptions {
  teams: { id: string; name: string }[]
  staff: { id: string; displayName: string; role: string; teamId: string | null }[]
}

const STATUS_LABELS: Record<CustomerStatus, string> = {
  INVITED: 'Invited',
  PENDING: 'Awaiting approval',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
}
const STATUS_COLORS: Record<CustomerStatus, [string, string]> = {
  INVITED: ['#eef2ff', '#4338ca'],
  PENDING: ['#fef3c7', '#92400e'],
  ACTIVE: ['#dcfce7', '#166534'],
  REJECTED: ['#fee2e2', '#991b1b'],
  SUSPENDED: ['#f1f5f9', '#475569'],
}

const ACTION_NOTICES = {
  approve: 'Customer approved.',
  reject: 'Customer rejected.',
  suspend: 'Customer suspended.',
  reactivate: 'Customer reactivated.',
} as const

const fullLink =(link: IssuedLink) => `${window.location.origin}${import.meta.env.BASE_URL}${link.path}`

const inputClass = 'rounded-md w-full font-ui text-[13px] px-3 py-2 outline-none'
const inputStyle = { border: '1px solid var(--nb-border)', color: NAVY, background: '#fff' }
const smallButton = 'rounded-sm font-ui text-[11px] font-600 px-2.5 py-1 whitespace-nowrap'

function StatusBadge({ status }: { status: CustomerStatus }) {
  const [background, color] = STATUS_COLORS[status]
  return (
    <span className="inline-block rounded-sm font-ui text-[10px] font-700 tracking-wide uppercase px-2 py-0.5" style={{ background, color }}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function ErrorText({ message }: { message: string }) {
  if (!message) return null
  return <div role="alert" className="rounded-md mb-3 px-3 py-2 font-ui text-[12px]" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>{message}</div>
}

/** Fresh 2FA confirmation for sensitive actions (valid for 5 minutes on the server). */
function StepUpDialog({ open, onClose, onConfirmed }: { open: boolean; onClose: () => void; onConfirmed: () => void }) {
  const { refreshStaff } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await authApi.post('/auth/staff/mfa/verify', { code: code.trim() }, 'staff')
      setCode('')
      await refreshStaff()
      onConfirmed()
    } catch (err) {
      setError(describeError(err))
      await refreshStaff()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Confirm with your authenticator" maxWidth={420}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>This action needs a fresh two-factor confirmation. Enter the current code from your authenticator app.</p>
        <ErrorText message={error} />
        <input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={20} className={inputClass} style={inputStyle} placeholder="123456" aria-label="Authentication code" data-i18n-skip />
        <button type="submit" disabled={busy || !code.trim()} className="rounded-md font-ui text-[13px] font-600 py-2.5 text-white disabled:opacity-50" style={{ background: BLUE }}>
          {busy ? 'Please wait…' : 'Confirm'}
        </button>
      </form>
    </Modal>
  )
}

function LinkDialog({ link, title, onClose }: { link: IssuedLink | null; title: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  if (!link) return null
  const url = fullLink(link)
  return (
    <Modal open onClose={onClose} title={title} maxWidth={560}>
      <p className="font-ui text-[13px] mb-3" style={{ color: 'var(--nb-text-secondary)' }}>
        This link is shown only once and works only once. Share it only with this person, through a channel you trust. It expires on{' '}
        <span data-i18n-skip>{new Date(link.expiresAt).toLocaleString()}</span>.
      </p>
      <code data-i18n-skip className="block rounded-md px-3 py-2.5 font-mono text-[12px] break-all select-all mb-3" style={{ background: 'var(--nb-surface)', border: '1px solid var(--nb-border)', color: NAVY }}>
        {url}
      </code>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(url).then(() => setCopied(true))}
          className="rounded-md font-ui text-[12px] font-600 px-4 py-2 text-white"
          style={{ background: BLUE }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <button type="button" onClick={onClose} className="rounded-md font-ui text-[12px] px-4 py-2" style={{ border: '1px solid var(--nb-border)', color: '#475569' }}>
          Done
        </button>
      </div>
    </Modal>
  )
}

function ReasonDialog({ action, onClose, onSubmit }: { action: { label: string; required: boolean; hint?: string } | null; onClose: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  if (!action) return null
  return (
    <Modal open onClose={onClose} title={action.label} maxWidth={460}>
      <form
        onSubmit={async event => {
          event.preventDefault()
          setBusy(true)
          await onSubmit(reason.trim())
          setBusy(false)
          setReason('')
        }}
        className="flex flex-col gap-3"
      >
        <label className="font-ui text-[12px] font-600" style={{ color: NAVY }} htmlFor="status-reason">
          Reason {action.required ? '' : '(optional)'}
        </label>
        <textarea id="status-reason" value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={500} className={inputClass} style={inputStyle} />
        <p className="font-ui text-[11px]" style={{ color: '#94a3b8' }}>{action.hint ?? 'The reason is saved with the account and in the audit log.'}</p>
        <button type="submit" disabled={busy || (action.required && !reason.trim())} className="rounded-md font-ui text-[13px] font-600 py-2.5 text-white disabled:opacity-50" style={{ background: BLUE }}>
          {busy ? 'Please wait…' : action.label}
        </button>
      </form>
    </Modal>
  )
}

function AssignDialog({ customer, options, onClose, onSave }: { customer: AdminCustomer | null; options: AssignmentOptions | null; onClose: () => void; onSave: (body: { teamId: string | null; assignedStaffId: string | null }) => Promise<void> }) {
  const [teamId, setTeamId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setTeamId(customer?.team?.id ?? '')
    setStaffId(customer?.assignedStaff?.id ?? '')
  }, [customer])
  if (!customer) return null
  const owners = (options?.staff ?? []).filter(person => !teamId || person.teamId === teamId)
  return (
    <Modal open onClose={onClose} title="Assign customer" maxWidth={460}>
      <div className="flex flex-col gap-3">
        <p className="font-ui text-[13px]" style={{ color: 'var(--nb-text-secondary)' }}>
          <span data-i18n-skip>{customer.companyName}</span>
        </p>
        <label className="font-ui text-[12px] font-600" style={{ color: NAVY }} htmlFor="assign-team">Team</label>
        <select id="assign-team" value={teamId} onChange={e => { setTeamId(e.target.value); setStaffId('') }} className={inputClass} style={inputStyle}>
          <option value="">No team (unassigned)</option>
          {(options?.teams ?? []).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
        </select>
        <label className="font-ui text-[12px] font-600" style={{ color: NAVY }} htmlFor="assign-owner">Sales owner</label>
        <select id="assign-owner" value={staffId} onChange={e => setStaffId(e.target.value)} className={inputClass} style={inputStyle}>
          <option value="">No owner</option>
          {owners.map(person => <option key={person.id} value={person.id}>{person.displayName}</option>)}
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await onSave({ teamId: teamId || null, assignedStaffId: staffId || null })
            setBusy(false)
          }}
          className="rounded-md font-ui text-[13px] font-600 py-2.5 text-white disabled:opacity-50 mt-1"
          style={{ background: BLUE }}
        >
          {busy ? 'Please wait…' : 'Save assignment'}
        </button>
      </div>
    </Modal>
  )
}

const EMPTY_INVITE = { email: '', firstName: '', lastName: '', phone: '', companyName: '', teamId: '' }

/**
 * `invite` (Admin, Super Admin): creates the invitation and returns its one-time link.
 * `request` (Manager): files a request for an Admin to review; the answer is the same whatever the email.
 */
function InviteDialog({ open, mode, options, onClose, onInvited, onRequested, onStepUp }: { open: boolean; mode: 'invite' | 'request'; options: AssignmentOptions | null; onClose: () => void; onInvited: (link: IssuedLink) => void; onRequested: () => void; onStepUp: (retry: () => void) => void }) {
  const [form, setForm] = useState(EMPTY_INVITE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (field: keyof typeof EMPTY_INVITE) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(v => ({ ...v, [field]: e.target.value }))
  type InviteBody = { email: string; firstName: string; lastName: string; phone: string; companyName: string; teamId?: string }
  const send = async (body: InviteBody) => {
    setBusy(true)
    setError('')
    try {
      if (mode === 'request') {
        await authApi.post('/admin/customers/invitation-requests', body, 'staff')
        setForm(EMPTY_INVITE)
        onRequested()
        return
      }
      const result = await authApi.post<{ link: IssuedLink }>('/admin/customers/invitations', body, 'staff')
      setForm(EMPTY_INVITE)
      onInvited(result.link)
    } catch (err) {
      // A direct invitation needs a fresh 2FA confirmation; afterwards the exact same invitation is sent again.
      if (err instanceof ApiRequestError && err.code === 'step_up_required') {
        onStepUp(() => void send(body))
        return
      }
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    void send({ email: form.email, firstName: form.firstName, lastName: form.lastName, phone: form.phone, companyName: form.companyName, ...(form.teamId ? { teamId: form.teamId } : {}) })
  }
  const field = (id: keyof typeof EMPTY_INVITE, label: string, type = 'text') => (
    <div>
      <label className="block font-ui text-[12px] font-600 mb-1" style={{ color: NAVY }} htmlFor={`invite-${id}`}>{label}</label>
      <input id={`invite-${id}`} type={type} value={form[id]} onChange={set(id)} required className={inputClass} style={inputStyle} />
    </div>
  )
  return (
    <Modal open={open} onClose={onClose} title={mode === 'request' ? 'Request a customer invitation' : 'Invite a customer'} maxWidth={520}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === 'request' ? (
          <p className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>
            An Admin reviews your request and sends the invitation. The account then awaits approval by another authorized staff member — you cannot approve a customer whose invitation you requested.
          </p>
        ) : (
          <p className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>
            The customer receives a one-time link (valid 72 hours) to choose a password. The account then awaits approval by another authorized staff member — you cannot approve a customer you invited.
          </p>
        )}
        <ErrorText message={error} />
        {field('email', 'Email', 'email')}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field('firstName', 'First Name')}
          {field('lastName', 'Last Name')}
        </div>
        {field('phone', 'Phone', 'tel')}
        {field('companyName', 'Company')}
        {options && options.teams.length > 0 && (
          <div>
            <label className="block font-ui text-[12px] font-600 mb-1" style={{ color: NAVY }} htmlFor="invite-team">Team</label>
            <select id="invite-team" value={form.teamId} onChange={set('teamId')} className={inputClass} style={inputStyle}>
              <option value="">Default</option>
              {options.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </div>
        )}
        <button type="submit" disabled={busy} className="rounded-md font-ui text-[13px] font-600 py-2.5 text-white disabled:opacity-50 mt-1" style={{ background: BLUE }}>
          {busy ? 'Please wait…' : mode === 'request' ? 'Submit request' : 'Create invitation'}
        </button>
      </form>
    </Modal>
  )
}

/**
 * Invitation requests. Reviewers (Admin, Super Admin) see pending requests, whether the email already has an
 * account, and issue or decline them. Requesters see only their own requests as Submitted / Processed.
 */
function InvitationRequests({ reviewer, reloadKey, onIssued, onError, onStepUp }: { reviewer: boolean; reloadKey: number; onIssued: (link: IssuedLink) => void; onError: (err: unknown) => Promise<void>; onStepUp: (retry: () => void) => void }) {
  const [rows, setRows] = useState<InvitationRequestRow[] | null>(null)
  const [declining, setDeclining] = useState<InvitationRequestRow | null>(null)
  const load = useCallback(async () => {
    try {
      const result = await authApi.get<{ items: InvitationRequestRow[] }>(`/admin/customers/invitation-requests${reviewer ? '?status=PENDING' : ''}`)
      setRows(result.items)
    } catch (err) {
      await onError(err)
    }
  }, [reviewer, onError])

  useEffect(() => {
    void load()
  }, [load, reloadKey])

  // Issue and decline need a fresh 2FA confirmation; the retry repeats the same decision on the same request id
  // (and the same note). A refused attempt never changes the request on the server.
  const issue = async (row: InvitationRequestRow) => {
    try {
      const result = await authApi.post<{ link: IssuedLink }>(`/admin/customers/invitation-requests/${row.id}/issue`, {}, 'staff')
      onIssued(result.link)
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'step_up_required') {
        onStepUp(() => void issue(row))
        return
      }
      await onError(err)
    }
    await load()
  }

  const declineRequest = async (row: InvitationRequestRow, note: string) => {
    try {
      await authApi.post(`/admin/customers/invitation-requests/${row.id}/decline`, note ? { note } : {}, 'staff')
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'step_up_required') {
        onStepUp(() => void declineRequest(row, note))
        return
      }
      await onError(err)
    }
    await load()
  }

  const decline = async (note: string) => {
    const row = declining
    setDeclining(null)
    if (row) await declineRequest(row, note)
  }

  if (!rows || (reviewer && rows.length === 0)) return null
  return (
    <div className="mt-8">
      <h3 className="font-display font-700 text-[17px] mb-1" style={{ color: NAVY }}>Invitation requests</h3>
      <p className="font-ui text-[12px] mb-3" style={{ color: 'var(--nb-text-secondary)' }}>
        {reviewer
          ? 'Requests from Managers awaiting review. Issue the invitation, or decline the request. An email that already has an account is flagged.'
          : 'Your invitation requests. An Admin reviews each request; an invited customer appears in your list once the invitation is sent.'}
      </p>
      <div className="rounded-lg bg-white overflow-x-auto" style={{ border: '1px solid var(--nb-border)' }}>
        <table className="w-full" style={{ minWidth: 640 }}>
          <thead>
            <tr style={{ background: 'var(--nb-surface)', borderBottom: '1px solid var(--nb-border)' }}>
              {(reviewer ? ['Company', 'Contact', 'Team', 'Requested by', 'Status', 'Actions'] : ['Company', 'Contact', 'Team', 'Status', 'Requested']).map(heading => (
                <th key={heading} className="px-4 py-3 text-left font-ui text-[10px] font-700 tracking-widest uppercase" style={{ color: '#8f9faf' }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 font-ui text-[13px]" style={{ color: '#94a3b8' }}>No invitation requests yet.</td></tr>
            )}
            {rows.map((row, index) => (
              <tr key={row.id} style={{ borderBottom: '1px solid var(--nb-bg)', background: index % 2 === 0 ? '#fff' : 'var(--nb-surface)' }}>
                <td className="px-4 py-3 align-top font-ui text-[12px] font-600" style={{ color: NAVY }} data-i18n-skip>{row.companyName}</td>
                <td className="px-4 py-3 align-top">
                  <div className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }} data-i18n-skip>{row.firstName} {row.lastName}</div>
                  <div className="font-ui text-[11px]" style={{ color: '#8f9faf' }} data-i18n-skip>{row.email}</div>
                </td>
                <td className="px-4 py-3 align-top font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>
                  {row.team ? <span data-i18n-skip>{row.team.name}</span> : <span>Unassigned</span>}
                </td>
                {reviewer && (
                  <td className="px-4 py-3 align-top font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>
                    {row.requestedBy ? <span data-i18n-skip>{row.requestedBy.displayName}</span> : row.requestedByMe ? <span>You</span> : <span>—</span>}
                  </td>
                )}
                <td className="px-4 py-3 align-top">
                  <span className="inline-block rounded-sm font-ui text-[10px] font-700 tracking-wide uppercase px-2 py-0.5" style={{ background: '#eef2ff', color: '#4338ca' }}>{REQUEST_LABELS[row.status]}</span>
                  {reviewer && row.existingCustomer && (
                    <div className="font-ui text-[11px] mt-1 max-w-[220px]" style={{ color: '#92400e' }}>
                      <span>This email already has an account</span> (<span>{STATUS_LABELS[row.existingCustomer.status]}</span>)
                    </div>
                  )}
                </td>
                {reviewer ? (
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {!row.existingCustomer && (
                        <button type="button" onClick={() => void issue(row)} className={smallButton} style={{ background: '#16a34a', color: '#fff' }}>Issue invitation</button>
                      )}
                      <button type="button" onClick={() => setDeclining(row)} className={smallButton} style={{ border: '1px solid #fecaca', color: '#b91c1c' }}>Decline</button>
                    </div>
                  </td>
                ) : (
                  <td className="px-4 py-3 align-top font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }} data-i18n-skip>{row.createdAt.slice(0, 10)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ReasonDialog
        action={declining ? { label: 'Decline request', required: false, hint: 'The note is visible to Admins and Super Admins only.' } : null}
        onClose={() => setDeclining(null)}
        onSubmit={decline}
      />
    </div>
  )
}

export default function ApiCustomersPanel() {
  const { staff, refreshStaff } = useAuth()
  const can = (code: string) => staff?.permissions.includes(code) ?? false
  const [status, setStatus] = useState<'' | CustomerStatus>('PENDING')
  const [unassigned, setUnassigned] = useState(false)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<CustomerPage | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<AssignmentOptions | null>(null)
  const [reasonFor, setReasonFor] = useState<{ customer: AdminCustomer; action: 'reject' | 'suspend' | 'reactivate' } | null>(null)
  const [assigning, setAssigning] = useState<AdminCustomer | null>(null)
  const [inviting, setInviting] = useState(false)
  const [link, setLink] = useState<{ link: IssuedLink; title: string } | null>(null)
  const [stepUpRetry, setStepUpRetry] = useState<(() => void) | null>(null)
  const [requestsKey, setRequestsKey] = useState(0)
  const reviewer = can('customers.invite')
  const requester = !reviewer && can('customers.request_invite')

  /** Signed-out sessions go back to sign-in; everything else becomes a message. */
  const handleError = useCallback(
    async (err: unknown) => {
      if (err instanceof ApiRequestError && (err.status === 401 || err.code === 'stage_required')) {
        await refreshStaff()
        return
      }
      setError(describeError(err))
    },
    [refreshStaff],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ page: String(page) })
    if (status) query.set('status', status)
    if (unassigned) query.set('unassigned', 'true')
    try {
      setData(await authApi.get<CustomerPage>(`/admin/customers?${query.toString()}`))
    } catch (err) {
      await handleError(err)
    } finally {
      setLoading(false)
    }
  }, [page, status, unassigned, handleError])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!can('customers.assign')) return
    authApi.get<AssignmentOptions>('/admin/assignment-options').then(setOptions).catch(() => setOptions(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff?.id])

  const act = async (customer: AdminCustomer, action: 'approve' | 'reject' | 'suspend' | 'reactivate', reason?: string) => {
    setError('')
    setNotice('')
    try {
      await authApi.post(`/admin/customers/${customer.id}/${action}`, reason ? { reason } : {}, 'staff')
      setNotice(ACTION_NOTICES[action])
      setReasonFor(null)
      await load()
    } catch (err) {
      setReasonFor(null)
      // Status decisions need a fresh 2FA confirmation; retry the same decision (with its reason) afterwards.
      if (err instanceof ApiRequestError && err.code === 'step_up_required') {
        setStepUpRetry(() => () => void act(customer, action, reason))
        return
      }
      await handleError(err)
    }
  }

  const issueResetLink = async (customer: AdminCustomer) => {
    setError('')
    try {
      const result = await authApi.post<{ link: IssuedLink }>(`/admin/customers/${customer.id}/reset-link`, {}, 'staff')
      setLink({ link: result.link, title: 'Password reset link' })
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'step_up_required') {
        setStepUpRetry(() => () => void issueResetLink(customer))
        return
      }
      await handleError(err)
    }
  }

  const saveAssignment = async (body: { teamId: string | null; assignedStaffId: string | null }) => {
    if (!assigning) return
    try {
      await authApi.patch(`/admin/customers/${assigning.id}/assignment`, body, 'staff')
      setAssigning(null)
      setNotice('Assignment saved.')
      await load()
    } catch (err) {
      setAssigning(null)
      await handleError(err)
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="font-display font-700 text-[22px]" style={{ color: NAVY }}>Customer Management</h2>
        {(reviewer || requester) && (
          <button type="button" onClick={() => setInviting(true)} className="rounded-md font-ui text-[12px] font-600 px-4 py-2 text-white" style={{ background: BLUE }}>
            {reviewer ? 'Invite customer' : 'Request invitation'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }} htmlFor="customer-status-filter">Status</label>
        <select id="customer-status-filter" value={status} onChange={e => { setStatus(e.target.value as '' | CustomerStatus); setPage(1) }} className="rounded-md font-ui text-[12px] px-2 py-1.5" style={inputStyle}>
          <option value="">All</option>
          {(Object.keys(STATUS_LABELS) as CustomerStatus[]).map(value => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
        </select>
        {staff?.role !== 'SALES' && (
          <label className="flex items-center gap-2 font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>
            <input type="checkbox" checked={unassigned} onChange={e => { setUnassigned(e.target.checked); setPage(1) }} style={{ accentColor: BLUE }} />
            Unassigned only
          </label>
        )}
        <button type="button" onClick={() => void load()} className="rounded-md font-ui text-[12px] px-3 py-1.5" style={{ border: '1px solid var(--nb-border)', color: '#475569' }}>
          Refresh
        </button>
        {data && (
          <span className="font-ui text-[12px] ml-auto" style={{ color: '#94a3b8' }}>
            <span>Customers</span>: <span data-i18n-skip>{data.total}</span>
          </span>
        )}
      </div>

      <ErrorText message={error} />
      {notice && <div role="status" className="rounded-md mb-3 px-3 py-2 font-ui text-[12px]" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>{notice}</div>}

      <div className="rounded-lg bg-white overflow-x-auto" style={{ border: '1px solid var(--nb-border)' }}>
        <table className="w-full" style={{ minWidth: 760 }}>
          <thead>
            <tr style={{ background: 'var(--nb-surface)', borderBottom: '1px solid var(--nb-border)' }}>
              {['Company', 'Contact', 'Status', 'Team / Owner', 'Registered', 'Actions'].map(heading => (
                <th key={heading} className="px-4 py-3 text-left font-ui text-[10px] font-700 tracking-widest uppercase" style={{ color: '#8f9faf' }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !data && (
              <tr><td colSpan={6} className="px-4 py-6 font-ui text-[13px]" style={{ color: '#94a3b8' }}>Loading customers…</td></tr>
            )}
            {data && data.items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 font-ui text-[13px]" style={{ color: '#94a3b8' }}>No customers match this filter.</td></tr>
            )}
            {data?.items.map((customer, index) => {
              const decide = can('customers.approve') && (customer.status === 'PENDING' || customer.status === 'REJECTED')
              const ownInvitation = customer.invitedByMe || customer.requestedByMe
              return (
                <tr key={customer.id} style={{ borderBottom: '1px solid var(--nb-bg)', background: index % 2 === 0 ? '#fff' : 'var(--nb-surface)' }}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-ui text-[12px] font-600" style={{ color: NAVY }} data-i18n-skip>{customer.companyName}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }} data-i18n-skip>{customer.firstName} {customer.lastName}</div>
                    <div className="font-ui text-[11px]" style={{ color: '#8f9faf' }} data-i18n-skip>{customer.email}</div>
                    <div className="font-ui text-[11px]" style={{ color: '#8f9faf' }} data-i18n-skip>{customer.phone}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge status={customer.status} />
                    {customer.statusReason && <div className="font-ui text-[11px] mt-1 max-w-[220px]" style={{ color: '#8f9faf' }} data-i18n-skip>{customer.statusReason}</div>}
                  </td>
                  <td className="px-4 py-3 align-top font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }}>
                    {customer.team ? <span data-i18n-skip>{customer.team.name}</span> : <span>Unassigned</span>}
                    {customer.assignedStaff && <div className="text-[11px]" style={{ color: '#8f9faf' }} data-i18n-skip>{customer.assignedStaff.displayName}</div>}
                  </td>
                  <td className="px-4 py-3 align-top font-ui text-[12px]" style={{ color: 'var(--nb-text-secondary)' }} data-i18n-skip>
                    {customer.createdAt.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {decide && customer.invitedByMe && (
                        <span className="font-ui text-[11px] max-w-[200px]" style={{ color: '#92400e' }}>You invited this customer — another approver must decide.</span>
                      )}
                      {decide && !customer.invitedByMe && customer.requestedByMe && (
                        <span className="font-ui text-[11px] max-w-[200px]" style={{ color: '#92400e' }}>You requested this invitation — another approver must decide.</span>
                      )}
                      {decide && !ownInvitation && (
                        <>
                          <button type="button" onClick={() => void act(customer, 'approve')} className={smallButton} style={{ background: '#16a34a', color: '#fff' }}>Approve</button>
                          {customer.status === 'PENDING' && (
                            <button type="button" onClick={() => setReasonFor({ customer, action: 'reject' })} className={smallButton} style={{ border: '1px solid #fecaca', color: '#b91c1c' }}>Reject</button>
                          )}
                        </>
                      )}
                      {can('customers.approve') && (customer.status === 'ACTIVE' || customer.status === 'PENDING') && (
                        <button type="button" onClick={() => setReasonFor({ customer, action: 'suspend' })} className={smallButton} style={{ border: '1px solid var(--nb-border)', color: '#475569' }}>Suspend</button>
                      )}
                      {can('customers.approve') && customer.status === 'SUSPENDED' && (
                        <button type="button" onClick={() => setReasonFor({ customer, action: 'reactivate' })} className={smallButton} style={{ border: '1px solid var(--nb-border)', color: '#475569' }}>Reactivate</button>
                      )}
                      {can('customers.assign') && (
                        <button type="button" onClick={() => setAssigning(customer)} className={smallButton} style={{ border: '1px solid var(--nb-border)', color: '#475569' }}>Assign</button>
                      )}
                      {can('customers.reset_password') && customer.status !== 'INVITED' && (
                        <button type="button" onClick={() => void issueResetLink(customer)} className={smallButton} style={{ border: '1px solid var(--nb-border)', color: '#475569' }}>Reset link</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-2 mt-3 font-ui text-[12px]">
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-md px-3 py-1.5 disabled:opacity-40" style={{ border: '1px solid var(--nb-border)' }}>Previous</button>
          <span data-i18n-skip>{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="rounded-md px-3 py-1.5 disabled:opacity-40" style={{ border: '1px solid var(--nb-border)' }}>Next</button>
        </div>
      )}

      <ReasonDialog
        action={reasonFor ? { label: reasonFor.action === 'reject' ? 'Reject customer' : reasonFor.action === 'suspend' ? 'Suspend customer' : 'Reactivate customer', required: reasonFor.action !== 'reactivate' } : null}
        onClose={() => setReasonFor(null)}
        onSubmit={reason => (reasonFor ? act(reasonFor.customer, reasonFor.action, reason || undefined) : Promise.resolve())}
      />
      {(reviewer || requester) && (
        <InvitationRequests
          reviewer={reviewer}
          reloadKey={requestsKey}
          onError={handleError}
          onStepUp={retry => setStepUpRetry(() => retry)}
          onIssued={issued => {
            setLink({ link: issued, title: 'Invitation link' })
            void load()
          }}
        />
      )}

      <AssignDialog customer={assigning} options={options} onClose={() => setAssigning(null)} onSave={saveAssignment} />
      <InviteDialog
        open={inviting}
        mode={reviewer ? 'invite' : 'request'}
        options={options}
        onClose={() => setInviting(false)}
        onInvited={issued => {
          setInviting(false)
          setLink({ link: issued, title: 'Invitation link' })
          void load()
        }}
        onRequested={() => {
          setInviting(false)
          setNotice('Request submitted. An Admin will review it.')
          setRequestsKey(key => key + 1)
        }}
        onStepUp={retry => setStepUpRetry(() => retry)}
      />
      <LinkDialog link={link?.link ?? null} title={link?.title ?? ''} onClose={() => setLink(null)} />
      <StepUpDialog
        open={stepUpRetry !== null}
        onClose={() => setStepUpRetry(null)}
        onConfirmed={() => {
          const retry = stepUpRetry
          setStepUpRetry(null)
          retry?.()
        }}
      />
    </div>
  )
}
