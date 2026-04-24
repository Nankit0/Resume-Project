import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User, AuthContextValue } from '../types';
import type { PostgrestError } from '@supabase/supabase-js';
import { getSupabaseClient } from '../utils/supabaseDebug';

const AuthContext = createContext<AuthContextValue | null>(null);

type UserRow = {
  id: string | number;
  username: string;
  password: string | null;
  email: string | null;
  name: string | null;
  userRole: 'admin' | 'user' | null;
  isActive: boolean | null;
  createdAt?: string | null;
};

function normalizeUser(user: User): User {
  return {
    id: user.id,
    username: user.username,
    password: user.password,
    email: user.email,
    name: user.name,
    userRole: user.userRole || 'user',
    isActive: user.isActive !== false,
  };
}

function sameUser(a: User | null, b: User | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.id === b.id &&
    a.username === b.username &&
    a.password === b.password &&
    a.email === b.email &&
    a.name === b.name &&
    (a.userRole || 'user') === (b.userRole || 'user') &&
    (a.isActive !== false) === (b.isActive !== false)
  );
}

function mapAuthError(error: PostgrestError | null): string {
  if (!error) return 'Login failed. Please try again.';
  if (error.code === '42501') {
    return 'Login is blocked by database policy. Update Supabase RLS for users table.';
  }
  return 'Login failed. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const s = localStorage.getItem('rb_user');
      return s ? (JSON.parse(s) as User) : null;
    } catch {
      localStorage.removeItem('rb_user');
      return null;
    }
  });

  const syncSessionUser = (nextUser: User | null) => {
    setUser(prev => sameUser(prev, nextUser) ? prev : nextUser);
    if (nextUser) {
      localStorage.setItem('rb_user', JSON.stringify(nextUser));
    } else {
      localStorage.removeItem('rb_user');
    }
  };

  const refreshSession = useCallback(async () => {
    if (!user) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      logout();
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, password, email, name, userRole, isActive')
        .eq('id', user.id)
        .maybeSingle<UserRow>();

      if (error || !data) {
        logout();
        return;
      }

      const current = normalizeUser({
        id: data.id,
        username: data.username,
        password: data.password ?? undefined,
        email: data.email ?? undefined,
        name: data.name ?? undefined,
        userRole: data.userRole ?? 'user',
        isActive: data.isActive ?? true,
      });
      if (current.isActive === false) {
        logout();
        return;
      }

      if (!sameUser(user, current)) {
        syncSessionUser(current);
      }
    } catch {
      logout();
    }
  }, [user]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = async (username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'Login is unavailable right now. Please try again.' };
    }

    try {
      const identifier = username.trim();
      const selectCols = 'id, username, password, email, name, userRole, isActive';

      // Use two separate .eq() queries to avoid PostgREST .or() misparse of
      // special characters (e.g. '@' in email addresses).
      let { data: emailData, error: emailError } = await supabase
        .from('users')
        .select(selectCols)
        .eq('email', identifier)
        .eq('password', password)
        .limit(1);

      let data = emailData;
      let error = emailError;

      if (!emailError && (!emailData || emailData.length === 0)) {
        const usernameResult = await supabase
          .from('users')
          .select(selectCols)
          .eq('username', identifier)
          .eq('password', password)
          .limit(1);
        data = usernameResult.data;
        error = usernameResult.error;
      }

      if (error) {
        return { ok: false, error: mapAuthError(error) };
      }

      const users = (data ?? []) as UserRow[];
      if (users.length === 0) {
        return { ok: false, error: 'Invalid credentials' };
      }

      if (users.length > 1) {
        return { ok: false, error: 'Multiple matching accounts found. Contact an admin.' };
      }

      const u = normalizeUser({
        id: users[0].id,
        username: users[0].username,
        password: users[0].password ?? undefined,
        email: users[0].email ?? undefined,
        name: users[0].name ?? undefined,
        userRole: users[0].userRole ?? 'user',
        isActive: users[0].isActive ?? true,
      });

      if (u.isActive === false) {
        return { ok: false, error: 'This account is inactive. Contact an admin.' };
      }

      syncSessionUser(u);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Login failed. Please try again.' };
    }
  };

  const logout = () => {
    syncSessionUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshSession, syncSessionUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
