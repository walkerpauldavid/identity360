/**
 * Omada API Service
 * Main service layer for interacting with Omada Identity Management API
 * Based on omada-mcp-server project
 */

import { API_CONFIG, getHeaders, getGraphQLHeaders, handleApiError } from './apiConfig';
import {
  buildODataQuery,
  buildODataFilter,
  GraphQLQueries,
  executeGraphQL
} from '../utils/queryBuilder';
import { apiLogger } from './apiLogger';
import { withApiCache, withCacheInvalidation } from './apiCache';

/**
 * H-04 Fix: AbortController Manager
 * Tracks active requests by key and allows cancellation of stale requests
 */
const activeRequests = new Map();

/**
 * Create an abort controller for a request, cancelling any existing request with the same key
 * @param {string} requestKey - Unique key for the request (e.g., 'searchIdentities:filters')
 * @returns {AbortController} New abort controller for this request
 */
export const createAbortController = (requestKey) => {
  // Cancel any existing request with this key
  if (activeRequests.has(requestKey)) {
    const existingController = activeRequests.get(requestKey);
    existingController.abort();
  }

  // Create new controller and store it
  const controller = new AbortController();
  activeRequests.set(requestKey, controller);

  return controller;
};

/**
 * Remove an abort controller from tracking (call after request completes)
 * @param {string} requestKey - Key of the completed request
 */
export const clearAbortController = (requestKey) => {
  activeRequests.delete(requestKey);
};

/**
 * Cancel all active requests (useful for component unmount)
 */
export const cancelAllRequests = () => {
  for (const controller of activeRequests.values()) {
    controller.abort();
  }
  activeRequests.clear();
};

/**
 * Cancel requests matching a prefix (e.g., 'identity:' cancels all identity requests)
 * @param {string} prefix - Prefix to match
 */
export const cancelRequestsByPrefix = (prefix) => {
  for (const [key, controller] of activeRequests.entries()) {
    if (key.startsWith(prefix)) {
      controller.abort();
      activeRequests.delete(key);
    }
  }
};

/**
 * Check if an error is an AbortError (request was cancelled)
 * @param {Error} error - Error to check
 * @returns {boolean} True if the error is due to request cancellation
 */
export const isAbortError = (error) => {
  return error?.name === 'AbortError' || error?.message?.includes('aborted');
};

/**
 * Identity API Methods
 */
