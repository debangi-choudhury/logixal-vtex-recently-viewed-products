import React from 'react'
import { act, screen, waitFor } from '@testing-library/react'
import { useApolloClient, useQuery } from 'react-apollo'
import { useProduct } from 'vtex.product-context'
import { useRenderSession } from 'vtex.session-client'

import { useProductsByIds } from '../hooks/useProductsByIds'
import { useRecentlyViewed } from '../hooks/useRecentlyViewed'
import RecentlyViewedShelf from '../RecentlyViewedShelf'
import RecentlyViewedTracker from '../RecentlyViewedTracker'
import { messages } from '../utils/messages'
import type { ShelfProduct } from '../utils/products'
import {
  isStorageAvailable,
  readHistory,
  subscribeToHistory,
  writeHistory,
} from '../utils/storage'
import { renderWithIntl, text } from './support/render'

jest.mock('react-apollo', () => ({
  useQuery: jest.fn(),
  useApolloClient: jest.fn(),
}))

const ACCOUNT = 'store'
const useQueryMock = useQuery as jest.Mock
const useProductMock = useProduct as jest.Mock
const sessionMock = useRenderSession as jest.Mock

const inStock = (productId: string): ShelfProduct => ({
  productId,
  items: [{ sellers: [{ commertialOffer: { AvailableQuantity: 5 } }] }],
})

const soldOut = (productId: string): ShelfProduct => ({
  productId,
  items: [{ sellers: [{ commertialOffer: { AvailableQuantity: 0 } }] }],
})

let catalog: Record<string, ShelfProduct>
let client: { query: jest.Mock; mutate: jest.Mock }
let remote: Array<{ productId: string; viewedAt: string }>

function settings(enableSync: boolean) {
  useQueryMock.mockReturnValue({
    data: {
      recentlyViewedSettings: { enableSync, maxItems: 30, retentionDays: 90 },
    },
  })
}

function loggedIn(id: string | null) {
  sessionMock.mockReturnValue({
    loading: false,
    error: undefined,
    session: {
      namespaces: {
        profile: id
          ? { isAuthenticated: { value: 'true' }, id: { value: id } }
          : { isAuthenticated: { value: 'false' } },
      },
    },
  })
}

const stored = () => readHistory(ACCOUNT).items.map((i) => i.productId)

function view(...ids: string[]) {
  const now = Date.now()

  writeHistory(ACCOUNT, {
    ...readHistory(ACCOUNT),
    items: ids.map((productId, i) => ({
      productId,
      viewedAt: new Date(now - i * 1000).toISOString(),
    })),
  })
}

beforeEach(() => {
  jest.useRealTimers()
  window.localStorage.clear()
  catalog = {}
  remote = []
  client = {
    query: jest.fn(async ({ query, variables }) => {
      if (query === 'productsByIdentifier.gql') {
        const found = variables.values
          .map((id: string) => catalog[id])
          .filter(Boolean)

        if (!found.length) {
          throw new Error('No products found')
        }

        return { data: { productsByIdentifier: found } }
      }

      return { data: { recentlyViewed: { items: remote } } }
    }),
    mutate: jest.fn(async ({ variables }) => ({
      data: {
        recordRecentlyViewed: { items: [...remote, ...variables.items] },
      },
    })),
  }
  ;(useApolloClient as jest.Mock).mockReturnValue(client)
  useProductMock.mockReturnValue(undefined)
  settings(false)
  loggedIn(null)
})

describe('RecentlyViewedTracker', () => {
  it('records the product being viewed, in this browser only when sync is off', async () => {
    useProductMock.mockReturnValue({ product: { productId: '2208' } })

    renderWithIntl(<RecentlyViewedTracker />)

    expect(stored()).toEqual(['2208'])
    await act(async () => {})
    expect(client.mutate).not.toHaveBeenCalled()
  })

  it('records nothing outside a product page', () => {
    renderWithIntl(<RecentlyViewedTracker />)

    expect(stored()).toEqual([])
  })

  it('sends a logged-in shopper’s views to the server a few seconds later', async () => {
    jest.useFakeTimers()
    settings(true)
    loggedIn('shopper-1')

    const { rerender } = renderWithIntl(<RecentlyViewedTracker />)

    // The first sync starts at once, pulls the server history and ties the
    // local history to this shopper
    await waitFor(() => expect(readHistory(ACCOUNT).syncedAt).not.toBeNull())
    // Let the finished sync release its lock
    await act(async () => {})
    expect(client.query).toHaveBeenCalledTimes(1)
    expect(readHistory(ACCOUNT).owner).toBe('shopper-1')

    // A product page a second later
    jest.advanceTimersByTime(1000)
    useProductMock.mockReturnValue({ product: { productId: '1524' } })
    rerender(<RecentlyViewedTracker />)
    expect(client.mutate).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(3000)
    })

    await waitFor(() => expect(client.mutate).toHaveBeenCalledTimes(1))

    const [{ variables }] = client.mutate.mock.calls[0]

    expect(
      variables.items.map((i: { productId: string }) => i.productId)
    ).toEqual(['1524'])
  })
})

