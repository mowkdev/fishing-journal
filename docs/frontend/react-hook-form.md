# React Hook Form

> A form library for React that keeps inputs *uncontrolled* and validates with a schema. We pair it with **Zod** for validation.

## The problem with `useState` forms

A "simple" controlled form in React looks like this:

```jsx
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [errors, setErrors] = useState({});

const onSubmit = (e) => {
  e.preventDefault();
  const next = {};
  if (!email.includes('@')) next.email = 'Invalid email';
  if (password.length < 1) next.password = 'Required';
  setErrors(next);
  if (Object.keys(next).length) return;
  // ...submit
};

return (
  <form onSubmit={onSubmit}>
    <input value={email} onChange={(e) => setEmail(e.target.value)} />
    {errors.email && <p>{errors.email}</p>}
    <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
    {errors.password && <p>{errors.password}</p>}
    <button type="submit">Sign in</button>
  </form>
);
```

This works. But:

- **Every keystroke re-renders the whole form.** Type "abc" → 3 re-renders. Big forms get slow.
- **Validation logic lives in the submit handler**, often duplicated for "validate on blur" or "validate on change".
- **Error display is tangled** with the input markup.
- **Scaling up** (10 fields, conditional fields, arrays of fields) becomes pasta.

React Hook Form (RHF) solves all four by going *uncontrolled* — your inputs don't bind to React state. RHF holds the values in a ref and tells you about changes only when *you* ask, or when validation runs.

## The pieces

```jsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
```

- `useForm` — the hook. Returns `register`, `handleSubmit`, `formState`, etc.
- `zodResolver` — adapter from `@hookform/resolvers/zod`. Plugs a Zod schema in as RHF's validator.
- `z` — Zod, the schema library.

## Our LoginForm — line by line

```jsx
// apps/frontend/src/features/auth/LoginForm.jsx
const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const LoginForm = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      const signedIn = await login(values);
      navigate(signedIn.role === 'ADMIN' ? '/dashboard' : '/');
    } catch (err) {
      setServerError(err.message ?? 'Sign-in failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}

      <Label htmlFor="password">Password</Label>
      <Input id="password" type="password" {...register('password')} />
      {errors.password && <p>{errors.password.message}</p>}

      {serverError && <p role="alert">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
};
```

What each part does:

| Part                                              | Meaning                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `z.object({ email: …, password: … })`             | The single source of truth for "what does a valid form look like".      |
| `useForm({ resolver: zodResolver(schema), … })`   | Wire Zod into RHF as the validator.                                     |
| `defaultValues: { email: '', password: '' }`      | Initial values. Important for "controlled vs uncontrolled" hygiene.     |
| `register('email')`                               | Returns `{ name, ref, onChange, onBlur }` — spread onto the input.      |
| `handleSubmit(onSubmit)`                          | Wraps your submit handler: runs validation first, then calls you with parsed `values`. |
| `formState.errors`                                | Object keyed by field name; `errors.email?.message` is what you render. |
| `formState.isSubmitting`                          | `true` while your async `onSubmit` is in flight. Use to disable the button. |
| `serverError`                                     | Separate `useState` for errors the *server* sends back — RHF only knows about client-side validation. |

`{...register('email')}` is the trick: it gives the input a `ref`, a `name`, and `onChange`/`onBlur` handlers in one shot. The input stays uncontrolled — React doesn't manage its value — but RHF still tracks it.

## Why Zod

Zod is a schema library. Each schema is *both* a runtime validator *and* a piece of documentation:

```js
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

schema.parse({ email: 'a@b.c', password: '12345678' });   // ✅ returns parsed value
schema.parse({ email: 'nope', password: '1' });            // ❌ throws ZodError with details
```

Pros for forms:

- **One file = the rules.** Adding a field means adding it to the schema; RHF picks up the new validation automatically.
- **Composable.** `z.object({ ... }).extend({ ... })`, `.partial()`, `.refine(custom check)`. You can express anything.
- **Used on the backend too.** Our login controller validates `req.body` with a Zod schema too (`apps/api/src/features/auth/auth.controller.js`). Same library, same syntax — easy mental model.

## Server errors vs client errors

RHF only validates *client-side* — it has no idea your API returned 401. So:

- **Client validation** (format, required, length): use Zod via `zodResolver`. Errors live in `formState.errors`.
- **Server validation** (wrong password, email already taken): catch the API error in your `onSubmit` and store it in a separate `useState` like `serverError`.

This split is intentional — they're different kinds of error. Mixing them into one state container leads to "did the user fix the email or did the server change its mind?" confusion.

## Patterns we follow

- **Always pass `defaultValues`.** Without them, fields start as `undefined`, which React treats as uncontrolled. The moment a user types, the input switches to controlled — React warns about it in the console.
- **Use `aria-invalid` on inputs** when there's an error (`aria-invalid={errors.email ? 'true' : 'false'}`). Screen readers and styling both benefit.
- **`noValidate` on the `<form>`.** Disables the browser's built-in validation tooltip so our Zod messages are what the user sees.
- **Disable the submit button with `isSubmitting`.** Prevents double-clicks turning into double requests.

## Going deeper

- [React Hook Form docs](https://react-hook-form.com/) — `register`, `Controller`, field arrays, watch, trigger.
- [`Controller` component](https://react-hook-form.com/docs/usecontroller/controller) — wraps libraries whose inputs *must* be controlled (some date pickers, some combobox libs).
- [Zod docs](https://zod.dev/) — full type list, refinements, transforms.
- [`@hookform/resolvers`](https://github.com/react-hook-form/resolvers) — adapters for Zod, Yup, Joi, Valibot, …