export const identityApi = {
  /**
   * Search for identities using OData
   * @param {Object} filters - Filter criteria (EMAIL, FIRSTNAME, LASTNAME, etc.)
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email for impersonation
   * @param {Object} options - Additional query options (including optional 'signal' for AbortController)
   * @returns {Promise<Object>} Search results
   */
  searchIdentities: async (filters, bearerToken, impersonateUser, options = {}) => {
    let requestId;
    let url;
    // H-04 fix: Extract signal from options for request cancellation
    const { signal } = options;
    try {
      // Use defaults only if not explicitly provided (including null)
      const top = 'top' in options ? options.top : 50;
      const skip = 'skip' in options ? options.skip : 0;
      const select = 'select' in options ? options.select : 'EMAIL,FIRSTNAME,LASTNAME,DISPLAYNAME,IDENTITYID,EMPLOYEEID,JOBTITLE,OUREF,IDENTITYCATEGORY,IDENTITYSTATUS,RISKLEVEL,UId,Id';
      const orderBy = 'orderBy' in options ? options.orderBy : 'DISPLAYNAME';

      // Support passing a pre-built filter string directly via options.filter
      // Otherwise, build filter from the filters object
      let filterString;
      if (options.filter) {
        // Use pre-built filter string (for complex OR queries)
        filterString = options.filter;
      } else if (filters) {
        // Build filter from object
        filterString = buildODataFilter(filters);
      } else {
        filterString = '';
      }

      const queryOptions = {
        filter: filterString,
        count: true
      };

      // Only add parameters if they're not null
      if (select !== null) queryOptions.select = select;
      if (top !== null) queryOptions.top = top;
      if (skip !== null) queryOptions.skip = skip;
      if (orderBy !== null) queryOptions.orderBy = orderBy;

      url = buildODataQuery(API_CONFIG.baseUrl, API_CONFIG.entityTypes.IDENTITY, queryOptions);

      const requestHeaders = await getHeaders(bearerToken, impersonateUser);
      requestId = apiLogger.logRequest('OData', url, {
        method: 'GET',
        filters,
        top,
        skip,
        select,
        orderBy,
        count: true
      }, requestHeaders);

      // H-04 fix: Include signal for request cancellation
      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
        referrerPolicy: 'no-referrer',
        signal
      });

      const responseHeaders = Object.fromEntries(response.headers.entries());
      const statusCode = response.status;

      // Clone response to read raw text
      const responseClone = response.clone();
      const rawResponseText = await responseClone.text();

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${rawResponseText}`);
        apiLogger.logResponse(requestId, 'OData', url, null, false, error, responseHeaders, statusCode, rawResponseText);
        throw error;
      }

      const data = await response.json();

      const result = {
        status: 'success',
        data: data.value || [],
        total: data['@odata.count'] || data.value?.length || 0,
        endpoint: url
      };

      apiLogger.logResponse(requestId, 'OData', url, result, true, null, responseHeaders, statusCode, rawResponseText);

      return result;
    } catch (error) {
      // H-04 fix: Don't log abort errors as failures
      if (isAbortError(error)) {
        return { status: 'aborted', data: [], total: 0 };
      }
      // Log error response for network/CORS errors
      if (requestId) {
        apiLogger.logResponse(requestId, 'OData', url || 'searchIdentities', null, false, error, {}, null, null);
      }
      return handleApiError(error, 'searchIdentities');
    }
  },

  /**
   * Get identity by ID
   * @param {string} identityId - Identity ID (integer)
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @param {Object} options - Optional { signal } for AbortController
   * @returns {Promise<Object>} Identity details
   */
  getIdentityById: async (identityId, bearerToken, impersonateUser, options = {}) => {
    const { signal } = options;
    try {
      const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.odata.dataObjects}/Identity(${identityId})`;

      const requestHeaders = await getHeaders(bearerToken, impersonateUser);
      const requestId = apiLogger.logRequest('OData', url, { method: 'GET', identityId }, requestHeaders);

      // H-04 fix: Include signal for request cancellation
      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
        referrerPolicy: 'no-referrer',
        signal
      });

      const responseHeaders = Object.fromEntries(response.headers.entries());
      const statusCode = response.status;

      // Clone response to read raw text
      const responseClone = response.clone();
      const rawResponseText = await responseClone.text();

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${rawResponseText}`);
        apiLogger.logResponse(requestId, 'OData', url, null, false, error, responseHeaders, statusCode, rawResponseText);
        throw error;
      }

      const data = await response.json();

      const result = {
        status: 'success',
        data
      };

      apiLogger.logResponse(requestId, 'OData', url, result, true, null, responseHeaders, statusCode, rawResponseText);

      return result;
    } catch (error) {
      // H-04 fix: Handle abort errors gracefully
      if (isAbortError(error)) {
        return { status: 'aborted', data: null };
      }
      return handleApiError(error, 'getIdentityById');
    }
  },

  /**
   * Get identity count by category ID (efficient - uses OData $count without fetching data)
   * @param {number} categoryId - Category ID (e.g., 561)
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @param {Object} options - Optional { signal } for AbortController
   * @returns {Promise<Object>} Count result
   */
  getIdentityCountByCategoryId: async (categoryId, bearerToken, impersonateUser, options = {}) => {
    const { signal } = options;
    let requestId;
    let url;
    try {
      // Build filter for category ID - use the syntax that works
      const filterString = `IDENTITYCATEGORY/Id eq ${categoryId}`;

      const queryOptions = {
        filter: filterString,
        count: true,
        top: 0 // Don't fetch any records, just get the count
      };

      url = buildODataQuery(API_CONFIG.baseUrl, API_CONFIG.entityTypes.IDENTITY, queryOptions);

      const requestHeaders = await getHeaders(bearerToken, impersonateUser);
      requestId = apiLogger.logRequest('OData', url, {
        method: 'GET',
        categoryId,
        countOnly: true
      }, requestHeaders);

      // H-04 fix: Include signal for request cancellation
      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
        referrerPolicy: 'no-referrer',
        signal
      });

      const responseHeaders = Object.fromEntries(response.headers.entries());
      const statusCode = response.status;

      // Clone response to read raw text
      const responseClone = response.clone();
      const rawResponseText = await responseClone.text();

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${rawResponseText}`);
        apiLogger.logResponse(requestId, 'OData', url, null, false, error, responseHeaders, statusCode, rawResponseText);
        throw error;
      }

      const data = await response.json();

      const result = {
        status: 'success',
        categoryId,
        count: data['@odata.count'] || 0,
        endpoint: url
      };

      apiLogger.logResponse(requestId, 'OData', url, result, true, null, responseHeaders, statusCode, rawResponseText);

      return result;
    } catch (error) {
      // H-04 fix: Handle abort errors gracefully
      if (isAbortError(error)) {
        return { status: 'aborted', categoryId, count: 0 };
      }
      if (requestId) {
        apiLogger.logResponse(requestId, 'OData', url || 'getIdentityCountByCategoryId', null, false, error, {}, null, null);
      }
      return handleApiError(error, 'getIdentityCountByCategoryId');
    }
  },

  /**
   * Get all identity category counts efficiently
   * Uses configured category IDs to get counts via OData
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @returns {Promise<Object>} Object with category details and counts
   */
  getIdentityCategoryCounts: async (bearerToken, impersonateUser) => {
    try {
      // Use configured categories
      const categories = API_CONFIG.identityCategories;

      // Get counts for each category ID in parallel
      const countPromises = categories.map(cat =>
        identityApi.getIdentityCountByCategoryId(cat.id, bearerToken, impersonateUser)
          .then(result => ({
            ...cat,
            count: result.status === 'success' ? result.count : 0
          }))
      );

      const categoriesWithCounts = await Promise.all(countPromises);

      // Calculate total
      const total = categoriesWithCounts.reduce((sum, cat) => sum + cat.count, 0);

      return {
        status: 'success',
        categories: categoriesWithCounts,
        total
      };
    } catch (error) {
      return handleApiError(error, 'getIdentityCategoryCounts');
    }
  },

  /**
   * Get identities by category ID
   * @param {number} categoryId - Category ID
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @param {Object} options - Additional query options (including optional 'signal' for AbortController)
   * @returns {Promise<Object>} Identities in category
   */
  getIdentitiesByCategoryId: async (categoryId, bearerToken, impersonateUser, options = {}) => {
    // H-04 fix: Extract signal from options for request cancellation
    const { signal } = options;
    let requestId;
    let url;
    try {
      const top = options.top || 1000;
      const skip = options.skip || 0;
      const select = options.select || 'EMAIL,FIRSTNAME,LASTNAME,DISPLAYNAME,IDENTITYID,EMPLOYEEID,JOBTITLE,OUREF,IDENTITYCATEGORY,IDENTITYSTATUS,RISKLEVEL,UId,Id';
      const orderBy = options.orderBy || 'DISPLAYNAME';

      const queryOptions = {
        filter: `IDENTITYCATEGORY/Id eq ${categoryId}`,
        select,
        top,
        skip,
        orderBy,
        count: true
      };

      url = buildODataQuery(API_CONFIG.baseUrl, API_CONFIG.entityTypes.IDENTITY, queryOptions);

      const requestHeaders = await getHeaders(bearerToken, impersonateUser);
      requestId = apiLogger.logRequest('OData', url, {
        method: 'GET',
        categoryId,
        top,
        skip
      }, requestHeaders);

      // H-04 fix: Include signal for request cancellation
      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
        referrerPolicy: 'no-referrer',
        signal
      });

      const responseHeaders = Object.fromEntries(response.headers.entries());
      const statusCode = response.status;

      // Clone response to read raw text
      const responseClone = response.clone();
      const rawResponseText = await responseClone.text();

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${rawResponseText}`);
        apiLogger.logResponse(requestId, 'OData', url, null, false, error, responseHeaders, statusCode, rawResponseText);
        throw error;
      }

      const data = await response.json();

      const result = {
        status: 'success',
        data: data.value || [],
        total: data['@odata.count'] || data.value?.length || 0,
        endpoint: url
      };

      apiLogger.logResponse(requestId, 'OData', url, result, true, null, responseHeaders, statusCode, rawResponseText);

      return result;
    } catch (error) {
      // H-04 fix: Handle abort errors gracefully
      if (isAbortError(error)) {
        return { status: 'aborted', data: [], total: 0 };
      }
      if (requestId) {
        apiLogger.logResponse(requestId, 'OData', url || 'getIdentitiesByCategoryId', null, false, error, {}, null, null);
      }
      return handleApiError(error, 'getIdentitiesByCategoryId');
    }
  },

  /**
   * Get contexts for identity (needed for access requests)
   * @param {string} identityUId - Identity UId (32-char GUID, not integer Id!)
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @param {Object} options - Optional { signal } for AbortController
   * @returns {Promise<Object>} Identity contexts
   */
  getIdentityContexts: async (identityUId, bearerToken, impersonateUser, options = {}) => {
    const { signal } = options;
    let requestId;
    let endpoint;
    try {
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_2}`;
      const queryObject = GraphQLQueries.getContextsForIdentity(identityUId);
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getIdentityContexts',
        identityUId,
        graphqlQuery: queryObject.query,
        variables: queryObject.variables || {}
      }, requestHeaders);

      // H-04 fix: Pass signal for request cancellation
      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders,
        { signal }
      );

      // Handle both standard GraphQL response { data: { ... } } and direct response
      const graphqlData = result.data?.data || result.data;
      const contexts = graphqlData?.accessRequestComponents?.contexts || [];

      console.log('getIdentityContexts raw result:', result.data);
      console.log('getIdentityContexts contexts:', contexts);

      const response = {
        status: 'success',
        data: contexts,
        contexts_count: contexts.length
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      return response;
    } catch (error) {
      // H-04 fix: Handle abort errors gracefully
      if (isAbortError(error)) {
        return { status: 'aborted', data: [], contexts_count: 0 };
      }
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      // Log the error response
      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'getIdentityContexts');
    }
  }
};

/**
 * Access Request API Methods
 */
