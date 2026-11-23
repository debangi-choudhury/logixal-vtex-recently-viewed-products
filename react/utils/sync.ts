import type { HistoryItem, HistoryLimits } from './history'
import { mergeHistory } from './history'
import { isStorageAvailable, readHistory, writeHistory } from './storage'

export interface SyncTransport {
  pull: () => Promise<HistoryItem[]>
  push: (items: HistoryItem[]) => Promise<HistoryItem[]>
}

export interface SyncOptions {
  account: string
  limits: HistoryLimits
  transport: SyncTransport
}

const PULL_INTERVAL_MS = 5 * 60 * 1000
const WRITE_DEBOUNCE_MS = 3000

let running: Promise<void> | null = null
let timer: ReturnType<typeof setTimeout> | null = null

async function runSync({ account, limits, transport }: SyncOptions) {
  if (!isStorageAvailable()) {
    return
  }

  const startedAt = Date.now()
  const { owner, items, syncedAt } = readHistory(account)

  // A sync scheduled before logout must not send the next shopper's views.
  if (owner === null) {
    return
  }

  const pending = items.filter(
    ({ viewedAt }) => syncedAt === null || Date.parse(viewedAt) > syncedAt
  )

  if (
    !pending.length &&
    syncedAt !== null &&
    startedAt - syncedAt < PULL_INTERVAL_MS
  ) {
    return
  }

  const remote = pending.length
    ? await transport.push(pending)
    : await transport.pull()

  // Read again: the shopper may have viewed a product or logged out meanwhile.
  const latest = readHistory(account)

  if (latest.owner !== owner) {
    return
  }

  writeHistory(account, {
    ...latest,
    items: mergeHistory([latest.items, remote], limits, Date.now()),
    syncedAt: startedAt,
  })
}

/**
 * Sends views that haven't been synced and brings in those from other devices.
 * On failure the views stay pending, and the next page load tries again.
 */
export function syncHistory(options: SyncOptions) {
  if (!running) {
    running = runSync(options)
      .catch(() => {})
      .then(() => {
        running = null
      })
  }

  return running
}

/** Groups the views of a browsing burst into a single write. */
export function scheduleSync(options: SyncOptions) {
  if (timer) {
    clearTimeout(timer)
  }

  timer = setTimeout(() => {
    timer = null
    syncHistory(options)
  }, WRITE_DEBOUNCE_MS)
}
