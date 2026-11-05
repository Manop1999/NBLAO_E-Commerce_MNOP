/**
 * Append-only audit log writer. There is deliberately no update or delete function, and the database trigger
 * from the auth_foundation migration rejects UPDATE, DELETE and TRUNCATE on audit_events.
 *
 * Details never contain passwords, tokens, codes, hashes, secrets, cookies or IP addresses: keys that look like
 * any of these are dropped before writing.
 */
import type { AuditCategory, Prisma, SubjectType } from '../generated/prisma/client.ts'
import type { Db } from './context.ts'

export interface AuditInput {
  category: AuditCategory
  type: string
  outcome: 'success' | 'failure' | 'denied'
  actor?: { type: SubjectType; id: string } | null
  subject?: { type: SubjectType; id: string } | null
  teamId?: string | null
  details?: Record<string, unknown>
  at: Date
}

const SENSITIVE_KEY = /pass|token|secret|code|hash|cookie|csrf|otp|authorization|apikey|privatekey|^ip$|^ipaddress$|^remoteaddress$/i

export function redactDetails(details: Record<string, unknown> | undefined): Prisma.InputJsonObject {
  const clean: Record<string, Prisma.InputJsonValue> = {}
  for (const [key, value] of Object.entries(details ?? {})) {
    if (SENSITIVE_KEY.test(key)) continue
    if (value === null || value === undefined) continue
    if (typeof value === 'string') clean[key] = value.slice(0, 500)
    else if (typeof value === 'number' || typeof value === 'boolean') clean[key] = value
    else if (Array.isArray(value)) clean[key] = value.filter(item => typeof item === 'string' || typeof item === 'number').slice(0, 20) as Prisma.InputJsonArray
  }
  return clean
}

export async function recordAudit(db: Db, event: AuditInput): Promise<void> {
  await db.auditEvent.create({
    data: {
      at: event.at,
      category: event.category,
      type: event.type,
      outcome: event.outcome,
      actorType: event.actor?.type ?? null,
      actorId: event.actor?.id ?? null,
      subjectType: event.subject?.type ?? null,
      subjectId: event.subject?.id ?? null,
      teamId: event.teamId ?? null,
      details: redactDetails(event.details),
    },
  })
}
