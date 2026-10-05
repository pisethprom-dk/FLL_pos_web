<!-- v1.0.0 — handover context for Claude Code. Place at the repo root as CLAUDE.md. -->

# POS frontend — Angular 22

Back-office screens for the POS backend in `../pos_backend` (Django + DRF): one
hardware shop in Phnom Penh, prices in US dollars, riel across the counter.

**Read `../pos_backend/CLAUDE.md` for the domain rules.** They are not repeated
here. The backend enforces them; the frontend shows them and never works
around them.

---

## How to work on this project

**Discuss before coding.** The concept and approach must be agreed before any
code is generated. This is a firm rule from the project owner, not a
preference. When a decision is ambiguous, ask — do not pick one and build it.

**Every hand-written file gets a version comment on line 1**, bumped on every
change: `// v1.0.0` in TypeScript and SCSS, `<!-- v1.0.0 -->` in HTML. Not in
`src/app/api/` (generated) and not in JSON files (JSON has no comments).

**Run the tests and the build before claiming anything works.**

```bash
npm test -- --watch=false
npm run build
```

**UI work is delivered as files, never as code pasted in chat.**

---

## Running it

```bash
nvm use                 # reads .nvmrc → Node 22 (Angular CLI 22 needs ≥ 22.22.3)
npm install
npm start               # http://localhost:4200
```

The backend must be running (`docker compose up -d` in `../pos_backend`).

`npm start` proxies `/api` and `/media` to `http://localhost:8000`
(`proxy.conf.json`), so the browser sees one origin — the same as nginx in
production. That is what lets the refresh cookie (`pos_refresh`, path
`/api/auth/`, httpOnly) work. **Always call relative URLs (`/api/...`); never
`http://localhost:8000` from code.**

If `nvm install` cannot find any version: `~/.zshrc` on this Mac sets
`NVM_NODEJS_ORG_MIRROR` to the retired taobao mirror. Override it for the
command: `NVM_NODEJS_ORG_MIRROR=https://nodejs.org/dist nvm install 22`.

---

## The API client is generated

`src/app/api/` is written by `ng-openapi-gen` from the backend's
`/api/schema/`. **Never edit it.** With the backend running:

```bash
npm run api             # regenerate
npm run build           # the compiler now shows what a backend change broke
```

Commit the generated output, so a build never needs the backend running.

- One injectable service per backend area, returning Observables:
  `AuthService`, `UsersService`, `CompanyService`, `CatalogueService`,
  `PartnersService`, `InventoryService`, `SalesService`. Method names come
  from the backend's operation ids, e.g. `salesInvoicesCompleteCreate`.
- The generated `AuthService` is only the HTTP calls. The app's own session
  state (token, user, scopes) needs another name — e.g. `SessionStore` — so
  the two do not collide.
- **Money arrives as decimal strings** (`"212.05"`). Never `parseFloat` it for
  arithmetic. The till may preview totals with the same rules as the backend,
  but the server is the authority: what prints is what the API returned.
- **A field the user may not see comes back `null`**, not missing — cost and
  profit for a Seller, expected quantity while a count is open.
- If a generated type is wrong, fix the backend schema (see "Keeping the
  schema clean" in the backend CLAUDE.md), then regenerate. Never patch it here.

---

## Decisions already made

Do not re-litigate these without asking.

- **Angular 22**: standalone components, zoneless, strict, SCSS, Vitest, no SSR.
- **Separate repo** from the backend, sibling folder.
- **Screens**: the agreed mockup's own CSS
  (`../pos_backend/mock-up/pos-dashboard-mockup.html`) ported as the app
  stylesheet, with **Angular CDK** for behaviour only — dialogs, overlays,
  tables, keyboard access. No Angular Material, no PrimeNG.
- **API client**: generated services returning Observables
  (`services: true`, `promises: false` in `ng-openapi-gen.json`).
- **Auth** (to build): access token in memory only, never in localStorage. An
  interceptor adds `Bearer`; on a 401 it calls `/api/auth/refresh/` once and
  retries. On start-up the app calls refresh to restore the session. The
  scopes from `/api/auth/me/` drive route guards and a `*hasScope` directive —
  no role names in components.

---

## Layout

```
src/app/
  api/         GENERATED — ng-openapi-gen output, never edited
  core/        app-wide singletons: session, interceptors, guards, the shell
  shared/      reused pieces: money pipes ($ and ៛), table, dialog, inputs
  features/    one folder per mockup menu, each a lazy-loaded route:
               sell, quotations, payments, returns, warranty, stock,
               reports, catalogue, partners, company, users
```

---

## Current state

| Step | What | Status |
|---|---|---|
| 1 | Backend schema clean (0 warnings, tested) | Done — in the backend |
| 2 | Scaffold, proxy, generated client | Done |
| 3 | Core: session, interceptor, guards, `*hasScope`, shell from the mockup, login | **Next** — agree the design first |
| 4 | Catalogue screens (proves the pipeline end to end) | |
| 5 | Partners, stock, the till, quotations, payments, returns | |

**No API yet for:** Dashboard, Daily sales, Stock on hand, Receivables
(backend slice 6), and Warranty claims (not assigned to a slice).
