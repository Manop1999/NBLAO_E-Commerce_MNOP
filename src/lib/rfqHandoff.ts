/*
 * The prototype has no backend, so an RFQ is never transmitted by the site itself. These helpers turn the
 * prepared RFQ into plain text the customer can send to NB LAO by email or WhatsApp.
 */
import { getWhatsAppUrl } from '../content'

export interface RfqHandoffItem {
  name: string
  sku: string
  variantLabel?: string
  qty: number
}

export interface RfqHandoffInput {
  reference: string
  company: { name: string; contact: string; email: string; phone: string; position: string; address: string }
  requirements: { deliveryDate: string; deliveryLocation: string; budget: string; notes: string }
  items: RfqHandoffItem[]
}

// Keeps the mailto/WhatsApp URL within what mail clients and browsers reliably accept.
export const MAX_NOTES_LENGTH = 500

export function buildRfqSummary({ reference, company, requirements, items }: RfqHandoffInput): string {
  const lines: string[] = [`Request for Quotation ${reference}`, '']

  lines.push('Products:')
  items.forEach((item, index) => {
    const variant = item.variantLabel ? ` (${item.variantLabel})` : ''
    lines.push(`${index + 1}. ${item.name}${variant} - SKU ${item.sku} - Qty ${item.qty}`)
  })
  lines.push('')

  lines.push('Company:')
  const companyFields: [string, string][] = [
    ['Company', company.name],
    ['Contact', company.contact],
    ['Position', company.position],
    ['Email', company.email],
    ['Phone', company.phone],
    ['Address', company.address],
  ]
  for (const [label, value] of companyFields) if (value.trim()) lines.push(`${label}: ${value.trim()}`)

  const notes = requirements.notes.trim()
  const requirementFields: [string, string][] = [
    ['Required by', requirements.deliveryDate],
    ['Delivery location', requirements.deliveryLocation],
    ['Budget (USD)', requirements.budget],
    ['Notes', notes.length > MAX_NOTES_LENGTH ? `${notes.slice(0, MAX_NOTES_LENGTH)}…` : notes],
  ]
  const filled = requirementFields.filter(([, value]) => value.trim())
  if (filled.length) {
    lines.push('', 'Requirements:')
    for (const [label, value] of filled) lines.push(`${label}: ${value.trim()}`)
  }

  return lines.join('\n')
}

export function buildRfqMailto(email: string, input: RfqHandoffInput): string {
  const subject = `RFQ ${input.reference}${input.company.name.trim() ? ` - ${input.company.name.trim()}` : ''}`
  return `mailto:${email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildRfqSummary(input))}`
}

/** Returns '' when the configured WhatsApp contact is not a usable number or wa.me link. */
export function buildRfqWhatsAppUrl(whatsapp: string, input: RfqHandoffInput): string {
  const base = getWhatsAppUrl(whatsapp)
  if (!base) return ''
  return `${base}${base.includes('?') ? '&' : '?'}text=${encodeURIComponent(buildRfqSummary(input))}`
}
