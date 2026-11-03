# NB LAO shop server (Phase 1B-local A1–A6, Phase 1D catalog API)

The future backend API for `shop.nblao.com`. It is a **standalone package** (its own `package.json` and
`pnpm-lock.yaml`), separate from the React/Vite frontend at the repository root. It runs **only on your own
computer** against a local PostgreSQL. Nothing here is deployed. The published GitHub Pages site does not call
it; only a local frontend started with `VITE_CATALOG_SOURCE=api` reads the catalog from it.

## Status

| Step | What | Status |
|---|---|---|
| A1 | Local database guard, draft permissions, CSV reader/writer | Done |
| A2 | Standalone package: ESM, pnpm 10.34.3, strict `tsconfig.json` (`noUncheckedIndexedAccess`) | Done |
| A3/A4 | PostgreSQL 17 in Docker on `127.0.0.1`, restricted role `nblao_app`, databases `nblao_dev` and `nblao_test` | Done |
| A5 | Fastify app factory, zod configuration, `GET /api/health`, `GET /api/ready` | Done |
| A6 | Prisma catalog schema (Brand, Category, Product, ProductVariant, ProductImage), first migration, idempotent demo seed | Done |
| 1D | Public read-only catalog API: `GET /api/products`, `GET /api/brands` | Done |

| Path | Purpose |
|---|---|
| `src/db/assertLocalDatabase.ts` | Refuses any database that is not local and allow-listed (A1). |
| `src/auth/permissions.ts` | Draft permission codes and a deny-by-default `can()` (A1). No roles or users yet (decision D12). |
| `src/csv/parse.ts`, `src/csv/write.ts` | CSV reader/writer with formula-injection escaping (A1). Not used by any endpoint yet. |
| `src/config.ts` | Environment validation with zod. Only `development`/`test`, only loopback bind addresses. |
| `src/app.ts` | `buildApp()`: `GET /api/health` (never touches the database), `GET /api/ready` (503 when the database does not answer within 2 s) and, with a catalog reader, the catalog routes. |
| `src/errors.ts` | One error envelope for every API error; internal details are logged, never returned. |
| `src/catalog/` | Catalog API (1D): `query.ts` (zod query contract), `dto.ts` (public response shapes), `reader.ts` (Prisma reads with an explicit field list), `routes.ts`. |
| `src/server.ts` | `pnpm dev` entry point: config → `assertLocalDatabase()` → Prisma client → listen on `127.0.0.1:3001`. |
| `src/db/client.ts` | The only place a Prisma client is created; runs the guard first. |
| `src/db/commands.ts`, `scripts/db.ts` | `db:migrate`, `db:seed`, `db:reset`, each guarded. |
| `src/db/seed.ts` | Demo seed from the catalog the frontend already ships (`src/data.ts`, `src/brands.ts`). |
| `prisma/schema.prisma`, `prisma/migrations/` | Catalog schema and the committed migration (with CHECK constraints). |
| `docker-compose.yml`, `docker/postgres/initdb/01-nblao.sh` | Local PostgreSQL 17.11 and its first-start setup. |
| `test/unit/` | Unit tests (no database): guard, config, endpoints, client guard, seed helpers, CSV, permissions, frontend isolation. |
| `test/db/` | Integration tests against `nblao_test`: readiness, seed idempotency and protection, constraints, catalog reads and pagination. |

## Catalog API (Phase 1D, read-only, public)

| Endpoint | Query | Response |
|---|---|---|
| `GET /api/products` | `page` (≥ 1, default 1), `pageSize` (1–100, default 24), `sort` (`featured` \| `price_asc` \| `price_desc` \| `name_asc`), `category` (slug; includes subcategories), `brand` (brand id), `q` (≤ 100 chars; name, SKU or model, case-insensitive) | `{ items, page, pageSize, total, totalPages }` |
| `GET /api/brands` | none | `{ items }` |

- **Visibility:** active products in a supported currency (USD, THB, LAK); only active and visible variants;
  active brands only (a product whose brand is inactive shows `brand: null`).
