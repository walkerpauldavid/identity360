/**
 * OAuth2 Authentication Service with PKCE
 * Implements OAuth 2.0 Authorization Code Flow with PKCE for browser-based apps
 * Based on oauth_mcp_server logic adapted for React/browser environment
 */

/**
 * Generate a random string for PKCE code verifier
 * @param {number} length - Length of the string
 * @returns {string} Random string
 */
const generateRandomString = (length = 128) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
};

/**
 * Generate SHA-256 hash and base64url encode
 * @param {string} plain - Plain text string
 * @returns {Promise<string>} Base64url encoded hash
 */
const sha256 = async (plain) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64urlEncode(hash);
};

/**
 * Base64url encode an ArrayBuffer
 * @param {ArrayBuffer} buffer - Buffer to encode
 * @returns {string} Base64url encoded string
 */
const base64urlEncode = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

/**
 * OAuth2 Configuration
 */
export const getOAuthConfig = () => ({
  tenantId: import.meta.env.VITE_TENANT_ID || '',
  clientId: import.meta.env.VITE_CLIENT_ID || '',
  scope: import.meta.env.VITE_OAUTH2_SCOPE || 'https://graph.microsoft.com/.default',
  redirectUri: import.meta.env.VITE_REDIRECT_URI || `${window.location.origin}/callback`,

  // Azure AD endpoints
  authorizeEndpoint: (tenantId) =>
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
  tokenEndpoint: (tenantId) =>
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,

  // Request offline_access to get refresh tokens
  getScopeWithRefresh: function() {
    const baseScope = this.scope;
    return baseScope.includes('offline_access') ? baseScope : `${baseScope} offline_access`;
  }
});

/**
 * OAuth2 Authentication Service
 */
class AuthService {
  constructor() {
    this.config = getOAuthConfig();
    this.tokenKey = 'oauth_token_data';
    this.stateKey = 'oauth_state';
    this.codeVerifierKey = 'oauth_code_verifier';
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    // Check for override token first
    const overrideToken = localStorage.getItem('bearer_token_override');
    if (overrideToken) {
      // Validate override token's JWT expiry
      if (this.isTokenExpired(overrideToken)) {
        console.log('Override token is expired - clearing it');
        localStorage.removeItem('bearer_token_override');
        // Fall through to check OAuth token
      } else {
        console.log('Using valid override token');
        return true;
      }
    }

    const tokenData = this.getStoredToken();
    if (!tokenData || !tokenData.access_token) {
      console.log('No stored OAuth token found');
      return false;
    }

    // Check the actual JWT token expiry (more reliable than stored expires_at)
    if (this.isTokenExpired(tokenData.access_token)) {
      console.log('OAuth token JWT is expired - clearing authentication');
      this.clearAuth();
      return false;
    }

    // Also check stored expires_at as a fallback
    if (tokenData.expires_at && new Date(tokenData.expires_at) <= new Date()) {
      console.log('OAuth token expires_at passed - clearing authentication');
      this.clearAuth();
      return false;
    }

    console.log('OAuth token is valid');
    return true;
  }