describe('useRecentlyViewed', () => {
  function Probe() {
    const { items } = useRecentlyViewed()

    return <output>{items.map((i) => i.productId).join(',')}</output>
  }

  it('shows the history saved in this browser', async () => {
    view('1', '2')

    renderWithIntl(<Probe />)

    expect(screen.getByRole('status').textContent).toBe('1,2')
  })

  it('follows changes made in another tab', async () => {
    renderWithIntl(<Probe />)

    await act(async () => {
      view('3')
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: `recently-viewed-products:v1:${ACCOUNT}`,
        })
      )
    })

    expect(screen.getByRole('status').textContent).toBe('3')
  })

  it('brings in the history from other devices when a shopper logs in', async () => {
    settings(true)
    loggedIn('shopper-1')
    remote = [{ productId: '9', viewedAt: new Date().toISOString() }]

    renderWithIntl(<Probe />)

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('9')
    )
    expect(client.query).toHaveBeenCalledWith({
      query: 'recentlyViewed.gql',
      fetchPolicy: 'no-cache',
    })
  })

  it("clears a shopper's history on logout, so the next person never sees it", async () => {
    writeHistory(ACCOUNT, {
      owner: 'shopper-1',
      items: [{ productId: '1', viewedAt: new Date().toISOString() }],
      syncedAt: null,
    })

    // While the session is loading, the history is hidden
    sessionMock.mockReturnValue({ loading: true })

    const { rerender } = renderWithIntl(<Probe />)

    expect(screen.getByRole('status').textContent).toBe('')

    loggedIn(null)
    rerender(<Probe />)

    await waitFor(() => expect(stored()).toEqual([]))
    expect(readHistory(ACCOUNT).owner).toBeNull()
  })

  it('works with default limits before the settings load', () => {
    useQueryMock.mockReturnValue({ data: undefined })
    view('5')

    renderWithIntl(<Probe />)

    expect(screen.getByRole('status').textContent).toBe('5')
  })
})

describe('RecentlyViewedShelf', () => {
  it('shows available products, newest first, leaving out the product being viewed', async () => {
    view('1', '2', '3', '4')
    catalog = {
      '1': inStock('1'),
      '2': inStock('2'),
      '3': soldOut('3'),
      '4': inStock('4'),
    }
    useProductMock.mockReturnValue({ product: { productId: '1' } })

    renderWithIntl(<RecentlyViewedShelf />)

    await waitFor(() =>
      expect(
        screen.getAllByRole('listitem').map((li) => li.textContent)
      ).toEqual(['2', '4'])
    )
    expect(screen.getByRole('heading').textContent).toBe(text(messages.title))
    expect(
      document.querySelector('[data-extension]')?.getAttribute('data-extension')
    ).toBe('list-context.product-list-static')
  })

  it('follows its settings: title, limit, current product and unavailable products', async () => {
    view('1', '2', '3')
    catalog = { '1': inStock('1'), '2': soldOut('2'), '3': inStock('3') }
    useProductMock.mockReturnValue({ product: { productId: '1' } })

    renderWithIntl(
      <RecentlyViewedShelf
        title="Seen lately"
        maxItems={2}
        excludeCurrentProduct={false}
        hideUnavailable={false}
      />
    )

    await waitFor(() =>
      expect(
        screen.getAllByRole('listitem').map((li) => li.textContent)
      ).toEqual(['1', '2'])
    )
    expect(screen.getByRole('heading').textContent).toBe('Seen lately')
  })

  it('shows nothing until there is something to show', () => {
    const { container } = renderWithIntl(<RecentlyViewedShelf />)

    expect(container.innerHTML).toBe('')
  })
})

describe('useProductsByIds', () => {
  function Products({ ids }: { ids: string[] }) {
    const products = useProductsByIds(ids)

    return <output>{products.map((p) => p.productId).join(',')}</output>
  }

  it('asks for at most 10 products at a time and keeps the history order', async () => {
    const ids = Array.from({ length: 23 }, (_, i) => String(i + 1))

    ids.forEach((id) => {
      catalog[id] = inStock(id)
    })

    renderWithIntl(<Products ids={ids} />)

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(ids.join(','))
    )
    expect(
      client.query.mock.calls.map(([{ variables }]) => variables.values.length)
    ).toEqual([10, 10, 3])
  })

  it('leaves out a group the catalog refuses, and empties for no IDs', async () => {
    catalog = { '1': inStock('1') }

    const { rerender } = renderWithIntl(<Products ids={['1', 'gone']} />)

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('1')
    )

    rerender(<Products ids={['gone']} />)
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(''))

    rerender(<Products ids={[]} />)
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('ignores an answer that arrives after the list changed', async () => {
    let answer: (value: unknown) => void = () => {}

    client.query.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve
      })
    )

    const { unmount } = renderWithIntl(<Products ids={['1']} />)

    unmount()
    await act(async () => {
      answer({ data: { productsByIdentifier: [inStock('1')] } })
    })
  })
})

describe('storage', () => {
  it('reports when the browser blocks storage', () => {
    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked')
      })

    expect(isStorageAvailable()).toBe(false)
    setItem.mockRestore()
    expect(isStorageAvailable()).toBe(true)
  })

  it('tells listeners about changes to this account only, until unsubscribed', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToHistory(ACCOUNT, listener)

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'recently-viewed-products:v1:other' })
    )
    expect(listener).not.toHaveBeenCalled()

    view('1')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    view('2')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
