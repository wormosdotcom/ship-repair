import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { login as apiLogin, logout as apiLogout, me } from '../lib/api';
import { User, Role } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    me().then((res) => {
      if (res.data?.user) setUser(res.data.user);
      setLoading(false);
    });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    if (res.error) return res.error;
    if (res.data?.user) setUser(res.data.user);
    return null;
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  const hasRole = (...roles: Role[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const value = useMemo(() => ({ user, loading, login, logout, hasRole }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
