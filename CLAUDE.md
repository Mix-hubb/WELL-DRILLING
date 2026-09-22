# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Well-Drilling is a Thai-language SaaS for managing well-drilling and repair businesses: customer/well/pump records, drilling and repair requests, quotations, job queues, PDF well reports, and LINE integration (LIFF forms + webhook bot). Multi-tenant via `org_id` on nearly every table. UI strings, error messages, and commit-adjacent docs are in Thai — keep new user-facing strings in Thai to match the existing app.

Three parts: `backend/` (Express + TypeScript API), `frontend/` (Vue 3 + TypeScript SPA), `supabase/` (PostgreSQL migrations + Supabase config, also used for Realtime broadcast).

## Commands

Backend (`cd backend`):
- `npm run dev` — ts-node-dev with hot reload, listens on `PORT` (default 4000, README says 4001 in one place — check `.env`)
- `npm run build` — `tsc -p tsconfig.json` to `dist/`
- `npm start` — run built `dist/server.js`
- `npm test` — `vitest run` (single run, no watch)
- `npm run test:watch` — vitest watch mode
- Run a single test file: `npx vitest run src/controllers/jobs.controller.test.ts`

Frontend (`cd frontend`):
- `npm run dev` — Vite dev server on `http://localhost:5173`
- `npm run build` — `vue-tsc -b && vite build` (type-checks before bundling)
- `npm run preview` — preview a production build
- `npm test` — `vitest run` (jsdom environment, see `frontend/vitest.config.ts`)
- `npm run test:watch` — vitest watch mode
- Run a single test file: `npx vitest run src/stores/jobs.test.ts`

There is no lint script in either package; type-checking (`tsc`/`vue-tsc`) is the primary static check, and CI runs `npm test` + `npm audit --audit-level=high` per package.

Database: apply `supabase/migrations/*.sql` in numeric order via the Supabase SQL editor or a Postgres client. There is no migration runner script — check the latest numbered file before adding a new one.

## Architecture

### Backend request flow

`src/server.ts` wires everything: security headers, CORS, JSON body parsing (with `rawBody` captured for webhook signature checks), then three route tiers:
1. **Public routes** — LIFF form submissions (`/api/public/*`), pump catalog, uploads, LINE webhooks, and magic-link routes for drillers/customers to submit results without logging in.
2. **Protected routes** — everything under `/api/customers`, `/api/jobs`, `/api/wells`, etc., gated by `authMiddleware` (JWT) then `apiLimiter` (rate limit) then the router.
3. **Debug/admin routes** — inline in `server.ts`, gated by `authMiddleware` + `adminMiddleware`.

