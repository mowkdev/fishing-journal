# Express

> A minimal, unopinionated HTTP framework for Node.js. We use it as the foundation of `apps/api`.

## Why Express

Node.js gives you raw HTTP with `http.createServer((req, res) => …)`. You quickly want:

- Routing (`GET /users/:id` instead of parsing `req.url` by hand).
- Body parsing (`req.body` instead of streaming bytes).
- Middleware (run something before *every* handler — auth, logging, CORS).
- A clean way to return errors.

Express gives you all four with a tiny API. It has been the default Node web framework for ~15 years, which means: huge ecosystem, every problem you'll hit has been hit before, every library has Express examples.

Alternatives — Fastify (faster, schema-first), Hapi (more structured), Koa (Express's younger sibling) — all great. We chose Express for the same reason most teams do: maximum familiarity, minimum surprise.

## The app factory pattern

Look at `apps/api/src/app.js`:

```js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  app.use('/api', router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
```

Two important things going on:

1. **It's a factory, not a top-level `app`.** `createApp()` returns a *new* Express app every time. That's essential for testing: `health.test.js` calls `createApp()` per test so each test has a clean state.
2. **Order matters.** Middleware runs in the order it's registered. `helmet` and `cors` add response headers. `express.json()` parses request bodies. The router runs only after parsing. The error handler is last, because Express identifies error handlers by their `(err, req, res, next)` signature *and* their position in the stack.

The bootstrap that actually listens lives separately, in `apps/api/src/index.js`:

```js
const app = createApp();
const server = app.listen(env.PORT, () => { … });
```

This separation is so `app` can be imported by tests without anything binding to a port.

## The middleware we use

| Middleware       | What it does                                                              | Why it's here                                       |
| ---------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| `helmet()`       | Sets a bunch of security-related response headers.                        | Free baseline hardening; one line.                  |
| `cors(…)`        | Adds CORS headers so the frontend on `:5173` can call the API on `:3001`. | Required only because we run them on different ports in dev. |
| `express.json()` | Parses `Content-Type: application/json` request bodies into `req.body`.   | Otherwise `req.body` is `undefined`.                |
| `morgan(…)`      | Logs each request to stdout.                                              | Free dev feedback. We skip it in tests to keep output clean. |
| `notFoundHandler`| Catches anything no route matched and returns a 404 JSON.                 | Without this, unmatched routes return Express's default HTML page. |
| `errorHandler`   | Catches anything `next(err)`-thrown and returns a 500 JSON.               | Centralised error shape. Hides stack traces in non-dev. |

## How a request flows

```
GET /api/health
    │
    ▼
helmet ──▶ cors ──▶ express.json ──▶ morgan ──▶ router('/api')
                                                    │
                                                    ▼
                                           healthRouter('/')
                                                    │
                                                    ▼
                                              getHealth (controller)
                                                    │
                                                    ▼
                                              checkHealth (service)
                                                    │
                                                    ▼
                                              prisma.$queryRaw
```

If anything in that chain calls `next(err)` (or throws inside an `async` handler that we caught with try/catch), control jumps straight to `errorHandler` at the bottom of the stack.

## Writing a handler

The canonical pattern in this repo:

```js
export const someHandler = async (req, res, next) => {
  try {
    const data = await someService(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
```

- `async` because almost everything we do involves the DB.
- The `try/catch` exists because Express 4 doesn't auto-catch async errors. Express 5 (released 2024) does — when we upgrade we can drop the try/catch.
- `res.json(…)` sets `Content-Type: application/json` and serialises. Always prefer it over `res.send(JSON.stringify(…))`.

## Error handling

Our error-handler middleware:

```js
export const errorHandler = (err, req, res, _next) => {
  const status = err.status ?? err.statusCode ?? 500;
  const isDev = process.env.NODE_ENV === 'development';

  res.status(status).json({
    error: {
      message: err.message ?? 'Internal Server Error',
      ...(isDev && err.stack ? { stack: err.stack } : {}),
    },
  });
};
```

Two conventions:

1. **Throw errors with a `status` property** when you want a specific code. E.g. `const err = new Error('Bad'); err.status = 400; throw err;`. Otherwise it'll be 500.
2. **Errors are shaped `{ error: { message, … } }`.** Same shape across the whole API so the frontend can render them uniformly.

## What we don't use Express for

- **Templating.** We never `res.render(…)` anything. The frontend is a separate React app.
- **Sessions or cookies.** Auth is JWT in `Authorization`. No `express-session`, no cookie middleware.
- **Static assets.** Vite serves the frontend in dev; in production we'd serve it from a CDN or behind an Nginx, not Express.

Keeping Express as "JSON in, JSON out, plus middleware" keeps the surface area small.

## Going deeper

- [Express routing guide](https://expressjs.com/en/guide/routing.html)
- [Writing middleware](https://expressjs.com/en/guide/writing-middleware.html)
- [Error handling](https://expressjs.com/en/guide/error-handling.html) — read this if you haven't.
- [Helmet best practices](https://helmetjs.github.io/) — which headers it sets and why.