export const accessRequestApi = {
  /**
   * Get access requests total count (summary only)
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @returns {Promise<Object>} Access requests total
   */
  getAccessRequestsTotal: async (bearerToken, impersonateUser) => {
    let requestId;
    let endpoint;
    try {
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_2}`;
      const queryObject = GraphQLQueries.getAccessRequestsTotal();
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getAccessRequestsTotal',
        graphqlQuery: queryObject.query,
        variables: queryObject.variables || {}
      }, requestHeaders);

      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders
      );

      // Handle both standard GraphQL response { data: { ... } } and direct response
      const graphqlData = result.data?.data || result.data;
      const total = graphqlData?.accessRequests?.total || 0;
      const pages = graphqlData?.accessRequests?.pages || 0;

      const response = {
        status: 'success',
        total,
        pages
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      return response;
    } catch (error) {
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'getAccessRequestsTotal');
    }
  },

  /**
   * Get all access requests
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @returns {Promise<Object>} Access requests
   */
  getAccessRequests: async (bearerToken, impersonateUser) => {
    let requestId;
    let endpoint;
    try {
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_2}`;
      const queryObject = GraphQLQueries.getAccessRequests();
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getAccessRequests',
        graphqlQuery: queryObject.query,
        variables: queryObject.variables || {}
      }, requestHeaders);

      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders
      );

      // Handle both standard GraphQL response { data: { ... } } and direct response
      const graphqlData = result.data?.data || result.data;
      const requests = graphqlData?.accessRequests?.data || [];
      const total = graphqlData?.accessRequests?.total || 0;
      const pages = graphqlData?.accessRequests?.pages || 0;

      const response = {
        status: 'success',
        data: requests,
        total,
        pages
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      return response;
    } catch (error) {
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'getAccessRequests');
    }
  },

  /**
   * Get access requests filtered by resource name
   * Used for Entitlement-centric view to show access requests for a resource
   * @param {string} resourceName - Resource name to filter by
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Access requests for the resource
   */
  getAccessRequestsForResource: async (resourceName, bearerToken, impersonateUser, pagination = {}) => {
    let requestId;
    let endpoint;
    try {
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_2}`;
      const queryObject = GraphQLQueries.getAccessRequestsForResource(resourceName, pagination);
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getAccessRequestsForResource',
        resourceName,
        pagination,
        graphqlQuery: queryObject.query,
        variables: queryObject.variables || {}
      }, requestHeaders);

      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders
      );

      const graphqlData = result.data?.data || result.data;
      const requests = graphqlData?.accessRequests?.data || [];
      const total = graphqlData?.accessRequests?.total || 0;
      const pages = graphqlData?.accessRequests?.pages || 0;

      const response = {
        status: 'success',
        data: requests,
        total,
        pages
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      return response;
    } catch (error) {
      if (isAbortError(error)) {
        return { status: 'aborted', data: [], total: 0, pages: 0 };
      }
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'getAccessRequestsForResource');
    }
  },

  /**
   * Get access requests filtered by system name
   * Used for System-centric view to show access requests for all resources in a system
   * @param {string} systemName - System name to filter by
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Access requests for the system
   */
  getAccessRequestsForSystem: async (systemName, bearerToken, impersonateUser, pagination = {}) => {
    let requestId;
    let endpoint;
    try {
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_2}`;
      const queryObject = GraphQLQueries.getAccessRequestsForSystem(systemName, pagination);
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getAccessRequestsForSystem',
        systemName,
        pagination,
        graphqlQuery: queryObject.query,
        variables: queryObject.variables || {}
      }, requestHeaders);

      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders
      );

      const graphqlData = result.data?.data || result.data;
      const requests = graphqlData?.accessRequests?.data || [];
      const total = graphqlData?.accessRequests?.total || 0;
      const pages = graphqlData?.accessRequests?.pages || 0;

      const response = {
        status: 'success',
        data: requests,
        total,
        pages
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      return response;
    } catch (error) {
      if (isAbortError(error)) {
        return { status: 'aborted', data: [], total: 0, pages: 0 };
      }
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'getAccessRequestsForSystem');
    }
  },

  /**
   * Get pending approvals filtered by resource name
   * Used for Entitlement-centric view to show pending approval questions for a resource
   * @param {string} resourceName - Resource name to filter by
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Pending approvals for the resource
   */
  getApprovalsForResource: async (resourceName, bearerToken, impersonateUser, pagination = {}) => {
    let requestId;
    let endpoint;
    try {
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_2}`;
      const queryObject = GraphQLQueries.getApprovalsForResource(resourceName, pagination);
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getApprovalsForResource',
        resourceName,
        pagination,
        graphqlQuery: queryObject.query,
        variables: queryObject.variables || {}
      }, requestHeaders);

      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders
      );

      const graphqlData = result.data?.data || result.data;
      const approvals = graphqlData?.accessRequestApprovalSurveyQuestions?.data || [];
      const total = graphqlData?.accessRequestApprovalSurveyQuestions?.total || 0;
      const pages = graphqlData?.accessRequestApprovalSurveyQuestions?.pages || 0;

      const response = {
        status: 'success',
        data: approvals,
        total,
        pages
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      return response;
    } catch (error) {
      if (isAbortError(error)) {
        return { status: 'aborted', data: [], total: 0, pages: 0 };
      }
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'getApprovalsForResource');
    }
  },

  /**
   * Get approval workflow status for a specific survey object
   * Returns assignee names and approval status
   * @param {string} surveyObjectId - The surveyObjectKey from an approval item
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @returns {Promise<Object>} Workflow status with assignees
   */
  getApprovalWorkflowStatus: async (surveyObjectId, bearerToken, impersonateUser) => {
    let requestId;
    let endpoint;
    try {
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_2}`;
      const queryObject = GraphQLQueries.getApprovalWorkflowStatus(surveyObjectId);
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getApprovalWorkflowStatus',
        surveyObjectId,
        graphqlQuery: queryObject.query,
        variables: queryObject.variables || {}
      }, requestHeaders);

      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders
      );

      const graphqlData = result.data?.data || result.data;
      const workflowStatuses = graphqlData?.accessApprovalWorkflowStatus || [];

      const response = {
        status: 'success',
        data: workflowStatuses
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      return response;
    } catch (error) {
      if (isAbortError(error)) {
        return { status: 'aborted', data: [] };
      }
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'getApprovalWorkflowStatus');
    }
  },

  /**
   * Get resources available for beneficiary
   * @param {string} identityUId - Identity UId (32-char GUID)
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @param {Object} filters - Optional filters (systemId, contextId, name)
   * @returns {Promise<Object>} Available resources
   */
  getResourcesForBeneficiary: async (identityUId, bearerToken, impersonateUser, filters = {}) => {
    let requestId;
    let endpoint;
    try {
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_2}`;
      const queryObject = GraphQLQueries.getResourcesForBeneficiary(identityUId, filters);
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getResourcesForBeneficiary',
        identityUId,
        filters,
        graphqlQuery: queryObject.query,
        variables: queryObject.variables || {}
      }, requestHeaders);

      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders
      );

      const resources = result.data?.accessRequestComponents?.resources?.data || [];

      const response = {
        status: 'success',
        data: resources,
        beneficiary_id: identityUId,
        resources_count: resources.length
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      return response;
    } catch (error) {
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'getResourcesForBeneficiary');
    }
  },

  /**
   * Create access request
   * @param {Object} requestData - Request data
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @returns {Promise<Object>} Created request
   */
  createAccessRequest: async (requestData, bearerToken, impersonateUser) => {
    let requestId;
    let endpoint;
    try {
      const {
        identityUId,
        resourceId,
        contextId,
        reason,
        validFrom,
        validTo
      } = requestData;

      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v1_1}`;
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      // Validation
      if (!identityUId || !resourceId || !contextId || !reason) {
        const error = new Error('Missing required fields: identityUId, resourceId, contextId, reason');
        throw error;
      }

      const queryObject = GraphQLQueries.createAccessRequest(
        identityUId,
        resourceId,
        contextId,
        reason,
        validFrom,
        validTo
      );

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'createAccessRequest',
        requestData,
        graphqlQuery: queryObject.query,
        variables: queryObject.variables || {}
      }, requestHeaders);

      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders
      );

      const requestDetails = result.data?.createAccessRequest;

      const response = {
        status: 'success',
        data: requestDetails,
        access_request_id: requestDetails?.id
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      return response;
    } catch (error) {
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'createAccessRequest');
    }
  }
};

