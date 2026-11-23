import { ForbiddenError, UserInputError } from '@vtex/api'

import type { HistoryItem } from '../utils/history'
import { mergeHistory, retentionCutoff, sanitizeItems } from '../utils/history'
import { getSettings } from '../utils/settings'
import { getShopperId } from '../utils/shopper'

const MAX_ITEMS_PER_REQUEST = 100
const PURGE_BATCH_SIZE = 100
const PURGE_RANGE_START = '2000-01-01T00:00:00.000Z'

const statusOf = (error: any) => error?.response?.status ?? error?.status
const isNotFound = (error: any) => statusOf(error) === 404

/**
 * Runs a Master Data call and logs a failure before passing it on. Logs carry
 * the operation and status only, never the shopper or their history.
 */
async function logFailure<T>(
  ctx: Context,
  operation: string,
  run: () => Promise<T>,
  { allowNotFound = false } = {}
): Promise<T | undefined> {
  try {
    return await run()
  } catch (error) {
    if (allowNotFound && isNotFound(error)) {
      return undefined
    }

    ctx.vtex.logger.error({
      message: 'Recently viewed history request failed',
      operation,
      status: statusOf(error) ?? null,
    })

    throw error
  }
}

async function readItems(
  ctx: Context,
  shopperId: string
): Promise<HistoryItem[]> {
  const document = await logFailure(
    ctx,
    'read',
    () => ctx.clients.history.get(shopperId, ['items']),
    { allowNotFound: true }
  )

  // Master Data answers a missing document with an empty 200, not only a 404.
  return (document as { items?: HistoryItem[] } | null | undefined)?.items ?? []
}

async function getSyncSettings(ctx: Context) {
  const settings = await getSettings(ctx)

  if (!settings.enableSync) {
    throw new ForbiddenError('History sync is turned off')
  }

  return settings
}

export const queries = {
  recentlyViewed: async (_: unknown, __: unknown, ctx: Context) => {
    const settings = await getSyncSettings(ctx)
    const shopperId = await getShopperId(ctx)
    const items = await readItems(ctx, shopperId)

    return { items: mergeHistory([items], settings, Date.now()) }
  },

  recentlyViewedSettings: (_: unknown, __: unknown, ctx: Context) =>
    getSettings(ctx),
}

export const mutations = {
  recordRecentlyViewed: async (
    _: unknown,
    { items }: { items: HistoryItem[] },
    ctx: Context
  ) => {
    if (items.length > MAX_ITEMS_PER_REQUEST) {
      throw new UserInputError('Too many items')
    }

    const settings = await getSyncSettings(ctx)
    const shopperId = await getShopperId(ctx)
    const now = Date.now()
    const stored = await readItems(ctx, shopperId)
    const merged = mergeHistory(
      [stored, sanitizeItems(items, now)],
      settings,
      now
    )

    await logFailure(ctx, 'save', () =>
      ctx.clients.history.saveOrUpdate({
        id: shopperId,
        items: merged,
        lastActivityAt: new Date(now).toISOString(),
      })
    )

    return { items: merged }
  },

  clearRecentlyViewed: async (_: unknown, __: unknown, ctx: Context) => {
    const shopperId = await getShopperId(ctx)

    await logFailure(
      ctx,
      'clear',
      () => ctx.clients.history.delete(shopperId),
      {
        allowNotFound: true,
      }
    )

    return true
  },

  purgeInactiveRecentlyViewed: async (
    _: unknown,
    __: unknown,
    ctx: Context
  ) => {
    const {
      clients: { history },
    } = ctx

    const { retentionDays } = await getSettings(ctx)
    const cutoff = new Date(retentionCutoff(retentionDays, Date.now()))
    const inactive =
      (await logFailure(ctx, 'purge-search', () =>
        history.search(
          { page: 1, pageSize: PURGE_BATCH_SIZE },
          ['id'],
          undefined,
          `lastActivityAt between ${PURGE_RANGE_START} AND ${cutoff.toISOString()}`
        )
      )) ?? []

    await logFailure(ctx, 'purge-delete', () =>
      Promise.all(inactive.map(({ id }: any) => history.delete(id as string)))
    )

    return inactive.length
  },
}
