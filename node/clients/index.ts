import type { ClientsConfig, ServiceContext } from '@vtex/api'
import { IOClients, LRUCache } from '@vtex/api'
import { masterDataFor } from '@vtex/clients'

import type { RecentlyViewedDocument } from '../utils/history'
import VtexId from './vtexId'

export class Clients extends IOClients {
  public get vtexId() {
    return this.getOrSet('vtexId', VtexId)
  }

  // Uses the app token by design. The shopper's token can't reach this app's
  // entity, and granting it access would mean making fields public. The
  // shopper is still validated first with their own token, in getShopperId.
  public get history() {
    return this.getOrSet(
      'history',
      masterDataFor<RecentlyViewedDocument>('recentlyViewed')
    )
  }
}

declare global {
  type Context = ServiceContext<Clients>
}

const TIMEOUT_MS = 3000
const settingsCache = new LRUCache<string, any>({ max: 100 })

metrics.trackCache('recently-viewed-settings', settingsCache)

// Only app settings are cached in memory. Shopper documents must never be.
const clients: ClientsConfig<Clients> = {
  implementation: Clients,
  options: {
    default: {
      retries: 2,
      timeout: TIMEOUT_MS,
    },
    apps: {
      memoryCache: settingsCache,
    },
  },
}

export default clients
