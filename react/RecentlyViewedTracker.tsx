import { useEffect } from 'react'
import { useProduct } from 'vtex.product-context'

import { useRecentlyViewed } from './hooks/useRecentlyViewed'

function RecentlyViewedTracker() {
  const productId = useProduct()?.product?.productId
  const { recordView } = useRecentlyViewed()

  useEffect(() => {
    if (productId) {
      recordView(productId)
    }
    // recordView changes as settings load. Each product view is recorded once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  return null
}

export default RecentlyViewedTracker
