declare module '*.gql' {
  import type { DocumentNode } from 'graphql'

  const document: DocumentNode
  export default document
}

declare module '*.css' {
  const styles: Record<string, string>
  export default styles
}

declare module 'vtex.css-handles' {
  export function useCssHandles<T extends string>(
    handles: readonly T[]
  ): Record<T, string>
}

declare module 'vtex.product-context' {
  export function useProduct():
    | { product?: { productId?: string } | null }
    | null
    | undefined
}

declare module 'vtex.render-runtime' {
  import type { ComponentType } from 'react'

  export const canUseDOM: boolean
  export const ExtensionPoint: ComponentType<Record<string, unknown>>
  export function useRuntime(): { account: string }
}

declare module 'vtex.session-client' {
  export interface SessionValue {
    value?: string
  }

  export function useRenderSession(): {
    loading: boolean
    error?: unknown
    session?: {
      namespaces?: {
        profile?: {
          id?: SessionValue
          isAuthenticated?: SessionValue
        }
      }
    }
  }
}