/**
 * Approval API Methods
 */
export const approvalApi = {
  /**
   * Get pending approvals
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @param {string} workflowStep - Optional workflow step filter
   * @param {boolean} summaryMode - Include survey IDs (default: true)
   * @returns {Promise<Object>} Pending approvals
   */
  getPendingApprovals: async (bearerToken, impersonateUser, workflowStep = null, summaryMode = true) => {
    let requestId;
    let endpoint;
    try {
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_2}`;
      const queryObject = GraphQLQueries.getPendingApprovals(workflowStep, summaryMode);
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getPendingApprovals',
        workflowStep,
        summaryMode,
        graphqlQuery: queryObject.query,
        variables: queryObject.variables || {}
      }, requestHeaders);

      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders
      );

      const approvals = result.data?.accessRequestApprovalSurveyQuestions?.data || [];
      const total = result.data?.accessRequestApprovalSurveyQuestions?.total || 0;

      const response = {
        status: 'success',
        data: approvals,
        total_approvals: total
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      return response;
    } catch (error) {
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'getPendingApprovals');
    }
  },

  /**
   * Make approval decision
   * @param {string} surveyId - Survey GUID
   * @param {string} surveyObjectKey - Survey object GUID
   * @param {string} decision - "APPROVE" or "REJECT"
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @returns {Promise<Object>} Decision result
   */
  makeApprovalDecision: async (surveyId, surveyObjectKey, decision, bearerToken, impersonateUser) => {
    let requestId;
    let endpoint;
    try {
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_2}`;
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      if (!['APPROVE', 'REJECT'].includes(decision)) {
        const error = new Error('Decision must be "APPROVE" or "REJECT"');
        throw error;
      }

      const queryObject = GraphQLQueries.makeApprovalDecision(surveyId, surveyObjectKey, decision);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'makeApprovalDecision',
        surveyId,
        surveyObjectKey,
        decision,
        graphqlQuery: queryObject.query,
        variables: queryObject.variables || {}
      }, requestHeaders);

      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders
      );

      const success = result.data?.submitRequestQuestions?.questionsSuccessfullySubmitted || false;

      const response = {
        status: success ? 'success' : 'error',
        data: { questions_successfully_submitted: success },
        decision
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      return response;
    } catch (error) {
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'makeApprovalDecision');
    }
  }
};

/**
 * Assignment API Methods
 */
