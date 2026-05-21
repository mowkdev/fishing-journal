# Fishing Journal — Documentation

These docs explain how this project is built and **why** each piece exists. They're written for a junior developer who already knows React and Node, and is using this codebase to learn about monorepos, Feature-Sliced Design, Prisma, TanStack Query, JWT auth, and the rest of the stack.

If something here gets stale (a file moves, a pattern changes), the doc is wrong — update it.

---

## Suggested reading order

You don't have to read everything before you contribute, but if you do read it in this order it'll make the most sense:

1. [Architecture overview](./architecture/overview.md) — the monorepo, the two apps, how they talk to each other.
2. [Feature-Sliced Design](./architecture/feature-sliced-design.md) — how we organise code on both sides of the stack.
3. [API layers: routes → controllers → services](./architecture/api-layers.md) — the three-file pattern every backend feature follows.
4. [Authentication flow](./architecture/auth.md) — the end-to-end story of how login works.
5. Pick whichever stack docs you need next — they stand alone.

---

## Index

### Architecture

- [Monorepo & app overview](./architecture/overview.md)
- [Feature-Sliced Design](./architecture/feature-sliced-design.md)
- [API layers: routes → controllers → services](./architecture/api-layers.md)
- [Authentication flow](./architecture/auth.md)

### Backend stack

- [Express](./backend/express.md) — the HTTP server
- [Prisma](./backend/prisma.md) — the database client + migrations
- [Postgres](./backend/postgres.md) — the database itself

### Frontend stack

- [React Hook Form](./frontend/react-hook-form.md) — form state & validation
- [shadcn/ui (and Tailwind)](./frontend/shadcn-ui.md) — the component layer
- [TanStack Query](./frontend/tanstack-query.md) — server state management

---

## How to use these docs

Each doc follows the same shape:

- **Why this exists** — the problem the tool/pattern solves.
- **How we use it here** — concrete file paths from this repo so you can read the real code.
- **Patterns to follow** — do's and don'ts that the project already follows.
- **Going deeper** — links to official docs when you're ready to learn more than what's here.

When you see a path like `apps/api/src/features/health/health.service.js`, open it. The examples here are short on purpose — the real codebase is the source of truth.
