/**
 * Omada API Configuration
 * Based on omada-mcp-server project structure
 */

import { authService } from './authService';

export const API_CONFIG = {
  // Set these in your .env file
  baseUrl: import.meta.env.VITE_OMADA_BASE_URL || '',

  endpoints: {
    // OData REST API
    odata: {
      dataObjects: '/OData/DataObjects',
      builtIn: '/OData/BuiltIn',
    },

    // GraphQL API - Different versions for different operations
    graphql: {
      v1_1: '/api/Domain/1.1',   // For mutations (createAccessRequest)
      v2_19: '/api/Domain/2.19', // Legacy version
      v3_0: '/api/Domain/3.0',   // Legacy version
      v3_2: '/api/Domain/3.2',   // Default version - supports resourceIds filter
      default: '/api/Domain/3.2' // Default GraphQL API version
    }
  },

  // Entity types for OData queries
  entityTypes: {
    IDENTITY: 'Identity',
    RESOURCE: 'Resource',
    ROLE: 'Role',
    ACCOUNT: 'Account',
    APPLICATION: 'Application',
    SYSTEM: 'System',
    CALCULATED_ASSIGNMENTS: 'CalculatedAssignments',
    ASSIGNMENT_POLICY: 'AssignmentPolicy',
  },

  // Identity Category Configuration
  // Maps category IDs to their display names
  identityCategories: [
    { id: 560, name: 'Employee', color: '#4CAF50' },
    { id: 561, name: 'Contractor', color: '#FF9800' },
    { id: 563, name: 'Other', color: '#2196F3' },
    { id: 1001, name: 'Technical', color: '#9C27B0' }
  ]
};

/**
 * Ensure we have a valid token, refreshing if necessary
 * @returns {Promise<string>} Valid bearer token
 * @throws {Error} If unable to get valid token
 */
export const ensureValidBearerToken = async () => {
  const token = await authService.ensureValidToken();

  if (!token) {
    throw new Error('Authentication required: Unable to obtain valid access token');
  }

  return token;
};

/**
 * Get standard headers for API requests with automatic token validation
 * @param {string|null} bearerToken - OAuth bearer token (if null, will auto-fetch)
 * @param {string|null} impersonateUser - User email for impersonation
 * @returns {Promise<Object>} Headers object
 */
export const getHeaders = async (bearerToken = null, impersonateUser = null) => {
  // If no token provided, ensure we have a valid one
  if (!bearerToken) {
    bearerToken = await ensureValidBearerToken();
  }

  // Check if token already has "Bearer " prefix
  const authHeader = bearerToken.startsWith('Bearer ')
    ? bearerToken
    : `Bearer ${bearerToken}`;

  const headers = {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  if (impersonateUser) {
    headers['X-Omada-Impersonation'] = impersonateUser;
  }

  return headers;
};

/**
 * Get standard headers for API requests (synchronous version for backward compatibility)
 * WARNING: This does not validate token expiry. Use getHeaders() for automatic token refresh.
 * @param {string} bearerToken - OAuth bearer token
 * @param {string|null} impersonateUser - User email for impersonation
 * @returns {Object} Headers object
 */
export const getHeadersSync = (bearerToken, impersonateUser = null) => {
  // Check if token already has "Bearer " prefix
  const authHeader = bearerToken.startsWith('Bearer ')
    ? bearerToken
    : `Bearer ${bearerToken}`;

  const headers = {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  if (impersonateUser) {
    headers['X-Omada-Impersonation'] = impersonateUser;
  }

  return headers;
};

/**
 * Get headers for GraphQL API requests with automatic token validation
 * Uses 'impersonate_user' header instead of 'X-Omada-Impersonation'
 * @param {string|null} bearerToken - OAuth bearer token (if null, will auto-fetch)
 * @param {string|null} impersonateUser - User email for impersonation
 * @returns {Promise<Object>} Headers object
 */
export const getGraphQLHeaders = async (bearerToken = null, impersonateUser = null) => {
  // If no token provided, ensure we have a valid one
  if (!bearerToken) {
    bearerToken = await ensureValidBearerToken();
  }

  // Check if token already has "Bearer " prefix
  const authHeader = bearerToken.startsWith('Bearer ')
    ? bearerToken
    : `Bearer ${bearerToken}`;

  const headers = {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  if (impersonateUser) {
    headers['impersonate_user'] = impersonateUser;
  }

  return headers;
};

/**
 * Handle API errors consistently
 * @param {Error} error - The error object
 * @param {string} context - Context description
 * @returns {Object} Standardized error response
 */
export const handleApiError = (error, context) => {
  console.error(`API Error in ${context}:`, error);

  return {
    status: 'error',
    error_type: error.name || 'UnknownError',
    message: error.message || 'An unknown error occurred',
    context,
    timestamp: new Date().toISOString()
  };
};
