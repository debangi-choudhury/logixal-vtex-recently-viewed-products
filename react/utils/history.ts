export interface HistoryItem {
  productId: string
  viewedAt: string
}

export interface HistoryLimits {
  maxItems: number
  retentionDays: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Keeps the newest view of each product, drops expired views, and caps the
 * result, newest first. node/utils/history.ts holds the same logic for the
 * service, so change both together.
 */
export function mergeHistory(
  lists: HistoryItem[][],
  { maxItems, retentionDays }: HistoryLimits,
  now: number
): HistoryItem[] {
  const cutoff = now - retentionDays * DAY_MS
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