  /**
   * Check if token needs refresh (expired or expiring soon)
   * @returns {boolean} True if token needs refresh
   */
  needsRefresh() {
    const tokenData = this.getStoredToken();
    if (!tokenData || !tokenData.access_token) {
      return false; // No token to refresh
    }

    if (!tokenData.expires_at) {
      return false; // No expiry info
    }

    // Check if token is expired or will expire in the next 5 minutes
    const expiryTime = new Date(tokenData.expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    return expiryTime <= fiveMinutesFromNow;
  }

  /**
   * Get stored token data
   * @returns {Object|null} Token data
   */
  getStoredToken() {
    try {
      const data = localStorage.getItem(this.tokenKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading stored token:', error);
      return null;
    }
  }

  /**
   * Get access token
   * @returns {string|null} Access token
   */
  getAccessToken() {
    // Check for override token first
    const overrideToken = localStorage.getItem('bearer_token_override');
    if (overrideToken) {
      return overrideToken;
    }

    // Fall back to OAuth token
    const tokenData = this.getStoredToken();
    return tokenData?.access_token || null;
  }

  /**
   * Decode JWT token to get expiry time (without verification)
   * @param {string} token - JWT token
   * @returns {Object|null} Decoded token payload
   */
  decodeToken(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Check if a JWT token is expired or expiring soon
   * @param {string} token - JWT token
   * @returns {boolean} True if token needs refresh
   */
  isTokenExpired(token) {
    if (!token || typeof token !== 'string') {
      console.log('isTokenExpired: No token or invalid token type');
      return true;
    }

    const decoded = this.decodeToken(token);
    if (!decoded) {
      console.log('isTokenExpired: Failed to decode token');
      return true;
    }

    if (!decoded.exp) {
      console.log('isTokenExpired: Token has no exp claim');
      return true;
    }

    const expiryTime = new Date(decoded.exp * 1000); // exp is in seconds
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    const isExpired = expiryTime <= fiveMinutesFromNow;
    console.log('isTokenExpired:', isExpired, '| Expiry:', expiryTime.toISOString(), '| Now:', now.toISOString());

    return isExpired;
  }

  /**
   * Ensure we have a valid access token, refreshing if necessary
   * @returns {Promise<string|null>} Valid access token
   */
  async ensureValidToken() {
    // Check for override token first - but validate its expiry
    const overrideToken = localStorage.getItem('bearer_token_override');
    if (overrideToken) {
      // Check if override token is expired
      if (this.isTokenExpired(overrideToken)) {
        console.warn('Override token is expired, clearing it');
        localStorage.removeItem('bearer_token_override');
        // Fall through to use OAuth token
      } else {
        return overrideToken;
      }
    }

    // Check if refresh is needed
    if (this.needsRefresh()) {
      const tokenData = this.getStoredToken();

      // If we have a refresh token, try to refresh
      if (tokenData?.refresh_token) {
        try {
          console.log('Token expired or expiring soon, refreshing...');
          const newTokenData = await this.refreshToken(tokenData.refresh_token);
          this.storeToken(newTokenData);
          return newTokenData.access_token;
        } catch (error) {
          console.error('Token refresh failed:', error);
          // If refresh fails, clear auth and return null
          this.clearAuth();
          return null;
        }
      } else {
        // No refresh token available
        console.warn('Token expired but no refresh token available - please log in again');
        this.clearAuth();
        return null;
      }
    }

    // Token is still valid
    return this.getAccessToken();
  }

  /**
   * Get bearer token (with "Bearer" prefix)
   * @returns {string|null} Bearer token
   */
  getBearerToken() {
    // Check for override token first
    const overrideToken = localStorage.getItem('bearer_token_override');
    if (overrideToken) {
      // Override token is stored without "Bearer" prefix, so add it
      return `Bearer ${overrideToken}`;
    }

    // Fall back to OAuth token
    const token = this.getAccessToken();
    return token ? `Bearer ${token}` : null;
  }

  /**
   * Store token data
   * @param {Object} tokenData - Token data to store
   */
  storeToken(tokenData) {
    try {
      // Calculate expiry timestamp
      if (tokenData.expires_in) {
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in - 300); // 5 min buffer
        tokenData.expires_at = expiresAt.toISOString();
      }

      localStorage.setItem(this.tokenKey, JSON.stringify(tokenData));
    } catch (error) {
      console.error('Error storing token:', error);
    }
  }

  /**
   * Clear authentication data
   */
  clearAuth() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.stateKey);
    localStorage.removeItem(this.codeVerifierKey);
    console.log('Auth data cleared');
  }

  /**
   * Initiate OAuth2 login with PKCE
   */
  async login() {
    try {
      console.log('=== Starting OAuth2 Login Flow ===');

      // Validate configuration
      console.log('Checking OAuth configuration...');
      console.log('Tenant ID:', this.config.tenantId ? 'SET' : 'MISSING');
      console.log('Client ID:', this.config.clientId ? 'SET' : 'MISSING');
      console.log('Redirect URI:', this.config.redirectUri);
      console.log('Scope:', this.config.getScopeWithRefresh());

      if (!this.config.tenantId || !this.config.clientId) {
        const errorMsg = 'Missing OAuth configuration: VITE_TENANT_ID and VITE_CLIENT_ID must be set in .env file';
        console.error(errorMsg);
        alert(errorMsg);
        throw new Error(errorMsg);
      }

      // Generate PKCE parameters
      console.log('Generating PKCE parameters...');
      const codeVerifier = generateRandomString(128);
      const codeChallenge = await sha256(codeVerifier);
      const state = generateRandomString(32);
      console.log('PKCE parameters generated successfully');

      // Store for callback (using localStorage for better persistence)
      localStorage.setItem(this.stateKey, state);
      localStorage.setItem(this.codeVerifierKey, codeVerifier);
      console.log('Stored state and code verifier to localStorage');

      // Build authorization URL
      const authUrl = new URL(this.config.authorizeEndpoint(this.config.tenantId));
      authUrl.searchParams.append('client_id', this.config.clientId);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', this.config.redirectUri);
      authUrl.searchParams.append('scope', this.config.getScopeWithRefresh());
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('code_challenge', codeChallenge);
      authUrl.searchParams.append('code_challenge_method', 'S256');
      authUrl.searchParams.append('response_mode', 'query');

      console.log('=== Redirecting to Microsoft Login ===');
      console.log('Authorization URL:', authUrl.toString());

      // Redirect to authorization endpoint
      window.location.href = authUrl.toString();

      console.log('Redirect initiated - if you see this, the redirect may have been blocked');
    } catch (error) {
      console.error('=== Login Failed ===');
      console.error('Error:', error);
      console.error('Error stack:', error.stack);
      alert(`Login failed: ${error.message}\n\nCheck the browser console for details.`);
      throw error;
    }
  }