export const assignmentApi = {
  /**
   * Get calculated assignments (detailed with compliance)
   * @param {string|Array} identityUIds - Identity UId(s) (32-char GUID)
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @param {Object} filters - Optional filters
   * @param {Object} pagination - Pagination options (including optional 'signal' for AbortController)
   * @returns {Promise<Object>} Assignments
   */
  getCalculatedAssignmentsDetailed: async (
    identityUIds,
    bearerToken,
    impersonateUser,
    filters = {},
    pagination = {}
  ) => {
    // H-04 fix: Extract signal from pagination options
    const { signal, ...paginationParams } = pagination;
    let requestId;
    let endpoint;
    try {
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_2}`;
      const queryObject = GraphQLQueries.getCalculatedAssignmentsDetailed(
        identityUIds,
        filters,
        paginationParams
      );
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getCalculatedAssignmentsDetailed',
        identityUIds,
        filters,
        pagination: paginationParams,
        graphqlQuery: queryObject.query,
        variables: queryObject.variables || {}
      }, requestHeaders);

      // H-04 fix: Pass signal for request cancellation
      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders,
        { signal }
      );

      // Handle both standard GraphQL response { data: { ... } } and direct response
      const graphqlData = result.data?.data || result.data;
      const assignments = graphqlData?.calculatedAssignments?.data || [];
      const total = graphqlData?.calculatedAssignments?.total || 0;
      const pages = graphqlData?.calculatedAssignments?.pages || 0;

      const response = {
        status: 'success',
        data: assignments,
        total,
        pages,
        current_page: pagination.page || 1,
        rows_per_page: pagination.rows || 50
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      return response;
    } catch (error) {
      // H-04 fix: Handle abort errors gracefully
      if (isAbortError(error)) {
        return { status: 'aborted', data: [], total: 0, pages: 0 };
      }
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'getCalculatedAssignmentsDetailed');
    }
  },

  /**
   * Get identities that have a specific resource (entitlement) assigned
   * Used for entitlement-centric view in Identity360
   * @param {string} resourceId - Resource UUID (required)
   * @param {string} resourceName - Resource name (optional, not used in query)
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @param {Object} pagination - Pagination options (including optional 'signal' for AbortController)
   * @param {string} systemId - Optional system ID filter
   * @param {string} complianceStatus - Optional compliance status filter (e.g., 'Not Approved', 'Approved')
   * @param {boolean} includeDisabled - Include disabled assignments (default: true)
   * @returns {Promise<Object>} Identities with this resource
   */
  getIdentitiesHavingResource: async (
    resourceId,
    resourceName,
    bearerToken,
    impersonateUser,
    pagination = {},
    systemId = null,
    complianceStatus = null,
    includeDisabled = true
  ) => {
    // H-04 fix: Extract signal from pagination options
    const { signal, ...paginationParams } = pagination;
    let requestId;
    let endpoint;
    try {
      // Use GraphQL v3.2 which supports the resourceIds filter
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_2}`;
      const queryObject = GraphQLQueries.getIdentitiesHavingResource(
        resourceId,
        resourceName,
        systemId,
        paginationParams,
        complianceStatus,
        includeDisabled
      );
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getIdentitiesHavingResource',
        resourceId,
        resourceName,
        pagination: paginationParams,
        complianceStatus,
        graphqlQuery: queryObject.query
      }, requestHeaders);

      // H-04 fix: Pass signal for request cancellation
      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders,
        { signal }
      );

      // Handle both standard GraphQL response { data: { ... } } and direct response
      const graphqlData = result.data?.data || result.data;
      const assignments = graphqlData?.calculatedAssignments?.data || [];
      const total = graphqlData?.calculatedAssignments?.total || 0;
      const pages = graphqlData?.calculatedAssignments?.pages || 0;

      const response = {
        status: 'success',
        data: assignments,
        total,
        pages,
        current_page: pagination.page || 1,
        rows_per_page: pagination.rows || 100
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      return response;
    } catch (error) {
      // H-04 fix: Handle abort errors gracefully
      if (isAbortError(error)) {
        return { status: 'aborted', data: [], total: 0, pages: 0 };
      }
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'getIdentitiesHavingResource');
    }
  },

  /**
   * Get child resources for identities using reasonType: CHILD_RESOURCE filter
   * Used when Entitlement is focus node to find child resources via identity assignments
   * @param {string[]} identityIds - Array of identity UUIDs to query
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email for impersonation
   * @param {Object} pagination - Pagination options { page, rows, signal }
   * @param {boolean} includeDisabled - Include disabled assignments (default: true)
   * @returns {Promise<Object>} Child resource assignments for the specified identities
   */
  getChildResourcesForIdentities: async (
    identityIds,
    bearerToken,
    impersonateUser,
    pagination = {},
    includeDisabled = true
  ) => {
    console.log('[DEBUG:API:getChildResourcesForIdentities] === API METHOD CALLED ===');
    console.log('[DEBUG:API:getChildResourcesForIdentities] identityIds count:', identityIds?.length);
    console.log('[DEBUG:API:getChildResourcesForIdentities] identityIds (first 3):', identityIds?.slice(0, 3));
    console.log('[DEBUG:API:getChildResourcesForIdentities] bearerToken available:', !!bearerToken);
    console.log('[DEBUG:API:getChildResourcesForIdentities] impersonateUser:', impersonateUser);

    // H-04 fix: Extract signal from pagination options
    const { signal, ...paginationParams } = pagination;
    let requestId;
    let endpoint;
    try {
      // Use GraphQL v3.2 which supports the reasonType filter
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_2}`;
      console.log('[DEBUG:API:getChildResourcesForIdentities] Endpoint:', endpoint);

      const queryObject = GraphQLQueries.getChildResourcesForIdentities(
        identityIds,
        paginationParams,
        includeDisabled
      );
      console.log('[DEBUG:API:getChildResourcesForIdentities] Query built successfully');
      console.log('[DEBUG:API:getChildResourcesForIdentities] Query:', queryObject.query.substring(0, 200) + '...');
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getChildResourcesForIdentities',
        identityIds,
        identityCount: identityIds.length,
        pagination: paginationParams,
        includeDisabled,
        graphqlQuery: queryObject.query
      }, requestHeaders);

      // H-04 fix: Pass signal for request cancellation
      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders,
        { signal }
      );

      console.log('[DEBUG:API:getChildResourcesForIdentities] GraphQL call completed');
      console.log('[DEBUG:API:getChildResourcesForIdentities] Raw result keys:', Object.keys(result));

      // Handle both standard GraphQL response { data: { ... } } and direct response
      const graphqlData = result.data?.data || result.data;
      console.log('[DEBUG:API:getChildResourcesForIdentities] graphqlData keys:', graphqlData ? Object.keys(graphqlData) : 'null');

      const assignments = graphqlData?.calculatedAssignments?.data || [];
      const total = graphqlData?.calculatedAssignments?.total || 0;
      const pages = graphqlData?.calculatedAssignments?.pages || 0;

      console.log('[DEBUG:API:getChildResourcesForIdentities] Parsed results: assignments=', assignments.length, 'total=', total, 'pages=', pages);

      if (assignments.length > 0) {
        console.log('[DEBUG:API:getChildResourcesForIdentities] First assignment:', JSON.stringify(assignments[0], null, 2).substring(0, 500));
      }

      const response = {
        status: 'success',
        data: assignments,
        total,
        pages,
        current_page: pagination.page || 1,
        rows_per_page: pagination.rows || 500
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      console.log('[DEBUG:API:getChildResourcesForIdentities] Returning response with', response.data.length, 'assignments');
      return response;
    } catch (error) {
      console.error('[DEBUG:API:getChildResourcesForIdentities] ERROR:', error.message);
      console.error('[DEBUG:API:getChildResourcesForIdentities] Error details:', error);

      // H-04 fix: Handle abort errors gracefully
      if (isAbortError(error)) {
        return { status: 'aborted', data: [], total: 0, pages: 0 };
      }
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'getChildResourcesForIdentities');
    }
  },

  /**
   * Get system compliance health data from the Compliance Workbench
   * Returns per-system compliance status counts and system health in a single call.
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @param {Object} filters - Optional filters (e.g., { showAccounts: true })
   * @param {Object} options - Optional settings including { signal } for AbortController
   * @returns {Promise<Object>} System compliance data
   */
  getComplianceWorkbenchData: async (bearerToken, impersonateUser, filters = {}, options = {}) => {
    const { signal } = options;
    let requestId;
    let endpoint;
    try {
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_2}`;
      const queryObject = GraphQLQueries.getComplianceWorkbenchData(filters);
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getComplianceWorkbenchData',
        filters,
        graphqlQuery: queryObject.query
      }, requestHeaders);

      const result = await executeGraphQL(
        endpoint,
        queryObject,
        requestHeaders,
        { signal }
      );

      const graphqlData = result.data?.data || result.data;
      const workbenchData = graphqlData?.complianceWorkbenchData || [];

      const response = {
        status: 'success',
        data: workbenchData
      };

      apiLogger.logResponse(requestId, 'GraphQL', endpoint, response, true, null, result.headers, result.status, result.rawResponse);

      return response;
    } catch (error) {
      if (isAbortError(error)) {
        return { status: 'aborted', data: [] };
      }
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'getComplianceWorkbenchData');
    }
  }
};

/**
 * Assignment Policy API Methods
 * For working with Omada Assignment Policies (automatic entitlement/account assignment rules)
 *
 * Assignment Policies automatically assign entitlements and accounts to identities based on contexts.
 * Key fields:
 * - DISPLAYNAME: Policy display name
 * - DESCRIPTION: Policy description
 * - AP_CONTEXTS: Array of contexts that trigger this policy (identities in these contexts get the policy's resources)
 * - AP_RESOURCES: Array of resources (entitlements) assigned by this policy
 * - AP_ACCOUNTRESOURCES: Array of account resources assigned by this policy
 * - ISACTIVE: Whether the policy is currently active
 * - VALIDFROM, VALIDTO: Policy validity period
 */
