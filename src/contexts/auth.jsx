import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import storage from '@/services/storage';
import { authApi, setOnUnauthorized } from '@/services/api';
import { registerForPushNotifications } from '@/services/notifications';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Register 401 callback so the API interceptor can clear auth state mid-session
  useEffect(() => {
    setOnUnauthorized(() => {
      setToken(null);
      setUser(null);
    });
  }, []);

  const loadSession = async () => {
  try {
    const savedToken = await storage.getItem('auth_token');
    const savedUser = await storage.getItem('auth_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));

      try {
        const res = await Promise.race([
          authApi.me(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000)
          ),
        ]);
        setUser(res.data.user);
        await storage.setItem('auth_user', JSON.stringify(res.data.user));
      } catch {
        await storage.removeItem('auth_token');
        await storage.removeItem('auth_user');
        setToken(null);
        setUser(null);
      }
    }
  } catch (err) {
    console.error('Session load error:', err);
  } finally {
    setIsLoading(false);
  }  };

  // Check for existing session on mount
  useEffect(() => {
    loadSession();
  }, []);

  const login = useCallback(async (data) => {
    const res = await authApi.login(data);
    const { user: newUser, token: newToken } = res.data;

    await storage.setItem('auth_token', newToken);
    await storage.setItem('auth_user', JSON.stringify(newUser));

    setToken(newToken);
    setUser(newUser);

    registerForPushNotifications().catch(() => {});
  }, []);

  const signup = useCallback(async (data) => {
    const res = await authApi.signup(data);
    const { user: newUser, token: newToken } = res.data;

    await storage.setItem('auth_token', newToken);
    await storage.setItem('auth_user', JSON.stringify(newUser));

    setToken(newToken);
    setUser(newUser);

    registerForPushNotifications().catch(() => {});

    return newToken;
  }, []);

  const googleLogin = useCallback(async (userData, authToken) => {
    await storage.setItem('auth_token', authToken);
    await storage.setItem('auth_user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    // Révoquer le token côté serveur avant de le supprimer localement
    try { await authApi.logout(); } catch { /* si le token est déjà invalide, on continue */ }
    await storage.removeItem('auth_token');
    await storage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me();
      setUser(res.data.user);
      await storage.setItem('auth_user', JSON.stringify(res.data.user));
    } catch (err) {
      console.error('Refresh user error:', err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        signup,
        googleLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
