/**
 * OData and GraphQL Query Builders
 * Helper functions to construct API queries
 */

// ============================================================================
// GRAPHQL PAGINATION CONSTANTS
// Configurable defaults for all GraphQL API calls
// ============================================================================
export const GRAPHQL_PAGINATION = {
  // Default page size for most queries
  DEFAULT_ROWS: 10,

  // Maximum rows per page (API may have limits)
  MAX_ROWS: 5000,

  // Default starting page
  DEFAULT_PAGE: 1,

  // Specific defaults for different query types
  CALCULATED_ASSIGNMENTS: {
    DEFAULT_ROWS: 10,     // Default page size
    MAX_ROWS: 5000        // Max per request
  },

  IDENTITIES_HAVING_RESOURCE: {
    DEFAULT_ROWS: 10,     // Default page size
    MAX_ROWS: 2000
  },

  CONTEXTS: {
    DEFAULT_ROWS: 10,     // Default page size
    MAX_ROWS: 500
  }
};

/**
 * Build OData query URL
 * @param {string} baseUrl - Base API URL
 * @param {string} entityType - Entity type (Identity, Resource, etc.)
 * @param {Object} options - Query options
 * @returns {string} Complete OData URL
 */
export const buildODataQuery = (baseUrl, entityType, options = {}) => {
  const {
    filter,
    select,
    top,
    skip,
    orderBy,
    expand,
    count = false,
  } = options;

  const params = new URLSearchParams();

  if (filter) params.append('$filter', filter);
  if (select) params.append('$select', select);
  if (top !== undefined && top !== null) params.append('$top', top.toString());
  if (skip !== undefined && skip !== null) params.append('$skip', skip.toString());
  if (orderBy) params.append('$orderby', orderBy);
  if (expand) params.append('$expand', expand);
  if (count) params.append('$count', 'true');

  const queryString = params.toString();
  const separator = queryString ? '?' : '';

  return `${baseUrl}/OData/DataObjects/${entityType}${separator}${queryString}`;
};

/**
 * Build OData filter string from field filters
 * @param {Object} filters - Key-value pairs for filtering
 * @returns {string} OData filter string
 */
export const buildODataFilter = (filters) => {
  if (!filters || Object.keys(filters).length === 0) return '';

  const filterParts = [];

  Object.entries(filters).forEach(([field, value]) => {
    if (value === null || value === undefined) return;

    // Handle different filter types
    if (typeof value === 'string') {
      // Use contains for string searches
      filterParts.push(`contains(tolower(${field}), tolower('${value}'))`);
    } else if (typeof value === 'number') {
      filterParts.push(`${field} eq ${value}`);
    } else if (typeof value === 'boolean') {
      filterParts.push(`${field} eq ${value}`);
    } else if (value.operator && value.value) {
      // Custom operator (eq, ne, gt, lt, etc.)
      filterParts.push(`${field} ${value.operator} '${value.value}'`);
    }
  });

  return filterParts.join(' and ');
};

/**
 * GraphQL Query Templates
 */
