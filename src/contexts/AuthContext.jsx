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

  // Initialize authentication on mount - clears stale tokens and validates auth
  useEffect(() => {
    // Clear any stale callback processing flags
    localStorage.removeItem('oauth_callback_processing');

    // Initialize auth and clear any stale tokens before checking
    console.log('=== App Startup: Initializing Authentication ===');
    authService.initializeAuth();

    checkAuth();
  }, []);

  // Listen for 401 unauthorized events from API calls
  useEffect(() => {
    const handleUnauthorized = (event) => {
      console.warn('Received auth:unauthorized event:', event.detail);
      setIsAuthenticated(false);
      setUser(null);
      setError('Your session has expired. Please log in again.');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
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

  /**
   * Handle authentication errors (e.g., 401 responses from APIs)
   * Clears stale tokens and triggers re-authentication
   * @param {string} reason - Description of why re-auth is needed
   */
  const handleAuthError = (reason = 'API authentication error') => {
    console.warn(`Auth error detected: ${reason} - clearing stale auth and redirecting to login`);
    authService.clearAuth();
    setIsAuthenticated(false);
    setUser(null);
    // Navigate to login will happen automatically due to route protection
  };

  /**
   * Check if token is stale (for use by API services)
   * @returns {boolean} True if token is stale
   */
  const isTokenStale = () => {
    return authService.isTokenStale();
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
    checkAuth,
    handleAuthError,
    isTokenStale
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
