import { useEffect, useState } from 'react'
import { useApolloClient } from 'react-apollo'

import productsByIdentifierQuery from '../graphql/productsByIdentifier.gql'
import type { ShelfProduct } from '../utils/products'
import { chunk, sortByIds } from '../utils/products'

// The catalog search may return only 10 products per request unless a range is
// set, and productsByIdentifier takes no range, so larger lists are split.
const PRODUCTS_PER_REQUEST = 10

export function useProductsByIds(ids: string[]) {
  const client = useApolloClient()
  const [products, setProducts] = useState<ShelfProduct[]>([])
  const idsKey = ids.join(',')

  useEffect(() => {
    if (!idsKey) {
      setProducts([])

      return
    }

    let cancelled = false
    const currentIds = idsKey.split(',')

    Promise.all(
      chunk(currentIds, PRODUCTS_PER_REQUEST).map((values) =>
        client
          .query<{ productsByIdentifier: ShelfProduct[] }>({
            query: productsByIdentifierQuery,
            variables: { values },
          })
          .then(({ data }) => data.productsByIdentifier ?? [])
          // The resolver throws when no product matches. A failed group only
          // leaves its products off the shelf.
          .catch(() => [] as ShelfProduct[])
      )
    ).then((groups) => {
      if (!cancelled) {
        setProducts(
          sortByIds(
            groups.reduce((all, group) => all.concat(group), []),
            currentIds
          )
        )
      }
    })

    return () => {
      cancelled = true
    }
  }, [client, idsKey])

  return products
}
