# Recently Viewed Products

Shows shoppers the products they viewed recently. History is kept across browsing sessions, and logged-in shoppers can optionally have it synced across devices.

## How history is stored

| Shopper | Where history is stored | On another device |
|---|---|---|
| Anonymous | `localStorage` | Not available |
| Logged in, sync on | `localStorage` and Master Data | Available after login |
| Logged in, sync off | `localStorage` | Not available |

History stores product IDs and view dates only. Prices and stock are always fetched fresh.

With sync on, `localStorage` is cleared at logout, and the history returns from Master Data at the next login. Anonymous history merges into the account at login.

## Setup

1. Link or install the app in your workspace.
2. Add the app to your theme's `manifest.json`:

   ```json
   "peerDependencies": {
     "logixalpartnerus.recently-viewed-products": "0.x"
   }
   ```

3. Add the tracker to the product page. It renders nothing:

   ```json
   "store.product": {
     "children": ["recently-viewed-tracker", "..."]
   }
   ```

4. Add the shelf to any page. It's hidden when there's nothing to show:

   ```json
   "store.home": {
     "blocks": ["recently-viewed-shelf", "..."]
   }
   ```

## Shelf props

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | "Recently viewed" | Shelf title |
| `maxItems` | `number` | `10` | Products shown |
| `excludeCurrentProduct` | `boolean` | `true` | Hides the product being viewed |
| `hideUnavailable` | `boolean` | `true` | Hides products that are out of stock |

To change the card layout, set your own `list-context.product-list-static` block in the `blocks` of `recently-viewed-shelf`.

## App settings

| Setting | Default | Limits |
|---|---|---|
| Sync history across devices | Off | |
| Products kept per shopper | 30 | 1 to 50 |
| Days to keep each view | 90 | 1 to 365 |

Keep more products than the shelf shows, so that it stays full after unavailable products are removed.

## Privacy

Sync stores browsing history against a shopper account. Review it with your privacy team before turning it on.

- `clearRecentlyViewed` deletes the logged-in shopper's history, even when sync is off.
- `purgeInactiveRecentlyViewed` deletes up to 100 documents of inactive shoppers per call. It's admin only and isn't scheduled by this app, so it needs to be run regularly.

## Before going live

These need a real VTEX account to confirm:

- For a minute or so after a link or install, requests can fail with `403` or `GraphQL validation failed`. Retest before treating these as bugs.
- The `between` filter in `purgeInactiveRecentlyViewed` works on `lastActivityAt`, and the resource it requires suits your admins.
- Master Data documents appear to be shared across workspaces, since the entity name doesn't include the workspace. Test with test shoppers only.
- Each link or install creates a schema, with a limit of 60 per entity, so delete old ones regularly.

## Customization

| CSS Handles |
|---|
| `recentlyViewedContainer` |
| `recentlyViewedTitle` |
