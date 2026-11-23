import { AuthenticationError } from '@vtex/api'

const STORE_AUDIENCE = 'webstore'
const REJECTED_TOKEN_STATUSES = [400, 401, 403, 404]

/**
 * Resolves the shopper from the store token on the request, as validated by
 * VTEX ID. This is the only source of identity: nothing the browser sends as
 * an argument can select whose history is read or written.
 *
 * Throws AuthenticationError for a missing or rejected token. Other VTEX ID
 * failures propagate, so an outage isn't reported as a logged-out shopper.
 */
export async function getShopperId(ctx: Context): Promise<string> {
  const {
    clients: { vtexId },
    vtex: { account, storeUserAuthToken },
  } = ctx

  if (!storeUserAuthToken) {
    throw new AuthenticationError('Shopper is not logged in')
  }

  const credential = await vtexId
    .validateCredential(storeUserAuthToken)
    .catch((error: any) => {
      if (REJECTED_TOKEN_STATUSES.includes(error?.response?.status)) {
        return null
      }

      ctx.vtex.logger.error({
        message: 'VTEX ID token validation failed',
        status: error?.response?.status ?? null,
      })

      throw error
    })

  if (
    credential?.authStatus !== 'Success' ||
    !credential.id ||
    credential.account !== account ||
    credential.audience !== STORE_AUDIENCE
  ) {
    throw new AuthenticationError('Invalid shopper token')
  }

  return credential.id
}
