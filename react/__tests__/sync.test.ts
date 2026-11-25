import type { HistoryItem } from '../utils/history'
import {
  addView,
  canShowHistory,
  readHistory,
  reconcileOwner,
  writeHistory,
} from '../utils/storage'
import { syncHistory } from '../utils/sync'

const ACCOUNT = 'store'
const LIMITS = { maxItems: 30, retentionDays: 90 }

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const ids = (items: HistoryItem[]) => items.map(({ productId }) => productId)

function buildOptions(remote: HistoryItem[] = []) {
  const transport = {
    pull: jest.fn(async () => remote),
    push: jest.fn(async (views: HistoryItem[]) => [...remote, ...views]),
  }

  return { account: ACCOUNT, limits: LIMITS, transport }
}

beforeEach(() => window.localStorage.clear())

describe('local history', () => {
  it('survives a new read, as after a browser restart', () => {
    addView(ACCOUNT, '1', LIMITS)

    expect(ids(readHistory(ACCOUNT).items)).toEqual(['1'])
  })

  it('moves a product back to the top when viewed again', () => {
    const now = Date.now()

    addView(ACCOUNT, '1', LIMITS, now - 2000)
    addView(ACCOUNT, '2', LIMITS, now - 1000)
    addView(ACCOUNT, '1', LIMITS, now)

    expect(ids(readHistory(ACCOUNT).items)).toEqual(['1', '2'])
  })

  it('recovers from corrupted storage', () => {
    window.localStorage.setItem('recently-viewed-products:v1:store', '{broken')

    expect(readHistory(ACCOUNT).items).toEqual([])
  })

  it('keeps accounts apart', () => {
    addView(ACCOUNT, '1', LIMITS)

    expect(readHistory('other').items).toEqual([])
  })
})

describe('shared devices', () => {
  it('leaves no history behind after logout', () => {
    addView(ACCOUNT, '1', LIMITS)
    reconcileOwner(ACCOUNT, 'shopper-a', true)
    reconcileOwner(ACCOUNT, null, true)

    expect(readHistory(ACCOUNT)).toEqual({
      owner: null,
      items: [],
      syncedAt: null,
    })
  })

  it('does not show one shopper the history of another', () => {
    addView(ACCOUNT, '1', LIMITS)
    reconcileOwner(ACCOUNT, 'shopper-a', true)
    reconcileOwner(ACCOUNT, 'shopper-b', true)

    expect(readHistory(ACCOUNT).items).toEqual([])
    expect(readHistory(ACCOUNT).owner).toBe('shopper-b')
  })

  it('keeps anonymous history at login so it can merge', () => {
    addView(ACCOUNT, '1', LIMITS)
    reconcileOwner(ACCOUNT, 'shopper-a', true)

    expect(ids(readHistory(ACCOUNT).items)).toEqual(['1'])
  })

  it('keeps history after logout when sync is off', () => {
    addView(ACCOUNT, '1', LIMITS)
    reconcileOwner(ACCOUNT, 'shopper-a', false)
    reconcileOwner(ACCOUNT, null, false)

    expect(ids(readHistory(ACCOUNT).items)).toEqual(['1'])
  })

  it('hides a shopper history until the session confirms that shopper', () => {
    const owned = { owner: 'shopper-a', items: [], syncedAt: null }

    expect(canShowHistory(owned, false, null)).toBe(false)
    expect(canShowHistory(owned, true, null)).toBe(false)
    expect(canShowHistory(owned, true, 'shopper-b')).toBe(false)
    expect(canShowHistory(owned, true, 'shopper-a')).toBe(true)
  })

  it('shows history that belongs to nobody straight away', () => {
    expect(
      canShowHistory({ owner: null, items: [], syncedAt: null }, false, null)
    ).toBe(true)
  })
})

