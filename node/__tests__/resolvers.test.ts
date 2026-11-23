import { AuthenticationError, ForbiddenError } from '@vtex/api'

import { mutations, queries } from '../resolvers'

const SHOPPER_A = 'shopper-a'
const VALID_CREDENTIAL = {
  authStatus: 'Success',
  id: SHOPPER_A,
  account: 'store',
  audience: 'webstore',
}

const recentView = (productId: string) => ({
  productId,
  viewedAt: new Date(Date.now() - 1000).toISOString(),
})

const httpError = (message: string, status: number) =>
  Object.assign(new Error(message), { response: { status } })

function buildContext({
  settings = { enableSync: true } as Record<string, unknown>,
  token = 'token' as string | undefined,
  credential = VALID_CREDENTIAL as unknown,
  documents = {} as Record<string, unknown>,
} = {}) {
  const history = {
    get: jest.fn(async (id: string) => {
      if (!documents[id]) {
        throw httpError('Not found', 404)
      }

      return documents[id]
    }),
    saveOrUpdate: jest.fn(async () => ({})),
    delete: jest.fn(async () => ({})),
    search: jest.fn(async () => [] as Array<{ id: string }>),
  }

  const validateCredential = jest.fn(async () => credential)
  const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn() }

  const ctx = {
    clients: {
      apps: { getAppSettings: jest.fn(async () => settings) },
      vtexId: { validateCredential },
      history,
    },
    vtex: { account: 'store', storeUserAuthToken: token, logger },
  }

  return { ctx: ctx as unknown as Context, history, validateCredential, logger }
}

describe('shopper identity', () => {
  it('reads only the document of the validated shopper', async () => {
    const { ctx, history } = buildContext({
      documents: { [SHOPPER_A]: { items: [recentView('1')] } },
    })

    const { items } = await queries.recentlyViewed(null, null, ctx)

    expect(history.get).toHaveBeenCalledWith(SHOPPER_A, ['items'])
    expect(items.map(({ productId }) => productId)).toEqual(['1'])
  })

  it('ignores any user id sent by the browser', async () => {
    const { ctx, history } = buildContext()
    const args = {
      items: [recentView('1')],
      userId: 'shopper-b',
      id: 'shopper-b',
    }

    await mutations.recordRecentlyViewed(null, args, ctx)

    expect(history.saveOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: SHOPPER_A })
    )
  })

  it.each([
    ['a missing token', { token: '' }],
    [
      'a failed status',
      { credential: { ...VALID_CREDENTIAL, authStatus: 'Fail' } },
    ],
    [
      'another account',
      { credential: { ...VALID_CREDENTIAL, account: 'other' } },
    ],
    [
      'an admin audience',
      { credential: { ...VALID_CREDENTIAL, audience: 'admin' } },
    ],
    ['no user id', { credential: { ...VALID_CREDENTIAL, id: undefined } }],
  ])('rejects %s and touches no data', async (_, options) => {
    const { ctx, history } = buildContext(options as any)

    await expect(queries.recentlyViewed(null, null, ctx)).rejects.toThrow(
      AuthenticationError
    )
    await expect(
      mutations.recordRecentlyViewed(null, { items: [recentView('1')] }, ctx)
    ).rejects.toThrow(AuthenticationError)
    await expect(
      mutations.clearRecentlyViewed(null, null, ctx)
    ).rejects.toThrow(AuthenticationError)

    expect(history.get).not.toHaveBeenCalled()
    expect(history.saveOrUpdate).not.toHaveBeenCalled()
    expect(history.delete).not.toHaveBeenCalled()
  })

  it('rejects a token that VTEX ID refuses', async () => {
    const { ctx, validateCredential } = buildContext()

    validateCredential.mockRejectedValue(httpError('Unauthorized', 401))

    await expect(queries.recentlyViewed(null, null, ctx)).rejects.toThrow(
      AuthenticationError
    )
  })

  it('does not report a VTEX ID outage as a logged-out shopper', async () => {
    const { ctx, validateCredential } = buildContext()
    const outage = httpError('Unavailable', 503)

    validateCredential.mockRejectedValue(outage)

    await expect(queries.recentlyViewed(null, null, ctx)).rejects.toBe(outage)
  })
})

