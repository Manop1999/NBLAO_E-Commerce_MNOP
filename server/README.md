# NB LAO shop server (Phase 1B-local A1–A6, Phase 1D catalog API, Phase 1E authentication)

The future backend API for `shop.nblao.com`. It is a **standalone package** (its own `package.json` and
`pnpm-lock.yaml`), separate from the React/Vite frontend at the repository root. It runs **only on your own
computer** against a local PostgreSQL. Nothing here is deployed. The published GitHub Pages site does not call
it; only a local frontend started with `VITE_CATALOG_SOURCE=api` and/or `VITE_AUTH_SOURCE=api` talks to it.

## Status

| Step | What | Status |
|---|---|---|
| A1 | Local database guard, draft permissions, CSV reader/writer | Done |
| A2 | Standalone package: ESM, pnpm 10.34.3, strict `tsconfig.json` (`noUncheckedIndexedAccess`) | Done |
| A3/A4 | PostgreSQL 17 in Docker on `127.0.0.1`, restricted role `nblao_app`, databases `nblao_dev` and `nblao_test` | Done |
| A5 | Fastify app factory, zod configuration, `GET /api/health`, `GET /api/ready` | Done |
| A6 | Prisma catalog schema (Brand, Category, Product, ProductVariant, ProductImage), first migration, idempotent demo seed | Done |
| 1D | Public read-only catalog API: `GET /api/products`, `GET /api/brands` | Done |
| 1E | Staff and customer authentication, TOTP 2FA, roles and data scopes, approvals, invitations, reset links, append-only audit log (local only) | Done |

| Path | Purpose |
|---|---|
| `src/db/assertLocalDatabase.ts` | Refuses any database that is not local and allow-listed (A1). |
| `src/auth/permissions.ts` | Permission codes and a deny-by-default `can()` (A1, extended in 1E). |
| `src/auth/roles.ts` | Role → permission map (D12), customer and audit data scopes, staff-management rules (D-STAFF). |
| `src/auth/` (other files) | Phase 1E: passwords (Argon2id), tokens, sessions, TOTP, AES-GCM secret box, recovery codes, lockout, CSRF/origin checks and guards (`http.ts`), audit writer, routes (`staffAuth`, `customerAuth`, `accountTokens`, `adminCustomers`, `adminStaff`), `plugin.ts` wiring, `cli.ts`. |
| `scripts/auth.ts` | `auth:*` local commands (key setup, first Super Admin, Super Admin 2FA reset, cleanup). |
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
| `test/db/` | Integration tests against `nblao_test`: readiness, seed idempotency and protection, constraints, catalog reads and pagination, and (1E) every authentication workflow with synthetic `@example.test` accounts. |

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

## Authentication (Phase 1E, local development only)

Real sign-in runs **only on this computer** until HTTPS hosting and a domain exist (Phase 1H). The GitHub Pages
build keeps the prototype sign-in; `scripts/verify-build-output.mjs` refuses any build made with
`VITE_AUTH_SOURCE=api`.

### Safe local setup

```sh
# server/ (database already set up as described below)
pnpm db:migrate               # applies the auth migrations; never resets anything
pnpm auth:setup-keys          # adds a random TOTP_ENCRYPTION_KEY to server/.env (value never printed)
pnpm auth:create-super-admin  # interactive, hidden password prompt; refuses if a Super Admin exists;
                              # the email must end in @admin.nblao.invalid (see "Privileged email namespace")
pnpm dev
# repository root, second terminal
VITE_AUTH_SOURCE=api VITE_CATALOG_SOURCE=api pnpm dev   # Vite on 127.0.0.1 with the /api proxy
```

- Never put passwords, keys or tokens in command arguments, environment variables of the frontend
  (`VITE_*` is public) or chat. `TOTP_ENCRYPTION_KEY` lives only in the gitignored `server/.env`; replacing it
  invalidates every 2FA enrolment. Production key storage and rotation are a Phase 1H launch blocker.
- Use synthetic test accounts only (for example `name@example.test`); no real customer data locally.
- The first Super Admin must change the password and enrol 2FA at first sign-in.

### Workflows

