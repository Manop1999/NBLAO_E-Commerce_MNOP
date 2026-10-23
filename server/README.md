# NB LAO shop server (Phase 1B-local, A1)

This folder is reserved for the future backend API for `shop.nblao.com`. It will be a **standalone package**,
separate from the React/Vite frontend at the repository root. **Nothing here is built, run, or deployed yet.**

## Status

A1 (the dependency-free skeleton) is complete. Nothing below is called by an endpoint, job or UI yet.

| Path | Purpose |
|---|---|
| `README.md` | This file. |
| `test/unit/frontend-isolation.test.ts` | Proves that files in `server/` cannot change the frontend's generated CSS. |
| `src/db/assertLocalDatabase.ts` | Local-database safety guard (A1-b). No database connection exists. |
| `test/unit/assertLocalDatabase.test.ts` | Unit tests for the guard. |
| `src/auth/permissions.ts` | Draft permission codes and a deny-by-default `can()` helper (A1-c). No role mapping (decision D12) and no users. |
| `test/unit/permissions.test.ts` | Unit tests for the permission helper. |
| `src/csv/parse.ts` | RFC 4180-style CSV reader: strict UTF-8, removes leading BOMs, rejects NUL characters, detects `;`-separated files (header and rows with matching semicolons outside quotes), protective-apostrophe handling (A1-d). |
| `test/unit/csv-parse.test.ts` | Unit tests for the reader. |
| `src/csv/write.ts` | CSV writer with formula-injection escaping, quoting, UTF-8 BOM and CRLF (A1-d). |
| `test/unit/csv-write.test.ts` | Unit tests for the writer, including import/export round trips. |

## Frontend isolation

Tailwind v4 scans the whole repository for class names. `src/index.css` contains `@source not "../server";`
so files in this folder are excluded. The isolation test compiles the real `src/index.css` with the installed
Tailwind and scans the repository with Tailwind's own scanner, exactly as the Vite plugin does. It checks that:

1. without the boundary, this folder's files **would** be scanned (control), and
2. with the boundary from `src/index.css`, **no** file in `server/` is scanned and a sentinel word from this
   folder never reaches the CSS candidates.

Run it from the repository root with the already-installed tools (no install needed):

```sh
node_modules/.bin/vitest run --root server
```

## CSV escaping policy

- **Import (`parse.ts`):** cell values are never evaluated; text is kept exactly as written. Exactly one
  leading apostrophe is removed when the value is one or more apostrophes followed by `=`, `+`, `-`, `@`, TAB
  or CR, because that is the protective prefix the exporter adds.
- **Export (`write.ts`):** text that starts with `=`, `+`, `-`, `@`, TAB or CR (optionally after leading
  apostrophes) gets one leading apostrophe so spreadsheets show it as text instead of running it as a formula.
  Numbers and booleans are written as plain values (a negative number stays `-5`). Fields containing a comma,
  double quote, CR or LF are quoted and quotes are doubled. Files use CRLF and, by default, a UTF-8 BOM.
- Together these make exported values round-trip unchanged through import.
- Not yet used by any module: per-column validation (IDs, numbers, enums), limits (decision X5), dry-run,
  preview and import jobs come in later, separately approved phases.

## Not implemented yet (each needs separate approval)

- `package.json` and `pnpm-lock.yaml` for this folder (A2 pnpm 10.34.3 via Corepack, A5 dependency install).
- Fastify app, `/api/health`, `/api/ready`, configuration (A5).
- Prisma schema, migrations and database tests (A3 PostgreSQL 17, A4 local role/databases, A6 migrations).
- CSV module registry, import jobs, any CSV endpoint or UI.
- Authentication, staff accounts, email, payments, CI workflow, staging, production.

## Database safety rules (for later phases)

- Every migration or database-writing command must first call `assertLocalDatabase()` from
  `src/db/assertLocalDatabase.ts`. It refuses unless `DATABASE_URL` points at `localhost`/`127.0.0.1`/`::1`
  (no `host`, `hostaddr` or `service` query parameter in any letter case), the database is `nblao_dev` or
  `nblao_test` (`ALLOWED_LOCAL_DATABASES`
  may only narrow this list), and `NODE_ENV` is `development` or `test`.
- Never use production credentials. Never point `DATABASE_URL` at a remote host.
