import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import storage from '@/services/storage';
import { authApi } from '@/services/api';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const savedToken = await storage.getItem('auth_token');
      const savedUser = await storage.getItem('auth_user');

      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));

        // Verify token is still valid
        try {
          const res = await authApi.me();
          setUser(res.data.user);
          await storage.setItem('auth_user', JSON.stringify(res.data.user));
        } catch {
          // Token expired
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
    }
  };

  const login = useCallback(async (data) => {
    const res = await authApi.login(data);
    const { user: newUser, token: newToken } = res.data;

    await storage.setItem('auth_token', newToken);
    await storage.setItem('auth_user', JSON.stringify(newUser));

    setToken(newToken);
    setUser(newUser);
  }, []);

  const signup = useCallback(async (data) => {
    const res = await authApi.signup(data);
    const { user: newUser, token: newToken } = res.data;

    await storage.setItem('auth_token', newToken);
    await storage.setItem('auth_user', JSON.stringify(newUser));

    setToken(newToken);
    setUser(newUser);
  }, []);

  const googleLogin = useCallback(async (userData, authToken) => {
    await storage.setItem('auth_token', authToken);
    await storage.setItem('auth_user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
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
  console.log("context", context);

  return context;
}
