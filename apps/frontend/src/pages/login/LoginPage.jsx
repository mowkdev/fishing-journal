import { Fish } from 'lucide-react';
import { LoginForm } from '@/features/auth';
import { ThemeToggle } from '@/shared/ui/theme-toggle.jsx';

export const LoginPage = () => (
  <div className="relative min-h-screen bg-background text-foreground">
    <header className="absolute right-4 top-4">
      <ThemeToggle />
    </header>
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-primary">
          <Fish className="h-10 w-10" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight">Fishing Journal</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>
        <LoginForm />
      </div>
    </main>
  </div>
);
