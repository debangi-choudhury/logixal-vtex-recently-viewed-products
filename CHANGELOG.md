# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-11-25

### Fixed

- A product view recorded in the same millisecond a sync started was never sent to the server. It is now sent with the next sync.

## [0.1.0] - 2026-11-23

### Added

- `recently-viewed-tracker` block, which records product views on the product page.
- `recently-viewed-shelf` block, which shows recently viewed products with the theme's product cards, newest first, without the product being viewed or unavailable ones.
- History kept in `localStorage` across browsing sessions.
- Optional sync across devices for logged-in shoppers, stored in Master Data v2 and turned on in the app settings. The shopper is resolved from their store token through VTEX ID, never from an ID sent by the browser.
- Retention and size limits in the app settings, clearing of a shopper's history at logout on shared devices, a delete mutation for a shopper's history, and an admin-only purge of inactive histories.
