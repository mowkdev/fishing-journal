# Feature-Sliced Design (FSD)

> A way to organise a codebase so that **business features**, not technical layers, are the primary unit of structure.

## The problem FSD solves

A common React app layout looks like this:

```
src/
├── components/   ← all components mixed together
├── hooks/        ← all hooks mixed together
├── services/     ← all API code mixed together
└── pages/
```

It looks tidy. It's terrible to maintain. To touch the "add a note" feature, you open four directories. Code that *is* one thing is scattered across the repo. Reuse is implicit and accidental.

FSD flips this: **co-locate everything that belongs to one feature**, then **rank features by scope** (app-wide vs page-wide vs feature-wide vs shared).

## Layers (frontend)

Top to bottom, from broadest to narrowest scope:

| Layer       | Holds                                                                          | Example in this repo                              |
| ----------- | ------------------------------------------------------------------------------ | ------------------------------------------------- |
| `app/`      | App-wide bootstrap: providers, router, global styles entry.                    | `ThemeProvider`, `QueryProvider`, `AuthProvider`. |
| `pages/`    | Route-level screens. Each one composes widgets and features.                   | `LoginPage`, `DashboardPage`.                     |
| `widgets/`  | Self-contained UI blocks reused across pages.                                  | (empty — will hold things like `MapPanel`).       |
| `features/` | One user-facing capability: form, hook, API call, all together.                | `features/auth/` (LoginForm, ProtectedRoute, api).|
| `entities/` | A business object and its UI: type, queries, display components.               | (empty — will hold `note`, `location`).           |
| `shared/`   | Reusable code with no business meaning: UI primitives, helpers, fetch wrapper. | `shared/ui/button.jsx`, `shared/api/http.js`.     |

### The golden rule: imports flow downward

A `feature` can import from `entities` and `shared`. A `feature` **cannot** import from another `feature`, a `page`, or `widget`. A `shared` thing can only import from other `shared` things.

```
       app   ▲   higher = wider scope
       │
       ▼
      pages
       │
       ▼
     widgets
       │
       ▼
     features ───▶ entities
       │              │
       ▼              ▼
            shared
```

This is the single most important property. It guarantees you can move or delete any slice without breaking unrelated code.

## Slices

Inside a layer, code is split into **slices** — one per business concept:

```
features/
├── auth/         ← one slice
├── add-note/     ← another slice (future)
└── tag-location/ ← another slice (future)
```

Each slice typically has its own internal structure:

```
features/auth/
├── api.js               ← HTTP calls
├── LoginForm.jsx        ← UI component
├── ProtectedRoute.jsx   ← UI component (or hook)
└── index.js             ← Barrel: the public API of this slice
```

The `index.js` is a **barrel file** — it re-exports the things outside code is allowed to import:

```js
// features/auth/index.js
export { LoginForm } from './LoginForm.jsx';
export { ProtectedRoute } from './ProtectedRoute.jsx';
```

Outside the slice, always import from the barrel: `import { LoginForm } from '@/features/auth'`. That way you can rename internal files without breaking callers.

## FSD on the API

The backend uses the same idea but with fewer layers — the API doesn't have UI, so layers like `pages` and `widgets` don't apply. We have:

```
apps/api/src/
├── features/        ← one folder per HTTP feature (auth, health, …)
├── routes/index.js  ← mounts every feature router under /api
├── middleware/      ← errorHandler, notFoundHandler, requireAuth, …
├── lib/             ← pure helpers (jwt.js, password.js)
├── db/prisma.js     ← the singleton PrismaClient
└── config/env.js    ← env reader
```

Each feature is a slice with three files (see [api-layers.md](./api-layers.md) for the deep-dive):

```
features/auth/
├── auth.routes.js       ← HTTP binding
├── auth.controller.js   ← request parsing + response shaping
└── auth.service.js      ← business logic + DB access
```

The same "imports flow downward" rule applies: a feature can use `db/`, `lib/`, `middleware/`, `config/`, but two features should not import each other. If they need to, the shared part probably belongs in `lib/` or as its own feature.

## "Where do I put X?"

A quick decision flow:

- Is it pure presentation, no business meaning? → `shared/ui/`
- Is it a generic helper (date formatting, fetch wrapper)? → `shared/lib/` or `shared/api/`
- Is it a thing the *user* can recognise (a note, a location, a fishing trip)? → `entities/<thing>/`
- Is it something the user *does* (log in, add a note, filter the map)? → `features/<action>/`
- Is it a chunk of UI made of multiple features, used on more than one page? → `widgets/<block>/`
- Is it a whole screen? → `pages/<page>/`
- Does the whole app need it (provider, router config)? → `app/`

## What FSD is **not**

- It's not "one component per file" — that's a separate convention.
- It's not "MVC for React" — there's no controller pattern on the frontend.
- It's not enforced by tooling here (yet). The rules are social. We'll add a lint rule (`eslint-plugin-boundaries` or similar) when the codebase grows.

## Going deeper

- [feature-sliced.design](https://feature-sliced.design/) — the official guide. The terminology and rules above come from there.
- [Why slice by feature?](https://feature-sliced.design/docs/about/motivation) — the motivation article.