- **Public fields only:** the reader selects an explicit field list and `dto.ts` maps it; JSON columns are
  re-shaped field by field. Prices are `{ minor: "<integer string>", currency, decimals }`.
- **Deterministic paging:** every sort ends with the product id, so pages never overlap or skip rows.
- **Strict queries:** unknown, repeated or malformed parameters → `400 { error: { code: "invalid_query", message, issues } }`.
  Unknown routes and methods → `404 { error: { code: "not_found", ... } }`. Unexpected failures →
  `500 { error: { code: "internal", ... } }` with details only in the server log.
- No write routes, no authentication, no CORS. `/api/health` and `/api/ready` are unchanged.

### Using it from the frontend (local development)

```sh
# terminal 1 (server/): database and API
docker compose up -d --wait && pnpm db:migrate && pnpm db:seed && pnpm dev
# terminal 2 (repository root): storefront reading the API through the Vite proxy
VITE_CATALOG_SOURCE=api pnpm dev
```

With `VITE_CATALOG_SOURCE=api` the Vite dev server proxies `/api` to `127.0.0.1:3001` and listens on `127.0.0.1`
only. The storefront loads every product page and keeps the existing browser-side EN/LO/TH search. Stock is not
part of the API yet, so products show "Availability on request", Add to Cart and Checkout are disabled, and RFQ
stays available. GitHub Pages builds always use the demo catalog: `scripts/verify-build-output.mjs` refuses an
API-mode build.

**Scaling note:** browser-side search is limited to 5,000 products (50 pages × 100). Beyond that, move
multilingual search to the server (stored Lao/Thai names or a translation table with PostgreSQL full-text or
trigram indexes) and page the product list on the server.

## Requirements

- **Node.js 22** (as in `.mise.toml` and CI). Node 24+ also works; Prisma 7.10 prints a support warning on
  Node 26 but runs.
- **pnpm 10.34.3**, pinned in `packageManager`. If your global pnpm is a different version, run the commands
  below as `npx corepack pnpm …` (Corepack then uses exactly 10.34.3), or install pnpm 10.34.3.
- **Docker Desktop** with the WSL 2 backend (primary path), or a native PostgreSQL 17 (alternative below).

## First-time setup (Docker, recommended)

Run everything from `server/`:

```sh
cp .env.example .env        # then replace every CHANGE_ME with your own local passwords
pnpm install                # server dependencies only; the frontend lockfile is not touched
pnpm db:generate            # generates the Prisma client into src/generated/ (gitignored)
docker compose up -d --wait # PostgreSQL 17 on 127.0.0.1:5432, creates nblao_app, nblao_dev, nblao_test
pnpm db:migrate             # applies prisma/migrations to nblao_dev
pnpm db:seed                # demo catalog, every row marked is_demo = true; safe to run again
pnpm dev                    # API on http://127.0.0.1:3001
```

Check it:

```sh
curl http://127.0.0.1:3001/api/health   # 200 {"status":"ok"}
curl http://127.0.0.1:3001/api/ready    # 200 when PostgreSQL answers, 503 when it does not
```

`NBLAO_APP_PASSWORD` in `.env` must match the password inside `DATABASE_URL` and `TEST_DATABASE_URL`.
The init script runs only when the Docker volume is empty; to change passwords later, change them in
PostgreSQL as well.

Stop the database with `docker compose stop` (data is kept in the `nblao_nblao-postgres-data` volume).
`docker compose down -v` **deletes all local database data**.

## Alternative: native PostgreSQL 17 on Windows

1. Install PostgreSQL 17 from postgresql.org, listening on `127.0.0.1` only (`listen_addresses = 'localhost'`).
2. As the superuser, run the same statements as `docker/postgres/initdb/01-nblao.sh` (create role
   `nblao_app` with `NOSUPERUSER NOCREATEDB NOCREATEROLE`, databases `nblao_dev` and `nblao_test` owned by it,
   and the `REVOKE` lines), using your own password.
