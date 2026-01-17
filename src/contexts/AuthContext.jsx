/**
 * Authentication Context Provider
 * Manages authentication state across the React application
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  // Check authentication status on mount
  useEffect(() => {
    // Clear any stale callback processing flags
    localStorage.removeItem('oauth_callback_processing');
    checkAuth();
  }, []);

  const checkAuth = () => {
    try {
      console.log('=== Checking Authentication ===');
      const authenticated = authService.isAuthenticated();
      console.log('Authentication result:', authenticated);
      setIsAuthenticated(authenticated);

      if (authenticated) {
        const userEmail = authService.getUserEmail();
        const userInfo = authService.getUserInfo();
        console.log('User email:', userEmail);
        setUser({
          email: userEmail,
          info: userInfo
        });
      } else {
        console.log('Not authenticated - should redirect to login');
        setUser(null);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setError(err.message);
      setIsAuthenticated(false);
      setUser(null);
      // Also clear any potentially corrupted auth data
      authService.clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    try {
      setError(null);
      await authService.login();
      // Note: This will redirect, so code after this won't execute
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.message);
      throw err;
    }
  };

  const logout = () => {
    try {
      authService.logout();
      setIsAuthenticated(false);
      setUser(null);
      setError(null);
    } catch (err) {
      console.error('Logout failed:', err);
      setError(err.message);
    }
  };

  const handleCallback = useCallback(async (code, state) => {
    try {
      setIsLoading(true);
      setError(null);
      await authService.handleCallback(code, state);
      checkAuth();
      return true;
    } catch (err) {
      console.error('Callback handling failed:', err);
      setError(err.message);
      setIsAuthenticated(false);
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getAccessToken = () => {
    return authService.getAccessToken();
  };

  const getBearerToken = () => {
    return authService.getBearerToken();
  };

  const ensureValidToken = async () => {
    return await authService.ensureValidToken();
  };

  const value = {
    isAuthenticated,
    isLoading,
    user,
    error,
    login,
    logout,
    handleCallback,
    getAccessToken,
    getBearerToken,
    ensureValidToken,
    checkAuth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
