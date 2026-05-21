# API layers: routes → controllers → services

> Every backend feature is built out of the same three files. This doc explains why, and walks through the existing `auth` feature line by line.

## The pattern

A feature lives at `apps/api/src/features/<feature-name>/` and contains three siblings:

```
features/auth/
├── auth.routes.js       ← HTTP binding
├── auth.controller.js   ← request parsing + response shaping
└── auth.service.js      ← business logic + database access
```

Each layer has one job and is **not allowed to do the others'**:

| Layer       | Knows about               | Does NOT know about       |
| ----------- | ------------------------- | ------------------------- |
| Routes      | URLs, HTTP verbs          | Request bodies, DB, logic |
| Controller  | HTTP req/res, validation  | How data is stored        |
| Service     | Business rules, Prisma    | `req`, `res`, status codes|

Why care? Because then:

- The **service** is plain JavaScript. You can call it from a test, from a CLI script, or from a future GraphQL handler — no Express required.
- The **controller** is thin and predictable. Looking at one tells you exactly which fields the endpoint expects and what it returns.
- The **route** is a one-line registration. Easy to scan, easy to reason about authentication and method.

## Walkthrough: `POST /api/auth/login`

Let's follow a login request from URL to database and back.

### 1. The route — `auth.routes.js`

```js
// apps/api/src/features/auth/auth.routes.js
import { Router } from 'express';
import { postLogin, postLogout, getMe } from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', postLogin);
authRouter.post('/logout', requireAuth, postLogout);
authRouter.get('/me', requireAuth, getMe);
```

This file's only job is to say "when an HTTP request matches *this URL + verb*, hand it to *this controller function*." `requireAuth` is middleware that runs first — see [auth.md](./auth.md).

The router gets mounted by `apps/api/src/routes/index.js`:

```js
router.use('/auth', authRouter);   // becomes /api/auth/*
```

…which itself is mounted at `/api` by `apps/api/src/app.js`.

### 2. The controller — `auth.controller.js`

```js
// apps/api/src/features/auth/auth.controller.js
import { z } from 'zod';
import { login, logout, getCurrentUser } from './auth.service.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const postLogin = async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: 'Invalid request body', issues: parsed.error.flatten() },
      });
    }

    const result = await login(parsed.data);
    if (!result) {
      return res.status(401).json({ error: { message: 'Invalid credentials' } });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
};
```

The controller does **four** things, in order:

1. **Validate input.** Zod (`loginSchema.safeParse`) checks the shape and types of `req.body`. If invalid, return 400 with the issues. Nothing downstream sees garbage.
2. **Call the service.** It hands over only the validated data — `parsed.data`, never `req.body` directly.
3. **Translate the service's answer into HTTP.** `null` from the service becomes a 401 here. The service has no idea what 401 means.
4. **Forward unexpected errors** to the error-handling middleware with `next(err)`. The global error handler (`middleware/errorHandler.js`) turns those into a clean JSON 500 response.

Notice the controller knows nothing about JWTs, bcrypt, or Prisma. Move them around at will — the controller doesn't notice.

### 3. The service — `auth.service.js`

```js
// apps/api/src/features/auth/auth.service.js
import { prisma } from '../../db/prisma.js';
import { verifyPassword } from '../../lib/password.js';
import { signSessionToken } from '../../lib/jwt.js';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  role: user.role,
});

export const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  const token = signSessionToken({ sessionId: session.id, userId: user.id });

  return { token, user: toPublicUser(user) };
};
```

The service:

- Talks to Prisma.
- Uses helpers from `lib/` for password verification and JWT signing.
- Returns plain JavaScript values: `null` for "doesn't apply" (controller decides if that's 401), or an object with `{ token, user }` on success.
- `toPublicUser` strips fields the API should never expose, like `passwordHash`.

It has **zero** references to `req`, `res`, status codes, or HTTP. You could call `login({ email, password })` from a one-off script tomorrow and it would just work.

## The shared pieces around features

Features don't live in isolation — they depend on a few shared concerns:

```
src/
├── db/prisma.js          ← single PrismaClient instance, shared by all services
├── lib/                  ← pure helpers (jwt.js, password.js, …)
├── middleware/           ← errorHandler, notFoundHandler, auth (requireAuth, requireRole)
├── config/env.js         ← reads process.env once
└── routes/index.js       ← composes all feature routers under /api
```

These are the only things a feature is allowed to import outside its own folder.

## Adding a new feature — the template

Imagine you're adding "notes". Steps:

1. **Create the slice** `apps/api/src/features/notes/` with three files:
   - `notes.routes.js` — declare URLs.
   - `notes.controller.js` — parse input, format output.
   - `notes.service.js` — business logic + Prisma.
2. **Mount the router** in `apps/api/src/routes/index.js`:
   ```js
   import { notesRouter } from '../features/notes/notes.routes.js';
   router.use('/notes', notesRouter);
   ```
3. **Update the Prisma schema** if you need new tables, then `pnpm --filter @fishing-journal/api prisma:migrate -- --name add_notes`.
4. **Test it.** Add `notes.test.js` next to the feature; mock `db/prisma.js` and use `supertest` to hit `createApp()`. The existing `health.test.js` is the template.

## Common mistakes

- **Calling Prisma from a controller.** It works, but now your "logic" is half in the controller, half in the service. Always go through the service.
- **Returning `res` from a service.** Means the service is now bound to Express. Don't.
- **Doing `if (!email) return res.status(400)…` checks in the controller manually.** Use the Zod schema. It's exhaustive and the error message is consistent.
- **Importing another feature's service.** Two features needing the same logic is a sign that logic belongs in `lib/` or its own feature called by both.

## Going deeper

- [Express routing](https://expressjs.com/en/guide/routing.html)
- [Zod safeParse](https://zod.dev/?id=safeparse)
- [Express error handling](https://expressjs.com/en/guide/error-handling.html) — explains how `next(err)` reaches `errorHandler`.
