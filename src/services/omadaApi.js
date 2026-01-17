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

/**
 * Identity API Methods
 */
export const identityApi = {
  /**
   * Search for identities using OData
   * @param {Object} filters - Filter criteria (EMAIL, FIRSTNAME, LASTNAME, etc.)
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email for impersonation
   * @param {Object} options - Additional query options
   * @returns {Promise<Object>} Search results
   */
  searchIdentities: async (filters, bearerToken, impersonateUser, options = {}) => {
    let requestId;
    let url;
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

      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
        referrerPolicy: 'no-referrer'
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
   * @returns {Promise<Object>} Identity details
   */
  getIdentityById: async (identityId, bearerToken, impersonateUser) => {
    try {
      const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.odata.dataObjects}/Identity(${identityId})`;

      const requestHeaders = await getHeaders(bearerToken, impersonateUser);
      const requestId = apiLogger.logRequest('OData', url, { method: 'GET', identityId }, requestHeaders);

      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
        referrerPolicy: 'no-referrer'
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
      return handleApiError(error, 'getIdentityById');
    }
  },

  /**
   * Get identity count by category ID (efficient - uses OData $count without fetching data)
   * @param {number} categoryId - Category ID (e.g., 561)
   * @param {string} bearerToken - OAuth bearer token
   * @param {string} impersonateUser - User email
   * @returns {Promise<Object>} Count result
   */
  getIdentityCountByCategoryId: async (categoryId, bearerToken, impersonateUser) => {
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

      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
        referrerPolicy: 'no-referrer'
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
   * @param {Object} options - Additional query options
   * @returns {Promise<Object>} Identities in category
   */
  getIdentitiesByCategoryId: async (categoryId, bearerToken, impersonateUser, options = {}) => {
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

      const response = await fetch(url, {
        method: 'GET',
        headers: requestHeaders,
        referrerPolicy: 'no-referrer'
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
   * @returns {Promise<Object>} Identity contexts
   */
  getIdentityContexts: async (identityUId, bearerToken, impersonateUser) => {
    let requestId;
    let endpoint;
    try {
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_0}`;
      const queryObject = GraphQLQueries.getContextsForIdentity(identityUId);
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getIdentityContexts',
        identityUId,
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
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_0}`;
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
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_0}`;
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
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_0}`;
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
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_0}`;
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
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v3_0}`;
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
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Assignments
   */
  getCalculatedAssignmentsDetailed: async (
    identityUIds,
    bearerToken,
    impersonateUser,
    filters = {},
    pagination = {}
  ) => {
    let requestId;
    let endpoint;
    try {
      endpoint = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.graphql.v2_19}`;
      const queryObject = GraphQLQueries.getCalculatedAssignmentsDetailed(
        identityUIds,
        filters,
        pagination
      );
      const requestHeaders = await getGraphQLHeaders(bearerToken, impersonateUser);

      requestId = apiLogger.logRequest('GraphQL', endpoint, {
        functionName: 'getCalculatedAssignmentsDetailed',
        identityUIds,
        filters,
        pagination,
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
      const responseHeaders = error.responseHeaders || {};
      const statusCode = error.statusCode || null;
      const rawResponse = error.rawResponse || null;

      if (requestId) {
        apiLogger.logResponse(requestId, 'GraphQL', endpoint, null, false, error, responseHeaders, statusCode, rawResponse);
      }

      return handleApiError(error, 'getCalculatedAssignmentsDetailed');
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
   * @param {Object} options - Query options (filter, select, top, skip, orderBy)
   * @returns {Promise<Object>} Query results
   */
  query: async (entityType, bearerToken, impersonateUser, options = {}) => {
    let requestId;
    let url;
    try {
      const { filter, select, top, skip, orderBy, expand } = options;

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
        ...options
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

      const result = {
        status: 'success',
        data: data.value || (Array.isArray(data) ? data : [data]),
        total: data['@odata.count'] || data.value?.length || 1,
        endpoint: url
      };

      apiLogger.logResponse(requestId, 'OData', url, result, true, null, responseHeaders, statusCode, rawResponseText);

      return result;
    } catch (error) {
      if (requestId) {
        apiLogger.logResponse(requestId, 'OData', url || `query:${entityType}`, null, false, error, {}, null, null);
      }
      return handleApiError(error, `odata.query:${entityType}`);
    }
  }
};

/**
 * Combined API export
 */
export const omadaApi = {
  identity: identityApi,
  accessRequest: accessRequestApi,
  approval: approvalApi,
  assignment: assignmentApi,
  odata: odataApi
};

export default omadaApi;
