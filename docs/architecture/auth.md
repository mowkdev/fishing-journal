# Authentication flow

> How a user signs in, stays signed in, and signs out — from button click to database row.

## The model: JWT *and* a DB session

A lot of tutorials show "JWT auth" as: server signs a token, client stores it, server verifies it on every request. Stateless. Simple.

The problem with that pattern: **you can't log a user out**. Once a JWT is signed, anyone with a copy of it can use it until the expiry timestamp passes. There's no off switch.

Our model:

- **JWT** signed by the server, stored in `localStorage` on the client, sent on every request as `Authorization: Bearer <jwt>`.
- **Session row** in Postgres with a unique ID, a user ID, and an `expiresAt`. The JWT's payload includes `sid` (session ID) and `uid` (user ID).
- On every authed request, the API verifies the JWT signature **and** looks up the session. If the session is gone or expired, the request is rejected — even if the JWT is still cryptographically valid.

That gives us the best of both worlds: stateless transport (no DB lookup needed to verify the signature), with a server-side off switch (delete the row → instant logout).

## The two data models

```prisma
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  role         Role      @default(USER)   // USER | ADMIN
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

Two things to notice:

- `passwordHash` — never `password`. We store the bcrypt hash. Even a full DB dump doesn't expose plaintext passwords.
- `onDelete: Cascade` on the Session relation — when a user is deleted, all their sessions go with them.

## The flow end-to-end

```
┌─────────┐                ┌────────────┐               ┌──────────┐
│  React  │                │  Express   │               │ Postgres │
└────┬────┘                └─────┬──────┘               └────┬─────┘
     │  POST /api/auth/login     │                           │
     │ {email, password}         │                           │
     ├──────────────────────────▶│  bcrypt.compare           │
     │                           │  prisma.session.create    │
     │                           ├──────────────────────────▶│
     │                           │◀──────────────────────────┤
     │                           │  jwt.sign({sid, uid})     │
     │  200 {token, user}        │                           │
     │◀──────────────────────────┤                           │
     │                           │                           │
     │  localStorage.setItem     │                           │
     │  Authorization: Bearer …  │                           │
     │                           │                           │
     │  GET /api/auth/me         │                           │
     ├──────────────────────────▶│  jwt.verify               │
     │                           │  prisma.session.find      │
     │                           ├──────────────────────────▶│
     │                           │◀──────────────────────────┤
     │  200 {user}               │                           │
     │◀──────────────────────────┤                           │
     │                           │                           │
     │  POST /api/auth/logout    │                           │
     ├──────────────────────────▶│  prisma.session.delete    │
     │                           ├──────────────────────────▶│
     │  200 {ok: true}           │                           │
     │◀──────────────────────────┤                           │
     │                           │                           │
     │  localStorage.removeItem  │                           │
```

## The pieces, by file

### Backend

| File                                                | Job                                                          |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `apps/api/src/lib/password.js`                      | `hashPassword`, `verifyPassword` — wraps bcrypt.             |
| `apps/api/src/lib/jwt.js`                           | `signSessionToken`, `verifySessionToken` — wraps jsonwebtoken. |
| `apps/api/src/middleware/auth.js`                   | `requireAuth` (checks JWT + session), `requireRole(role)`.   |
| `apps/api/src/features/auth/auth.service.js`        | `login`, `logout`, `getCurrentUser` — pure logic.            |
| `apps/api/src/features/auth/auth.controller.js`     | HTTP wrappers + Zod validation.                              |
| `apps/api/src/features/auth/auth.routes.js`         | Binds `/login`, `/logout`, `/me` to controllers.             |
| `apps/api/prisma/seed.js`                           | Upserts the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.     |

### Frontend

| File                                                  | Job                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/frontend/src/shared/api/http.js`                | Stores/reads token in localStorage; auto-attaches Bearer header.   |
| `apps/frontend/src/features/auth/api.js`              | `loginRequest`, `logoutRequest`, `meRequest`.                      |
| `apps/frontend/src/app/providers/AuthProvider.jsx`    | React context holding `{ user, status, login, logout }`.           |
| `apps/frontend/src/features/auth/LoginForm.jsx`       | Form (React Hook Form + Zod).                                      |
| `apps/frontend/src/features/auth/ProtectedRoute.jsx`  | Wrapper that gates routes by auth status + role.                   |

