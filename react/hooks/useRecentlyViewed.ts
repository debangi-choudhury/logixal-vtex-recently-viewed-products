import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApolloClient, useQuery } from 'react-apollo'
import { useRuntime } from 'vtex.render-runtime'
import { useRenderSession } from 'vtex.session-client'

import recentlyViewedQuery from '../graphql/recentlyViewed.gql'
import recordRecentlyViewedMutation from '../graphql/recordRecentlyViewed.gql'
import settingsQuery from '../graphql/recentlyViewedSettings.gql'
import type { StoredHistory } from '../utils/storage'
import {
  addView,
  canShowHistory,
  readHistory,
  reconcileOwner,
  subscribeToHistory,
} from '../utils/storage'
import type { SyncOptions } from '../utils/sync'
import { scheduleSync, syncHistory } from '../utils/sync'

interface SettingsData {
  recentlyViewedSettings: {
    enableSync: boolean
    maxItems: number
    retentionDays: number
  }
}

const DEFAULT_LIMITS = { maxItems: 30, retentionDays: 90 }
const EMPTY_ITEMS: StoredHistory['items'] = []
const INITIAL_HISTORY: StoredHistory = {
  owner: null,
  items: EMPTY_ITEMS,
  syncedAt: null,
}

/**
 * Local history for the current shopper. Starts empty and reads localStorage
 * after mount, so server-rendered and hydrated markup match.
 */
export function useRecentlyViewed() {
  const { account } = useRuntime()
  const client = useApolloClient()
  const { loading: sessionLoading, error, session } = useRenderSession()
  const { data } = useQuery<SettingsData>(settingsQuery, { ssr: false })
  const [history, setHistory] = useState(INITIAL_HISTORY)

  const settings = data?.recentlyViewedSettings
  const maxItems = settings?.maxItems ?? DEFAULT_LIMITS.maxItems
  const retentionDays = settings?.retentionDays ?? DEFAULT_LIMITS.retentionDays
  const limits = useMemo(
    () => ({ maxItems, retentionDays }),
    [maxItems, retentionDays]
  )

  const { profile } = session?.namespaces ?? {}
  const isAuthenticated = profile?.isAuthenticated?.value === 'true'
  const shopperId = isAuthenticated ? profile?.id?.value ?? null : null
  const sessionKnown = !sessionLoading && !error && Boolean(session?.namespaces)
  const canSync =
    sessionKnown && Boolean(shopperId) && settings?.enableSync === true

  const syncOptions = useMemo<SyncOptions>(
    () => ({
      account,
      limits,
      transport: {
        pull: () =>
          client
            .query({ query: recentlyViewedQuery, fetchPolicy: 'no-cache' })
            .then((result) => result.data.recentlyViewed.items),
        push: (views) =>
          client
            .mutate({
              mutation: recordRecentlyViewedMutation,
              variables: { items: views },
              fetchPolicy: 'no-cache',
            })
            .then((result) => result.data.recordRecentlyViewed.items),
      },
    }),
    [account, client, limits]
  )

  useEffect(() => {
    const refresh = () => setHistory(readHistory(account))

    refresh()

    return subscribeToHistory(account, refresh)
  }, [account])

  useEffect(() => {
    // Don't wait for settings: logout must clear history even if they fail.
    if (!sessionKnown) {
      return
    }

    reconcileOwner(account, shopperId, canSync)

    if (canSync) {
      syncHistory(syncOptions)
    }
  }, [account, canSync, sessionKnown, shopperId, syncOptions])

  const recordView = useCallback(
    (productId: string) => {
      addView(account, productId, limits)

      if (canSync) {
        scheduleSync(syncOptions)
      }
    },
    [account, canSync, limits, syncOptions]
  )

  const items = canShowHistory(history, sessionKnown, shopperId)
    ? history.items
    : EMPTY_ITEMS

  return { items, recordView }
}
