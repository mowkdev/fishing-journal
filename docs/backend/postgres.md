# Postgres

> The database we store everything in. Runs in Docker locally; would run as a managed service in production.

## Why a relational database

Our domain has lots of *relationships*:

- A **user** has many **notes**.
- A **note** can have one **location**.
- A **location** has coordinates and belongs to the user who tagged it.

Relational databases are built for exactly this kind of data. Foreign keys keep references consistent (you can't have a note pointing at a deleted user). Indexes make lookups fast. Transactions let you do multi-step writes safely. SQL is a 50-year-old, battle-tested query language.

Could we use MongoDB or DynamoDB? Yes, and it'd be fine for "the user has a list of notes". As soon as you want to filter notes by location, or paginate by date, or do reporting, you're rebuilding relational features by hand. We'd rather start with the right primitive.

## Why **Postgres** specifically

Among relational databases (MySQL, MariaDB, SQL Server, Oracle, …), Postgres is the open-source workhorse. Pros:

- **Free, no licensing surprises.** Apache 2.0 license. Every cloud has a managed Postgres offering.
- **Rich type system.** Native `jsonb`, arrays, enums, UUIDs, geographic types via PostGIS — useful when we add the map feature.
- **Excellent concurrency.** MVCC means readers don't block writers and vice versa.
- **Modern features.** Common table expressions, window functions, partial indexes, generated columns — you grow into them.
- **Tooling.** Every ORM, every BI tool, every dashboard supports Postgres.

## How we run it locally

```bash
pnpm db:up      # starts the container in the background
pnpm db:down    # stops and removes it (volume persists)
pnpm db:logs    # tails the logs
```

The compose service is in `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: fishing-journal-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-fishing}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-fishing}
      POSTGRES_DB: ${POSTGRES_DB:-fishing_journal}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-fishing} -d ${POSTGRES_DB:-fishing_journal}"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres-data:
```

A few things to notice:

- **`postgres:16-alpine`** — Postgres 16 on the small Alpine Linux base image. Fast to pull, fast to start.
- **`postgres-data` named volume** — your data survives `pnpm db:down` and `docker compose restart`. To wipe it, see [Resetting local data](../../README.md#resetting-local-data) in the project README.
- **`healthcheck`** — runs `pg_isready` every 5 seconds. `docker compose ps` shows `(healthy)` once it passes. Useful when scripting "wait for the DB" sequences.
- **`${VAR:-default}` syntax** — Compose reads `.env` (root) first; if a variable is missing, it uses the default after `:-`. Means the file works out of the box with no env file.

The credentials come from the **root** `.env` (Compose's, not the API's). The API's `.env` then points at the same database via `DATABASE_URL`. Keep the two in sync.

## How the API connects

The API process runs on your host (not in Docker), so its connection string targets `localhost`:

```
DATABASE_URL=postgresql://fishing:fishing@localhost:5432/fishing_journal?schema=public
```

Breaking it down:

| Part                                | Meaning                                              |
| ----------------------------------- | ---------------------------------------------------- |
| `postgresql://`                     | Protocol — Prisma also accepts `postgres://`.        |
| `fishing:fishing`                   | username:password.                                   |
| `@localhost:5432`                   | host and port.                                       |
| `/fishing_journal`                  | database name.                                       |
| `?schema=public`                    | Postgres schema namespace inside the database.       |

If you change the port (because something else is on 5432), change it in **both** `.env` files.

## A short SQL crash course

You'll rarely write raw SQL with Prisma, but it helps to know what's happening underneath. The four operations:

```sql
-- Read
SELECT id, email FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" DESC LIMIT 20;

-- Write
INSERT INTO "User" (id, email, "passwordHash", role)
VALUES ('cuid1', 'a@b.c', '...', 'ADMIN');

-- Update
UPDATE "User" SET role = 'ADMIN' WHERE id = 'cuid1';

-- Delete
DELETE FROM "User" WHERE id = 'cuid1';
```

Notice the `"double quotes"` around table and column names. Prisma uses PascalCase identifiers (`User`, `passwordHash`) which aren't standard SQL identifiers, so they need quoting.

## Connecting with a SQL client

For ad-hoc poking, two options:

1. **Prisma Studio** — `pnpm --filter @fishing-journal/api prisma:studio`. A web UI. Great for browsing and small edits.
2. **`psql` inside the container** — `docker exec -it fishing-journal-postgres psql -U fishing -d fishing_journal`. A real SQL prompt. Useful for `EXPLAIN ANALYZE` and other DB-admin-y things.

For a graphical client, [TablePlus](https://tableplus.com/), [DBeaver](https://dbeaver.io/), or [Postico](https://eggerapps.at/postico2/) all work — point them at `localhost:5432` with the credentials from your `.env`.

## When to think about Postgres directly

Most of the time, you change the Prisma schema and forget Postgres is there. Open the schema, add a model, run the migration.

Times you actually need to know SQL:

- **Performance tuning.** When a query is slow, `EXPLAIN ANALYZE` (in `psql`) shows you the plan. Maybe you need an index.
- **Complex queries.** Aggregations, window functions, full-text search — you'll either write `$queryRaw` or extend the schema with a `view`.
- **Migrations Prisma can't generate cleanly.** Renaming a column without losing data needs hand-edited migration SQL.

Postgres is deep; you'll keep finding more useful features for years.

## Going deeper

- [Postgres tutorial](https://www.postgresqltutorial.com/) — the friendliest entry point.
- [`EXPLAIN` glossary](https://www.postgresql.org/docs/current/using-explain.html) — how to read query plans.
- [psql commands](https://www.postgresql.org/docs/current/app-psql.html) — `\d`, `\dt`, `\l`, etc.
