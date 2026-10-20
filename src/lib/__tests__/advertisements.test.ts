import { describe, expect, it } from 'vitest'
import { type Advertisement, DEFAULT_ADVERTISEMENTS, getActiveAdvertisements, restoreMainCampaigns } from '../../content'

const ad = (overrides: Partial<Advertisement>): Advertisement => ({
  ...DEFAULT_ADVERTISEMENTS[0],
  id: 'ad-1',
  titleEn: 'Custom',
  image: '/advertisements/custom.png',
  ...overrides,
})
const mainImages = (list: Advertisement[]) =>
  getActiveAdvertisements(list).filter(item => item.placement === 'main').map(item => item.image)
const EXPECTED = ['/advertisements/test001.png', '/advertisements/test002.png', '/advertisements/test003.png']

describe('restoreMainCampaigns', () => {
  it('shows only the three bundled campaigns, in order, when an uploaded banner held the main carousel', () => {
    const annualTrip = ad({ id: 'ad-1730000000000', titleEn: 'NB LAO Annual Trip 2026', image: 'data:image/jpeg;base64,AAAA', displayOrder: 1 })
    const result = restoreMainCampaigns([annualTrip])
    expect(mainImages(result)).toEqual(EXPECTED)
    // The uploaded ad is kept (not deleted) but no longer active, so an Admin can re-enable it.
    expect(result.find(item => item.id === annualTrip.id)).toEqual({ ...annualTrip, active: false })
  })

  it('restores a campaign whose image was replaced, keeping its Admin-edited title and link', () => {
    const edited = { ...DEFAULT_ADVERTISEMENTS[0], titleEn: 'Annual Trip', image: 'data:image/png;base64,BBBB', destinationUrl: '/products', active: false, endDate: '2020-01-01' }
    const result = restoreMainCampaigns([edited, DEFAULT_ADVERTISEMENTS[1]])
    expect(mainImages(result)).toEqual(EXPECTED)
    expect(result[0]).toMatchObject({ id: 'ad-campaign-001', titleEn: 'Annual Trip', destinationUrl: '/products', active: true, placement: 'main', startDate: '', endDate: '' })
    // The uploaded image is not lost: it is kept as its own inactive ad an Admin can re-enable.
    expect(result).toContainEqual({ ...edited, id: 'ad-campaign-001-previous-image', active: false })
  })

  it('leaves side advertisements and already-inactive ads untouched', () => {
    const side = ad({ id: 'ad-side', placement: 'side', image: 'data:image/png;base64,CCCC' })
    const inactive = ad({ id: 'ad-old', active: false })
    const result = restoreMainCampaigns([...DEFAULT_ADVERTISEMENTS, side, inactive])
    expect(result).toContainEqual(side)
    expect(result).toContainEqual(inactive)
    expect(mainImages(result)).toEqual(EXPECTED)
  })

  it('never creates duplicate ids when it runs again after the restored flag is lost', () => {
    const first = restoreMainCampaigns([{ ...DEFAULT_ADVERTISEMENTS[0], image: 'data:image/png;base64,FIRST' }, ...DEFAULT_ADVERTISEMENTS.slice(1)])
    // Campaign 1's image is replaced again, then the one-time update runs a second (and third) time.
    const replaceAgain = (list: Advertisement[], image: string) => list.map(item => (item.id === 'ad-campaign-001' ? { ...item, image } : item))
    const second = restoreMainCampaigns(replaceAgain(first, 'data:image/png;base64,SECOND'))
    const third = restoreMainCampaigns(replaceAgain(second, 'data:image/png;base64,THIRD'))
    for (const list of [first, second, third]) {
      const ids = list.map(item => item.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(mainImages(list)).toEqual(EXPECTED)
    }
    // Every replaced image is still there, each under its own id, and none was overwritten.
    const copies = third.filter(item => item.id.startsWith('ad-campaign-001-previous-image')).sort((a, b) => a.id.localeCompare(b.id))
    expect(copies.map(item => [item.id, item.image, item.active])).toEqual([
      ['ad-campaign-001-previous-image', 'data:image/png;base64,FIRST', false],
      ['ad-campaign-001-previous-image-2', 'data:image/png;base64,SECOND', false],
      ['ad-campaign-001-previous-image-3', 'data:image/png;base64,THIRD', false],
    ])
  })

  it('is a no-op for the default list and stable when applied twice', () => {
    expect(restoreMainCampaigns(DEFAULT_ADVERTISEMENTS)).toEqual(DEFAULT_ADVERTISEMENTS)
    const once = restoreMainCampaigns([ad({ id: 'x' }), DEFAULT_ADVERTISEMENTS[2]])
    expect(restoreMainCampaigns(once)).toEqual(once)
  })
})
