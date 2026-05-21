# Architecture overview

> A high-level map of what runs where, and how the pieces talk to each other.

## The shape of the repo

```
fishing-journal/                 ← Turborepo monorepo
├── apps/
│   ├── api/                     ← Express + Prisma server (port 3001)
│   └── frontend/                ← Vite + React SPA (port 5173)
├── docker-compose.yml           ← Postgres in a container (port 5432)
├── docs/                        ← You are here
├── turbo.json                   ← Task pipeline (dev/build/test)
└── pnpm-workspace.yaml          ← Tells pnpm which folders are packages
```

Two **apps**, one **database**, glued by a **monorepo**. That's it.

## Why a monorepo?

A monorepo means *all the code lives in one git repository*, even if it's deployed as separate services.

| With a monorepo                                              | Without one                                               |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| One `git clone`, one PR can touch both apps                  | Two repos, two PRs, hard to keep API and UI in sync       |
| Shared tooling (lint, format, test config)                   | Drift between projects                                    |
| Easy to extract shared code into a `packages/` folder later  | Cross-repo dependencies are messy                         |

We use two tools to make the monorepo work:

- **pnpm workspaces** — installs dependencies once at the root and links them into each app. See `pnpm-workspace.yaml`.
- **Turborepo** — runs scripts across all apps with caching and parallelism. See `turbo.json`. `pnpm dev` at the root runs both apps in parallel via Turbo.

## The two apps

### `apps/api` — the backend

A Node.js HTTP server built with **Express**. It uses **Prisma** to talk to **Postgres**. Written in plain JavaScript using ES modules (`import`/`export`), no TypeScript.

Responsibilities:
- Serving JSON over HTTP at `/api/*`.
- Validating input (with Zod).
- Hashing passwords (bcrypt), issuing JWTs.
- Reading & writing to Postgres.

Entry point: `apps/api/src/index.js`.

### `apps/frontend` — the frontend

A single-page React application built with **Vite**. Styling via **Tailwind** + **shadcn/ui**. Forms via **React Hook Form** + **Zod**. Server state via **TanStack Query**.

Responsibilities:
- Rendering the UI.
- Capturing user input.
- Calling the API.
- Caching server data in memory so the UI feels fast.

Entry point: `apps/frontend/src/main.jsx`.

## How the apps talk

```
┌──────────────────┐         HTTP (JSON)            ┌──────────────────┐
│  React frontend  │ ───────────────────────────▶   │   Express API    │
│  localhost:5173  │  Authorization: Bearer <jwt>   │  localhost:3001  │
│                  │ ◀───────────────────────────   │                  │
└──────────────────┘                                └────────┬─────────┘
                                                             │
                                                             ▼  TCP (Prisma)
                                                    ┌──────────────────┐
                                                    │  Postgres (Docker)│
                                                    │  localhost:5432  │
                                                    └──────────────────┘
```

A few important details:

- **Same origin during dev.** Vite proxies `/api/*` to `http://localhost:3001`. So the frontend code calls `/api/auth/login`, not `http://localhost:3001/api/auth/login`. This avoids CORS in dev and lets us deploy them behind the same domain later. Config: `apps/frontend/vite.config.js`.
- **The frontend never touches the database.** Every read or write goes through the API.
- **Auth is stateless on the wire, stateful in the DB.** The frontend sends a JWT in `Authorization: Bearer …`. The API verifies the signature *and* looks up a `Session` row in Postgres. See [auth.md](./auth.md).

## Where things live

When you're trying to figure out where to put something:

| You're working on...        | Look in...                                |
| --------------------------- | ----------------------------------------- |
| The database schema         | `apps/api/prisma/schema.prisma`           |
| An HTTP endpoint            | `apps/api/src/features/<feature>/`        |
| Cross-cutting backend code  | `apps/api/src/middleware`, `lib`, `db`    |
| A new screen                | `apps/frontend/src/pages/<page>/`         |
| A user-facing feature       | `apps/frontend/src/features/<feature>/`   |
| A reusable UI component     | `apps/frontend/src/shared/ui/`            |
| HTTP client / fetch helpers | `apps/frontend/src/shared/api/`           |

The next doc — [Feature-Sliced Design](./feature-sliced-design.md) — explains the *why* behind these locations.

## Going deeper

- [pnpm workspaces](https://pnpm.io/workspaces) — how the install layout works.
- [Turborepo handbook](https://turbo.build/repo/docs) — caching and pipelines.
- [Why monorepos?](https://monorepo.tools/) — a balanced overview.