describe('sync setting', () => {
  it('refuses to read or store history when sync is off', async () => {
    const { ctx, history } = buildContext({ settings: { enableSync: false } })

    await expect(queries.recentlyViewed(null, null, ctx)).rejects.toThrow(
      ForbiddenError
    )
    await expect(
      mutations.recordRecentlyViewed(null, { items: [recentView('1')] }, ctx)
    ).rejects.toThrow(ForbiddenError)

    expect(history.saveOrUpdate).not.toHaveBeenCalled()
  })

  it('still lets a shopper delete their history when sync is off', async () => {
    const { ctx, history } = buildContext({ settings: { enableSync: false } })

    await expect(mutations.clearRecentlyViewed(null, null, ctx)).resolves.toBe(
      true
    )
    expect(history.delete).toHaveBeenCalledWith(SHOPPER_A)
  })

  it('defaults to off when the app has no settings', async () => {
    const { ctx } = buildContext({ settings: {} })

    await expect(
      queries.recentlyViewedSettings(null, null, ctx)
    ).resolves.toEqual({ enableSync: false, maxItems: 30, retentionDays: 90 })
  })

  it('keeps settings inside their limits', async () => {
    const { ctx } = buildContext({
      settings: { maxItems: 500, retentionDays: -1 },
    })

    await expect(
      queries.recentlyViewedSettings(null, null, ctx)
    ).resolves.toMatchObject({ maxItems: 50, retentionDays: 90 })
  })
})

describe('recordRecentlyViewed', () => {
  it('merges with the stored history and saves the result', async () => {
    const { ctx, history } = buildContext({
      documents: { [SHOPPER_A]: { items: [recentView('1')] } },
    })

    const { items } = await mutations.recordRecentlyViewed(
      null,
      { items: [recentView('2')] },
      ctx
    )

    expect(
      items.map(({ productId }) => productId).sort((a, b) => a.localeCompare(b))
    ).toEqual(['1', '2'])
    expect(history.saveOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: SHOPPER_A, items })
    )
  })

  it('does not overwrite history when Master Data fails to read it', async () => {
    const { ctx, history } = buildContext()

    history.get.mockRejectedValue(httpError('Throttled', 429))

    await expect(
      mutations.recordRecentlyViewed(null, { items: [recentView('1')] }, ctx)
    ).rejects.toThrow('Throttled')
    expect(history.saveOrUpdate).not.toHaveBeenCalled()
  })
})

describe('missing documents', () => {
  it.each([
    ['an empty 200', ''],
    ['a null 200', null],
  ])('treats %s from Master Data as no history', async (_, response) => {
    const { ctx, history } = buildContext()

    history.get.mockResolvedValue(response as any)

    await expect(queries.recentlyViewed(null, null, ctx)).resolves.toEqual({
      items: [],
    })
  })
})

describe('logging', () => {
  const logged = (logger: { error: jest.Mock }) =>
    JSON.stringify(logger.error.mock.calls)

  it('logs a VTEX ID outage with its status, without the token', async () => {
    const { ctx, validateCredential, logger } = buildContext({
      token: 'secret-token',
    })

    validateCredential.mockRejectedValue(httpError('Unavailable', 503))

    await expect(queries.recentlyViewed(null, null, ctx)).rejects.toThrow()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ status: 503 })
    )
    expect(logged(logger)).not.toContain('secret-token')
  })

  it('logs a Master Data failure without the shopper id', async () => {
    const { ctx, history, logger } = buildContext()

    history.get.mockRejectedValue(httpError('Throttled', 429))

    await expect(queries.recentlyViewed(null, null, ctx)).rejects.toThrow()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'read', status: 429 })
    )
    expect(logged(logger)).not.toContain(SHOPPER_A)
  })

  it('does not log a rejected token or a missing document', async () => {
    const { ctx, validateCredential, logger } = buildContext()

    validateCredential.mockRejectedValue(httpError('Unauthorized', 401))
    await expect(queries.recentlyViewed(null, null, ctx)).rejects.toThrow()

    const second = buildContext()

    await queries.recentlyViewed(null, null, second.ctx)

    expect(logger.error).not.toHaveBeenCalled()
    expect(second.logger.error).not.toHaveBeenCalled()
  })
})

describe('clearRecentlyViewed', () => {
  it('succeeds when the shopper has no document', async () => {
    const { ctx, history } = buildContext()

    history.delete.mockRejectedValue(httpError('Not found', 404))

    await expect(mutations.clearRecentlyViewed(null, null, ctx)).resolves.toBe(
      true
    )
  })
})

describe('purgeInactiveRecentlyViewed', () => {
  it('deletes the documents past the retention period', async () => {
    const { ctx, history } = buildContext()

    history.search.mockResolvedValue([{ id: 'old-1' }, { id: 'old-2' }])

    await expect(
      mutations.purgeInactiveRecentlyViewed(null, null, ctx)
    ).resolves.toBe(2)
    expect(history.delete).toHaveBeenCalledWith('old-1')
    expect(history.delete).toHaveBeenCalledWith('old-2')
  })
})