export const GraphQLQueries = {
  /**
   * Get contexts for identity
   */
  getContextsForIdentity: (identityId) => ({
    query: `
      query GetContextsForIdentity {
        accessRequestComponents {
          contexts(identityIds: "${identityId}") {
            id
            displayName
            type
          }
        }
      }
    `
  }),

  /**
   * Get resources for beneficiary
   */
  getResourcesForBeneficiary: (identityId, filters = {}) => {
    const filterStr = JSON.stringify({
      beneficiaryIds: identityId,
      ...(filters.systemId && { systemId: filters.systemId }),
      ...(filters.contextId && { contextId: filters.contextId }),
      ...(filters.name && { name: filters.name })
    });

    return {
      query: `
        query GetResourcesForBeneficiary {
          accessRequestComponents {
            resources(filters: ${filterStr.replace(/"([^"]+)":/g, '$1:')}) {
              data {
                name
                id
                description
                system {
                  name
                  id
                }
                resourceType {
                  name
                  id
                }
              }
            }
          }
        }
      `
    };
  },

  /**
   * Get access requests total (summary only)
   */
  getAccessRequestsTotal: () => ({
    query: `
      query GetAccessRequestsTotal {
        accessRequests {
          pages
          total
        }
      }
    `
  }),

  /**
   * Get access requests
   */
  getAccessRequests: () => ({
    query: `
      query GetAccessRequests {
        accessRequests {
          pages
          total
          data {
            id
            reason
            validFrom
            validTo
            status {
              approvalStatus
              provisioningStatus
            }
            beneficiary {
              firstName
              lastName
              identityId
              id
              displayName
              accounts {
                accountName
              }
            }
            resource {
              name
              id
              system {
                name
                id
              }
            }
          }
        }
      }
    `
  }),

  /**
   * Create access request
   */
  createAccessRequest: (identityId, resourceId, contextId, reason, validFrom, validTo) => ({
    query: `
      mutation CreateAccessRequest {
        createAccessRequest(accessRequest: {
          reason: "${reason}",
          identities: {id: "${identityId}"},
          resources: {id: "${resourceId}"},
          context: "${contextId}"
          ${validFrom ? `, validFrom: "${validFrom}"` : ''}
          ${validTo ? `, validTo: "${validTo}"` : ''}
        }) {
          id
          status {
            approvalStatus
            requestAssignmentState
          }
          resource {
            name
            id
            system {
              name
              id
            }
          }
          validFrom
          validTo
        }
      }
    `
  }),

  /**
   * Get pending approvals
   */
  getPendingApprovals: (workflowStep = null, summaryMode = true) => {
    const filterClause = workflowStep
      ? `filters: {workflowStep: {filterValue: "${workflowStep}", operator: EQUALS}}`
      : '';

    return {
      query: `
        query myAccessRequestApprovalSurveyQuestions {
          accessRequestApprovalSurveyQuestions(${filterClause}) {
            pages
            total
            data {
              reason
              ${!summaryMode ? 'surveyId\n              surveyObjectKey' : ''}
              workflowStep
              workflowStepTitle
              history
              resourceAssignment {
                resource {
                  id
                  name
                  system {
                    id
                    name
                  }
                  resourceType {
                    name
                    id
                  }
                }
              }
            }
          }
        }
      `
    };
  },

  /**
   * Make approval decision
   */
  makeApprovalDecision: (surveyId, surveyObjectKey, decision) => ({
    query: `
      mutation makeApprovalDecision {
        submitRequestQuestions(
          submitRequestQuestionsInput: {
            accessApprovals: {
              questions: {
                decision: ${decision},
                surveyObjectKey: "${surveyObjectKey}"
              },
              surveyId: "${surveyId}"
            }
          }
        ) {
          questionsSuccessfullySubmitted
        }
      }
    `
  }),

  /**
   * Get calculated assignments detailed
   * Can filter by identityIds OR systemId (not both)
   * @param {string|string[]|null} identityIds - Identity UUID(s) to filter by
   * @param {Object} filters - Additional filters
   * @param {string} filters.systemId - System UUID to filter by (alternative to identityIds)
   * @param {string} filters.resourceTypeName - Filter by resource type name
   * @param {string} filters.complianceStatus - Filter by compliance status
   * @param {string} filters.accountName - Filter by account name
   * @param {boolean} filters.accountNameExact - Use EQUALS operator for exact match (default: false uses CONTAINS)
   * @param {string} filters.systemName - Filter by system name
   * @param {boolean} filters.includeDisabled - Include disabled assignments (default: true)
   * @param {Object} pagination - Pagination options
   */
  getCalculatedAssignmentsDetailed: (identityIds = null, filters = {}, pagination = {}) => {
    // Use configurable pagination constants with defaults
    const paginationConfig = GRAPHQL_PAGINATION.CALCULATED_ASSIGNMENTS;
    const page = pagination.page ?? GRAPHQL_PAGINATION.DEFAULT_PAGE;
    const rows = pagination.rows ?? paginationConfig.DEFAULT_ROWS;
    const { sortOrder = 'ASCENDING', includeDisabled = true } = filters;

    const filterParts = [];

    // Filter disabled assignments only if explicitly requested to exclude them
    if (!includeDisabled) {
      filterParts.push('disabled: false');
    }

    // Primary filter: either systemId or identityIds
    if (filters.systemId) {
      // Filter by system ID
      filterParts.push(`systemId: "${filters.systemId}"`);
    } else if (identityIds) {
      // Filter by identity ID(s)
      // For single ID, use plain string; for multiple, use array format
      if (Array.isArray(identityIds)) {
        filterParts.push(`multipleIdentityIds: ["${identityIds.join('","')}"]`);
      } else {
        filterParts.push(`multipleIdentityIds: "${identityIds}"`);
      }
    }

    // Additional filters
    if (filters.resourceTypeName) {
      filterParts.push(`resourceTypeName: {filterValue: "${filters.resourceTypeName}", operator: CONTAINS}`);
    }
    if (filters.complianceStatus) {
      filterParts.push(`complianceStatus: {filterValue: "${filters.complianceStatus}", operator: CONTAINS}`);
    }
    if (filters.accountName) {
      // Use EQUALS for exact match when accountNameExact is true, otherwise CONTAINS
      const accountNameOperator = filters.accountNameExact ? 'EQUALS' : 'CONTAINS';
      filterParts.push(`accountName: {filterValue: "${filters.accountName}", operator: ${accountNameOperator}}`);
    }
    if (filters.systemName) {
      filterParts.push(`systemName: {filterValue: "${filters.systemName}", operator: CONTAINS}`);
    }

    const filterClause = filterParts.join(', ');

    // Always include pagination for consistent API behavior
    const paginationClause = `pagination: {page: ${page}, rows: ${rows}}`;

    return {
      query: `
        query GetCalculatedAssignmentsDetailed {
          calculatedAssignments(
            sorting: {sortOrder: ${sortOrder}}
            ${paginationClause}
            filters: {${filterClause}}
          ) {
            pages
            total
            data {
              id
              complianceStatus
              disabled
              validFrom
              validTo
              violations {
                description
                violationStatus
              }
              account {
                id
                accountName
                accountType {
                  name
                  id
                }
                system {
                  name
                  id
                }
              }
              identity {
                identityId
                lastName
                firstName
                displayName
                id
                riskLevel {
                  name
                }
                accounts {
                  accountName
                  id
                  accountType {
                    name
                    id
                  }
                  system {
                    name
                    id
                  }
                }
                contexts {
                  displayName
                  id
                  type
                }
              }
              resource {
                name
                id
                description
                maxValidity
                system {
                  id
                  name
                }
                resourceType {
                  id
                  name
                }
                resourceCategory {
                  name
                  id
                }
                resourceFolder {
                  name
                  id
                }
              }
              reason {
                description
                reasonType
                causeObjectKey
              }
            }
          }
        }
      `
    };
  },

  /**
   * Get identities that have a specific resource (entitlement) assigned
   * Used for entitlement-centric view in Identity360
   * @param {string} resourceId - Resource UUID (required)
   * @param {string} resourceName - Resource name (optional, not used in query)
   * @param {string} systemId - System ID (optional, not used in query)
   * @param {Object} pagination - Pagination options
   * @param {string} complianceStatus - Optional compliance status filter (e.g., 'Not Approved', 'Approved')
   * @param {boolean} includeDisabled - Include disabled assignments (default: true)
   * @returns {Object} GraphQL query object
   */
  getIdentitiesHavingResource: (resourceId = null, resourceName = null, systemId = null, pagination = {}, complianceStatus = null, includeDisabled = true) => {
    // Use configurable pagination constants with defaults
    const paginationConfig = GRAPHQL_PAGINATION.IDENTITIES_HAVING_RESOURCE;
    const page = pagination.page ?? GRAPHQL_PAGINATION.DEFAULT_PAGE;
    const rows = pagination.rows ?? paginationConfig.DEFAULT_ROWS;

    // Validate that we have resourceId
    if (!resourceId) {
      throw new Error('resourceId is required for getIdentitiesHavingResource');
    }

    // Build the filter parts
    const filterParts = [
      `resourceIds: "${resourceId}"`
    ];

    // Filter disabled assignments only if explicitly requested to exclude them
    if (!includeDisabled) {
      filterParts.push('disabled: false');
    }

    // Add complianceStatus filter if provided
    if (complianceStatus) {
      filterParts.push(`complianceStatus: {filterValue: "${complianceStatus}", operator: EQUALS}`);
    }

    const filterClause = filterParts.join(', ');

    // Always include pagination for consistent API behavior
    const paginationClause = `pagination: {page: ${page}, rows: ${rows}}`;

    return {
      query: `
        query GetIdentitiesHavingResource {
          calculatedAssignments(
            filters: {${filterClause}}
            sorting: {sortOrder: ASCENDING}
            ${paginationClause}
          ) {
            pages
            total
            data {
              complianceStatus
              id
              disabled
              violations {
                description
                violationStatus
              }
              resource {
                id
                name
                description
                system {
                  name
                  id
                }
              }
              account {
                id
                accountName
                system {
                  id
                  name
                }
              }
              validFrom
              validTo
              reason {
                description
                reasonType
              }
              identity {
                firstName
                id
                displayName
                lastName
                identityId
                riskLevel {
                  name
                }
              }
            }
          }
        }
      `
    };
  }
};

