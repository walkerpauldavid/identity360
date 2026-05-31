/**
 * OAuth2 Authentication Service with PKCE
 * Implements OAuth 2.0 Authorization Code Flow with PKCE for browser-based apps
 * Based on oauth_mcp_server logic adapted for React/browser environment
 */

/**
 * Pure JavaScript SHA-256 implementation for non-secure contexts (HTTP)
 * This is used as a fallback when crypto.subtle is not available
 */
const sha256Fallback = (message) => {
  // SHA-256 constants
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));

  // Convert string to UTF-8 byte array
  const encoder = new TextEncoder();
  const msgBytes = encoder.encode(message);
  const msgLength = msgBytes.length;

  // Pre-processing: adding padding bits
  const numBlocks = Math.ceil((msgLength + 9) / 64);
  const totalLength = numBlocks * 64;
  const paddedMsg = new Uint8Array(totalLength);
  paddedMsg.set(msgBytes);
  paddedMsg[msgLength] = 0x80;

  // Append length in bits as 64-bit big-endian
  const bitLength = msgLength * 8;
  const view = new DataView(paddedMsg.buffer);
  view.setUint32(totalLength - 4, bitLength, false);

  // Initialize hash values
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  // Process each 64-byte block
  for (let i = 0; i < numBlocks; i++) {
    const w = new Uint32Array(64);

    // Copy block into first 16 words
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i * 64 + j * 4, false);
    }

    // Extend the first 16 words into remaining 48 words
    for (let j = 16; j < 64; j++) {
      const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }

    // Initialize working variables
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    // Compression function main loop
    for (let j = 0; j < 64; j++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }

    // Add compressed chunk to current hash value
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  // Produce the final hash value (big-endian)
  const hash = new Uint8Array(32);
  const hashView = new DataView(hash.buffer);
  hashView.setUint32(0, h0, false); hashView.setUint32(4, h1, false);
  hashView.setUint32(8, h2, false); hashView.setUint32(12, h3, false);
  hashView.setUint32(16, h4, false); hashView.setUint32(20, h5, false);
  hashView.setUint32(24, h6, false); hashView.setUint32(28, h7, false);

  return hash.buffer;
};

/**
 * Check if crypto.subtle is available (requires secure context)
 */
const isCryptoSubtleAvailable = () => {
  return typeof crypto !== 'undefined' &&
         typeof crypto.subtle !== 'undefined' &&
         typeof crypto.subtle.digest === 'function';
};

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
 * Uses crypto.subtle when available (secure contexts), falls back to JS implementation
 * @param {string} plain - Plain text string
 * @returns {Promise<string>} Base64url encoded hash
 */