Routes are thin (`routes/*.routes.ts`): wire an HTTP verb + path to a controller function wrapped in `asyncHandler` (Express 4 doesn't forward async rejections automatically — always wrap async route handlers with `asyncHandler`). All write operations (POST/PUT/PATCH/DELETE) across every resource route are gated by `adminMiddleware` — the `DRILLER` role is read-only everywhere in the authenticated app (GET routes have no role check). Drillers still submit fieldwork data through the unauthenticated magic-link endpoints (`magicAuth`/`magicResourceAuth`), which are unaffected by this.

Controllers (`controllers/*.controller.ts`) talk to Postgres directly via the shared `pool` from `config/db.ts` — there is no ORM. Query params are always positional (`$1`, `$2`, ...).

### Multi-tenancy pattern

Every authenticated request carries `req.user.orgId` (set by `authMiddleware` from the JWT). Controllers scope queries to the caller's org using `userFilter(req, alias, existingParamCount)` / `userWhere(...)` from `utils/userFilter.ts`, which append an `AND <alias>.org_id = $N` clause with the correct positional parameter index — always pass the count of params already pushed onto the array so the index lines up. Public/LINE-facing endpoints instead resolve `org_id` from a LIFF ID via `utils/resolveOrg.ts` (`organizations.line_liff_id_drilling` / `line_liff_id_repair`), since those requests have no JWT.

**`org_id` only lives on `organizations`, `users`, and `customers`.** Everything else (`wells`, `well_strata_logs`, `well_pipes`, `well_pumps`, `well_control_boxes`, `drilling_requests`, `drilling_jobs`, `repair_requests`, `quotations`, `repair_records`, `line_notifications`) has no `org_id` column and is tenant-scoped transitively through a join back to `customers` (e.g. `wells.customer_id → customers.customer_id → customers.org_id`). So `userFilter`/`userWhere` must be applied against the `customers` alias in the query (typically aliased `c`), not against the child table itself — check the join chain before assuming a table can be filtered directly.

### Magic links

Drillers and customers can complete a job or submit repair records without an account via a `magic_link_token` stored on `drilling_jobs` / `repair_requests` rows. `middleware/upload.ts` exports `magicAuth` (validates a token exists and isn't expired) and `magicResourceAuth(resource)` (validates the token matches the specific `:id` in the route) — both are used directly in `server.ts` rather than through a `*.routes.ts` file.

### Realtime updates

Despite being called "SSE" throughout the code (`services/sse.ts`, `useSSE.ts`, `/api/events` in older docs), realtime push is implemented via **Supabase Realtime broadcast channels**, not actual server-sent events. Backend calls `broadcast({ type, data, orgId })` after a mutation; this publishes to Supabase channel `org:<orgId>` (or `global` for org-agnostic events like pump catalog changes). The frontend's `useSSE()` composable subscribes to both the caller's `org:<orgId>` channel (org id decoded from the JWT in localStorage) and the `global` channel, and dispatches events to any component that called `on(eventType, callback)`. When adding a new mutation that should live-update other clients, call `broadcast()` after the DB write and add a corresponding `on(...)` listener in the relevant store/view.

### Frontend structure

Vue 3 + `<script setup>` + Vuetify 3 + Pinia + vue-router, path-aliased `@` → `src/`. Layers:
- `api/*.ts` — thin wrappers around the shared `api`/`publicApi` clients in `api/client.ts`, one file per resource. `api` attaches the JWT from `localStorage["welldrill-token"]`; `publicApi` is for LIFF/unauthenticated form endpoints.
- `stores/*.ts` (Pinia) — hold fetched lists/records per resource, called by views; several register SSE listeners via `useSSE()`/`useSSERefresh()` to refresh on backend broadcasts.
- `views/*.vue` — routed pages; most authenticated routes render inside the main layout with nav (`AppNavDrawer`/`AppBottomNav`), while `LoginView`/`RegisterView`/`*PasswordView` are `meta: { public: true }`.
- `composables/` — cross-cutting logic (SSE subscriptions, driller repair/well form state).

### Database

Plain SQL migrations in `supabase/migrations/`, applied in numeric filename order (`0001_init.sql` ... `0008_organizations.sql`) — there is no down-migration or ORM-managed schema. Core tables and relationships:

- `organizations` (`org_id`, LINE channel secret/token/id, `line_liff_id_drilling`/`line_liff_id_repair`, `invite_code`) — tenant root.
- `users` (`org_id`, `role` ADMIN/DRILLER, `email`, `password_hash`) — staff accounts.
- `customers` (`org_id`, `user_id?`, `line_user_id`, `line_display_name`/`line_picture_url`) — the join point every other domain table scopes through.
- `wells` (`customer_id`) — one well row per site; carries `drilling_method`, `formation_water_type`, `warranty_expire_date` (defaults to completion + 2 years), `result` SUCCESS/FAIL. Child tables `well_strata_logs`, `well_pipes`, `well_pumps`, `well_control_boxes` all FK to `well_id`.
- `pump_catalog_models` — org-agnostic shared reference catalog (brand/model/specs/reference price), not scoped to a customer or org.
- `drilling_requests` (`customer_id`, `status` NEW/QUOTED/ACCEPTED/REJECTED/CANCELLED) → `drilling_jobs` (`request_id`, `customer_id`, `well_id?`, `status` QUEUED/DRILLING/SUCCESS/FAILED/CLOSED, `magic_link_token`).
- `repair_requests` (`customer_id`, `well_id?`, `problems`/`photos` as jsonb, `status` NEW..CLOSED/CANCELLED, `magic_link_token`) → `repair_records` (`repair_id`, `parts`/`pump` as jsonb, `is_warranty_claim`).
- `quotations` (`kind` DRILLING/REPAIR, `drilling_request_id?`, `repair_request_id?`, `status` PENDING/ACCEPTED/REJECTED) — one polymorphic table for both quote types.
- `line_notifications` (`customer_id`, `kind` QUOTE/STATUS/REMINDER/OTHER) — outbound LINE message log.

See the "Multi-tenancy pattern" note above — only `organizations`/`users`/`customers` have `org_id` directly; every other table above is scoped by joining back to `customers`.

### LINE integration

`services/line.ts` sends messages/Flex cards through an org's LINE channel access token (looked up from `organizations`, not a single global token — the app supports multiple orgs each with their own LINE channel). `routes/webhooks.routes.ts` receives inbound LINE events (text keywords like "ข้อมูลบ่อ"/"ประกัน"/"ประวัติซ่อม", postback actions for accept/reject on drilling requests). LIFF forms (`VITE_LIFF_ID_DRILLING`/`VITE_LIFF_ID_REPAIR` or per-org LIFF IDs from `organizations`) submit to the public `/api/public/*` endpoints, resolving the org via `utils/resolveOrg.ts`.

## Conventions to follow

- Error responses are `{ error: "<Thai message>" }`; keep this shape and language for new endpoints.
- Never bypass `userFilter`/`userWhere` on a protected, tenant-scoped query — a missing org filter is a cross-tenant data leak.
- SQL uses raw parameterized queries (`pool.query(sql, params)`) — never interpolate request-derived values into the SQL string.
- New async route handlers must be wrapped in `asyncHandler`.
- Backend tests live alongside source as `*.test.ts` (co-located, not in a separate `__tests__` dir); follow that pattern for new modules.
