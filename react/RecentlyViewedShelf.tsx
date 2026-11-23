import React, { useMemo } from 'react'
import { FormattedMessage } from 'react-intl'
import { useCssHandles } from 'vtex.css-handles'
import { useProduct } from 'vtex.product-context'
import { ExtensionPoint } from 'vtex.render-runtime'

import { useProductsByIds } from './hooks/useProductsByIds'
import { useRecentlyViewed } from './hooks/useRecentlyViewed'
import { messages } from './utils/messages'
import { isAvailable } from './utils/products'

interface Props {
  title?: string
  maxItems?: number
  excludeCurrentProduct?: boolean
  hideUnavailable?: boolean
}

const CSS_HANDLES = ['recentlyViewedContainer', 'recentlyViewedTitle'] as const

function RecentlyViewedShelf({
  title,
  maxItems = 10,
  excludeCurrentProduct = true,
  hideUnavailable = true,
}: Props) {
  const handles = useCssHandles(CSS_HANDLES)
  const currentProductId = useProduct()?.product?.productId
  const { items } = useRecentlyViewed()

  // Ask for every stored ID, because some may turn out to be unavailable.
  const ids = useMemo(
    () =>
      items
        .map(({ productId }) => productId)
        .filter((id) => !excludeCurrentProduct || id !== currentProductId),
    [currentProductId, excludeCurrentProduct, items]
  )

  const fetched = useProductsByIds(ids)

  const products = useMemo(
    () =>
      fetched
        .filter((product) => !hideUnavailable || isAvailable(product))
        .slice(0, maxItems),
    [fetched, hideUnavailable, maxItems]
  )

  if (!products.length) {
    return null
  }

  return (
    <section className={handles.recentlyViewedContainer}>
      <h2 className={`${handles.recentlyViewedTitle} t-heading-3 tc`}>
        {title ?? <FormattedMessage {...messages.title} />}
      </h2>
      <ExtensionPoint
        id="list-context.product-list-static"
        products={products}
      />
    </section>
  )
}

RecentlyViewedShelf.schema = {
  title: messages.editorTitle.id,
}

export default RecentlyViewedShelf
