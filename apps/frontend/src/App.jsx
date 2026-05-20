import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { UnderConstructionPage } from '@/pages/under-construction';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { ProtectedRoute } from '@/features/auth';

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<UnderConstructionPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute role="ADMIN">
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
