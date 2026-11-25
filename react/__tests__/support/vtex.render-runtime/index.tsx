import React from 'react'

export const useRuntime = jest.fn(() => ({ account: 'store' }))

/** Renders the block's props, so tests can see what it was given */
export const ExtensionPoint = ({
  id,
  products,
}: {
  id: string
  products: Array<{ productId: string }>
}) => (
  <ul data-extension={id}>
    {products.map((product) => (
      <li key={product.productId}>{product.productId}</li>
    ))}
  </ul>
)
