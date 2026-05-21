# Fishing Journal

A web app where anglers log fishing notes and pin the locations of their catches on a map.

This repo is a Turborepo monorepo with two apps:

- **`apps/api`** — Express + Prisma backend (Node.js, ESM, JavaScript).
- **`apps/frontend`** — Vite + React frontend (JavaScript, shadcn/ui, Tailwind).

Postgres runs in Docker; the API runs on the host for faster iteration.

> **Learning this stack?** The [`docs/`](./docs) directory has a guided tour written for junior developers — start with [`docs/README.md`](./docs/README.md).

---

## Tech stack

| Area              | Choice                                                                |
| ----------------- | --------------------------------------------------------------------- |
| Monorepo          | pnpm workspaces + Turborepo                                           |
| Language          | JavaScript (ESM, no TypeScript)                                       |
| Frontend          | Vite, React 18, shadcn/ui, Tailwind, TanStack Query, React Hook Form, Zod |
| Backend           | Express 4, Prisma 5, Postgres 16                                      |
| Auth              | JWT in `localStorage` + server-side `Session` row in Postgres; bcrypt password hashing |
| Tests             | Vitest everywhere; supertest for API HTTP tests                       |
| Architecture      | Feature-Sliced Design (FSD) on the frontend; layered FSD on the API   |

---

## Prerequisites

Install these once on your machine:

- **Node.js ≥ 20.6** — the API uses `node --watch --env-file` which requires 20.6+. An `.nvmrc` pins major version `20`.
- **pnpm ≥ 9** — easiest via `corepack enable` (ships with Node).
- **Docker Desktop** — for the Postgres container. The compose file expects `docker compose` (v2 CLI).
- **Git**.

Verify:

```bash
node --version    # v20.x
pnpm --version    # 9.x
docker --version
```

---

## First-time setup

From the repo root:

```bash
# 1. Install all workspace deps
pnpm install

# 2. Create local env files from the templates
cp .env.example .env
cp apps/api/.env.example apps/api/.env

# 3. Start Postgres in Docker
pnpm db:up

# 4. Generate the Prisma client + apply the initial migration
pnpm --filter @fishing-journal/api prisma:migrate -- --name init

# 5. Seed the admin user (reads ADMIN_EMAIL / ADMIN_PASSWORD from apps/api/.env)
pnpm --filter @fishing-journal/api db:seed

# 6. Boot both apps
pnpm dev
```

You should now have:

- API at <http://localhost:3001> (health: <http://localhost:3001/api/health>)
- Frontend at <http://localhost:5173>
- A sign-in page at <http://localhost:5173/login> — use the admin credentials you set in `apps/api/.env`. After login you'll land on `/dashboard`.

The Vite dev server proxies `/api/*` to the API, so the frontend can call the backend without CORS hassle.

> **Change the admin password before logging in for the first time.** The default in `.env.example` is `changeme-locally` — fine for a throwaway local DB, not fine for anything else. Edit `ADMIN_PASSWORD` in `apps/api/.env` and re-run `pnpm --filter @fishing-journal/api db:seed` (the seed is idempotent — it upserts).

---

## Environment variables

Two `.env` files. **Never commit them.**

### Root `.env` — only used by `docker-compose`

| Variable            | Default            | Notes                                  |
| ------------------- | ------------------ | -------------------------------------- |
| `POSTGRES_USER`     | `fishing`          | Container superuser.                   |
| `POSTGRES_PASSWORD` | `fishing`          | Local dev only — change for prod.      |
| `POSTGRES_DB`       | `fishing_journal`  | Database name created on first start.  |
| `POSTGRES_PORT`     | `5432`             | Host port mapped to the container.     |

### `apps/api/.env` — used by the API process

