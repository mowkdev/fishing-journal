# Prisma

> A modern ORM for Node.js. We use it as the only way to read or write Postgres from the API.

## What an ORM is, briefly

An **ORM** (Object-Relational Mapper) is a library that lets you write database operations in JavaScript objects instead of SQL strings:

```js
// Without an ORM
const result = await pgClient.query(
  'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
  [email, passwordHash],
);

// With Prisma
const user = await prisma.user.create({
  data: { email, passwordHash },
});
```

You still get SQL eventually — Prisma compiles your call into a parameterised query — but you don't write or maintain it by hand.

## Why Prisma specifically

The Node ORM landscape is crowded (Sequelize, TypeORM, Drizzle, Kysely, Mongoose, …). We picked Prisma because:

- **Schema as the source of truth.** One file (`schema.prisma`) describes every table, column, index, and relation. From it, Prisma generates a fully-typed client and SQL migration files.
- **Migrations come for free.** Change the schema, run `prisma migrate dev`, get a versioned SQL file in `apps/api/prisma/migrations/`.
- **Good autocomplete even without TypeScript.** The generated client ships JSDoc that VS Code uses for IntelliSense, even in plain `.js` files.
- **Great error messages.** When you misspell a field or break a relation, Prisma tells you precisely where.

The trade-off: Prisma is opinionated and you mostly use what it gives you. For very complex SQL (window functions, CTEs, recursive queries), drop down to `prisma.$queryRaw` — we already do this in the health check.

## The schema

`apps/api/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  USER
  ADMIN
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  role         Role      @default(USER)
  sessions     Session[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}
```

Reading it top to bottom:

- **`generator client`** — emit a JavaScript client (the thing you `import { PrismaClient } from '@prisma/client'`).
- **`datasource db`** — we talk to Postgres, connection string from the `DATABASE_URL` env var.
- **`enum Role`** — Postgres-native enum. `USER` and `ADMIN` are the only legal values.
- **`model User`** — a table. Each line is a column or a relation. `@id` marks the primary key; `@unique` adds a unique constraint; `@default(cuid())` gives us collision-resistant string IDs without DB sequences.
- **`model Session`** — note the relation back to `User`. `onDelete: Cascade` means deleting a user deletes their sessions. `@@index([userId])` creates a database index so `findMany({ where: { userId } })` is fast.

The schema file is the **single source of truth**. Don't write SQL `CREATE TABLE` statements by hand — change the schema and let Prisma generate the migration.

## The client — `db/prisma.js`

```js
// apps/api/src/db/prisma.js
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

One instance, exported once. Why one?

- A `PrismaClient` owns a connection pool to Postgres. Creating multiple instances would create multiple pools, which is wasteful.
- The tests mock this exact module path (`vi.mock('../../db/prisma.js')`) — if instances were scattered, mocks wouldn't apply uniformly.

Every service imports `{ prisma }` from this file. Nothing else creates a client.

## The five queries you'll write 90% of the time

```js
// Find one
const user = await prisma.user.findUnique({ where: { email } });

// Find many
const users = await prisma.user.findMany({
  where: { role: 'ADMIN' },
  orderBy: { createdAt: 'desc' },
  take: 20,
});

// Create
const note = await prisma.note.create({
  data: { title, body, userId: req.user.id },
});

// Update
const updated = await prisma.note.update({
  where: { id },
  data: { title },
});

// Delete
await prisma.note.delete({ where: { id } });
```

Plus two you'll meet sometimes:

- **`upsert`** — create-or-update by unique key. Our seed uses this:
  ```js
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'ADMIN' },
    create: { email, passwordHash, role: 'ADMIN' },
  });
  ```
- **`$queryRaw`** — escape hatch for arbitrary SQL. Use **tagged templates** so values are still parameterised:
  ```js
  await prisma.$queryRaw`SELECT 1`;                                 // health check
  await prisma.$queryRaw`SELECT * FROM "User" WHERE email = ${email}`;  // safe
  ```

## Migrations

Every change to `schema.prisma` becomes a migration.

```bash
# 1. Edit apps/api/prisma/schema.prisma
# 2. Generate + apply
pnpm --filter @fishing-journal/api prisma:migrate -- --name describe_your_change
```

That command does three things:

1. Diffs your schema against the database, produces a new SQL file at `apps/api/prisma/migrations/<timestamp>_describe_your_change/migration.sql`.
2. Applies it to your local DB.
3. Regenerates the Prisma client so your code picks up new fields/models immediately.

**Commit the migration folder.** It's part of the schema's history. When a teammate pulls your branch, `prisma migrate dev` will replay any migrations they don't have.

In production, you use `prisma migrate deploy` (no shadow database, no interactive prompts) — but the SQL it applies is the *exact* same files you committed.

## When to use `$queryRaw`

Most code uses the typed client. Drop to raw SQL when:

- The query uses Postgres features Prisma doesn't model directly (window functions, common table expressions, full-text search, `ON CONFLICT … DO UPDATE` with complex conditions).
- You're doing a one-off liveness check (the health route's `SELECT 1` — there's no model to query).
- You're optimising and the typed query generates inefficient SQL.

If you find yourself writing more than a few `$queryRaw` calls in a feature, that's a signal: maybe a Prisma view or a stored procedure is a better fit. Or maybe Prisma isn't the right tool for that feature.

## Prisma Studio — a free admin UI

```bash
pnpm --filter @fishing-journal/api prisma:studio
```

Opens a local UI at `http://localhost:5555` where you can browse, edit, and delete rows. Useful for debugging local data — never run it against production.

## Going deeper

- [Prisma schema reference](https://www.prisma.io/docs/orm/reference/prisma-schema-reference) — everything you can put in `schema.prisma`.
- [Prisma client API](https://www.prisma.io/docs/orm/reference/prisma-client-reference) — `findMany`, `include`, `select`, transactions, etc.
- [Relation queries](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries) — how to fetch nested data efficiently.
- [Migration guide](https://www.prisma.io/docs/orm/prisma-migrate) — the workflow in detail.