3. Put that password into `DATABASE_URL` and `TEST_DATABASE_URL` in `.env`, then continue from `pnpm db:migrate`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Starts the API (loopback only, no CORS). |
| `pnpm test` | Unit tests. Needs `pnpm db:generate` once; no database. |
| `pnpm test:db` | Applies migrations to `nblao_test`, then runs the integration tests there. Never resets or drops. |
| `pnpm typecheck` | Strict TypeScript check (also `pnpm exec tsc --noEmit -p server/tsconfig.json` from the root). |
| `pnpm db:generate` | Generates the Prisma client. |
| `pnpm db:migrate` | `prisma migrate deploy` on `DATABASE_URL` (committed migrations only). |
| `pnpm db:seed` | Upserts the demo catalog. Running it twice creates no duplicates. |
| `pnpm db:reset` | **Deletes all data** in the target database, re-applies migrations and re-seeds. Without `--yes` it only prints what it would delete. |

## Database safety rules

- Every database-writing path (`db:migrate`, `db:seed`, `db:reset`, server start, tests) calls
  `assertLocalDatabase()` **before** connecting. It refuses unless `DATABASE_URL` points at
  `localhost`/`127.0.0.1`/`::1` (no `host`, `hostaddr` or `service` query parameter in any letter case), the
  database is `nblao_dev` or `nblao_test` (`ALLOWED_LOCAL_DATABASES` may only narrow this list), and
  `NODE_ENV` is `development` or `test`. Its errors never include the password.
- Integration tests narrow the allow-list to `nblao_test`, so they can never touch `nblao_dev`.
- `nblao_app` cannot create databases or roles and cannot connect to the `postgres` maintenance database.
- PostgreSQL is published on `127.0.0.1` only. Never commit `.env`. Never use production credentials.

## Data model notes (A6)

- Money is stored as integer **minor units** (`price_minor BIGINT`) plus an ISO 4217 `currency`, matching
  `src/commerce/money.ts`. Conversion refuses negative or over-precise prices. CHECK constraints in the
  migration reject negative prices and malformed currency codes.
- Variants keep `option_values` (JSON) and an optional `price_minor` (null = product price).
- `legacy_id` keeps the frontend's numeric product id for a later cart/RFQ migration.
- Stock/inventory, orders, RFQs, customers and staff are **not** modelled yet.

## CSV escaping policy

- **Import (`parse.ts`):** cell values are never evaluated; text is kept exactly as written. Apostrophe
  stripping is **opt-in** (`stripProtectiveApostrophes: true`, default off) and should be enabled only for files
  known to come from our own exporter. When enabled, exactly one leading apostrophe is removed when the value
  is one or more apostrophes followed by `=`, `+`, `-`, `@`, TAB, CR or LF, because that is the protective
  prefix the exporter adds. By default, third-party values are never altered.
- **Export (`write.ts`):** text that starts with `=`, `+`, `-`, `@`, TAB, CR or LF (optionally after leading
  apostrophes) gets one leading apostrophe so spreadsheets show it as text instead of running it as a formula.
  Numbers and booleans are written as plain values (a negative number stays `-5`). Fields containing a comma,
  double quote, CR or LF are quoted and quotes are doubled. Strings containing a NUL character are refused
  (`RangeError`). Files use CRLF and, by default, a UTF-8 BOM.
- With stripping enabled for our own exports, exported values round-trip unchanged through import.
- Not yet used by any module: per-column validation, limits (decision X5), dry-run, preview and import jobs.

## Frontend isolation

Tailwind v4 scans the whole repository for class names. `src/index.css` contains `@source not "../server";`
so files in this folder are excluded. `test/unit/frontend-isolation.test.ts` compiles the real
`src/index.css` with the root's Tailwind and runs Tailwind's own scanner to prove that no file in `server/`
reaches the frontend CSS (it needs the root `pnpm install`).

## Not implemented yet (each needs separate approval)

- CORS, any write API, a hosted API for the published site.
- Authentication, staff/customer accounts, role mapping (D12).
- Orders, RFQ, quotations, inventory, payments.
- CSV import jobs or endpoints.
- Staging, production, hosting, domain, deployment.
