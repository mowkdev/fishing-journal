import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/app/providers/ThemeProvider.jsx';
import { Button } from './button.jsx';

const resolveIsDark = (theme) => {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const isDark = resolveIsDark(theme);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
};
