import { Construction, Fish } from 'lucide-react';
import { ThemeToggle } from '@/shared/ui/theme-toggle.jsx';

export const UnderConstructionPage = () => (
  <div className="relative min-h-screen bg-background text-foreground">
    <header className="absolute right-4 top-4">
      <ThemeToggle />
    </header>
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex items-center gap-3 text-primary">
        <Fish className="h-10 w-10" aria-hidden="true" />
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Fishing Journal</h1>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Construction className="h-5 w-5" aria-hidden="true" />
        <p>Under construction — come back soon.</p>
      </div>
    </main>
  </div>
);
