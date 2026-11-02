import { describe, expect, it } from 'vitest'
import { pageTitleFor, SITE_TITLE } from '../pageTitle'

describe('page titles', () => {
  it('uses the site title on the homepage', () => {
    expect(pageTitleFor('/')).toBe(SITE_TITLE)
    expect(pageTitleFor('')).toBe(SITE_TITLE)
  })
  it('names sections, including nested and trailing-slash paths', () => {
    expect(pageTitleFor('/products')).toBe('Products | NB LAO')
    expect(pageTitleFor('/products/12/')).toBe('Products | NB LAO')
    expect(pageTitleFor('/account/orders/NB-2026-0001')).toBe('Order Details | NB LAO')
    expect(pageTitleFor('/admin/login')).toBe('Admin Sign In | NB LAO')
    expect(pageTitleFor('/admin/products')).toBe('Admin | NB LAO')
  })
  it('does not match a prefix inside a longer word', () => {
    expect(pageTitleFor('/products-old')).toBe('Page Not Found | NB LAO')
    expect(pageTitleFor('/nowhere')).toBe('Page Not Found | NB LAO')
  })
  it('never mentions Figma', () => {
    for (const path of ['/', '/rfq', '/x']) expect(pageTitleFor(path)).not.toMatch(/figma/i)
  })
})
