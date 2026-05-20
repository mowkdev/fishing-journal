import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';

export const ProtectedRoute = ({ children, role }) => {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && user?.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
};
