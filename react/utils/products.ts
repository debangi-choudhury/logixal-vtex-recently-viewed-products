export interface ShelfProduct {
  productId: string
  items?: Array<{
    sellers?: Array<{
      commertialOffer?: { AvailableQuantity?: number }
    }>
  }>
}

export function chunk<T>(list: T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < list.length; index += size) {
    chunks.push(list.slice(index, index + size))
  }

  return chunks
}

export const isAvailable = ({ items }: ShelfProduct) =>
  (items ?? []).some(({ sellers }) =>
    (sellers ?? []).some(
      ({ commertialOffer }) => (commertialOffer?.AvailableQuantity ?? 0) > 0
    )
  )

/** The catalog doesn't promise an order, so restore the order of the history. */
export function sortByIds<T extends ShelfProduct>(
  products: T[],
  ids: string[]
) {
  const positions = new Map(ids.map((id, index) => [id, index]))

  return products
    .filter(({ productId }) => positions.has(productId))
    .sort(
      (a, b) =>
        (positions.get(a.productId) as number) -
        (positions.get(b.productId) as number)
    )
}
