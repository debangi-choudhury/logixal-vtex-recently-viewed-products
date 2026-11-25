import type { IOContext } from '@vtex/api'

import VtexId from '../clients/vtexId'

const context = {
  account: 'store',
  workspace: 'test',
  authToken: 'APP-TOKEN',
  region: 'aws-us-east-1',
  production: false,
  userAgent: 'test',
  operationId: 'op',
  requestId: 'req',
  platform: '',
  route: { id: '', params: {} },
  logger: { warn() {}, error() {}, info() {}, debug() {} },
} as unknown as IOContext

describe('VtexId', () => {
  it('validates the shopper’s token through Janus, never from cache', async () => {
    const post = jest.fn().mockResolvedValue({ authStatus: 'Success' })
    const client = new VtexId(context)

    Object.assign(client, { http: { post } })

    await expect(client.validateCredential('SHOPPER-TOKEN')).resolves.toEqual({
      authStatus: 'Success',
    })

    const [path, body, options] = post.mock.calls[0]

    expect(path).toBe('/api/vtexid/credential/validate')
    expect(body).toEqual({ token: 'SHOPPER-TOKEN' })
    expect(options).toMatchObject({ metric: 'vtexid-validate-credential' })
    expect(options.cacheable).toBeDefined()
  })
})

describe('service', () => {
  // The VTEX IO runtime defines this global; the clients module reports its
  // settings cache through it when loaded.
  const trackCache = jest.fn()

  Object.assign(global, { metrics: { trackCache } })

  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, node/global-require */
  const { default: clients, Clients } = require('../clients')
  const { default: service } = require('..')
  const { mutations, queries } = require('../resolvers')
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, node/global-require */

  const sorted = (o: object) =>
    Object.keys(o).sort((a, b) => a.localeCompare(b))

  it('wires every query and mutation', () => {
    const { resolvers } = service.config.graphql

    expect(sorted(resolvers.Query)).toEqual(sorted(queries))
    expect(sorted(resolvers.Mutation)).toEqual(sorted(mutations))
  })

  it('fails fast, and caches only the app settings in memory', () => {
    expect(clients.options.default).toEqual({ retries: 2, timeout: 3000 })
    expect(clients.options.apps.memoryCache).toBeDefined()
    expect(sorted(clients.options)).toEqual(['apps', 'default'])
    expect(trackCache).toHaveBeenCalledWith(
      'recently-viewed-settings',
      clients.options.apps.memoryCache
    )
  })

  it('builds each client once per request', () => {
    // Set by the VTEX IO runtime; the Master Data client names its schema after it
    process.env.VTEX_APP_ID = 'logixalpartnerus.recently-viewed-products@0.1.0'

    const io = new Clients({}, context)

    expect(io.vtexId).toBeInstanceOf(VtexId)
    expect(io.vtexId).toBe(io.vtexId)
    expect(io.history).toBe(io.history)
  })
})
