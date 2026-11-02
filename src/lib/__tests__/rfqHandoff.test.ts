import { describe, expect, it } from 'vitest'
import { buildRfqMailto, buildRfqSummary, buildRfqWhatsAppUrl, MAX_NOTES_LENGTH, type RfqHandoffInput } from '../rfqHandoff'

const input = (overrides: Partial<RfqHandoffInput> = {}): RfqHandoffInput => ({
  reference: 'RFQ-2026-1234',
  company: { name: 'Acme Power', contact: 'Somchai', email: 'buyer@acme.test', phone: '+856 20 1234 5678', position: '', address: '' },
  requirements: { deliveryDate: '2026-12-01', deliveryLocation: '', budget: '', notes: '' },
  items: [
    { name: 'Power Transformer', sku: 'EE-TRF-001', qty: 2 },
    { name: 'Safety Helmet', sku: 'SF-HLM-001', variantLabel: 'Size L', qty: 40 },
  ],
  ...overrides,
})

describe('RFQ handoff summary', () => {
  it('lists every product with SKU, variant and quantity', () => {
    const text = buildRfqSummary(input())
    expect(text).toContain('Request for Quotation RFQ-2026-1234')
    expect(text).toContain('1. Power Transformer - SKU EE-TRF-001 - Qty 2')
    expect(text).toContain('2. Safety Helmet (Size L) - SKU SF-HLM-001 - Qty 40')
  })
  it('omits empty optional fields', () => {
    const text = buildRfqSummary(input())
    expect(text).toContain('Company: Acme Power')
    expect(text).toContain('Required by: 2026-12-01')
    expect(text).not.toContain('Position:')
    expect(text).not.toContain('Delivery location:')
    expect(text).not.toContain('Notes:')
  })
  it('leaves out the requirements section when nothing was entered', () => {
    const text = buildRfqSummary(input({ requirements: { deliveryDate: '', deliveryLocation: '', budget: '', notes: '  ' } }))
    expect(text).not.toContain('Requirements:')
  })
  it('truncates long notes', () => {
    const text = buildRfqSummary(input({ requirements: { deliveryDate: '', deliveryLocation: '', budget: '', notes: 'x'.repeat(MAX_NOTES_LENGTH + 50) } }))
    expect(text).toContain(`Notes: ${'x'.repeat(MAX_NOTES_LENGTH)}…`)
    expect(text).not.toContain('x'.repeat(MAX_NOTES_LENGTH + 1))
  })
})

describe('RFQ handoff links', () => {
  it('builds a mailto link with an encoded subject and body', () => {
    const url = buildRfqMailto('info@nblao.test', input())
    expect(url.startsWith('mailto:info@nblao.test?subject=')).toBe(true)
    const params = new URLSearchParams(url.slice(url.indexOf('?') + 1))
    expect(params.get('subject')).toBe('RFQ RFQ-2026-1234 - Acme Power')
    expect(params.get('body')).toBe(buildRfqSummary(input()))
  })
  it('builds a WhatsApp link from a phone number', () => {
    const url = buildRfqWhatsAppUrl('+856 20 5237 1258', input())
    expect(url.startsWith('https://wa.me/8562052371258?text=')).toBe(true)
    expect(decodeURIComponent(url.split('text=')[1] ?? '')).toBe(buildRfqSummary(input()))
  })
  it('appends to a wa.me link that already has a query string', () => {
    expect(buildRfqWhatsAppUrl('https://wa.me/8562052371258?lang=lo', input())).toContain('?lang=lo&text=')
  })
  it('returns an empty string for an unusable WhatsApp contact', () => {
    expect(buildRfqWhatsAppUrl('', input())).toBe('')
    expect(buildRfqWhatsAppUrl('javascript:alert(1)', input())).toBe('')
  })
})
