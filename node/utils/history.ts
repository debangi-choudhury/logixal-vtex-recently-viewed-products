export interface HistoryItem {
  productId: string
  viewedAt: string
}

export interface HistoryLimits {
  maxItems: number
  retentionDays: number
}

export interface RecentlyViewedDocument {
  items: HistoryItem[]
  lastActivityAt: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const PRODUCT_ID_PATTERN = /^[\w-]{1,64}$/

export const retentionCutoff = (retentionDays: number, now: number) =>
  now - retentionDays * DAY_MS

/**
 * Keeps the newest view of each product, drops expired views, and caps the
 * result, newest first. react/utils/history.ts holds the same logic for the
 * browser, so change both together.
 */
export function mergeHistory(
  lists: HistoryItem[][],
  { maxItems, retentionDays }: HistoryLimits,
  now: number
): HistoryItem[] {
  const cutoff = retentionCutoff(retentionDays, now)
  const newest = new Map<string, { item: HistoryItem; time: number }>()

  lists.forEach((list) =>
    list.forEach((item) => {
      const time = Date.parse(item.viewedAt)
      const current = newest.get(item.productId)

      if (time >= cutoff && (!current || time > current.time)) {
        newest.set(item.productId, { item, time })
      }
    })
  )

  return Array.from(newest.values())
    .sort((a, b) => b.time - a.time)
    .slice(0, maxItems)
    .map(({ item }) => item)
}

/**
 * Normalizes shopper-supplied views. Malformed ones are dropped, and future
 * dates are moved to now so they can't stay at the top of the history.
 */
export function sanitizeItems(
  items: HistoryItem[],
  now: number
): HistoryItem[] {
  return items.reduce<HistoryItem[]>((valid, { productId, viewedAt }) => {
    const time = Date.parse(viewedAt)

    if (PRODUCT_ID_PATTERN.test(productId) && !Number.isNaN(time)) {
      valid.push({
        productId,
        viewedAt: new Date(Math.min(time, now)).toISOString(),
      })
    }

    return valid
  }, [])
}