## The middleware — how a protected endpoint stays protected

```js
// apps/api/src/middleware/auth.js
export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Missing bearer token' } });
  }
  const token = header.slice('Bearer '.length).trim();

  let payload;
  try {
    payload = verifySessionToken(token);   // throws on bad signature / expiry
  } catch {
    return res.status(401).json({ error: { message: 'Invalid or expired token' } });
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return res.status(401).json({ error: { message: 'Session expired' } });
  }

  req.session = session;
  req.user = session.user;
  next();
};
```

Three checks, in order:

1. **Header shape.** Must be `Authorization: Bearer <something>`.
2. **JWT signature & expiry.** `jwt.verify` throws if the signature doesn't match `JWT_SECRET` or if `exp` is in the past.
3. **Session existence & freshness.** Even a valid JWT is rejected if the corresponding row is gone or its `expiresAt` is past.

If all three pass, the middleware attaches `req.user` and `req.session`, then calls `next()`. Downstream controllers can trust they're talking to a real, current user.

`requireRole('ADMIN')` then layers on top — it's a one-liner that 403s if `req.user.role !== 'ADMIN'`.

## On the frontend — `AuthProvider`

`AuthProvider` is a React context with three states:

- `loading` — the page just loaded; we're calling `/api/auth/me` to find out who (if anyone) is signed in.
- `unauthenticated` — no valid token.
- `authenticated` — `user` is populated.

```jsx
// apps/frontend/src/app/providers/AuthProvider.jsx (simplified)
useEffect(() => {
  if (!getToken()) {
    setStatus('unauthenticated');
    return;
  }
  meRequest()
    .then(({ user }) => { setUser(user); setStatus('authenticated'); })
    .catch(() => { clearToken(); setStatus('unauthenticated'); });
}, []);
```

Anywhere in the component tree, components can read this with `useAuth()`:

```jsx
const { user, status, login, logout } = useAuth();
```

`login(credentials)` calls `/api/auth/login`, stores the JWT, sets `user`. `logout()` calls `/api/auth/logout` (best-effort — if the network fails, we still clear local state) and clears `user`.

## Protecting routes — `ProtectedRoute`

```jsx
// apps/frontend/src/App.jsx
<Route
  path="/dashboard"
  element={
    <ProtectedRoute role="ADMIN">
      <DashboardPage />
    </ProtectedRoute>
  }
/>
```

`ProtectedRoute` looks at `useAuth()`:

- `loading` → render a "Loading…" placeholder.
- `unauthenticated` → `<Navigate to="/login" replace state={{ from: location.pathname }} />`. The `from` lets the login page redirect you back where you tried to go.
- Wrong role → `<Navigate to="/" />`.
- Authenticated with correct role → render the children.

## The trust chain, summarised

1. The server is the only party that can sign valid JWTs (via `JWT_SECRET`).
2. The server is the only party that can create `Session` rows (via Prisma).
3. The frontend never makes a trust decision on its own — it asks the API ("can you hydrate me with `/me`?") and gates UI on the answer.

If `JWT_SECRET` leaks, an attacker can sign valid JWTs. They still need a matching `Session` row in our DB to actually pass `requireAuth`. (That's not a fix for a leaked secret — rotate it — but it's an extra layer.)

## Going deeper

- [jsonwebtoken docs](https://github.com/auth0/node-jsonwebtoken) — `sign` and `verify` options.
- [OWASP — JWT cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html) — pitfalls to be aware of.
- [bcrypt's design](https://en.wikipedia.org/wiki/Bcrypt) — why we use it instead of plain SHA-256.