export const assignmentPolicyApi = {
  /**
   * Get all assignment policies
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email for impersonation
   * @param {Object} options - Query options (filter, select, top, skip, orderBy, signal)
   * @returns {Promise<Object>} Assignment policies list
   */
  getAssignmentPolicies: async (bearerToken, impersonateUser, options = {}) => {
    // H-04 fix: Extract signal from options
    const { signal, filter, top = 100, skip, orderBy = 'DISPLAYNAME' } = options;
    let requestId;
    let url;
    try {
      // Build the OData URL for Assignmentpolicy entity
      url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.odata.dataObjects}/Assignmentpolicy`;

      // Build query parameters
      const params = new URLSearchParams();
      if (filter) params.append('$filter', filter);
      if (top !== undefined) params.append('$top', top);
      if (skip !== undefined) params.append('$skip', skip);
      if (orderBy) params.append('$orderby', orderBy);
      params.append('$count', 'true');

      const queryString = params.toString();
      if (queryString) {
        url = `${url}?${queryString}`;
      }

      const requestHeaders = await getHeaders(bearerToken, impersonateUser);
      requestId = apiLogger.logRequest('OData', url, {
        method: 'GET',
        entityType: 'Assignmentpolicy',
        filter, top, skip, orderBy
      }, requestHeaders);

      // H-04 fix: Include signal for request cancellation
      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
        signal
      });

      const responseHeaders = Object.fromEntries(response.headers.entries());
      const statusCode = response.status;
      const rawResponseText = await response.clone().text();

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${rawResponseText}`);
        apiLogger.logResponse(requestId, 'OData', url, null, false, error, responseHeaders, statusCode, rawResponseText);
        throw error;
      }

      const data = JSON.parse(rawResponseText);

      const result = {
        status: 'success',
        data: data.value || [],
        total: data['@odata.count'] || data.value?.length || 0,
        endpoint: url
      };

      apiLogger.logResponse(requestId, 'OData', url, result, true, null, responseHeaders, statusCode, rawResponseText);

      return result;
    } catch (error) {
      // H-04 fix: Handle abort errors gracefully
      if (isAbortError(error)) {
        return { status: 'aborted', data: [], total: 0 };
      }
      if (requestId) {
        apiLogger.logResponse(requestId, 'OData', url || 'getAssignmentPolicies', null, false, error, {}, null, null);
      }
      return handleApiError(error, 'assignmentPolicy.getAssignmentPolicies');
    }
  },

  /**
   * Get assignment policy by ID
   * @param {string} policyId - Policy ID (integer or UId)
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email for impersonation
   * @param {Object} options - Optional { signal } for AbortController
   * @returns {Promise<Object>} Assignment policy details with contexts and resources
   */
  getAssignmentPolicyById: async (policyId, bearerToken, impersonateUser, options = {}) => {
    const { signal } = options;
    let requestId;
    let url;
    try {
      // Check if policyId is a UUID or integer
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(policyId);

      if (isUuid) {
        // Use filter for UUID
        url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.odata.dataObjects}/Assignmentpolicy?$filter=UId eq ${policyId}`;
      } else {
        // Use direct ID access for integer
        url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.odata.dataObjects}/Assignmentpolicy(${policyId})`;
      }

      const requestHeaders = await getHeaders(bearerToken, impersonateUser);
      requestId = apiLogger.logRequest('OData', url, {
        method: 'GET',
        policyId
      }, requestHeaders);

      // H-04 fix: Include signal for request cancellation
      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
        signal
      });

      const responseHeaders = Object.fromEntries(response.headers.entries());
      const statusCode = response.status;
      const rawResponseText = await response.clone().text();

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${rawResponseText}`);
        apiLogger.logResponse(requestId, 'OData', url, null, false, error, responseHeaders, statusCode, rawResponseText);
        throw error;
      }

      const data = JSON.parse(rawResponseText);

      // Handle both single object and array response
      const policyData = isUuid
        ? (data.value?.[0] || null)
        : data;

      const result = {
        status: 'success',
        data: policyData,
        endpoint: url
      };

      apiLogger.logResponse(requestId, 'OData', url, result, true, null, responseHeaders, statusCode, rawResponseText);

      return result;
    } catch (error) {
      // H-04 fix: Handle abort errors gracefully
      if (isAbortError(error)) {
        return { status: 'aborted', data: null };
      }
      if (requestId) {
        apiLogger.logResponse(requestId, 'OData', url || 'getAssignmentPolicyById', null, false, error, {}, null, null);
      }
      return handleApiError(error, 'assignmentPolicy.getAssignmentPolicyById');
    }
  },

  /**
   * Get assignment policies by context
   * Finds all policies that are triggered by a specific context
   * @param {string} contextId - Context ID (UId)
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email for impersonation
   * @param {Object} options - Optional { signal } for AbortController
   * @returns {Promise<Object>} Assignment policies linked to this context
   */
  getAssignmentPoliciesByContext: async (contextId, bearerToken, impersonateUser, options = {}) => {
    const { signal } = options;
    let requestId;
    let url;
    try {
      // Query policies where AP_CONTEXTS contains the given context ID
      // Note: OData array filtering may require specific syntax depending on Omada's implementation
      url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.odata.dataObjects}/Assignmentpolicy`;
      // We'll fetch all and filter client-side, as OData array filtering can be complex
      const params = new URLSearchParams();
      params.append('$count', 'true');

      url = `${url}?${params.toString()}`;

      const requestHeaders = await getHeaders(bearerToken, impersonateUser);
      requestId = apiLogger.logRequest('OData', url, {
        method: 'GET',
        contextId
      }, requestHeaders);

      // H-04 fix: Include signal for request cancellation
      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
        signal
      });

      const responseHeaders = Object.fromEntries(response.headers.entries());
      const statusCode = response.status;
      const rawResponseText = await response.clone().text();

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${rawResponseText}`);
        apiLogger.logResponse(requestId, 'OData', url, null, false, error, responseHeaders, statusCode, rawResponseText);
        throw error;
      }

      const data = JSON.parse(rawResponseText);
      const allPolicies = data.value || [];

      // Filter client-side to find policies with matching context
      const filteredPolicies = allPolicies.filter(policy => {
        const contexts = policy.AP_CONTEXTS || [];
        return contexts.some(ctx =>
          ctx.UId === contextId ||
          String(ctx.Id) === String(contextId)
        );
      });

      const result = {
        status: 'success',
        data: filteredPolicies,
        total: filteredPolicies.length,
        endpoint: url,
        filteredBy: { contextId }
      };

      apiLogger.logResponse(requestId, 'OData', url, result, true, null, responseHeaders, statusCode, rawResponseText);

      return result;
    } catch (error) {
      // H-04 fix: Handle abort errors gracefully
      if (isAbortError(error)) {
        return { status: 'aborted', data: [], total: 0 };
      }
      if (requestId) {
        apiLogger.logResponse(requestId, 'OData', url || 'getAssignmentPoliciesByContext', null, false, error, {}, null, null);
      }
      return handleApiError(error, 'assignmentPolicy.getAssignmentPoliciesByContext');
    }
  },

  /**
   * Extract policy-to-context mapping from all policies
   * Creates a map of contextId -> [policies] for quick lookup
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email for impersonation
   * @returns {Promise<Object>} Map of contextId to policies
   */
  buildContextToPolicyMap: async (bearerToken, impersonateUser) => {
    try {
      const policiesResult = await assignmentPolicyApi.getAssignmentPolicies(bearerToken, impersonateUser, { top: 500 });

      if (policiesResult.status !== 'success') {
        return { status: 'error', error: 'Failed to fetch policies' };
      }

      const contextToPolicies = new Map();
      const policyToContexts = new Map();
      const policyToResources = new Map();

      policiesResult.data.forEach(policy => {
        const policyId = policy.UId || policy.Id;
        const policyInfo = {
          id: policyId,
          intId: policy.Id,
          name: policy.DISPLAYNAME || policy.DisplayName || policy.Name,
          description: policy.DESCRIPTION || policy.Description,
          isActive: policy.ISACTIVE !== false,
          validFrom: policy.VALIDFROM,
          validTo: policy.VALIDTO
        };

        // Map contexts to this policy
        const contexts = policy.AP_CONTEXTS || [];
        const contextIds = [];
        contexts.forEach(ctx => {
          const ctxId = ctx.UId || String(ctx.Id);
          contextIds.push(ctxId);

          if (!contextToPolicies.has(ctxId)) {
            contextToPolicies.set(ctxId, []);
          }
          contextToPolicies.get(ctxId).push({
            ...policyInfo,
            contextDisplayName: ctx.DisplayName
          });
        });
        policyToContexts.set(policyId, contextIds);

        // Map resources (entitlements) assigned by this policy
        const resources = policy.AP_RESOURCES || [];
        const accountResources = policy.AP_ACCOUNTRESOURCES || [];
        policyToResources.set(policyId, {
          resources: resources.map(r => ({
            id: r.UId || r.Id,
            name: r.DisplayName || r.Name,
            type: 'Resource'
          })),
          accountResources: accountResources.map(r => ({
            id: r.UId || r.Id,
            name: r.DisplayName || r.Name,
            type: 'AccountResource'
          }))
        });
      });

      return {
        status: 'success',
        data: {
          contextToPolicies: Object.fromEntries(contextToPolicies),
          policyToContexts: Object.fromEntries(policyToContexts),
          policyToResources: Object.fromEntries(policyToResources),
          totalPolicies: policiesResult.data.length
        }
      };
    } catch (error) {
      return handleApiError(error, 'assignmentPolicy.buildContextToPolicyMap');
    }
  }
};

/**
 * Resource Folder API Methods
 * OData operations for ResourceFolder entity type
 */
export const resourceFolderApi = {
  /**
   * Get resource folders with optional filtering
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email for impersonation
   * @param {Object} options - { filter, top, skip, orderBy, signal }
   * @returns {Promise<Object>} { status, data, total, endpoint }
   */
  getResourceFolders: async (bearerToken, impersonateUser, options = {}) => {
    const { signal, filter, top = 100, skip, orderBy = 'NAME' } = options;
    let requestId;
    let url;
    try {
      url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.odata.dataObjects}/ResourceFolder`;

      const params = new URLSearchParams();
      if (filter) params.append('$filter', filter);
      if (top !== undefined) params.append('$top', top);
      if (skip !== undefined) params.append('$skip', skip);
      if (orderBy) params.append('$orderby', orderBy);
      params.append('$count', 'true');

      const queryString = params.toString();
      if (queryString) {
        url = `${url}?${queryString}`;
      }

      const requestHeaders = await getHeaders(bearerToken, impersonateUser);
      requestId = apiLogger.logRequest('OData', url, {
        method: 'GET',
        entityType: 'ResourceFolder',
        filter, top, skip, orderBy
      }, requestHeaders);

      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
        signal
      });

      const responseHeaders = Object.fromEntries(response.headers.entries());
      const statusCode = response.status;
      const rawResponseText = await response.clone().text();

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${rawResponseText}`);
        apiLogger.logResponse(requestId, 'OData', url, null, false, error, responseHeaders, statusCode, rawResponseText);
        throw error;
      }

      const data = JSON.parse(rawResponseText);

      const result = {
        status: 'success',
        data: data.value || [],
        total: data['@odata.count'] || data.value?.length || 0,
        endpoint: url
      };

      apiLogger.logResponse(requestId, 'OData', url, result, true, null, responseHeaders, statusCode, rawResponseText);

      return result;
    } catch (error) {
      if (isAbortError(error)) {
        return { status: 'aborted', data: [], total: 0 };
      }
      if (requestId) {
        apiLogger.logResponse(requestId, 'OData', url || 'getResourceFolders', null, false, error, {}, null, null);
      }
      return handleApiError(error, 'resourceFolder.getResourceFolders');
    }
  },

  /**
   * Get a single resource folder by UId
   * @param {string} folderId - ResourceFolder UId (UUID)
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email for impersonation
   * @returns {Promise<Object>} ResourceFolder details or error
   */
  getResourceFolderById: async (folderId, bearerToken, impersonateUser) => {
    let requestId;
    let url;
    try {
      url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.odata.dataObjects}/ResourceFolder`;

      const params = new URLSearchParams();
      params.append('$filter', `UId eq ${folderId}`);
      params.append('$top', '1');

      url = `${url}?${params.toString()}`;

      const requestHeaders = await getHeaders(bearerToken, impersonateUser);
      requestId = apiLogger.logRequest('OData', url, {
        method: 'GET',
        entityType: 'ResourceFolder',
        folderId
      }, requestHeaders);

      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders
      });

      const responseHeaders = Object.fromEntries(response.headers.entries());
      const statusCode = response.status;
      const rawResponseText = await response.clone().text();

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${rawResponseText}`);
        apiLogger.logResponse(requestId, 'OData', url, null, false, error, responseHeaders, statusCode, rawResponseText);
        throw error;
      }

      const data = JSON.parse(rawResponseText);
      const folder = data.value?.[0] || null;

      const result = {
        status: 'success',
        data: folder,
        endpoint: url
      };

      apiLogger.logResponse(requestId, 'OData', url, result, true, null, responseHeaders, statusCode, rawResponseText);

      return result;
    } catch (error) {
      if (requestId) {
        apiLogger.logResponse(requestId, 'OData', url || 'getResourceFolderById', null, false, error, {}, null, null);
      }
      return handleApiError(error, 'resourceFolder.getResourceFolderById');
    }
  }
};

/**
 * Generic OData API Methods
 * For querying any OData entity type
 */
export const odataApi = {
  /**
   * Generic OData query for any entity type
   * @param {string} entityType - Entity type name (e.g., 'System', 'Account', 'Resource')
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email for impersonation
   * @param {Object} options - Query options (filter, select, top, skip, orderBy, signal)
   * @returns {Promise<Object>} Query results
   */
  query: async (entityType, bearerToken, impersonateUser, options = {}) => {
    // H-04 fix: Extract signal from options
    const { signal, filter, select, top, skip, orderBy, expand } = options;
    let requestId;
    let url;
    try {
      // Build the OData URL
      url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.odata.dataObjects}/${entityType}`;

      // Build query parameters
      const params = new URLSearchParams();
      if (filter) params.append('$filter', filter);
      if (select) params.append('$select', select);
      if (top !== undefined) params.append('$top', top);
      if (skip !== undefined) params.append('$skip', skip);
      if (orderBy) params.append('$orderby', orderBy);
      if (expand) params.append('$expand', expand);
      params.append('$count', 'true');

      const queryString = params.toString();
      if (queryString) {
        url = `${url}?${queryString}`;
      }

      const requestHeaders = await getHeaders(bearerToken, impersonateUser);
      requestId = apiLogger.logRequest('OData', url, {
        method: 'GET',
        entityType,
        filter, select, top, skip, orderBy, expand
      }, requestHeaders);

      // H-04 fix: Include signal for request cancellation
      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
        signal
      });

      const responseHeaders = Object.fromEntries(response.headers.entries());
      const statusCode = response.status;
      const rawResponseText = await response.clone().text();

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${rawResponseText}`);
        apiLogger.logResponse(requestId, 'OData', url, null, false, error, responseHeaders, statusCode, rawResponseText);
        throw error;
      }

      const data = JSON.parse(rawResponseText);

      const result = {
        status: 'success',
        data: data.value || (Array.isArray(data) ? data : [data]),
        total: data['@odata.count'] || data.value?.length || 1,
        endpoint: url
      };

      apiLogger.logResponse(requestId, 'OData', url, result, true, null, responseHeaders, statusCode, rawResponseText);

      return result;
    } catch (error) {
      // H-04 fix: Handle abort errors gracefully
      if (isAbortError(error)) {
        return { status: 'aborted', data: [], total: 0 };
      }
      if (requestId) {
        apiLogger.logResponse(requestId, 'OData', url || `query:${entityType}`, null, false, error, {}, null, null);
      }
      return handleApiError(error, `odata.query:${entityType}`);
    }
  }
};

/**
 * Combined API export — all read functions wrapped with IndexedDB caching (5-min TTL).
 * Mutations are wrapped with cache invalidation instead.
 * Cache key = namespace.fnName | JSON.stringify([impersonateUser, ...semanticParams])
 * Debug: window.__omadaApiCache.help()
 */
export const omadaApi = {
  identity: {
    searchIdentities: withApiCache('identity', 'searchIdentities',
      identityApi.searchIdentities,
      (filters, _token, impersonateUser, options) => [impersonateUser, filters, options]
    ),
    getIdentityById: withApiCache('identity', 'getIdentityById',
      identityApi.getIdentityById,
      (identityId, _token, impersonateUser) => [impersonateUser, identityId]
    ),
    getIdentityCountByCategoryId: withApiCache('identity', 'getIdentityCountByCategoryId',
      identityApi.getIdentityCountByCategoryId,
      (categoryId, _token, impersonateUser) => [impersonateUser, categoryId]
    ),
    getIdentityCategoryCounts: withApiCache('identity', 'getIdentityCategoryCounts',
      identityApi.getIdentityCategoryCounts,
      (_token, impersonateUser) => [impersonateUser]
    ),
    getIdentitiesByCategoryId: withApiCache('identity', 'getIdentitiesByCategoryId',
      identityApi.getIdentitiesByCategoryId,
      (categoryId, _token, impersonateUser, options) => [impersonateUser, categoryId, options]
    ),
    getIdentityContexts: withApiCache('identity', 'getIdentityContexts',
      identityApi.getIdentityContexts,
      (identityUId, _token, impersonateUser) => [impersonateUser, identityUId]
    ),
  },

  accessRequest: {
    getAccessRequestsTotal: withApiCache('accessRequest', 'getAccessRequestsTotal',
      accessRequestApi.getAccessRequestsTotal,
      (_token, impersonateUser) => [impersonateUser]
    ),
    getAccessRequests: withApiCache('accessRequest', 'getAccessRequests',
      accessRequestApi.getAccessRequests,
      (_token, impersonateUser) => [impersonateUser]
    ),
    getAccessRequestsForResource: withApiCache('accessRequest', 'getAccessRequestsForResource',
      accessRequestApi.getAccessRequestsForResource,
      (resourceName, _token, impersonateUser, pagination) => [impersonateUser, resourceName, pagination]
    ),
    getAccessRequestsForSystem: withApiCache('accessRequest', 'getAccessRequestsForSystem',
      accessRequestApi.getAccessRequestsForSystem,
      (systemName, _token, impersonateUser, pagination) => [impersonateUser, systemName, pagination]
    ),
    getApprovalsForResource: withApiCache('accessRequest', 'getApprovalsForResource',
      accessRequestApi.getApprovalsForResource,
      (resourceName, _token, impersonateUser, pagination) => [impersonateUser, resourceName, pagination]
    ),
    getApprovalWorkflowStatus: withApiCache('accessRequest', 'getApprovalWorkflowStatus',
      accessRequestApi.getApprovalWorkflowStatus,
      (surveyObjectId, _token, impersonateUser) => [impersonateUser, surveyObjectId]
    ),
    getResourcesForBeneficiary: withApiCache('accessRequest', 'getResourcesForBeneficiary',
      accessRequestApi.getResourcesForBeneficiary,
      (identityUId, _token, impersonateUser, filters) => [impersonateUser, identityUId, filters]
    ),
    // MUTATION — not cached, triggers invalidation on success
    createAccessRequest: withCacheInvalidation(
      accessRequestApi.createAccessRequest,
      ['accessRequest', 'assignment']
    ),
  },

  approval: {
    getPendingApprovals: withApiCache('approval', 'getPendingApprovals',
      approvalApi.getPendingApprovals,
      (_token, impersonateUser, workflowStep, summaryMode) => [impersonateUser, workflowStep, summaryMode]
    ),
    // MUTATION — not cached, triggers invalidation on success
    makeApprovalDecision: withCacheInvalidation(
      approvalApi.makeApprovalDecision,
      ['approval', 'accessRequest', 'assignment']
    ),
  },

  assignment: {
    getCalculatedAssignmentsDetailed: withApiCache('assignment', 'getCalculatedAssignmentsDetailed',
      assignmentApi.getCalculatedAssignmentsDetailed,
      (identityUIds, _token, impersonateUser, filters, pagination) => [impersonateUser, identityUIds, filters, pagination]
    ),
    getIdentitiesHavingResource: withApiCache('assignment', 'getIdentitiesHavingResource',
      assignmentApi.getIdentitiesHavingResource,
      (resourceId, resourceName, _token, impersonateUser, pagination, systemId, complianceStatus, includeDisabled) =>
        [impersonateUser, resourceId, resourceName, pagination, systemId, complianceStatus, includeDisabled]
    ),
    getChildResourcesForIdentities: withApiCache('assignment', 'getChildResourcesForIdentities',
      assignmentApi.getChildResourcesForIdentities,
      (identityIds, _token, impersonateUser, pagination, includeDisabled) =>
        [impersonateUser, identityIds, pagination, includeDisabled]
    ),
  },

  assignmentPolicy: {
    getAssignmentPolicies: withApiCache('assignmentPolicy', 'getAssignmentPolicies',
      assignmentPolicyApi.getAssignmentPolicies,
      (_token, impersonateUser, options) => [impersonateUser, options]
    ),
    getAssignmentPolicyById: withApiCache('assignmentPolicy', 'getAssignmentPolicyById',
      assignmentPolicyApi.getAssignmentPolicyById,
      (policyId, _token, impersonateUser) => [impersonateUser, policyId]
    ),
    getAssignmentPoliciesByContext: withApiCache('assignmentPolicy', 'getAssignmentPoliciesByContext',
      assignmentPolicyApi.getAssignmentPoliciesByContext,
      (contextId, _token, impersonateUser) => [impersonateUser, contextId]
    ),
    buildContextToPolicyMap: withApiCache('assignmentPolicy', 'buildContextToPolicyMap',
      assignmentPolicyApi.buildContextToPolicyMap,
      (_token, impersonateUser) => [impersonateUser]
    ),
  },

  compliance: {
    getComplianceWorkbenchData: withApiCache('compliance', 'getComplianceWorkbenchData',
      assignmentApi.getComplianceWorkbenchData,
      (_token, impersonateUser, filters) => [impersonateUser, filters]
    ),
  },

  resourceFolder: {
    getResourceFolders: withApiCache('resourceFolder', 'getResourceFolders',
      resourceFolderApi.getResourceFolders,
      (_token, impersonateUser, options) => [impersonateUser, options]
    ),
    getResourceFolderById: withApiCache('resourceFolder', 'getResourceFolderById',
      resourceFolderApi.getResourceFolderById,
      (folderId, _token, impersonateUser) => [impersonateUser, folderId]
    ),
  },

  odata: {
    query: withApiCache('odata', 'query',
      odataApi.query,
      (entityType, _token, impersonateUser, options) => [impersonateUser, entityType, options]
    ),
  },
};

export default omadaApi;
