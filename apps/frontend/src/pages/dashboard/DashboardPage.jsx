import { Construction, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { Button } from '@/shared/ui/button.jsx';
import { ThemeToggle } from '@/shared/ui/theme-toggle.jsx';

export const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-65px)] flex-col items-center justify-center gap-3 px-6 text-center">
        <Construction className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground">Dashboard under construction.</p>
      </main>
    </div>
  );
};