const sha256 = async (plain) => {
  let hash;

  if (isCryptoSubtleAvailable()) {
    // Use native crypto.subtle (fast, available in secure contexts)
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    hash = await crypto.subtle.digest('SHA-256', data);
  } else {
    // Fallback to pure JS implementation (works over HTTP)
    console.warn('crypto.subtle not available (non-secure context). Using JavaScript SHA-256 fallback.');
    hash = sha256Fallback(plain);
  }

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
    this.sessionKey = 'oauth_session_id';

    // Maximum age for tokens in milliseconds (24 hours)
    // Tokens older than this are considered stale even if JWT hasn't expired
    this.MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;

    // Buffer time for token expiry checks (5 minutes)
    this.TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

    // Refresh mutex — when a refresh is in flight, concurrent callers await the same promise
    this._refreshPromise = null;
  }

  /**
   * Generate a unique session ID for tracking login sessions
   * @returns {string} Unique session identifier
   */
  generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get the current session ID
   * @returns {string|null} Current session ID
   */
  getSessionId() {
    return localStorage.getItem(this.sessionKey);
  }

  /**
   * Initialize authentication on app startup
   * Validates existing tokens and clears any stale data
   * Call this method when the app loads to ensure clean auth state
   * @returns {boolean} True if valid authentication exists, false otherwise
   */
  initializeAuth() {
    console.log('=== Initializing Authentication ===');

    // Check for stale tokens and clear them
    if (this.isTokenStale()) {
      console.log('Stale token detected during initialization - clearing auth');
      this.clearAuth();
      return false;
    }

    // Validate current authentication
    const isValid = this.isAuthenticated();
    console.log('Authentication initialized, valid:', isValid);
    return isValid;
  }

  /**
   * Check if the stored token is stale
   * A token is considered stale if:
   * 1. It was stored more than MAX_TOKEN_AGE_MS ago
   * 2. The JWT is expired or expiring soon
   * 3. The session ID doesn't match (indicates different login session)
   * @returns {boolean} True if token is stale
   */
  isTokenStale() {
    const tokenData = this.getStoredToken();
    if (!tokenData || !tokenData.access_token) {
      return false; // No token to be stale
    }

    // Check 1: Token age based on stored_at timestamp
    if (tokenData.stored_at) {
      const storedTime = new Date(tokenData.stored_at).getTime();
      const age = Date.now() - storedTime;
      if (age > this.MAX_TOKEN_AGE_MS) {
        console.log(`Token is stale: age ${Math.round(age / 1000 / 60)} minutes exceeds max ${this.MAX_TOKEN_AGE_MS / 1000 / 60} minutes`);
        return true;
      }
    }

    // Check 2: JWT expiry
    if (this.isTokenExpired(tokenData.access_token)) {
      console.log('Token is stale: JWT is expired or expiring soon');
      return true;
    }

    // Check 3: Session ID validation (if session tracking is enabled)
    const currentSessionId = this.getSessionId();
    if (tokenData.session_id && currentSessionId && tokenData.session_id !== currentSessionId) {
      console.log('Token is stale: session ID mismatch (different login session)');
      return true;
    }

    return false;
  }

  /**
   * Check if user is authenticated
   * Validates token freshness, expiry, and session consistency
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

    // STALE TOKEN CHECK: Validate token is not stale before accepting it
    if (this.isTokenStale()) {
      console.log('Token is stale - clearing authentication');
      this.clearAuth();
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

    console.log('OAuth token is valid and not stale');
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
   * Checks for stale tokens before returning
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

    // STALE TOKEN CHECK: Reject stale tokens before proceeding
    if (this.isTokenStale()) {
      console.warn('Token is stale - clearing auth and requiring fresh login');
      this.clearAuth();
      return null;
    }

    // Check if refresh is needed
    if (this.needsRefresh()) {
      // Refresh mutex: if a refresh is already in flight, await it instead of starting another
      if (this._refreshPromise) {
        return this._refreshPromise;
      }

      this._refreshPromise = this._performRefresh();
      try {
        return await this._refreshPromise;
      } finally {
        this._refreshPromise = null;
      }
    }

    // Token is still valid
    return this.getAccessToken();
  }

  /**
   * Internal: perform the actual token refresh (called once via mutex)
   * @returns {Promise<string|null>} New access token or null
   */
  async _performRefresh() {
    const tokenData = this.getStoredToken();

    if (tokenData?.refresh_token) {
      try {
        console.log('Token expired or expiring soon, refreshing...');
        const newTokenData = await this.refreshToken(tokenData.refresh_token);
        this.storeToken(newTokenData);
        return newTokenData.access_token;
      } catch (error) {
        console.error('Token refresh failed:', error);
        this.clearAuth();
        return null;
      }
    } else {
      console.warn('Token expired but no refresh token available - please log in again');
      this.clearAuth();
      return null;
    }
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
   * Store token data with staleness tracking metadata
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

      // Add staleness tracking metadata
      tokenData.stored_at = new Date().toISOString();
      tokenData.session_id = this.getSessionId();

      localStorage.setItem(this.tokenKey, JSON.stringify(tokenData));
      console.log('Token stored with session:', tokenData.session_id, 'at:', tokenData.stored_at);
    } catch (error) {
      console.error('Error storing token:', error);
    }
  }

  /**
   * Clear authentication data including session tracking
   */
  clearAuth() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.stateKey);
    localStorage.removeItem(this.codeVerifierKey);
    localStorage.removeItem(this.sessionKey);
    localStorage.removeItem('bearer_token_override'); // Also clear override tokens
    console.log('Auth data cleared (including session and override tokens)');
  }

  /**
   * Initiate OAuth2 login with PKCE
   * Clears any existing stale tokens before starting fresh login
   */
  async login() {
    try {
      console.log('=== Starting OAuth2 Login Flow ===');

      // STALE TOKEN PREVENTION: Clear any existing auth data before new login
      // This prevents stale tokens from interfering with the new login session
      console.log('Clearing any existing auth data before new login...');
      this.clearAuth();

      // Generate a new session ID for this login attempt
      const newSessionId = this.generateSessionId();
      localStorage.setItem(this.sessionKey, newSessionId);
      console.log('New session ID:', newSessionId);

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
      // Always show the account picker so users don't get silently signed in
      // as whichever Microsoft account was most recently active in this browser.
      authUrl.searchParams.append('prompt', 'select_account');

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
   *
   * IMPORTANT: This redirects to Azure AD logout to fully end the session.
   * To revert to local-only logout (no Azure AD redirect), comment out the
   * window.location.href line and uncomment the "Local-only logout" section.
   */
  logout() {
    this.clearAuth();

    // === AZURE AD FULL LOGOUT (current) ===
    // Redirects to Azure AD to end the session, then returns to login page
    const postLogoutRedirectUri = encodeURIComponent(`${window.location.origin}/login`);
    window.location.href = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogoutRedirectUri}`;

    // === LOCAL-ONLY LOGOUT (previous behavior) ===
    // Uncomment below and comment out the Azure AD redirect above to revert
    // This only clears local tokens but keeps Azure AD session active (auto re-login)
    // return; // Just clear local auth, don't redirect to Azure AD
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
