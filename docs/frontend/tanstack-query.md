# TanStack Query

> Manages the data you fetch from your server. Caches it, refreshes it, deduplicates it, keeps it in sync. Formerly known as React Query.

## The problem it solves

If you've ever written this:

```jsx
const [notes, setNotes] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  let cancelled = false;
  setLoading(true);
  fetch('/api/notes')
    .then((r) => r.json())
    .then((data) => { if (!cancelled) { setNotes(data); setLoading(false); } })
    .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
  return () => { cancelled = true; };
}, []);
```

You've written it five more times. And each copy has slightly different bugs: maybe one forgot the cleanup, another reset `loading` in the wrong place, another doesn't deduplicate when two components mount at once. You also probably have no caching — switching tabs and back refetches everything.

TanStack Query (TSQ) replaces all of that with one hook:

```jsx
const { data: notes, isLoading, error } = useQuery({
  queryKey: ['notes'],
  queryFn: () => apiFetch('/notes'),
});
```

And gives you a cache, request deduplication, background refetching, retries, and devtools for free.

## The mental model: **server state is not client state**

This is the key insight TSQ is built on.

**Client state** — `useState` is great for this — is things you fully own: form input values, modal open/closed, current tab. Truth lives in React.

**Server state** is a *snapshot* of something the server owns. The user has notes in Postgres; you've cached a copy in your component. Two consequences:

- Your copy is **always stale by some amount**. The server might have changed since you fetched.
- Two components asking for "the user's notes" should see the *same* copy, not two independent fetches.

TSQ models server state as a cache keyed by `queryKey`. Multiple components asking with the same key share the same fetch and the same data. The cache knows when its entries are "fresh" (don't refetch) vs "stale" (refetch in the background, show old data immediately).

## Our setup

```jsx
// apps/frontend/src/app/providers/QueryProvider.jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export const QueryProvider = ({ children }) => {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30,           // 30s — don't auto-refetch within this window
            refetchOnWindowFocus: false,    // we'll opt-in per query when we want this
            retry: 1,                       // retry failed queries once before giving up
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
```

The provider is mounted in `apps/frontend/src/main.jsx`:

```jsx
<ThemeProvider …>
  <QueryProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </QueryProvider>
</ThemeProvider>
```

One client, one cache, for the whole app.

Three defaults are worth understanding:

- **`staleTime: 30000`** — when you call `useQuery` again within 30 seconds of the last successful fetch, TSQ uses the cached data and doesn't hit the server. After 30 seconds, the cache entry is "stale" — TSQ still returns cached data immediately for snappiness, but kicks off a background refetch.
- **`refetchOnWindowFocus: false`** — TSQ defaults to "refetch when the user tabs back to the page". Useful for dashboards, annoying for forms. We opt-in per query when we want it.
- **`retry: 1`** — failed requests retry once. The default is 3, which is too aggressive for an SPA where a slow API call should fail fast and let us show an error.

## Writing a query

We don't have feature queries yet (the project's still scaffolded), but here's the pattern they'll follow once we add notes:

```js
// apps/frontend/src/features/notes/api.js
import { apiFetch } from '@/shared/api/http';

export const fetchNotes = () => apiFetch('/notes');
export const fetchNote = (id) => apiFetch(`/notes/${id}`);
export const createNote = (input) =>
  apiFetch('/notes', { method: 'POST', body: JSON.stringify(input) });
```

```jsx
// apps/frontend/src/features/notes/useNotes.js
import { useQuery } from '@tanstack/react-query';
import { fetchNotes } from './api';

export const useNotes = () =>
  useQuery({
    queryKey: ['notes'],
    queryFn: fetchNotes,
  });
```

```jsx
// apps/frontend/src/pages/notes/NotesPage.jsx
const NotesPage = () => {
  const { data: notes, isLoading, error } = useNotes();
  if (isLoading) return <Spinner />;
  if (error) return <ErrorPanel message={error.message} />;
  return <NoteList notes={notes} />;
};
```

The hook lives in the feature. The page just consumes it. That's the FSD pattern: business logic in hooks, presentation in components.

## Query keys — the cache's index

The `queryKey` is how TSQ identifies a query in the cache. It's an array; convention is "noun, then identifiers, then filters":

```js
useQuery({ queryKey: ['notes'] });                    // all notes
useQuery({ queryKey: ['notes', noteId] });            // one note by id
useQuery({ queryKey: ['notes', { tag: 'pike' }] });   // filtered list
```

Two queries with the same key share a cache entry. Two with different keys are independent. This becomes important when you mutate data — you tell the cache "the `['notes']` entry is now stale" and TSQ refetches it.

## Mutations — writing data

```jsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

const useCreateNote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createNote,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
    },
  });
};
```

Then in a component:

```jsx
const { mutate, isPending } = useCreateNote();

<Button onClick={() => mutate({ title: 'New' })} disabled={isPending}>
  Add note
</Button>
```

The `onSuccess` callback calls `invalidateQueries` — TSQ marks the `['notes']` cache as stale, which triggers a refetch in any mounted `useNotes()` hook. UI updates automatically. No `setState`, no event bus.

## Patterns we follow

- **One hook per query, lives in the feature.** `useNotes()`, `useNote(id)`, `useCreateNote()`. Pages and widgets call hooks, never `useQuery` directly.
- **API calls live in a feature's `api.js`.** Hooks call those functions. Don't put `apiFetch` calls inside `useQuery({ queryFn: () => apiFetch(...) })` inline — pull it out so it's reusable from mutations and tests.
- **Use `queryKey` arrays.** Even if it feels overkill for "all notes" (`['notes']`), it's the consistent shape.
- **Don't manually copy server data into `useState`.** If you find yourself doing `useEffect(() => setLocal(data), [data])`, the cache *is* your state — read it.

## Things TSQ does that you'll appreciate later

- **Deduplication.** Five components calling `useNotes()` produce one network request.
- **Background refetching.** When the user has been idle and comes back, stale queries refetch silently.
- **Optimistic updates.** Update the cache *before* the mutation responds; roll back if it fails. Makes UIs feel instant.
- **Devtools.** Drop `<ReactQueryDevtools />` into your app to inspect every cache entry, see fetch timing, force invalidation. Indispensable when debugging "why is this data wrong?"

## Going deeper

- [TanStack Query docs](https://tanstack.com/query/latest/docs/framework/react/overview) — start with "Important Defaults" and "Queries".
- [Practical React Query](https://tkdodo.eu/blog/practical-react-query) — TKDodo's blog series; the de-facto reference for idioms.
- [Why server state is special](https://tanstack.com/query/v5/docs/framework/react/guides/important-defaults) — explains the mental model.
