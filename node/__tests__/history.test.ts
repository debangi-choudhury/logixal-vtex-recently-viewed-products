import { mergeHistory, sanitizeItems } from '../utils/history'

const NOW = Date.parse('2026-11-04T12:00:00.000Z')
const LIMITS = { maxItems: 3, retentionDays: 90 }
const view = (productId: string, viewedAt: string) => ({ productId, viewedAt })

describe('mergeHistory', () => {
  it('keeps the newest view of each product, newest first', () => {
    const merged = mergeHistory(
      [
        [view('1', '2026-11-01T00:00:00.000Z')],
        [
          view('1', '2026-11-03T00:00:00.000Z'),
          view('2', '2026-11-02T00:00:00.000Z'),
        ],
      ],
      LIMITS,
      NOW
    )

    expect(merged).toEqual([
      view('1', '2026-11-03T00:00:00.000Z'),
      view('2', '2026-11-02T00:00:00.000Z'),
    ])
  })

  it('drops views older than the retention period', () => {
    expect(
      mergeHistory([[view('1', '2026-01-01T00:00:00.000Z')]], LIMITS, NOW)
    ).toEqual([])
  })

  it('caps the result and keeps the newest views', () => {
    const items = ['1', '2', '3', '4'].map((id) =>
      view(id, `2026-11-0${id}T00:00:00.000Z`)
    )

    expect(
      mergeHistory([items], LIMITS, NOW).map(({ productId }) => productId)
    ).toEqual(['4', '3', '2'])
  })

  it('ignores unparseable dates', () => {
    expect(mergeHistory([[view('1', 'not-a-date')]], LIMITS, NOW)).toEqual([])
  })
})

describe('sanitizeItems', () => {
  it('drops malformed product ids and dates', () => {
    expect(
      sanitizeItems(
        [
          view('../other-doc', '2026-11-01T00:00:00.000Z'),
          view('1', 'yesterday'),
          view('2', '2026-11-01T00:00:00.000Z'),
        ],
        NOW
      )
    ).toEqual([view('2', '2026-11-01T00:00:00.000Z')])
  })

  it('moves future dates to now', () => {
    expect(sanitizeItems([view('1', '2030-01-01T00:00:00.000Z')], NOW)).toEqual(
      [view('1', new Date(NOW).toISOString())]
    )
  })
})
