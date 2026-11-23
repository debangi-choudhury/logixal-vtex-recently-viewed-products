import { CacheType, JanusClient } from '@vtex/api'

export interface Credential {
  authStatus: string
  id?: string
  account?: string
  audience?: string
}

// The VTEX ID client in @vtex/api only covers login flows, so token
// validation goes through Janus, as vtex.store-graphql does.
export default class VtexId extends JanusClient {
  public validateCredential(token: string) {
    return this.http.post<Credential>(
      '/api/vtexid/credential/validate',
      { token },
      {
        cacheable: CacheType.None,
        metric: 'vtexid-validate-credential',
      }
    )
  }
}
