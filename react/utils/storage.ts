import type { HistoryItem, HistoryLimits } from './history'
import { mergeHistory } from './history'

export interface StoredHistory {
  /** Shopper this history syncs with. Null while it belongs to no account. */
  owner: string | null
  items: HistoryItem[]
  /** Views newer than this haven't reached Master Data yet. */
  syncedAt: number | null
}

const UPDATE_EVENT = 'recently-viewed-products:updated'

const EMPTY: StoredHistory = { owner: null, items: [], syncedAt: null }

const storageKey = (account: string) => `recently-viewed-products:v1:${account}`

export function isStorageAvailable() {
  try {
    const probe = `${UPDATE_EVENT}:probe`

    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)

    return true
  } catch {
    return false
  }
}

export function readHistory(account: string): StoredHistory {
  try {
    const stored = window.localStorage.getItem(storageKey(account))
    const parsed = stored ? JSON.parse(stored) : null

    return parsed && Array.isArray(parsed.items)
      ? { ...EMPTY, ...parsed }
      : EMPTY
  } catch {
    return EMPTY
  }
}

export function writeHistory(account: string, history: StoredHistory) {
  try {
    window.localStorage.setItem(storageKey(account), JSON.stringify(history))
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT))
  } catch {
    // Storage can be full or blocked. The shelf just stays empty in that case.
  }
}

export function addView(
  account: string,
  productId: string,
  limits: HistoryLimits,
  now = Date.now()
) {
  const history = readHistory(account)
  const view = { productId, viewedAt: new Date(now).toISOString() }

  writeHistory(account, {
    ...history,
    items: mergeHistory([history.items, [view]], limits, now),
  })
}

/**
 * Applies the rules for shared devices once the session is known. History tied
 * to one shopper is removed as soon as they log out or someone else logs in.
 * History that isn't tied to anyone, as when sync is off, is left alone.
 */
export function reconcileOwner(
  account: string,
  shopperId: string | null,
  syncEnabled: boolean
) {
  let history = readHistory(account)

  if (history.owner && history.owner !== shopperId) {
    history = EMPTY
    writeHistory(account, history)
  }

  if (shopperId && syncEnabled && history.owner !== shopperId) {
    writeHistory(account, { ...history, owner: shopperId, syncedAt: null })
  }
}

/**
 * History tied to a shopper is only shown once the session confirms that same
 * shopper, so the next person on a device never sees it, even while loading.
 */
export const canShowHistory = (
  { owner }: StoredHistory,
  sessionKnown: boolean,
  shopperId: string | null
) => !owner || (sessionKnown && owner === shopperId)

/** Calls the listener when this tab or another one changes the history. */
export function subscribeToHistory(account: string, listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey(account)) {
      listener()
    }
  }

  window.addEventListener(UPDATE_EVENT, listener)
  window.addEventListener('storage', onStorage)

  return () => {
    window.removeEventListener(UPDATE_EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}
