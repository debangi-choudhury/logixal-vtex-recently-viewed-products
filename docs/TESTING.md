# Testing Recently Viewed Products

Last full test: 2026-11-24, version 0.1.0 with the B2C theme `logixalpartnerus.store-theme` 1.1.0, in the `debangi` workspace.

## Review against VTEX's skills

Reviewed against the VTEX IO track of https://github.com/vtex/skills. No changes were needed.

| Area | Result |
| --- | --- |
| The shopper is identified on the server, from the store token validated by VTEX ID; no operation takes a user ID | Pass |
| VTEX ID validation through a `JanusClient`, with a matching outbound policy (`@vtex/api`'s own ID client only covers sign-in) | Pass |
| Master Data through `@vtex/clients`' `masterDataFor`, with `ADMIN_DS` and an outbound policy for `api.vtex.com` | Pass |
| GraphQL: `@auth` on every operation; the shopper's history is `@cacheControl(scope: PRIVATE, maxAge: ZERO)`; only the non-personal settings are publicly cached | Pass |
| Browser storage is used only after the page loads, so server rendering is safe | Pass |
| Storefront blocks use CSS handles; messages in English, Spanish and Portuguese | Pass |
| Master Data schema: no caching (`v-cache: false`) | Pass |
| No logging to the console | Pass |

## Automated checks

```bash
yarn lint                        # 0 errors, 9 warnings
yarn test                        # 28 backend tests, then 24 React tests
cd react && npx tsc --noEmit     # no errors
cd node && npx tsc --noEmit      # no errors
```

## What was tested, and how

On 2026-11-24 in `debangi`, logged in as a shopper, with sync turned on in the app settings.

1. Unlinked the old B2C theme link (1.0.0) in `debangi`, so the installed theme 1.1.0, which places the tracker and the shelf, is used.
2. Opened the home page and read the history saved in the browser and on the server.
3. Opened two product pages, one after the other.
4. On each, checked the history saved in the browser, the shelf, and the history on the server.

### Results

| Check | Result |
| --- | --- |
| Blocks on the product page | Tracker and shelf from 0.1.0 |
| Settings | Sync on, 30 products kept, 90 days |
| First product viewed (2208) | Saved at the top of the browser history |
| Shelf on that product's page | Lists the earlier products with prices and Add to cart, and leaves out the product being viewed |
| Second product viewed (1524) | History reads 1524, 2208, …; its shelf starts with 2208 |
| Sync to the server | The server history gained 2208, then 1524, within seconds |

### Found during testing

- At the start, the server history for this shopper was empty while the browser held 8 products and a last sync on 2026-11-23. Something deleted the server copy in between. New views synced normally, but the 7 older ones stayed in the browser only: the app merges the two histories when a shopper logs in, so a shopper who stays logged in doesn't send older views again. Logging out and back in merges them. This is an edge case, not a failure of the normal flow.

### Not tested on 2026-11-24

- Logging out (the history should be cleared from the browser) and logging back in (it should come back from the server).
- A second device or browser.
- A shopper who isn't logged in, in a fresh browser.
- Products that become unavailable, and the 90-day retention.

## Manual test steps

Use a store workspace that runs the B2C theme 1.1.0, such as `https://debangi--logixalpartnerus.myvtex.com/`. Check the app's settings in Admin (**Apps → Installed Apps → Recently Viewed Products**) to see whether sync is on.

1. **Anonymous shopper**
   1. Open the store in a private window, without logging in.
   2. Open three different product pages.
   3. On the third, check that **Recently viewed** shows the first two, newest first, and not the product you're on.
   4. Open the home page or another page with the shelf, and check that all three appear.
   5. Close the window and open a new private window: the history is gone, as expected without an account.
2. **Logged-in shopper with sync on**
   1. Log in as a test shopper and view two or three products.
   2. Check that the shelf shows them.
   3. Open the store in another browser or device, log in as the same shopper, and check that the shelf shows the same products.
3. **Logging out**
   1. Log out. Check that the shelf no longer shows that shopper's products.
   2. Log back in. Check that they come back.
4. **Sync off**
   1. Turn sync off in the app settings.
   2. Log in, view products, then check another browser: the products should not appear there.
5. **Unavailable products**
   1. View a product, then make it unavailable in the catalog.
   2. Check that the shelf leaves it out without breaking.

If something fails, note the shopper, the workspace, the product IDs and any message in the browser console.