  /**
   * Handle OAuth callback
   * @param {string} code - Authorization code from callback
   * @param {string} state - State parameter from callback
   * @returns {Promise<Object>} Token data
   */
  async handleCallback(code, state) {
    try {
      // Check if already authenticated (callback already processed)
      if (this.isAuthenticated()) {
        console.log('Already authenticated, skipping callback processing');
        return this.getStoredToken();
      }

      // Debug: Log all localStorage keys
      console.log('=== CALLBACK DEBUG ===');
      console.log('Received state:', state);
      console.log('Received code:', code?.substring(0, 20) + '...');
      console.log('All localStorage keys:', Object.keys(localStorage));
      console.log('Looking for key:', this.stateKey);
      console.log('Looking for key:', this.codeVerifierKey);

      // Validate state
      const storedState = localStorage.getItem(this.stateKey);
      console.log('Stored state:', storedState);

      if (!storedState) {
        // Check if we're already authenticated (duplicate call after successful processing)
        if (this.isAuthenticated()) {
          console.log('No stored state, but already authenticated. Callback already processed.');
          return this.getStoredToken();
        }
        console.error('No stored state found. Please try logging in again.');
        console.error('localStorage contents:', localStorage);
        throw new Error('No stored state found - please restart login');
      }

      if (storedState !== state) {
        console.error('State mismatch:', { storedState, receivedState: state });
        throw new Error('Invalid state parameter - possible CSRF attack');
      }

      // Get code verifier
      const codeVerifier = localStorage.getItem(this.codeVerifierKey);
      if (!codeVerifier) {
        console.error('No code verifier found. Please try logging in again.');
        throw new Error('Code verifier not found - please restart login');
      }

      // Exchange code for token
      const tokenData = await this.exchangeCodeForToken(code, codeVerifier);

      // Store token
      this.storeToken(tokenData);

      // Clear stored state and verifier
      localStorage.removeItem(this.stateKey);
      localStorage.removeItem(this.codeVerifierKey);

      return tokenData;
    } catch (error) {
      console.error('Callback handling failed:', error);
      this.clearAuth();
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code
   * @param {string} codeVerifier - PKCE code verifier
   * @returns {Promise<Object>} Token data
   */
  async exchangeCodeForToken(code, codeVerifier) {
    const tokenUrl = this.config.tokenEndpoint(this.config.tenantId);

    const params = new URLSearchParams();
    params.append('client_id', this.config.clientId);
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', this.config.redirectUri);
    params.append('code_verifier', codeVerifier);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Token exchange failed: ${response.status} - ${errorData.error_description || response.statusText}`
      );
    }

    return await response.json();
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New token data
   */
  async refreshToken(refreshToken) {
    const tokenUrl = this.config.tokenEndpoint(this.config.tenantId);

    const params = new URLSearchParams();
    params.append('client_id', this.config.clientId);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('scope', this.config.getScopeWithRefresh());

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Token refresh failed: ${response.status} - ${errorData.error_description || response.statusText}`
      );
    }

    const tokenData = await response.json();
    console.log('Token refreshed successfully');
    return tokenData;
  }

  /**
   * Logout and clear authentication
   */
  logout() {
    this.clearAuth();
    // Optionally redirect to Azure AD logout
    // window.location.href = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/logout`;
  }

  /**
   * Get user info from token (if JWT)
   * @returns {Object|null} Decoded token payload
   */
  getUserInfo() {
    const token = this.getAccessToken();
    if (!token) return null;

    try {
      // JWT tokens have 3 parts separated by dots
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      // Decode the payload (second part)
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Get user email from token
   * @returns {string|null} User email
   */
  getUserEmail() {
    const userInfo = this.getUserInfo();
    return userInfo?.preferred_username || userInfo?.upn || userInfo?.email || null;
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