| Workflow | How it works |
|---|---|
| Staff sign-in | `POST /api/auth/staff/login` → session stage: 2FA verification (if enrolled) → forced password change → forced 2FA enrolment for Super Admin, Admin and Manager → `FULL`. Only `FULL` sessions reach `/api/admin/*`. |
| 2FA (TOTP) | RFC 6238, SHA-1, 6 digits, 30 s, ±1 step, replay-protected: every write that consumes a code (sign-in/step-up verification, enrolment confirmation, recovery-code regeneration) claims its time step with a conditional update inside its transaction, so two concurrent requests with the same code cannot both succeed and a losing request never replaces the winner's recovery codes (`409 mfa_code_used`). Enrolment shows a server-generated QR code and the setup key once; 10 single-use recovery codes are shown once. Sensitive actions need a 2FA confirmation within the last 5 minutes (step-up). |
| 2FA failures | Counted separately from password failures; wrong codes never lock the password sign-in, and nobody can block a colleague's 2FA. (1) **Challenge:** 5 wrong codes end that sign-in challenge only. (2) **Account + source:** 10 wrong codes for one account from one source address within 15 minutes block 2FA for that account *from that source only* for 15 minutes, doubling per repeat (max 24 h); other networks and the account's existing sessions keep working (`mfa_throttles`, source stored as a SHA-256 digest only). (3) **Rate limits:** 10 2FA requests/min per source and 5 code attempts/min per account + source. (4) **Monitoring:** an account-wide counter raises an audited alert every 20 failures but never blocks. Mandatory 2FA is never bypassed: a blocked source still cannot pass the 2FA step. Recovery: a correct code from that source after the block, or a Super Admin 2FA reset (clears all blocks and forces re-enrolment). Failures, blocks and alerts are audited without codes, secrets or addresses. |
| Customer registration | `POST /api/auth/customer/register` → `PENDING`, unassigned, nobody signed in; identical answer for existing emails. Pending customers can sign in and see their status. |
| Approval | `POST /api/admin/customers/:id/approve` / `reject` (reason) / `suspend` (reason) / `reactivate`; Super Admin, Admin and Manager (in scope). **Each decision needs a 2FA confirmation within the last 5 minutes (step-up).** The inviter, and the staff member who requested the invitation, can never approve or reject that customer (the inviter rule is also a DB CHECK); the account then stays `PENDING`. |
| Invitations | Direct: `POST /api/admin/customers/invitations` (`customers.invite`: Super Admin and Admin only, **fresh 2FA (step-up) required**) → `INVITED` customer and a one-time link (72 h). The customer sets a password → `PENDING` (approval still required). Concurrent invitations or registrations of one email answer `409 email_in_use`, never 500. |
| Invitation requests | Managers (`customers.request_invite`) cannot invite directly: a direct invitation must look the email up across all customers, which would tell a Manager whether an account exists outside their scope. `POST /api/admin/customers/invitation-requests` files a request **without reading the customers table** and always answers `202` (same body, statements and timing for a new email and for one registered inside or outside the Manager's scope); limited to 20 per staff member per hour. A Manager must belong to a team (`403 team_required` otherwise). The requester sees only their own requests as `SUBMITTED` / `PROCESSED`. Super Admin and Admin review every request (`GET …/invitation-requests`, including whether the email is already registered) and `issue` it (creates the `INVITED` customer and the link; existing email → `409`, request stays pending) or `decline` it (optional internal note); both need a fresh 2FA (step-up), checked before the request is read, so a refused attempt never changes it. Decisions are claimed atomically and audited as SECURITY events — including the `customer_invited` event of a request-based invitation — which Managers cannot read. |
| Reset links | Customers: Super Admin, Admin, Manager (in scope); staff: Super Admin only. One-time, 60 minutes, 2FA step-up required, all sessions revoked on use, 2FA kept. No temporary passwords; self-service email reset is Phase 1H. |
| Account links | Links look like `/account/set-password#<token>`: the token is in the fragment, so it never reaches server logs, and the page removes it from the address bar. Only SHA-256 digests are stored. |
| Scopes | Sales: only their assigned customers. Manager: their team plus unassigned customers. Admin/Super Admin: all. Warehouse: none. Enforced in the database query. |
| Staff management | API only in 1E (UI in 1G). Super Admin lists, inspects and manages every staff account. Admin lists and inspects only Manager, Sales and Warehouse accounts (filter in the database query) and gets the same 403 for any Admin or Super Admin account (including its own) **and for ids that belong to no account**, on every staff endpoint, so staff ids cannot confirm that a privileged account exists (Super Admins get 404 for missing ids). Manager, Sales and Warehouse get 403 on all staff and team endpoints. Super Admin and Admin accounts must use the reserved privileged namespace (below), and only a Super Admin can create them; everyone else must not. An Admin creating staff with a reserved address always gets the same `400 reserved_email` — decided from the request alone, before any lookup, so it never reveals whether such an account exists; other duplicates (which can only be accounts the Admin already sees) get `409 email_unavailable`. Both are audited (visible to Super Admins only) and limited to 5 per staff member per hour. Promotion into Admin/Super Admin needs a separate account with a reserved address; a privileged account cannot become a non-privileged one (disable it instead). The last active Super Admin cannot be disabled or demoted (advisory lock). Role or status changes end all sessions. |
| Sessions | Server-side; HttpOnly cookies `nblao_staff` (SameSite=Strict) and `nblao_customer` (Lax). Staff 30 min idle / 12 h absolute; customers 2 h / 12 h, or 7 days / 30 days with Remember me. CSRF: allowed Origin + JSON only + `x-csrf-token`. |
| Abuse limits | Per-IP rate limits, per-email attempt limits, password lockout (5 failures → 15 min, doubling up to 24 h), separate 2FA throttling (above). **The per-IP, per-email, per-account + source, staff-email-conflict and invitation-request limits are kept in process memory** — see the launch blockers below. |
| Audit log | `audit_events` is append-only: a database trigger rejects UPDATE, DELETE and TRUNCATE. Managers read operational events of their team; security events need Admin. Retention and a separate database role are Phase 1H decisions. |

### Auth commands

| Command | What it does |
|---|---|
| `pnpm auth:setup-keys` | Adds `TOTP_ENCRYPTION_KEY` to `server/.env` if missing. Never replaces or prints an existing key. |
| `pnpm auth:create-super-admin` | Creates the first Super Admin (interactive terminal only). |
| `pnpm auth:reset-super-admin-mfa` | Last resort when no other Super Admin can reset 2FA; asks you to type `RESET`; audited. |
| `pnpm auth:cleanup` | Deletes sessions and links that expired or were used more than a day ago. Never touches audit events. |

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
- Stock/inventory, orders and RFQs are **not** modelled yet. Customers, staff, teams, sessions, account links
  and audit events were added in Phase 1E (`auth_foundation` and `mfa_pending_secret` migrations).

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

### Privileged email namespace (temporary for Phase 1E)

Why: without it, an Admin could learn that an address belongs to a Super Admin or Admin because creating a staff
account with it fails while the account is missing from the Admin's staff list.

- **Rule ("if and only if"):** a staff account is `SUPER_ADMIN` or `ADMIN` exactly when its normalised email
  (trimmed, lower case) is at least one character followed by `@admin.nblao.invalid`. The same rule is in
  `src/auth/privilegedNamespace.ts` and in the PostgreSQL CHECK constraint `staff_users_privileged_namespace`
  (`email LIKE '_%@admin.nblao.invalid'`, migration `20261104000400_privileged_email_namespace`); tests insert the
  same role/email combinations through the database and compare with the code.
- **Admins** can never use the namespace: the refusal is identical whether or not the account exists, is decided
  before any lookup, is audited and rate-limited. Any other duplicate can only be a Manager, Sales or Warehouse
  account the Admin already sees. Admins still create and manage Manager, Sales and Warehouse accounts as before.
- **Super Admins** create Admin/Super Admin accounts with reserved addresses (one-time setup link, as before), may
  switch an account between Admin and Super Admin, and cannot promote a Manager/Sales/Warehouse account (create a
  separate privileged account) or demote a privileged account (disable it). The first Super Admin from the CLI must
  use the namespace.
- **No email:** `.invalid` (RFC 2606) can never receive mail, and nothing in Phase 1E sends email; setup and reset
  stay one-time links shown to the authorised operator.
- **Production guard:** `config.ts` refuses to start with `NODE_ENV=production` while the namespace is the
  temporary `.invalid` placeholder, and `scripts/verify-build-output.mjs` refuses a published frontend build
  that contains it.
- **Phase 1H (launch blocker):** replace it with a verified domain owned and controlled by NB LAO (confirm ownership,
  DNS/MX and mailbox setup first). Plan it as a migration: switch the code constant and the CHECK together; create
  new privileged accounts at the new domain through Super Admin setup links; verify each person can sign in and has
  2FA; then disable the old accounts (the last active Super Admin is protected); only then tighten the constraint so
  old addresses are refused. Never edit privileged emails in place without verifying the person.

### Security design notes (reviewed in Phase 1E)

**CSRF.** State-changing `/api/auth` and `/api/admin` requests must (1) come from an allowed loopback Origin and
not be `Sec-Fetch-Site: cross-site`, (2) send JSON (form and text bodies are refused with 415, so a plain HTML form
cannot post), and (3) carry `x-csrf-token`. The token is `HMAC-SHA256(key = session token, "nblao-csrf-v1")`:
the session token is 32 random bytes (256 bits), so the CSRF token is bound to exactly one session and purpose,
changes whenever the session is rotated, and cannot be turned back into the session token. It is compared in
constant time, sent only in a header and a no-store JSON body (never in a URL), and redacted from logs. Without
CORS, other sites cannot read it.

**Account links.** One page serves customer invitations, staff setup links and password resets, but each token
row stores its purpose and account; the server derives what a link does from that row (the browser cannot choose)
and accepts it only in the matching account state (an invitation only while a customer is `INVITED` / a staff
account has no password yet; a reset only for an active account that has a password). A database CHECK ties each
token to exactly one account of the declared type. Tokens are 32 random bytes, stored as SHA-256 only, single-use
(atomic claim), expiry-checked (72 h invitations, 60 min resets), superseded when a new link is issued, sent only in
POST bodies, and never logged. In the browser the token lives in the URL fragment (`#…`), which is never sent to
any server or included in a `Referer`. A small inline script at the top of `index.html` runs before any other
script, stylesheet or font: on `/account/set-password` it moves the token into page memory (never storage),
replaces the history entry so the address bar and session history no longer show it, and sets
`referrer: no-referrer` for the page. The pages load no analytics or third-party scripts; the only third-party
request is the Google Fonts stylesheet, which never sees the fragment. Residual: a browser may still record the
originally opened URL (with fragment) in its global history before any script runs; links are single-use and
short-lived to limit this.

**Customer list.** Inviter and approver staff ids are returned to Super Admins only; other staff get
`invitedByMe` / `requestedByMe` / `approvedByMe` flags (the assigned owner is always a Sales or Manager account).

**Team staff counts.** `GET /api/admin/teams` counts staff with the caller's staff-visibility filter in the count
query: an Admin's counts never include Admin or Super Admin members; a Super Admin's are complete.

**Invitation requests — residual limitation.** A Manager can still *infer* the outcome of a request later, from
whether an invited customer appears in their team. This now goes through a human Admin review (audited, rate-limited,
no automated oracle, no response or timing difference, and the Manager never holds the link). It is fully closed
only by email-only invitations (Phase 1H).

**Audit visibility.** Super Admins see every event. Everyone else (Admin, Manager in their operational scope) never
sees events whose subject or actor is a Super Admin or Admin account, filtered in the database query.

### Production launch blockers (Phase 1H; the local API must not be presented as production-ready)

- **Shared rate-limit store.** All attempt limiters (per-IP, per-email, per-account + source 2FA, staff-email conflicts, invitation requests) live in process memory:
  they reset on restart and are not shared between processes or servers. The server logs a warning at start-up,
  and `config.ts` refuses any `NODE_ENV` other than `development`/`test`. A shared store (for example Redis or
  PostgreSQL) plus correct `trustProxy` settings are mandatory before production: behind a proxy every request
  would otherwise appear to come from the proxy's address, merging all users into one 2FA source. (The password
  lockout and the per-source 2FA blocks are in PostgreSQL and already persist.)
- Replace the temporary privileged staff namespace `@admin.nblao.invalid` with a verified NB LAO domain (see
  "Privileged email namespace"); the server refuses to start in production until then.
- HTTPS, domain and a same-origin reverse proxy (`Secure` + `__Host-` cookies).
- `TOTP_ENCRYPTION_KEY` in a secret manager, with rotation.
- A separate database role so the runtime user cannot drop the audit trigger; an audit retention period.
- Email delivery for self-service password reset; backups and monitoring.

## Not implemented yet (each needs separate approval)

- CORS, a hosted API for the published site, production authentication (HTTPS, `__Host-` cookies, key
  management, shared rate-limit store, email delivery) — Phase 1H.
- Staff and Positions screens in the Admin Portal (Phase 1G); exports and refunds (permissions reserved).
- Orders, RFQ, quotations, inventory, payments.
- CSV import jobs or endpoints.
- Staging, production, hosting, domain, deployment.
