import React, { createContext, useState, useEffect, useContext } from 'react';
import authService from '../services/authService';
import { secureStorage } from '../services/secureStore';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from secure storage
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const storedToken = await secureStorage.getAuthToken();
        const storedUser = await secureStorage.getUser();

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
          // Silently refresh profile in background
          try {
            const freshUser = await authService.getProfile();
            setUser(freshUser);
          } catch (e) {
            console.log('[AuthContext] Background profile sync failed:', e.message);
          }
        }
      } catch (err) {
        console.error('[AuthContext] Bootstrap error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  const login = async (email, password) => {
    const res = await authService.login({ email, password });
    setToken(res.data.token);
    setUser(res.data.user);
    return res;
  };

  const logout = async () => {
    await authService.logout();
    setToken(null);
    setUser(null);
  };

  const refreshProfile = async () => {
    try {
      const freshUser = await authService.getProfile();
      setUser(freshUser);
      return freshUser;
    } catch (err) {
      console.error('[AuthContext] Failed to refresh profile:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        refreshProfile,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