| Variable        | Default                                                                            | Notes                                            |
| --------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| `NODE_ENV`      | `development`                                                                      |                                                  |
| `PORT`          | `3001`                                                                             |                                                  |
| `DATABASE_URL`  | `postgresql://fishing:fishing@localhost:5432/fishing_journal?schema=public`        | Must match the root `.env` Postgres credentials. |
| `JWT_SECRET`    | _placeholder_                                                                      | Replace with a long random string. Used to sign session tokens. |
| `JWT_EXPIRES_IN`| `7d`                                                                               | Token lifetime ([`jsonwebtoken` syntax](https://github.com/auth0/node-jsonwebtoken#token-expiration-exp-claim)). Session row's `expiresAt` is set to match. |
| `CORS_ORIGIN`   | `http://localhost:5173`                                                            | Frontend dev origin.                             |
| `ADMIN_EMAIL`   | `admin@example.com`                                                                | Used by `db:seed` to upsert the admin account.   |
| `ADMIN_PASSWORD`| `changeme-locally`                                                                 | Used by `db:seed`. Change before seeding.        |

The frontend reads no env variables today; future `VITE_*` variables will live in `apps/frontend/.env`.

---

## Common scripts

All commands below run from the **repo root**.

| Command                                       | What it does                                                  |
| --------------------------------------------- | ------------------------------------------------------------- |
| `pnpm dev`                                    | Runs both `api` and `frontend` dev servers via Turborepo.     |
| `pnpm build`                                  | Builds every workspace.                                       |
| `pnpm test`                                   | Runs Vitest in every workspace.                               |
| `pnpm db:up`                                  | Starts the Postgres container in the background.              |
| `pnpm db:down`                                | Stops and removes the Postgres container (keeps the volume).  |
| `pnpm db:logs`                                | Tails Postgres logs.                                          |
| `pnpm --filter @fishing-journal/api <script>` | Run an API-only script.                                       |
| `pnpm --filter @fishing-journal/frontend <s>` | Run a frontend-only script.                                   |

### API-specific scripts (`apps/api`)

| Command                  | What it does                                              |
| ------------------------ | --------------------------------------------------------- |
| `pnpm dev`               | `node --watch --env-file=.env src/index.js`               |
| `pnpm start`             | Production-style start (no watcher).                      |
| `pnpm test`              | Vitest (node env, supertest).                             |
| `pnpm prisma:generate`   | Generate the Prisma client (run after schema changes).    |
| `pnpm prisma:migrate`    | Create + apply a dev migration. Pass `-- --name <name>`.  |
| `pnpm prisma:studio`     | Open Prisma Studio at <http://localhost:5555>.            |
| `pnpm db:seed`           | Upsert the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. |

### Frontend-specific scripts (`apps/frontend`)

| Command         | What it does                                  |
| --------------- | --------------------------------------------- |
| `pnpm dev`      | Vite dev server on port 5173.                 |
| `pnpm build`    | Production build to `dist/`.                  |
| `pnpm preview`  | Serves the production build locally.          |
| `pnpm test`     | Vitest with jsdom + Testing Library.          |

---

## Repository layout

```
fishing-journal/
├── apps/
│   ├── api/                          # Express + Prisma backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Database schema (single source of truth)
│   │   │   ├── seed.js               # Admin seed (reads ADMIN_EMAIL / ADMIN_PASSWORD)
│   │   │   └── migrations/           # Generated SQL migrations (committed)
│   │   ├── src/
│   │   │   ├── index.js              # Server bootstrap (port, signals, prisma disconnect)
│   │   │   ├── app.js                # Express app factory (middleware, routing)
│   │   │   ├── config/env.js         # Typed-ish env reader
│   │   │   ├── db/prisma.js          # Singleton PrismaClient
│   │   │   ├── lib/                  # jwt.js (sign/verify), password.js (bcrypt)
│   │   │   ├── middleware/           # errorHandler, notFoundHandler, auth (requireAuth/requireRole)
│   │   │   ├── routes/index.js       # Root /api router — mounts feature routers
│   │   │   └── features/
│   │   │       ├── health/           # health.routes/controller/service + test
│   │   │       └── auth/             # login / logout / me — JWT + DB session
│   │   │           ├── auth.routes.js
│   │   │           ├── auth.controller.js
│   │   │           └── auth.service.js
│   │   └── vitest.config.js
│   │
│   └── frontend/                     # Vite + React frontend
│       ├── index.html
│       ├── src/
│       │   ├── main.jsx              # React root + providers
│       │   ├── App.jsx               # BrowserRouter + Routes
│       │   ├── index.css             # Tailwind directives + shadcn CSS vars
│       │   ├── app/
│       │   │   └── providers/        # ThemeProvider, QueryProvider, AuthProvider
│       │   ├── pages/                # Route-level pages
│       │   │   ├── under-construction/
│       │   │   ├── login/
│       │   │   └── dashboard/
│       │   ├── widgets/              # Composite UI blocks (empty for now)
│       │   ├── features/
│       │   │   └── auth/             # LoginForm, ProtectedRoute, api.js
│       │   ├── entities/             # Business entities (empty for now)
│       │   └── shared/               # Cross-cutting reusable code
│       │       ├── ui/               # shadcn components (button, input, label, theme-toggle)
│       │       ├── lib/utils.js      # cn() helper
│       │       ├── api/http.js       # fetch wrapper + token storage
│       │       ├── config/           # Constants (empty for now)
│       │       └── hooks/            # Shared hooks (empty for now)
│       ├── components.json           # shadcn CLI config (tsx: false → JSX output)
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── vite.config.js
│       ├── vitest.config.js
│       └── jsconfig.json             # IDE path alias resolution for @/*
│
├── docs/                             # Junior-friendly guide to the stack
│   ├── README.md                     # Index + reading order
│   ├── architecture/                 # overview, FSD, API layers, auth
│   ├── backend/                      # Express, Prisma, Postgres
│   └── frontend/                     # React Hook Form, shadcn/ui, TanStack Query
│
├── docker-compose.yml                # Postgres 16 + healthcheck + named volume
├── turbo.json                        # Turborepo pipeline
├── pnpm-workspace.yaml
├── package.json                      # Root scripts + turbo
├── .env.example                      # Postgres compose credentials
├── .editorconfig
├── .nvmrc
└── README.md
```

---

## Architecture conventions

### Frontend — Feature-Sliced Design

Layers, from highest to lowest. Imports always flow **downward** (a `feature` can import from `entities` and `shared`, but not vice-versa).

| Layer       | What lives here                                                                   |
| ----------- | --------------------------------------------------------------------------------- |
| `app/`      | App-wide bootstrap: providers (theme, query client), router, global styles entry. |
| `pages/`    | Route-level components. Each page composes widgets + features.                    |
| `widgets/`  | Self-contained UI blocks reused across pages (e.g. `MapPanel`, `NoteCard`).       |
| `features/` | A single user-facing capability (e.g. `add-note`, `auth-login`).                  |
| `entities/` | Business entities and their UI (e.g. `note`, `user`, `location`).                 |
| `shared/`   | Anything reusable with no business logic: `ui/` (shadcn), `lib/`, `api/`, `hooks/`, `config/`. |

Each slice (e.g. `features/add-note/`) typically exposes a barrel `index.js` so external code imports `@/features/add-note`, not internal files.

Business logic lives in **hooks** (`useAddNote`, `useNotesQuery`, …). Components stay focused on composition and presentation.

### Backend — layered FSD

Each feature is a self-contained slice under `src/features/<name>/` with three files:

- `<name>.routes.js` — Express router; binds HTTP verbs/paths to controller functions.
- `<name>.controller.js` — Parses the request, calls the service, shapes the HTTP response. **No business logic.**
- `<name>.service.js` — Business logic + data access via Prisma. **No `req`/`res`.**

Shared concerns live outside `features/`:

- `db/prisma.js` — the single `PrismaClient` instance.
- `lib/` — pure utilities reused across features (e.g. `jwt.js`, `password.js`).
- `middleware/` — error handler, 404 handler, `requireAuth` / `requireRole`.
- `config/env.js` — env reader.
- `routes/index.js` — mounts each feature router under `/api`.

Controllers validate inputs with Zod (see `auth.controller.js`).

---

## Database & migrations

The schema lives in `apps/api/prisma/schema.prisma`. Current models:

- **`User`** — id, email, passwordHash, role (`USER` | `ADMIN`), timestamps.
- **`Session`** — server-side session row (id, userId, expiresAt). Issued on login, looked up by every authed request, deleted on logout.

### Workflow when you change the schema

```bash
# Edit apps/api/prisma/schema.prisma, then:
pnpm --filter @fishing-journal/api prisma:migrate -- --name describe_your_change
```

That command:

1. Generates a SQL migration in `apps/api/prisma/migrations/`.
2. Applies it to your local Postgres.
3. Regenerates the Prisma client.

**Commit the generated migration folder** — it's part of the schema's history.

### Seeding

The seed lives at `apps/api/prisma/seed.js` and is wired into `prisma db seed` via the `prisma.seed` field in `apps/api/package.json`.

It reads two env vars from `apps/api/.env`:

| Env var          | Purpose                                |
| ---------------- | -------------------------------------- |
| `ADMIN_EMAIL`    | Email of the admin user to upsert.     |
| `ADMIN_PASSWORD` | Plaintext password — bcrypt-hashed before insert. |

Run it (idempotent — safe to re-run; it `upsert`s by email):

```bash
pnpm --filter @fishing-journal/api db:seed
```

After seeding, sign in at <http://localhost:5173/login>.

To rotate the admin password locally: edit `ADMIN_PASSWORD` in `apps/api/.env`, re-run the seed, and any existing JWTs/sessions remain valid until `JWT_EXPIRES_IN` elapses (run a `prisma.session.deleteMany({ where: { userId } })` if you need to force re-login).

### Browsing data

```bash
pnpm --filter @fishing-journal/api prisma:studio
```

Opens Prisma Studio at <http://localhost:5555>.

### Resetting local data

```bash
pnpm db:down
docker volume rm fishing-journal_postgres-data
pnpm db:up
pnpm --filter @fishing-journal/api prisma:migrate
pnpm --filter @fishing-journal/api db:seed
```

---

## API reference

### `GET /api/health`

Returns service liveness and database connectivity. Used by the frontend, container orchestrators, and uptime monitors.

**200 OK** — service is healthy and Postgres responded to `SELECT 1`:

```json
{
  "status": "ok",
  "uptime": 12.34,
  "timestamp": "2026-05-20T19:47:53.376Z",
  "db": "ok"
}
```

**503 Service Unavailable** — Postgres unreachable:

```json
{
  "status": "degraded",
  "uptime": 12.34,
  "timestamp": "2026-05-20T19:46:09.665Z",
  "db": "error",
  "dbError": "Can't reach database server at `localhost:5432`"
}
```

### `POST /api/auth/login`

Body: `{ "email": "...", "password": "..." }`. Returns a signed JWT and the public user shape on success.

**200 OK**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": "cuid", "email": "admin@example.com", "role": "ADMIN" }
}
```

**400** invalid body • **401** invalid credentials.

On success, the API also creates a `Session` row in Postgres. The JWT carries that session's ID — every authenticated request looks the session up and verifies it hasn't expired, so logout is real (not just "drop the token client-side").

### `GET /api/auth/me`

Requires `Authorization: Bearer <token>`. Returns the current user.

**200 OK** → `{ "user": { "id": "...", "email": "...", "role": "..." } }`
**401** missing/invalid/expired token.

### `POST /api/auth/logout`

Requires `Authorization: Bearer <token>`. Deletes the session row server-side; the JWT is then useless even if it hasn't expired.

**200 OK** → `{ "ok": true }`

---

## Frontend routes & auth flow

| Path          | Component                | Access        |
| ------------- | ------------------------ | ------------- |
| `/`           | `UnderConstructionPage`  | Public.       |
| `/login`      | `LoginPage`              | Public.       |
| `/dashboard`  | `DashboardPage`          | `ADMIN` only. |
| `*`           | redirect → `/`           | —             |

The provider tree (in `src/main.jsx`) is `ThemeProvider → QueryProvider → AuthProvider → App`.

`AuthProvider` (`src/app/providers/AuthProvider.jsx`) holds `{ user, status, login, logout }`:

- On mount, if a JWT exists in `localStorage`, it calls `GET /api/auth/me` to hydrate `user`. If that fails, it clears the token.
- `login({ email, password })` calls `POST /api/auth/login`, stores the JWT, and sets `user`.
- `logout()` calls `POST /api/auth/logout` (best-effort) and clears local state.
- `status` is `'loading' | 'authenticated' | 'unauthenticated'`.

`ProtectedRoute` (`src/features/auth/ProtectedRoute.jsx`) handles gating:

```jsx
<Route
  path="/dashboard"
  element={
    <ProtectedRoute role="ADMIN">
      <DashboardPage />
    </ProtectedRoute>
  }
/>
```

It shows a loading state while `AuthProvider` hydrates, redirects to `/login` (preserving the intended `from` path) when unauthenticated, and redirects to `/` when the user lacks the required role.

The HTTP client (`src/shared/api/http.js`) auto-attaches `Authorization: Bearer <token>` and throws a typed `ApiError` on non-2xx responses — wrap calls in `try/catch` (`LoginForm.jsx` shows the pattern).

---

## Testing

Vitest runs in both apps with one root command:

```bash
pnpm test
```

- **API** — node environment. The health test mocks `db/prisma.js` so it doesn't need a live Postgres. Use `supertest` for HTTP-level tests, mock Prisma at the module level for service tests.
- **Frontend** — jsdom environment with `@testing-library/react` and `@testing-library/jest-dom`. Setup file at `apps/frontend/src/test/setup.js`. Wrap components that depend on providers (e.g. `ThemeProvider`, `QueryProvider`) when rendering.

Run a single workspace:

```bash
pnpm --filter @fishing-journal/api test
pnpm --filter @fishing-journal/frontend test:watch
```

---

## Troubleshooting

**`pnpm install` complains about `packageManager` mismatch**
Run `corepack enable`. The root `package.json` pins `pnpm@9.12.0` via Corepack — Node will download the right version automatically.

**`Can't reach database server at localhost:5432`**
Postgres isn't running. `pnpm db:up`, then wait a few seconds for the healthcheck (`docker compose ps` shows `(healthy)`).

**`prisma generate` says `You don't have any models defined`**
The schema must contain at least one `model`. The repo ships with a placeholder `User` model precisely so this doesn't happen on a clean clone.

**Port `5432` already in use**
You probably have a host Postgres running. Either stop it, or change `POSTGRES_PORT` in the root `.env` *and* the port in `DATABASE_URL` in `apps/api/.env`.

**Frontend can't reach the API**
Check both apps are running (`pnpm dev` runs both). The Vite proxy in `vite.config.js` forwards `/api/*` to `localhost:3001` — if you changed `PORT` in the API env, update the proxy target too.

**Stale Prisma client after schema change**
Run `pnpm --filter @fishing-journal/api prisma:generate` (or just re-run the migrate command, which generates as part of its flow).

**`EPERM: operation not permitted, rename ... query_engine-windows.dll.node` on Windows**
Your API dev server is still running and holding the Prisma DLL. Stop the `pnpm dev` process (or just the api: `pnpm --filter @fishing-journal/api ...`), re-run `prisma:generate` / `prisma:migrate`, then start dev again.

**`401 Invalid or expired token` after re-seeding or rebuilding the DB**
Your browser still has a JWT in `localStorage` that references a `Session` row that no longer exists. Either sign out and back in, or `localStorage.removeItem('fishing-journal-auth-token')` in DevTools.
