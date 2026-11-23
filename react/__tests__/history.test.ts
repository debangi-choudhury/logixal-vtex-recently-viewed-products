import { mergeHistory } from '../utils/history'
import { chunk, isAvailable, sortByIds } from '../utils/products'

const NOW = Date.parse('2026-11-04T12:00:00.000Z')
const view = (productId: string, viewedAt: string) => ({ productId, viewedAt })

describe('mergeHistory', () => {
  it('matches the service for newest-wins, expiry and the cap', () => {
    const merged = mergeHistory(
      [
        [
          view('1', '2026-11-01T00:00:00.000Z'),
          view('expired', '2026-01-01T00:00:00.000Z'),
        ],
        [
          view('1', '2026-11-03T00:00:00.000Z'),
          view('2', '2026-11-02T00:00:00.000Z'),
          view('3', '2026-10-30T00:00:00.000Z'),
        ],
      ],
      { maxItems: 2, retentionDays: 90 },
      NOW
    )

    expect(merged).toEqual([
      view('1', '2026-11-03T00:00:00.000Z'),
      view('2', '2026-11-02T00:00:00.000Z'),
    ])
  })
})

describe('product helpers', () => {
  it('splits lists into groups', () => {
    expect(chunk(['1', '2', '3'], 2)).toEqual([['1', '2'], ['3']])
  })

  it('restores the history order and drops unrequested products', () => {
    const products = [
      { productId: '2' },
      { productId: '9' },
      { productId: '1' },
    ]

    expect(sortByIds(products, ['1', '2'])).toEqual([
      { productId: '1' },
      { productId: '2' },
    ])
  })

  it('treats a product with no stock or no items as unavailable', () => {
    const offer = (AvailableQuantity: number) => ({
      productId: '1',
      items: [{ sellers: [{ commertialOffer: { AvailableQuantity } }] }],
    })

    expect(isAvailable(offer(1))).toBe(true)
    expect(isAvailable(offer(0))).toBe(false)
    expect(isAvailable({ productId: '1' })).toBe(false)
  })
})
