import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearToken, getToken, setToken } from '@/shared/api/http';
import { loginRequest, logoutRequest, meRequest } from '@/features/auth/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!getToken()) {
      setStatus('unauthenticated');
      return;
    }

    meRequest()
      .then(({ user: me }) => {
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        clearToken();
        setUser(null);
        setStatus('unauthenticated');
      });
  }, []);

  const login = useCallback(async (credentials) => {
    const { token, user: signedIn } = await loginRequest(credentials);
    setToken(token);
    setUser(signedIn);
    setStatus('authenticated');
    return signedIn;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // best-effort: clear local state even if the server call fails
    }
    clearToken();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