describe('syncHistory', () => {
  it('sends nothing once nobody owns the history', async () => {
    addView(ACCOUNT, '1', LIMITS)

    const options = buildOptions()

    await syncHistory(options)

    expect(options.transport.push).not.toHaveBeenCalled()
    expect(options.transport.pull).not.toHaveBeenCalled()
  })

  it('drops the response if another shopper logs in mid-request', async () => {
    addView(ACCOUNT, '1', LIMITS)
    reconcileOwner(ACCOUNT, 'shopper-a', true)

    const options = buildOptions()

    options.transport.push.mockImplementation(async () => {
      reconcileOwner(ACCOUNT, 'shopper-b', true)

      return [{ productId: 'private', viewedAt: ago(1000) }]
    })

    await syncHistory(options)

    expect(readHistory(ACCOUNT).owner).toBe('shopper-b')
    expect(readHistory(ACCOUNT).items).toEqual([])
  })

  it('pushes anonymous views at login and keeps other devices views', async () => {
    addView(ACCOUNT, 'local', LIMITS)
    reconcileOwner(ACCOUNT, 'shopper-a', true)

    const options = buildOptions([{ productId: 'remote', viewedAt: ago(5000) }])

    await syncHistory(options)

    expect(ids(options.transport.push.mock.calls[0][0])).toEqual(['local'])
    expect(
      ids(readHistory(ACCOUNT).items).sort((a, b) => a.localeCompare(b))
    ).toEqual(['local', 'remote'])
    expect(readHistory(ACCOUNT).syncedAt).not.toBeNull()
  })

  it('pulls on a new device that has nothing local', async () => {
    reconcileOwner(ACCOUNT, 'shopper-a', true)

    const options = buildOptions([{ productId: 'remote', viewedAt: ago(5000) }])

    await syncHistory(options)

    expect(options.transport.pull).toHaveBeenCalledTimes(1)
    expect(options.transport.push).not.toHaveBeenCalled()
    expect(ids(readHistory(ACCOUNT).items)).toEqual(['remote'])
  })

  it('makes no request when recently synced with nothing pending', async () => {
    writeHistory(ACCOUNT, {
      owner: 'shopper-a',
      items: [{ productId: '1', viewedAt: ago(60000) }],
      syncedAt: Date.now() - 1000,
    })

    const options = buildOptions()

    await syncHistory(options)

    expect(options.transport.pull).not.toHaveBeenCalled()
    expect(options.transport.push).not.toHaveBeenCalled()
  })

  it('pulls again once the last sync is old', async () => {
    writeHistory(ACCOUNT, {
      owner: 'shopper-a',
      items: [],
      syncedAt: Date.now() - 10 * 60 * 1000,
    })

    const options = buildOptions()

    await syncHistory(options)

    expect(options.transport.pull).toHaveBeenCalledTimes(1)
  })

  it('sends only views newer than the last sync', async () => {
    writeHistory(ACCOUNT, {
      owner: 'shopper-a',
      items: [
        { productId: 'new', viewedAt: ago(1000) },
        { productId: 'old', viewedAt: ago(60000) },
      ],
      syncedAt: Date.now() - 30000,
    })

    const options = buildOptions()

    await syncHistory(options)

    expect(ids(options.transport.push.mock.calls[0][0])).toEqual(['new'])
  })

  it('keeps views pending when the request fails', async () => {
    addView(ACCOUNT, '1', LIMITS)
    reconcileOwner(ACCOUNT, 'shopper-a', true)

    const options = buildOptions()

    options.transport.push.mockRejectedValue(new Error('Network'))

    await syncHistory(options)

    expect(ids(readHistory(ACCOUNT).items)).toEqual(['1'])
    expect(readHistory(ACCOUNT).syncedAt).toBeNull()
  })

  it('does not write remote history back if logout happens mid-request', async () => {
    addView(ACCOUNT, '1', LIMITS)
    reconcileOwner(ACCOUNT, 'shopper-a', true)

    const options = buildOptions()

    options.transport.push.mockImplementation(async () => {
      reconcileOwner(ACCOUNT, null, true)

      return [{ productId: 'private', viewedAt: ago(1000) }]
    })

    await syncHistory(options)

    expect(readHistory(ACCOUNT).items).toEqual([])
  })

  it('shares one request between the tracker and the shelf', async () => {
    addView(ACCOUNT, '1', LIMITS)
    reconcileOwner(ACCOUNT, 'shopper-a', true)

    const options = buildOptions()

    await Promise.all([syncHistory(options), syncHistory(options)])

    expect(options.transport.push).toHaveBeenCalledTimes(1)
  })
})

describe('a view recorded as a sync starts', () => {
  it('is sent with the next sync, even in the same millisecond', async () => {
    const startedAt = Date.now() - 1000

    // The last sync started in the same millisecond as this view
    writeHistory(ACCOUNT, {
      owner: 'shopper-1',
      items: [{ productId: '7', viewedAt: new Date(startedAt).toISOString() }],
      syncedAt: startedAt,
    })

    const options = buildOptions()

    await syncHistory(options)

    expect(options.transport.push).toHaveBeenCalledTimes(1)
    expect(ids(options.transport.push.mock.calls[0][0])).toEqual(['7'])
    expect(options.transport.pull).not.toHaveBeenCalled()
  })

  it('is not sent again once a later sync has covered it', async () => {
    const viewedAt = Date.now() - 2000

    writeHistory(ACCOUNT, {
      owner: 'shopper-1',
      items: [{ productId: '7', viewedAt: new Date(viewedAt).toISOString() }],
      syncedAt: viewedAt + 1,
    })

    const options = buildOptions()

    await syncHistory(options)

    expect(options.transport.push).not.toHaveBeenCalled()
  })
})
