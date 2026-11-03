# Admin Portal modules — target vs. current state

The long-term NB LAO requirement is **19 Admin modules**. As of Phase 1D the Admin Portal (`src/pages/Admin.tsx`)
has **17 sections**. Phase 1D keeps all 17 unchanged and adds none; this page keeps the gap visible for Phase 1G
and later phases.

All current sections are **prototypes**: data lives in the browser (`localStorage`) or in bundled mock data, and
access is guarded only by the demo sign-in. Nothing here is server-authorized until Phase 1E/1G.

## Mapping: 19-module target → current code

| # | Target module | Current section | Status | Notes |
|---|---|---|---|---|
| 1 | Dashboard | Dashboard | Present (prototype) | Figures from mock `ORDERS` / `QUOTATIONS` in `src/data.ts`. |
| 2 | Products | Products | Present (prototype) | Local browser catalog. |
| 3 | Categories | — | **Missing** | Categories are fixed constants (`CATEGORIES`, `CATEGORY_SUBS`). The database table exists (Phase 1B A6). |
| 4 | Brands | Brand Logos | Present (prototype) | Label differs from the target; not renamed. |
| 5 | Orders | Orders | Present (prototype) | Stored demo orders plus a mock table. |
| 6 | Customers | Customers | Present (prototype) | Mock data. |
| 7 | Quotations | Quotations | Present (prototype) | Mock data. |
| 8 | Staff | — | **Missing** | Needs real staff accounts (Phase 1E). |
| 9 | Positions | — | **Missing** | Depends on server-side RBAC role mapping (decision D12, Phase 1E). |
| 10 | Loyalty | Loyalty | Present (prototype) | |
| 11 | Reviews | Reviews | Present (prototype) | |
| 12 | Coupons | — | **Missing** | "Sales & Promotions" manages sales placements, not coupons. |
| 13 | Shipping Companies | — | **Missing** | Only flat shipping *rates* exist (Currency & Pricing → Shipping); no carriers. |
| 14 | Payment Methods | — | **Missing** | Fixed list in `src/commerce/engine.ts`; no management screen. |
| 15 | Product Variants | inside the Products editor | **Embedded only — not delivered** | No standalone module. |
| 16 | Sales | Sales & Promotions | Present (prototype) | |
| 17 | Inventory | Inventory | **Partial** | Reuses the Products panel; no stock movements or reservations. |
| 18 | Audit Logs | catalog change log written by Products | **Embedded only — not delivered** | Browser-only log (`nblao_catalog_audit`); no viewer; not tamper-evident. |
| 19 | Emails | — | **Missing** | No email delivery (Phase 1H). |

Current sections that are outside the 19-module list and are kept as they are: Advertisements, Business Partners,
Leadership, Customer Service, Currency & Pricing, Reports ("Coming Soon"), Settings ("Coming Soon").

## Future requirements (Phase 1G backlog — not delivered)

- Categories (manage the database category tree)
- Staff and Positions (after real authentication and RBAC in Phase 1E)
- Coupons
- Shipping Companies
- Payment Methods
- Product Variants as a standalone module
- Audit Logs: server-side, append-only, viewable
- Emails
- Inventory completion (stock movements, reservations — with Phase 1F)

Each module must be connected to a server API with server-enforced permissions and audit history before it is
considered delivered. Embedded or browser-only functionality does not count.

## Related limitation: catalog search

In API catalog mode the storefront loads every public product (up to 5,000) and keeps the existing browser-side
EN/LO/TH search. A larger catalog needs server-side multilingual search (stored Lao/Thai names or a translation
table, with PostgreSQL full-text or trigram indexes) and server-side paging on the product list.