/**
 * Execute GraphQL query
 * @param {string} endpoint - GraphQL endpoint URL
 * @param {Object} queryObject - Query object with 'query' property
 * @param {Object} headers - Request headers
 * @returns {Promise<Object>} API response with data, headers, status, and rawResponse
 */
export const executeGraphQL = async (endpoint, queryObject, headers) => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(queryObject),
      referrerPolicy: 'no-referrer'  // Don't send Referer header to avoid origin validation issues
    });

    // Capture response headers and status
    const responseHeaders = Object.fromEntries(response.headers.entries());
    const statusCode = response.status;

    // Clone response to read raw text
    const responseClone = response.clone();
    const rawResponseText = await responseClone.text();

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.responseHeaders = responseHeaders;
      error.statusCode = statusCode;
      error.rawResponse = rawResponseText;
      throw error;
    }

    const data = await response.json();

    if (data.errors) {
      const error = new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
      error.responseHeaders = responseHeaders;
      error.statusCode = statusCode;
      error.rawResponse = rawResponseText;
      throw error;
    }

    return {
      data,
      headers: responseHeaders,
      status: statusCode,
      rawResponse: rawResponseText // Include raw response text
    };
  } catch (error) {
    console.error('GraphQL execution error:', error);
    throw error;
  }
};
