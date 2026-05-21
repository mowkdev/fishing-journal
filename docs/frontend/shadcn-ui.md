# shadcn/ui (and Tailwind)

> A collection of accessible, customisable React components — **not** a component library you install.

## The unusual thing about shadcn

Most component libraries (Material UI, Chakra, Mantine) are npm packages. You `npm install` them, import `<Button />`, and you're done. Updates come via package upgrades. Customisation happens through theme objects or `sx` props.

shadcn/ui is different: **you copy the components into your own repo**. There's a CLI (`npx shadcn add button`) that does the copy for you, but once a component lives in your codebase, *it's yours*. No package to upgrade, no theme wrapper, no escape hatches needed — if you want to change how the button looks, edit the file.

This sounds heavy ("I have to maintain my own components?") but in practice it's wonderful:

- **You own the code.** When the design system needs a tweak that the library doesn't support, you just write it.
- **No version skew.** Components don't break when you upgrade some other dependency, because they live with the rest of your code.
- **You only have what you use.** No tree-shaking guesses, no bundle bloat.
- **It's still updateable.** Re-run the CLI to pull the latest version of a component; review the diff like any other code change.

It's built on top of two things: **Radix UI primitives** (unstyled, accessible behavior — focus management, ARIA roles, keyboard handling) and **Tailwind CSS** (styling).

## How Tailwind fits in

Tailwind is a utility-first CSS framework. Instead of writing a `.button-primary { … }` class, you compose utilities directly in the markup:

```jsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md">
  Click me
</button>
```

Pros:

- **No CSS file to maintain.** Styles live next to the markup they affect.
- **No naming.** You don't agonise over `.btn-blue-large-secondary`.
- **Constraints by default.** `p-4`, `text-sm`, `rounded-md` — Tailwind enforces a design scale, you don't have to.

Pairing Tailwind with shadcn means: when you copy the `<Button />` component in, it comes with Tailwind classes built-in. To restyle it for your design, edit those classes.

## Theming with CSS variables

shadcn uses CSS variables for theme tokens:

```css
/* apps/frontend/src/index.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  /* ... */
}
```

Tailwind is told about these in `tailwind.config.js`:

```js
colors: {
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))',
  },
  // ...
}
```

So `bg-background` resolves to `background-color: hsl(var(--background))`. Toggle the `dark` class on `<html>` and every variable swaps in one paint. That's how our dark/light mode works — see `apps/frontend/src/app/providers/ThemeProvider.jsx`.

## The components we already have

| File                                              | Role                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `src/shared/ui/button.jsx`                        | Buttons with `variant` and `size` via `cva`.                      |
| `src/shared/ui/input.jsx`                         | Styled `<input>` with focus ring and disabled state.              |
| `src/shared/ui/label.jsx`                         | Styled `<label>`.                                                 |
| `src/shared/ui/theme-toggle.jsx`                  | Sun/moon icon button that flips `ThemeProvider`'s theme.          |

All shadcn-style components live under `shared/ui/`. That's set in `components.json`:

```json
"aliases": {
  "components": "@/shared/ui",
  "utils": "@/shared/lib/utils"
}
```

`components.json` is the CLI's config — when you `npx shadcn add card`, it knows to drop the file into `src/shared/ui/card.jsx`.

## Reading a shadcn component

The Button is a fair example of the patterns you'll see:

```jsx
// apps/frontend/src/shared/ui/button.jsx
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@/shared/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ...',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        // ...
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export const Button = forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
```

Three patterns here, each pulling its weight:

1. **`cva` (class-variance-authority)** — declares "variants" of a component. `<Button variant="outline" size="sm" />` resolves to the right Tailwind classes. Adding a new variant is one line in the `variants` object.
2. **`cn` (in `shared/lib/utils.js`)** — merges class strings and resolves Tailwind conflicts. If the caller passes `className="p-2"` and the variant already says `p-4`, `cn` resolves it to `p-2` (the override wins). Internally it's `twMerge(clsx(inputs))`.
3. **`asChild` + `Slot`** — the trick that lets you do `<Button asChild><Link to="/">Home</Link></Button>`. Instead of rendering a `<button>`, the component "becomes" the `<Link>` and applies its styles to it. This is Radix's `Slot` primitive.

## Adding a new component

```bash
cd apps/frontend
npx shadcn@latest add dialog
```

The CLI:

1. Reads `components.json` to learn your project conventions.
2. Drops the component into `src/shared/ui/dialog.jsx`.
3. Adds any missing dependencies (e.g. `@radix-ui/react-dialog`) to `package.json`.

Open the file, read it, customise as needed. The CLI is just a starter.

## Patterns we follow

- **Always import the `cn` helper for class merging.** Even tiny components. It's how user-supplied `className` overrides come through cleanly.
- **Use CSS variables, not hardcoded colors.** `bg-primary` not `bg-blue-500`. That way dark mode just works.
- **Prefer `variant` props over `className` for design choices.** If you find yourself passing the same `className` repeatedly, add a variant via `cva`.
- **One component per file in `shared/ui/`.** Even tiny ones — easier to find, easier to copy.

## Going deeper

- [shadcn/ui docs](https://ui.shadcn.com/) — every component, with copy-pastable code.
- [Tailwind docs](https://tailwindcss.com/docs) — utility reference. The colour, spacing, and typography pages are the most-visited.
- [Radix Primitives](https://www.radix-ui.com/primitives) — the accessibility layer underneath shadcn.
- [cva](https://cva.style/) — class-variance-authority's home page.
