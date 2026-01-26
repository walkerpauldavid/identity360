/**
 * Identity360 Data Service
 * Data contract interface for Omada OData and GraphQL APIs
 *
 * This service provides an abstraction layer between the Identity360 UI and
 * the Omada backend. It can be configured to use mock data for development
 * or real API calls for production.
 */

import { NodeTypes, LaneTypes, ReasonTypes, LaneConfigSchema, FocusNodeSchema, LaneDisplayConfig, LaneSchema, extractFieldValue, shouldLog } from './accessLensTypes';
import {
  buildLane,
  buildIdentitiesLane as buildIdentitiesLaneGeneric,
  buildAccountsLane as buildAccountsLaneGeneric,
  buildEntitlementsLane as buildEntitlementsLaneGeneric,
  buildSystemsLane as buildSystemsLaneGeneric,
  buildLanesForFocusNode
} from './laneBuilderService';
import { getNestedValue as getNestedValueUtil } from './accessLensUtils';

// Feature flag to enable schema-driven lane building
// Set to true to use the new laneBuilderService, false for legacy behavior
const USE_SCHEMA_DRIVEN_LANE_BUILDING = true;

// Configuration
const CONFIG = {
  odataPageSizeLimit: 1000, // Omada OData page size limit
  apiBaseUrl: '', // Will be set from environment or omadaApi
  graphqlEndpoint: '/graphql',
  odataEndpoint: '/odata'
};

// Default limits for lane display and pagination
const DEFAULTS = {
  // Pagination
  INITIAL_PAGE: 1,
  ROWS_PER_PAGE: 100,

  // Lane display
  ITEMS_PER_LANE: 10,          // Default number of items shown per lane (before "show all")
  MAX_BADGES_PER_ITEM: 3,      // Maximum badges shown on lane items

  // Debug
  DEBUG_LOG_SAMPLE_SIZE: 3     // Number of items to log for debugging
};

// ============================================================================
// EXTRACTOR REGISTRY
// Maps extract type names (from schema) to extractor functions
// Each function signature: (sourceData, focusNode, filters, context) => items[]
// ============================================================================

/**
 * Extractor registry - single source of truth for derived data extraction
 * To add a new extractor:
 * 1. Create the extractor function
 * 2. Add it to this registry with the extract key matching the schema
 */
const extractorRegistry = {
  // From calculatedAssignments
  'systems': (sourceData, focusNode, filters, context) =>
    extractSystemsFromAssignments(sourceData),

  'accounts': (sourceData, focusNode, filters, context) =>
    extractAccountsFromAssignments(sourceData),

  'roles': (sourceData, focusNode, filters, context) =>
    extractRolesFromAssignments(sourceData),

  'entitlements': (sourceData, focusNode, filters, context) =>
    extractEntitlementsFromAssignments(sourceData),

  'logicalApps': (sourceData, focusNode, filters, context) => {
    const lane = buildLogicalApplicationsLane(sourceData, filters, context?.systemDetailsMap || {});
    return lane.items || [];
  },

  'logicalAppsForSystem': (sourceData, focusNode, filters, context) => {
    const lane = buildLogicalAppsForSystemLane(
      sourceData,
      filters,
      focusNode?.id,
      context?.systemDetailsMap || {}
    );
    return lane.items || [];
  },

  'assignmentPolicies': (sourceData, focusNode, filters, context) => {
    const lane = buildAssignmentPoliciesLane(sourceData, filters);
    return lane.items || [];
  },

  'identities': (sourceData, focusNode, filters, context) => {
    const lane = buildIdentitiesLane(sourceData, filters);
    return lane.items || [];
  },

  // From focusNode (single item extraction)
  'system': (sourceData, focusNode, filters, context) => {
    if (!focusNode?.metadata?.system) return [];
    return [{
      node: {
        id: focusNode.metadata.systemId || 'system-1',
        type: NodeTypes.SYSTEM,
        displayName: focusNode.metadata.system,
        status: 'active',
        badges: [],
        metadata: {}
      }
    }];
  },

  'identity': (sourceData, focusNode, filters, context) => {
    if (!focusNode?.metadata?.identity) return [];
    return [{
      node: {
        id: focusNode.metadata.identityId || 'identity-1',
        type: NodeTypes.IDENTITY,
        displayName: focusNode.metadata.identity,
        status: 'active',
        badges: [],
        metadata: {}
      }
    }];
  },

  // Assignment Policy related extractions (from focusNode data)
  'AP_CONTEXTS': (sourceData, focusNode, filters, context) => {
    const contexts = focusNode?.rawData?.AP_CONTEXTS || focusNode?.AP_CONTEXTS || [];
    return contexts.map(ctx => ({
      node: {
        id: ctx.Id || ctx.id,
        type: NodeTypes.CONTEXT,
        displayName: ctx.DisplayName || ctx.Name || ctx.displayName || 'Unknown Context',
        status: 'active',
        badges: [],
        metadata: {
          ...ctx,
          uId: ctx.UId || ctx.uId || ctx.Id || ctx.id  // UId for cross-lane filtering
        }
      }
    }));
  },

  'AP_RESOURCES': (sourceData, focusNode, filters, context) => {
    const resources = focusNode?.rawData?.AP_RESOURCES || focusNode?.AP_RESOURCES || [];
    return resources.map(res => ({
      node: {
        id: res.Id || res.id,
        type: NodeTypes.ENTITLEMENT,
        displayName: res.DisplayName || res.Name || res.displayName || 'Unknown Resource',
        status: 'active',
        badges: [],
        metadata: { ...res }
      }
    }));
  },

  'AP_ACCOUNTRESOURCES': (sourceData, focusNode, filters, context) => {
    const accountResources = focusNode?.rawData?.AP_ACCOUNTRESOURCES || focusNode?.AP_ACCOUNTRESOURCES || [];
    return accountResources.map(acc => ({
      node: {
        id: acc.Id || acc.id,
        type: NodeTypes.ACCOUNT,
        displayName: acc.DisplayName || acc.Name || acc.displayName || 'Unknown Account Resource',
        status: 'active',
        badges: [],
        metadata: { ...acc }
      }
    }));
  }
};

/**
 * Get an extractor function by name
 * @param {string} extractName - The extract type from schema
 * @returns {Function|null} The extractor function or null if not found
 */
export function getExtractor(extractName) {
  return extractorRegistry[extractName] || null;
}

/**
 * Register a custom extractor (for extensibility)
 * @param {string} name - The extract type name
 * @param {Function} fn - The extractor function
 */
export function registerExtractor(name, fn) {
  if (typeof fn !== 'function') {
    console.warn(`registerExtractor: ${name} must be a function`);
    return;
  }
  extractorRegistry[name] = fn;
}

/**
 * Data Contract Interface
 * All methods return promises with standardized response shapes
 */

/**
 * Transform Omada Identity response to AccessLens node format
 */
export const transformIdentityToNode = (identity) => {
  if (!identity) return null;

  return {
    id: identity.UId || identity.Id || identity.id,
    type: NodeTypes.IDENTITY,
    displayName: identity.DISPLAYNAME ||
                 `${identity.FIRSTNAME || ''} ${identity.LASTNAME || ''}`.trim() ||
                 'Unknown',
    status: mapStatus(identity.IDENTITYSTATUS || identity.Status),
    riskScore: mapRiskLevel(identity.RISKLEVEL),
    badges: [
      identity.IDENTITYCATEGORY,
      identity.JOBTITLE
    ].filter(Boolean),
    metadata: {
      email: identity.EMAIL,
      department: identity.OUREF?.DisplayName || identity.OUREF,
      employeeId: identity.EMPLOYEEID,
      title: identity.JOBTITLE,
      // Raw data for debugging/extension
      _raw: identity
    }
  };
};

/**
 * Transform Omada Role response to AccessLens node format
 */
export const transformRoleToNode = (role) => {
  if (!role) return null;

  return {
    id: role.UId || role.Id || role.id,
    type: NodeTypes.ROLE,
    displayName: role.DisplayName || role.Name || role.DISPLAYNAME,
    status: mapStatus(role.Status),
    riskScore: role.RiskScore,
    badges: [
      role.RoleType,
      role.Category
    ].filter(Boolean),
    metadata: {
      members: role.MemberCount,
      entitlements: role.EntitlementCount,
      description: role.Description,
      _raw: role
    }
  };
};

/**
 * Transform Omada Account response to AccessLens node format
 */
export const transformAccountToNode = (account) => {
  if (!account) return null;

  return {
    id: account.UId || account.Id || account.id,
    type: NodeTypes.ACCOUNT,
    displayName: account.AccountName || account.DisplayName || account.Name,
    status: mapStatus(account.Status),
    badges: [
      account.SystemName || account.System?.Name
    ].filter(Boolean),
    metadata: {
      system: account.SystemName || account.System?.Name,
      systemId: account.SystemId || account.System?.Id,
      lastLogin: account.LastLogin,
      _raw: account
    }
  };
};

/**
 * Transform Omada Entitlement/Resource response to AccessLens node format
 */
export const transformEntitlementToNode = (entitlement) => {
  if (!entitlement) return null;

  return {
    id: entitlement.UId || entitlement.Id || entitlement.id,
    type: NodeTypes.ENTITLEMENT,
    displayName: entitlement.DisplayName || entitlement.Name,
    status: mapStatus(entitlement.Status),
    riskScore: entitlement.RiskScore,
    badges: [
      entitlement.SystemName || entitlement.System?.Name,
      entitlement.ResourceType?.Name || entitlement.Type
    ].filter(Boolean),
    metadata: {
      system: entitlement.SystemName || entitlement.System?.Name,
      systemId: entitlement.SystemId || entitlement.System?.Id,
      type: entitlement.ResourceType?.Name || entitlement.Type,
      description: entitlement.Description,
      _raw: entitlement
    }
  };
};

/**
 * Transform Omada System response to AccessLens node format
 */
export const transformSystemToNode = (system) => {
  if (!system) return null;

  return {
    id: system.UId || system.Id || system.id,
    type: NodeTypes.SYSTEM,
    displayName: system.DisplayName || system.Name,
    status: mapStatus(system.Status),
    badges: [
      system.Category,
      system.Vendor
    ].filter(Boolean),
    metadata: {
      vendor: system.Vendor,
      category: system.Category,
      description: system.Description,
      _raw: system
    }
  };
};

/**
 * Transform Omada Policy response to AccessLens node format
 */
export const transformPolicyToNode = (policy) => {
  if (!policy) return null;

  return {
    id: policy.UId || policy.Id || policy.id,
    type: NodeTypes.POLICY,
    displayName: policy.DisplayName || policy.Name,
    status: mapStatus(policy.Status),
    riskScore: policy.RiskScore,
    badges: [
      policy.Type,
      policy.Scope
    ].filter(Boolean),
    metadata: {
      type: policy.Type,
      scope: policy.Scope,
      description: policy.Description,
      _raw: policy
    }
  };
};

/**
 * Transform Omada Assignment Reason to AccessLens reason format
 */
export const transformReason = (reason, index = 0) => {
  if (!reason) return null;

  return {
    id: reason.Id || reason.ReasonId || `reason-${index}`,
    type: mapReasonType(reason.Type || reason.ReasonType),
    title: reason.Title || reason.DisplayName || getReasonTypeLabel(reason.Type),
    description: reason.Description || reason.Summary,
    confidence: reason.Confidence || 'high',
    evidencePath: reason.EvidencePath ? {
      nodes: (reason.EvidencePath.Nodes || []).map(transformNodeByType),
      edges: reason.EvidencePath.Edges || []
    } : null,
    facts: reason.Facts || [],
    _raw: reason
  };
};

/**
 * Helper: Map Omada status to standardized status
 */
function mapStatus(status) {
  if (!status) return 'active';
  const s = status.toLowerCase();
  if (s === 'active' || s === 'enabled') return 'active';
  if (s === 'disabled' || s === 'inactive') return 'disabled';
  if (s === 'pending') return 'pending';
  return 'active';
}

/**
 * Helper: Map Omada risk level to numeric score
 */
function mapRiskLevel(riskLevel) {
  if (!riskLevel) return undefined;
  if (typeof riskLevel === 'number') return riskLevel;
  const level = riskLevel.toLowerCase();
  if (level === 'high' || level === 'critical') return 75;
  if (level === 'medium') return 50;
  if (level === 'low') return 25;
  return undefined;
}

/**
 * Helper: Map Omada reason type to AccessLens reason type
 */
function mapReasonType(type) {
  if (!type) return ReasonTypes.OTHER;
  const t = type.toLowerCase();
  if (t.includes('role')) return ReasonTypes.ROLE_MEMBERSHIP;
  if (t.includes('birthright') || t.includes('automatic')) return ReasonTypes.BIRTHRIGHT;
  if (t.includes('direct') || t.includes('manual')) return ReasonTypes.DIRECT_ASSIGNMENT;
  if (t.includes('policy') || t.includes('rule')) return ReasonTypes.POLICY_RULE;
  if (t.includes('account')) return ReasonTypes.ACCOUNT_LINK;
  if (t.includes('sod') || t.includes('exception')) return ReasonTypes.SOD_EXCEPTION;
  return ReasonTypes.OTHER;
}

/**
 * Helper: Get display label for reason type
 */
function getReasonTypeLabel(type) {
  const labels = {
    [ReasonTypes.ROLE_MEMBERSHIP]: 'Role Membership',
    [ReasonTypes.BIRTHRIGHT]: 'Birthright Policy',
    [ReasonTypes.DIRECT_ASSIGNMENT]: 'Direct Assignment',
    [ReasonTypes.POLICY_RULE]: 'Policy Rule',
    [ReasonTypes.ACCOUNT_LINK]: 'Account Link',
    [ReasonTypes.SOD_EXCEPTION]: 'SoD Exception',
    [ReasonTypes.OTHER]: 'Other'
  };
  return labels[type] || 'Unknown';
}

/**
 * Helper: Transform node based on detected type
 */
function transformNodeByType(node) {
  if (!node) return null;
  const type = node.Type || node.type || detectNodeType(node);

  switch (type) {
    case NodeTypes.IDENTITY:
    case 'Identity':
      return transformIdentityToNode(node);
    case NodeTypes.ROLE:
    case 'Role':
      return transformRoleToNode(node);
    case NodeTypes.ACCOUNT:
    case 'Account':
      return transformAccountToNode(node);
    case NodeTypes.ENTITLEMENT:
    case 'Entitlement':
    case 'Resource':
      return transformEntitlementToNode(node);
    case NodeTypes.SYSTEM:
    case 'System':
      return transformSystemToNode(node);
    case NodeTypes.POLICY:
    case 'Policy':
      return transformPolicyToNode(node);
    default:
      return node;
  }
}

/**
 * Helper: Detect node type from properties
 */
function detectNodeType(node) {
  if (node.FIRSTNAME || node.LASTNAME || node.EMAIL) return NodeTypes.IDENTITY;
  if (node.AccountName || node.LastLogin) return NodeTypes.ACCOUNT;
  if (node.MemberCount || node.EntitlementCount) return NodeTypes.ROLE;
  if (node.ResourceType || node.SystemName) return NodeTypes.ENTITLEMENT;
  if (node.Vendor || node.Category) return NodeTypes.SYSTEM;
  return NodeTypes.IDENTITY;
}

// ============================================================================
// API METHODS - These make actual calls to Omada APIs
// ============================================================================

/**
 * Fetch focus data for a node (Identity, Role, Entitlement, etc.)
 * Returns the focus node and related lanes
 */
export async function fetchFocusData(nodeId, nodeType, filters = {}, apiContext = {}) {
  const { bearerToken, impersonateUser, omadaApi } = apiContext;

  try {
    // Determine which API calls to make based on node type
    const focusNode = await fetchNodeById(nodeId, nodeType, apiContext);
    const lanes = await fetchLanesForNode(focusNode, filters, apiContext);

    return {
      focusNode,
      lanes
    };
  } catch (error) {
    console.error('Error fetching focus data:', error);
    throw error;
  }
}

/**
 * Fetch a single node by ID
 */
async function fetchNodeById(nodeId, nodeType, apiContext) {
  const { omadaApi, bearerToken, impersonateUser } = apiContext;

  if (!omadaApi) {
    throw new Error('omadaApi instance required for real API calls');
  }

  switch (nodeType) {
    case NodeTypes.IDENTITY:
    case 'Identity':
      const identityResult = await omadaApi.identity.getIdentityById(nodeId, bearerToken, impersonateUser);
      return transformIdentityToNode(identityResult.data);

    case NodeTypes.ROLE:
    case 'Role':
      // Implement when role API is available
      throw new Error('Role API not yet implemented');

    case NodeTypes.ACCOUNT:
    case 'Account':
      // Implement when account API is available
      throw new Error('Account API not yet implemented');

    case NodeTypes.ENTITLEMENT:
    case 'Entitlement':
      // Implement when entitlement API is available
      throw new Error('Entitlement API not yet implemented');

    case NodeTypes.SYSTEM:
    case 'System':
      // Implement when system API is available
      throw new Error('System API not yet implemented');

    default:
      throw new Error(`Unknown node type: ${nodeType}`);
  }
}

/**
 * Fetch lanes data for a focus node
 */
async function fetchLanesForNode(focusNode, filters, apiContext) {
  const { omadaApi, bearerToken, impersonateUser } = apiContext;
  const lanes = [];

  if (!omadaApi) {
    throw new Error('omadaApi instance required for real API calls');
  }

  if (focusNode.type === NodeTypes.IDENTITY) {
    // Fetch roles for this identity
    try {
      // Note: Implement actual API calls when endpoints are available
      // const rolesResult = await omadaApi.role.getRolesForIdentity(focusNode.id, bearerToken, impersonateUser);
      // lanes.push(buildRolesLane(rolesResult.data));
    } catch (e) {
      console.warn('Failed to fetch roles:', e);
    }

    // Fetch accounts for this identity
    try {
      // const accountsResult = await omadaApi.account.getAccountsForIdentity(focusNode.id, bearerToken, impersonateUser);
      // lanes.push(buildAccountsLane(accountsResult.data));
    } catch (e) {
      console.warn('Failed to fetch accounts:', e);
    }

    // Fetch effective entitlements with reasons
    try {
      const assignmentsResult = await omadaApi.assignment.getCalculatedAssignmentsDetailed(
        focusNode.id,
        bearerToken,
        impersonateUser,
        {},
        { page: DEFAULTS.INITIAL_PAGE, rows: DEFAULTS.ROWS_PER_PAGE }
      );

      if (assignmentsResult.status === 'success' && assignmentsResult.data) {
        lanes.push(buildEntitlementsLane(assignmentsResult.data, filters));
      }
    } catch (e) {
      console.warn('Failed to fetch assignments:', e);
    }

    // Fetch systems
    try {
      // Build systems lane from the entitlements data
      // This extracts unique systems from the assignments
    } catch (e) {
      console.warn('Failed to fetch systems:', e);
    }
  }

  return lanes;
}

/**
 * Transform Omada Context response to AccessLens node format
 * Note: GraphQL returns 'displayName' (camelCase), OData returns 'DisplayName' (PascalCase)
 */
export const transformContextToNode = (context) => {
  if (!context) return null;

  // Handle both camelCase (GraphQL) and PascalCase (OData) field names
  const contextDisplayName = context.displayName || context.DisplayName || context.name || context.Name || 'Unknown Context';
  // Store UId for cross-lane filtering (Assignment Policies -> Contexts via AP_CONTEXTS)
  const contextUId = context.UId || context.uId || context.id || context.Id;

  return {
    id: context.id || context.UId || context.Id,
    type: NodeTypes.CONTEXT,
    displayName: contextDisplayName,
    status: 'active',
    badges: [
      context.type || context.Type
    ].filter(Boolean),
    metadata: {
      type: context.type || context.Type,
      description: context.description || context.Description,
      uId: contextUId,  // UId for cross-lane filtering with AP_CONTEXTS
      _raw: context
    }
  };
};

/**
 * Build Contexts lane from assignments data (for system-centric view)
 * Extracts unique contexts from all identities that have access to the system
 * @param {Array} assignments - Array of calculated assignments
 * @param {Object} filters - Active filters
 * @returns {Object} Contexts lane object
 */
export function buildContextsLaneFromAssignments(assignments, filters = {}) {
  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    return {
      laneType: LaneTypes.CONTEXTS,
      totalCount: 0,
      items: [],
      allItemsData: [],
      canLoadMore: false
    };
  }

  // Extract unique contexts from all identities
  const contextsMap = new Map();

  assignments.forEach(assignment => {
    const identityContexts = assignment.identity?.contexts || [];
    identityContexts.forEach(context => {
      const contextId = context.id || context.Id || context.UId;
      if (contextId && !contextsMap.has(contextId)) {
        contextsMap.set(contextId, context);
      }
    });
  });

  const contexts = Array.from(contextsMap.values());

  // Transform to lane items
  const items = contexts.map((context) => {
    const contextNode = transformContextToNode(context);
    return {
      node: contextNode,
      reasons: [],
      groupKey: context.type || 'default',
      groupLabel: context.type || 'Context'
    };
  });

  // Sort by displayName
  items.sort((a, b) =>
    (a.node.displayName || '').toLowerCase().localeCompare((b.node.displayName || '').toLowerCase())
  );

  return {
    laneType: LaneTypes.CONTEXTS,
    totalCount: items.length,
    items: items,
    allItemsData: items,
    canLoadMore: false
  };
}

/**
 * Build Contexts lane from identity contexts data
 */
export function buildContextsLane(contexts, filters = {}) {
  if (!contexts || !Array.isArray(contexts)) {
    return {
      laneType: LaneTypes.CONTEXTS,
      totalCount: 0,
      items: [],
      canLoadMore: false
    };
  }

  const items = contexts.map((context, index) => {
    const contextNode = transformContextToNode(context);

    return {
      node: contextNode,
      reasons: [],
      groupKey: context.type || 'default',
      groupLabel: context.type || 'Context'
    };
  });

  return {
    laneType: LaneTypes.CONTEXTS,
    totalCount: items.length,
    items: items,  // Show ALL items - lane card handles scrolling
    allItemsData: items,  // All items for maximize view
    canLoadMore: false
  };
}

/**
 * Build all lanes from calculated assignments data
 * This is the main function to transform API response into Identity360 lanes
 * @param {Array} assignments - Array of assignment data from API
 * @param {Object} filters - Active filters
 * @param {Object} options - Options for lane building
 * @param {boolean} options.includeIdentities - Include identities lane (for system-centric view)
 * @param {Object} options.systemDetailsMap - Map of systemId -> OData system details
 * @param {string} options.focusNodeType - The NodeTypes value for the central node (for schema-driven building)
 * @param {string} options.focusSystemId - The system ID when in system-centric view (for logical apps lane)
 */
export function buildLanesFromAssignments(assignments, filters = {}, options = {}) {
  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    return [];
  }

  // ============================================================================
  // SCHEMA-DRIVEN LANE BUILDING PATH (when USE_SCHEMA_DRIVEN_LANE_BUILDING is enabled)
  // Uses laneBuilderService for generic, configuration-based lane building
  // ============================================================================
  if (USE_SCHEMA_DRIVEN_LANE_BUILDING && options.focusNodeType) {
    if (shouldLog('LANES')) {
      console.log('[Schema-Driven Lane Building] Using laneBuilderService for', options.focusNodeType);
    }

    const lanes = buildLanesForFocusNode(options.focusNodeType, assignments, {
      filters,
      systemDetailsMap: options.systemDetailsMap
    });

    if (shouldLog('LANES')) {
      console.log('[Schema-Driven Lane Building] Built lanes:', lanes.map(l => `${l.laneType}(${l.items?.length})`).join(', '));
    }
    return lanes;
  }

  // ============================================================================
  // LEGACY LANE BUILDING PATH (original specialized logic)
  // ============================================================================

  const lanes = [];
  const systemDetailsMap = options.systemDetailsMap || {};

  // Build Systems lane (unique PHYSICAL systems from assignments) - skip for system-centric view
  if (!options.includeIdentities) {
    lanes.push(buildSystemsLane(assignments, filters, systemDetailsMap));
  }

  // Build Logical Applications lane (systems with resources but no direct accounts)
  // Only show in Identity-centric view, not system-centric view
  if (!options.includeIdentities) {
    const logicalAppsLane = buildLogicalApplicationsLane(assignments, filters, systemDetailsMap);
    // Only add if there are logical applications
    if (logicalAppsLane.items.length > 0) {
      lanes.push(logicalAppsLane);
    }
  }

  // Build Accounts lane (unique accounts from assignments)
  // Skip for Account-centric view since the Account is the focus node
  const isAccountCentric = !!options.focusAccountName;
  if (!isAccountCentric) {
    lanes.push(buildAccountsLane(assignments, filters));
  }

  // Build Entitlements/Resources lane
  if (shouldLog('LANES')) {
    console.log('[buildLanesFromAssignments] Building entitlements lane with', assignments.length, 'assignments');
    console.log('[buildLanesFromAssignments] options.includeIdentities:', options.includeIdentities);
    if (assignments.length > 0) {
      const withResource = assignments.filter(a => a.resource).length;
      const withResourceId = assignments.filter(a => a.resource?.id).length;
      console.log('[buildLanesFromAssignments] Assignments with resource:', withResource, '| with resource.id:', withResourceId);
      console.log('[buildLanesFromAssignments] First assignment keys:', Object.keys(assignments[0]));
      console.log('[buildLanesFromAssignments] First assignment.resource:', assignments[0].resource ? 'EXISTS' : 'MISSING');
      if (assignments[0].resource) {
        console.log('[buildLanesFromAssignments] First resource:', JSON.stringify({
          id: assignments[0].resource.id,
          name: assignments[0].resource.name,
          resourceType: assignments[0].resource.resourceType
        }));
      }
    }
  }
  lanes.push(buildEntitlementsLane(assignments, filters));

  // Build Assignment Policies lane (policies extracted from assignment reasons)
  // Show in Identity-centric view, Account-centric view, AND System-centric view
  const isSystemCentric = !!options.focusSystemId;
  if (!options.includeIdentities || isAccountCentric || isSystemCentric) {
    const assignmentPoliciesLane = buildAssignmentPoliciesLane(assignments, filters);
    // Only add if there are policies
    if (assignmentPoliciesLane.items.length > 0) {
      lanes.push(assignmentPoliciesLane);
    }
  }

  // Build Violations lane (violations extracted from assignments)
  // Show in Identity-centric view, Account-centric view, AND System-centric view
  if (!options.includeIdentities || isAccountCentric || isSystemCentric) {
    const violationsLane = buildViolationsLane(assignments, filters);
    // Only add if there are violations
    if (violationsLane.items.length > 0) {
      lanes.push(violationsLane);
    }
  }

  // Build Identities lane (for system-centric and account-centric views)
  if (options.includeIdentities) {
    lanes.push(buildIdentitiesLane(assignments, filters));
  }

  // Build Contexts lane (for system-centric view)
  // Shows the organizational contexts (roles, departments, etc.) of identities with access to the system
  if (isSystemCentric) {
    const contextsLane = buildContextsLaneFromAssignments(assignments, filters);
    if (contextsLane.items.length > 0) {
      lanes.push(contextsLane);
      if (shouldLog('LANES')) {
        console.log(`[buildLanesFromAssignments] Contexts lane (system): ${contextsLane.items.length} items`);
      }
    }
  }

  // Build Logical Applications lane
  // For system-centric view: shows logical apps implemented by the focus system
  // For account-centric view: shows logical apps accessible via the account's entitlements
  if (options.includeIdentities && options.focusSystemId) {
    // System-centric view
    const logicalAppsLane = buildLogicalAppsForSystemLane(
      assignments,
      filters,
      options.focusSystemId,
      systemDetailsMap
    );
    lanes.push(logicalAppsLane);
    if (shouldLog('LANES')) {
      console.log(`[buildLanesFromAssignments] Logical Apps lane (system): ${logicalAppsLane.items.length} items`);
    }
  } else if (isAccountCentric) {
    // Account-centric view: build logical apps from entitlements' systems
    const logicalAppsLane = buildLogicalApplicationsLane(assignments, filters, systemDetailsMap);
    if (logicalAppsLane.items.length > 0) {
      lanes.push(logicalAppsLane);
    }
    if (shouldLog('LANES')) {
      console.log(`[buildLanesFromAssignments] Logical Apps lane (account): ${logicalAppsLane.items.length} items`);
    }
  }

  return lanes;
}

/**
 * Build Systems lane from assignments data (extract unique PHYSICAL systems only)
 * Logical applications (systems with resources but no accounts) are excluded here
 * and handled by buildLogicalApplicationsLane instead.
 *
 * IMPORTANT: Extracts systems from BOTH account.system AND resource.system
 * because an account might be on one system (e.g., Active Directory) while
 * the resource/entitlement is on a different system (e.g., Document Management)
 *
 * @param {Array} assignments - Array of assignment data
 * @param {Object} filters - Active filters
 * @param {Object} systemDetailsMap - Map of systemId -> OData system details
 */
function buildSystemsLane(assignments, filters, systemDetailsMap = {}) {
  if (shouldLog('SYSTEMS')) {
    console.log('=== buildSystemsLane ===');
    console.log('Assignments:', assignments.length, '| System details:', Object.keys(systemDetailsMap).length);
  }

  // Extract unique systems from BOTH accounts and resources
  const systemsMap = new Map();

  assignments.forEach((assignment) => {
    // Extract system from account
    const accountSystem = assignment.account?.system;
    if (accountSystem && accountSystem.id && !systemsMap.has(accountSystem.id)) {
      systemsMap.set(accountSystem.id, {
        id: accountSystem.id,
        name: accountSystem.name || '',
        accountCount: 0,
        resourceCount: 0
      });
    }

    // Extract system from resource (may be different from account system!)
    const resourceSystem = assignment.resource?.system;
    if (resourceSystem && resourceSystem.id && !systemsMap.has(resourceSystem.id)) {
      systemsMap.set(resourceSystem.id, {
        id: resourceSystem.id,
        name: resourceSystem.name || '',
        accountCount: 0,
        resourceCount: 0
      });
    }

    // Count accounts per system (using account's system)
    if (accountSystem && systemsMap.has(accountSystem.id)) {
      systemsMap.get(accountSystem.id).accountCount++;
    }

    // Count resources per system (using resource's system)
    if (resourceSystem && systemsMap.has(resourceSystem.id)) {
      systemsMap.get(resourceSystem.id).resourceCount++;
    }
  });

  // Determine which systems are "logical" (have resources but no direct accounts)
  // These will be EXCLUDED from the Systems lane and shown in Logical Applications instead
  Array.from(systemsMap.values()).forEach(sys => {
    sys.isLogical = sys.resourceCount > 0 && sys.accountCount === 0;
  });

  // Filter to only PHYSICAL systems (exclude logical applications)
  const physicalSystems = Array.from(systemsMap.values())
    .filter(sys => !sys.isLogical)
    .sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()));

  if (shouldLog('SYSTEMS')) {
    console.log('Physical systems:', physicalSystems.length, '| Logical (excluded):', systemsMap.size - physicalSystems.length);
  }

  const items = physicalSystems.map((sys) => {
    // Get enriched details from OData if available
    const odataDetails = systemDetailsMap[sys.id] || {};

    // Extract system type, description, owner, and classification from OData
    // Note: SYSTEMTYPE might be named differently, and OWNERREF is an array
    const systemTypeObj = odataDetails.SYSTEMTYPE || odataDetails.C_SYSTEMTYPE || odataDetails.SystemType;
    const systemType = Array.isArray(systemTypeObj)
      ? systemTypeObj[0]?.DisplayName || systemTypeObj[0]?.Name
      : systemTypeObj?.DisplayName || systemTypeObj?.Name || null;

    const description = odataDetails.DESCRIPTION || odataDetails.Description || null;

    // OWNERREF is an array - get first owner's display name
    const ownerRef = odataDetails.OWNERREF;
    const owner = Array.isArray(ownerRef) && ownerRef.length > 0
      ? ownerRef[0]?.DisplayName || ownerRef[0]?.Name
      : ownerRef?.DisplayName || ownerRef?.Name || null;

    // CLT_TAGS might also be an array
    const tagsObj = odataDetails.CLT_TAGS;
    const classification = Array.isArray(tagsObj)
      ? tagsObj[0]?.DisplayName || tagsObj[0]?.Name
      : tagsObj?.DisplayName || tagsObj?.Name || null;

    // Build badges from enriched data
    const badges = [];
    if (systemType) badges.push(systemType);
    if (classification) badges.push(classification);

    const systemNode = {
      id: sys.id,
      type: NodeTypes.SYSTEM,
      displayName: sys.name || 'Unknown System',
      description: description,  // For hover tooltip
      status: 'active',
      badges: badges,
      metadata: {
        accountCount: sys.accountCount,
        resourceCount: sys.resourceCount,
        isLogical: false,
        // Enriched OData details
        systemType: systemType,
        description: description,
        owner: owner,
        classification: classification
      },
      rawData: {
        id: sys.id,
        name: sys.name,
        accountCount: sys.accountCount,
        resourceCount: sys.resourceCount,
        isLogical: false,
        // Include full OData response for Object Inspector
        ...odataDetails
      }
    };

    return {
      node: systemNode,
      reasons: [],
      groupKey: 'systems',
      groupLabel: 'Systems',
      rawData: { ...sys, ...odataDetails }
    };
  });

  return {
    laneType: LaneTypes.SYSTEMS,
    totalCount: items.length,
    items: items,  // Show ALL items - lane card handles scrolling
    allItemsData: items,
    canLoadMore: false
  };
}

/**
 * Build Logical Applications lane from assignments data
 * Logical applications are systems that have resources but no direct accounts.
 * They are implemented via other systems (e.g., Document Management via Active Directory)
 *
 * Each logical application stores a mapping to the underlying physical systems
 * that host the accounts which grant access to its resources.
 *
 * @param {Array} assignments - Array of assignment data
 * @param {Object} filters - Active filters
 * @param {Object} systemDetailsMap - Map of systemId -> OData system details
 */
function buildLogicalApplicationsLane(assignments, filters, systemDetailsMap = {}) {
  if (shouldLog('SYSTEMS')) {
    console.log('=== buildLogicalApplicationsLane ===');
  }

  // Map to track systems: { systemId -> { ...systemData, underlyingSystemIds: Set } }
  const systemsMap = new Map();
  // Map to track which physical system provides access to which logical system's resources
  const logicalToPhysicalMap = new Map(); // logicalSystemId -> Set of physicalSystemIds

  assignments.forEach((assignment) => {
    const accountSystem = assignment.account?.system;
    const resourceSystem = assignment.resource?.system;

    // Track account systems
    if (accountSystem && accountSystem.id) {
      if (!systemsMap.has(accountSystem.id)) {
        systemsMap.set(accountSystem.id, {
          id: accountSystem.id,
          name: accountSystem.name || '',
          accountCount: 0,
          resourceCount: 0
        });
      }
      systemsMap.get(accountSystem.id).accountCount++;
    }

    // Track resource systems
    if (resourceSystem && resourceSystem.id) {
      if (!systemsMap.has(resourceSystem.id)) {
        systemsMap.set(resourceSystem.id, {
          id: resourceSystem.id,
          name: resourceSystem.name || '',
          accountCount: 0,
          resourceCount: 0
        });
      }
      systemsMap.get(resourceSystem.id).resourceCount++;

      // If resource system differs from account system, track the relationship
      if (accountSystem && accountSystem.id !== resourceSystem.id) {
        if (!logicalToPhysicalMap.has(resourceSystem.id)) {
          logicalToPhysicalMap.set(resourceSystem.id, new Set());
        }
        logicalToPhysicalMap.get(resourceSystem.id).add(accountSystem.id);
      }
    }
  });

  // Find logical applications (systems with resources but no accounts)
  const logicalApps = Array.from(systemsMap.values())
    .filter(sys => sys.resourceCount > 0 && sys.accountCount === 0)
    .sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()));

  if (shouldLog('SYSTEMS')) {
    console.log('Logical Applications found:', logicalApps.length);
  }

  const items = logicalApps.map((app) => {
    // Get enriched details from OData if available
    const odataDetails = systemDetailsMap[app.id] || {};

    // Extract system type, description, owner, and classification from OData
    // Note: SYSTEMTYPE might be named differently, and OWNERREF is an array
    const systemTypeObj = odataDetails.SYSTEMTYPE || odataDetails.C_SYSTEMTYPE || odataDetails.SystemType;
    const systemType = Array.isArray(systemTypeObj)
      ? systemTypeObj[0]?.DisplayName || systemTypeObj[0]?.Name
      : systemTypeObj?.DisplayName || systemTypeObj?.Name || null;

    const description = odataDetails.DESCRIPTION || odataDetails.Description || null;

    // OWNERREF is an array - get first owner's display name
    const ownerRef = odataDetails.OWNERREF;
    const owner = Array.isArray(ownerRef) && ownerRef.length > 0
      ? ownerRef[0]?.DisplayName || ownerRef[0]?.Name
      : ownerRef?.DisplayName || ownerRef?.Name || null;

    // CLT_TAGS might also be an array
    const tagsObj = odataDetails.CLT_TAGS;
    const classification = Array.isArray(tagsObj)
      ? tagsObj[0]?.DisplayName || tagsObj[0]?.Name
      : tagsObj?.DisplayName || tagsObj?.Name || null;

    // Get the underlying physical systems that provide access
    const physicalSystemIds = logicalToPhysicalMap.get(app.id) || new Set();
    const physicalSystems = Array.from(physicalSystemIds).map(id => ({
      id,
      name: systemsMap.get(id)?.name || 'Unknown'
    }));

    // Build badges - show system type first, then classification, then underlying systems
    const badges = [];
    if (systemType) badges.push(systemType);
    if (classification) badges.push(classification);
    // Add underlying systems if we have room
    if (badges.length < 3) {
      physicalSystems.slice(0, 3 - badges.length).forEach(s => badges.push(`via ${s.name}`));
    }

    const appNode = {
      id: app.id,
      type: NodeTypes.LOGICAL_APPLICATION,  // Use new node type for proper schema support
      displayName: app.name || 'Unknown Application',
      description: description,  // For hover tooltip
      status: 'active',
      badges: badges.slice(0, DEFAULTS.MAX_BADGES_PER_ITEM),
      metadata: {
        resourceCount: app.resourceCount,
        isLogical: true,
        underlyingSystemIds: Array.from(physicalSystemIds),
        underlyingSystems: physicalSystems,
        // Enriched OData details
        systemType: systemType,
        description: description,
        owner: owner,
        classification: classification
      },
      rawData: {
        id: app.id,
        name: app.name,
        resourceCount: app.resourceCount,
        isLogical: true,
        underlyingSystemIds: Array.from(physicalSystemIds),
        underlyingSystems: physicalSystems,
        // Include full OData response for Object Inspector
        ...odataDetails
      }
    };

    return {
      node: appNode,
      reasons: [],
      groupKey: 'logical-applications',
      groupLabel: 'Logical Applications',
      rawData: { ...app, ...odataDetails }
    };
  });

  return {
    laneType: LaneTypes.LOGICAL_APPLICATIONS,
    totalCount: items.length,
    items: items,  // Show ALL items - lane card handles scrolling
    allItemsData: items,
    canLoadMore: false
  };
}

/**
 * Build Logical Applications lane for System-centric view
 * When the focus is a physical system, find logical applications that are implemented by this system.
 * A logical app is implemented by this system when:
 * - The assignment's account is on this system (focus system)
 * - The assignment's resource is on a DIFFERENT system (the logical app)
 *
 * @param {Array} assignments - Array of assignment data
 * @param {Object} filters - Active filters
 * @param {string} focusSystemId - The ID of the focus system
 * @param {Object} systemDetailsMap - Map of systemId -> OData system details
 */
function buildLogicalAppsForSystemLane(assignments, filters, focusSystemId, systemDetailsMap = {}) {
  if (shouldLog('SYSTEMS')) {
    console.log('=== buildLogicalAppsForSystemLane ===');
    console.log('Focus System ID:', focusSystemId, '| Assignments:', assignments?.length);
  }

  if (!assignments || !focusSystemId) {
    return {
      laneType: LaneTypes.LOGICAL_APPLICATIONS,
      totalCount: 0,
      items: [],
      allItemsData: [],
      canLoadMore: false
    };
  }

  // Use the Identity-centric approach: find systems with resources but no accounts
  // These are "logical applications" - systems accessed via other physical systems
  const systemsMap = new Map();
  const logicalToPhysicalMap = new Map(); // logicalSystemId -> Set of physicalSystemIds
  const focusSystemIdStr = String(focusSystemId);

  // First pass: count accounts and resources per system
  assignments.forEach((assignment) => {
    const accountSystem = assignment.account?.system;
    const resourceSystem = assignment.resource?.system;

    // Track account systems
    if (accountSystem && accountSystem.id) {
      const accountSystemIdStr = String(accountSystem.id);
      if (!systemsMap.has(accountSystemIdStr)) {
        systemsMap.set(accountSystemIdStr, {
          id: accountSystem.id,
          name: accountSystem.name || '',
          accountCount: 0,
          resourceCount: 0
        });
      }
      systemsMap.get(accountSystemIdStr).accountCount++;
    }

    // Track resource systems
    if (resourceSystem && resourceSystem.id) {
      const resourceSystemIdStr = String(resourceSystem.id);
      if (!systemsMap.has(resourceSystemIdStr)) {
        systemsMap.set(resourceSystemIdStr, {
          id: resourceSystem.id,
          name: resourceSystem.name || '',
          accountCount: 0,
          resourceCount: 0
        });
      }
      systemsMap.get(resourceSystemIdStr).resourceCount++;

      // If resource system differs from account system, track the relationship
      if (accountSystem && String(accountSystem.id) !== resourceSystemIdStr) {
        if (!logicalToPhysicalMap.has(resourceSystemIdStr)) {
          logicalToPhysicalMap.set(resourceSystemIdStr, new Set());
        }
        logicalToPhysicalMap.get(resourceSystemIdStr).add(String(accountSystem.id));
      }
    }
  });

  // Find logical applications: systems that have resources but no direct accounts
  // AND are accessible via the focus system (or any physical system if no focus match)
  const logicalAppsMap = new Map();

  systemsMap.forEach((system, systemIdStr) => {
    // Skip the focus system itself
    if (systemIdStr === focusSystemIdStr) return;

    // Logical app criteria: has resources but no accounts
    if (system.resourceCount > 0 && system.accountCount === 0) {
      const implementingSystemIds = logicalToPhysicalMap.get(systemIdStr);

      // Include ALL logical apps found since assignments are already filtered by focus system
      if (implementingSystemIds?.size > 0) {
        // Get implementing system names
        const implementingNames = new Set();
        implementingSystemIds?.forEach(implId => {
          const implSystem = systemsMap.get(implId);
          if (implSystem?.name) implementingNames.add(implSystem.name);
        });

        logicalAppsMap.set(systemIdStr, {
          id: system.id,
          name: system.name || 'Unknown',
          resourceCount: system.resourceCount,
          // Track which systems implement this logical app
          implementingSystemIds: implementingSystemIds ? Array.from(implementingSystemIds) : [],
          implementingSystemNames: implementingNames ? Array.from(implementingNames) : []
        });
      }
    }
  });

  const logicalApps = Array.from(logicalAppsMap.values())
    .sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()));

  if (shouldLog('SYSTEMS')) {
    console.log('[LogicalApps] Found:', logicalApps.length, 'logical applications');
  }

  const items = logicalApps.map((app) => {
    // Get enriched details from OData if available
    const odataDetails = systemDetailsMap[app.id] || {};

    // Extract system type from OData
    const systemTypeObj = odataDetails.SYSTEMTYPE || odataDetails.SystemType;
    const systemType = Array.isArray(systemTypeObj)
      ? systemTypeObj[0]?.DisplayName || systemTypeObj[0]?.Name
      : systemTypeObj?.DisplayName || systemTypeObj?.Name || null;

    const appNode = {
      id: app.id,
      type: NodeTypes.LOGICAL_APPLICATION,  // Use new node type for proper schema support
      displayName: app.name,
      status: 'active',
      badges: [
        systemType || 'Logical App',
        `${app.resourceCount} resource${app.resourceCount !== 1 ? 's' : ''}`
      ].filter(Boolean),
      metadata: {
        resourceCount: app.resourceCount,
        isLogical: true,
        systemType: systemType,
        // Store the implementing systems for cross-lane filtering
        underlyingSystemIds: app.implementingSystemIds,
        underlyingSystems: app.implementingSystemNames.map(name => ({ name }))
      },
      rawData: {
        id: app.id,
        name: app.name,
        resourceCount: app.resourceCount,
        isLogical: true,
        ...odataDetails
      }
    };

    return {
      node: appNode,
      reasons: [],
      groupKey: 'logical-applications',
      groupLabel: 'Logical Applications',
      rawData: { ...app, ...odataDetails }
    };
  });

  return {
    laneType: LaneTypes.LOGICAL_APPLICATIONS,
    totalCount: items.length,
    items: items,
    allItemsData: items,
    canLoadMore: false
  };
}

/**
 * Build Accounts lane from assignments data (extract unique accounts)
 * Data source: getCalculatedAssignments API -> assignment.account
 *
 * IMPORTANT: Uses composite key (accountId OR accountName+systemId) to ensure
 * accounts with the same name on different systems are treated as separate accounts.
 */
function buildAccountsLane(assignments, filters) {
  if (shouldLog('ACCOUNTS')) {
    console.log('=== buildAccountsLane: Starting ===');
    console.log('Total assignments received:', assignments.length);
  }

  // Extract unique accounts from assignments
  // Use composite key: account.id if available, otherwise accountName + systemId
  const accountsMap = new Map();

  assignments.forEach((assignment, index) => {
    const account = assignment.account;

    if (!account) {
      return;
    }

    // Create a unique key for this account
    // Prefer account.id if available, otherwise use accountName + systemId
    const accountId = account.id;
    const systemId = account.system?.id;
    const accountName = account.accountName;

    // Composite key ensures same account name on different systems are unique
    const uniqueKey = accountId || `${accountName}::${systemId || 'unknown'}`;

    if (accountName && !accountsMap.has(uniqueKey)) {
      // Store the identity that owns this account (for cross-lane filtering in System-centric view)
      const identity = assignment.identity;
      accountsMap.set(uniqueKey, {
        id: accountId || uniqueKey,
        accountName: accountName,
        accountType: account.accountType,
        system: account.system,
        resourceCount: 0,
        // Store identity info for cross-lane filtering
        identityId: identity?.id,
        identityDisplayName: identity?.displayName,
        identityIds: new Set([identity?.id].filter(Boolean))  // Track all identities that use this account
      });
    } else if (accountName && accountsMap.has(uniqueKey)) {
      // Account already exists - add this identity to the set of identities using this account
      const identity = assignment.identity;
      if (identity?.id) {
        accountsMap.get(uniqueKey).identityIds.add(identity.id);
      }
    }

    // Count resources per account (exclude "personal account" resources to match entitlements lane filtering)
    if (accountName && accountsMap.has(uniqueKey)) {
      const resourceName = assignment.resource?.name || '';
      const isPersonalAccount = resourceName.toLowerCase().includes('personal account');
      if (!isPersonalAccount) {
        accountsMap.get(uniqueKey).resourceCount++;
      }
    }
  });

  if (shouldLog('ACCOUNTS')) {
    console.log('=== buildAccountsLane: Results ===');
    console.log('Unique accounts extracted:', accountsMap.size);
  }

  const items = Array.from(accountsMap.values()).map((acc, index) => {
    const accountNode = {
      id: acc.id,
      type: NodeTypes.ACCOUNT,
      displayName: acc.accountName || 'Unknown Account',
      status: 'active',
      badges: [
        acc.system?.name,
        acc.accountType?.name
      ].filter(Boolean),
      metadata: {
        system: acc.system?.name,
        systemId: acc.system?.id,
        accountType: acc.accountType?.name,
        resourceCount: acc.resourceCount,
        // Cross-lane filtering: store identity info
        identityId: acc.identityId,
        identityDisplayName: acc.identityDisplayName,
        identityIds: Array.from(acc.identityIds || [])  // All identities using this account
      },
      rawData: {
        id: acc.id,
        accountName: acc.accountName,
        accountType: acc.accountType,
        system: acc.system,
        resourceCount: acc.resourceCount,
        // Cross-lane filtering: store identity info
        identity: {
          id: acc.identityId,
          displayName: acc.identityDisplayName
        },
        identityIds: Array.from(acc.identityIds || [])
      }
    };

    return {
      node: accountNode,
      reasons: [],
      groupKey: acc.system?.id || 'unknown',
      groupLabel: acc.system?.name || 'Unknown System',
      rawData: {
        id: acc.id,
        accountName: acc.accountName,
        accountType: acc.accountType,
        system: acc.system,
        resourceCount: acc.resourceCount,
        identity: {
          id: acc.identityId,
          displayName: acc.identityDisplayName
        },
        identityIds: Array.from(acc.identityIds || [])
      }
    };
  });

  // Sort items based on LaneSchema defaultSort configuration
  const accountsSchema = LaneSchema[LaneTypes.ACCOUNTS];
  if (accountsSchema?.defaultSort) {
    const { field, order } = accountsSchema.defaultSort;
    items.sort((a, b) => {
      const aValue = (a.node[field] || a.node.displayName || '').toLowerCase();
      const bValue = (b.node[field] || b.node.displayName || '').toLowerCase();
      const comparison = aValue.localeCompare(bValue);
      return order === 'desc' ? -comparison : comparison;
    });
  }

  return {
    laneType: LaneTypes.ACCOUNTS,
    totalCount: items.length,
    items: items,  // Show ALL items - lane card handles scrolling
    allItemsData: items,  // All items for maximize view
    canLoadMore: false
  };
}

/**
 * Build Identities lane from assignments data (extract unique identities)
 * Used for System-centric view where we show which identities have access to the system
 * Data source: getCalculatedAssignments API (filtered by systemId) -> assignment.identity
 */
function buildIdentitiesLane(assignments, filters) {
  // Suppressed verbose logging for performance
  // console.log('[buildIdentitiesLane] Starting with', assignments.length, 'assignments');

  // Extract unique identities from assignments
  const identitiesMap = new Map();

  assignments.forEach((assignment, index) => {
    const identity = assignment.identity;

    if (identity && identity.id && !identitiesMap.has(identity.id)) {
      // Store account info for cross-lane filtering in System-centric view
      const account = assignment.account;
      identitiesMap.set(identity.id, {
        id: identity.id,
        identityId: identity.identityId,
        displayName: identity.displayName || `${identity.firstName || ''} ${identity.lastName || ''}`.trim(),
        firstName: identity.firstName,
        lastName: identity.lastName,
        email: identity.email,
        title: identity.title,
        employeeId: identity.employeeId,
        department: identity.department,
        riskLevel: identity.riskLevel?.name,
        accounts: identity.accounts || [],
        contexts: identity.contexts || [],
        resourceCount: 0,
        // Cross-lane filtering: track all account IDs associated with this identity
        accountIds: new Set([account?.id].filter(Boolean))
      });
    } else if (identity && identity.id && identitiesMap.has(identity.id)) {
      // Identity already exists - add this account to the set of accounts for this identity
      const account = assignment.account;
      if (account?.id) {
        identitiesMap.get(identity.id).accountIds.add(account.id);
      }
    }

    // Count resources per identity
    if (identity && identity.id && identitiesMap.has(identity.id)) {
      identitiesMap.get(identity.id).resourceCount++;
    }
  });

  // console.log('[buildIdentitiesLane] Unique identities:', identitiesMap.size);

  const items = Array.from(identitiesMap.values()).map((ident) => {
    const identityNode = {
      id: ident.id,
      type: NodeTypes.IDENTITY,
      displayName: ident.displayName || 'Unknown Identity',
      status: 'active',
      badges: [
        ident.riskLevel
      ].filter(Boolean),
      metadata: {
        identityId: ident.identityId,
        firstName: ident.firstName,
        lastName: ident.lastName,
        email: ident.email,
        title: ident.title,
        employeeId: ident.employeeId,
        department: ident.department,
        riskLevel: ident.riskLevel,
        accountCount: ident.accounts?.length || 0,
        resourceCount: ident.resourceCount,
        // Cross-lane filtering: store account IDs
        accountIds: Array.from(ident.accountIds || [])
      },
      rawData: {
        id: ident.id,
        identityId: ident.identityId,
        displayName: ident.displayName,
        firstName: ident.firstName,
        lastName: ident.lastName,
        email: ident.email,
        title: ident.title,
        employeeId: ident.employeeId,
        department: ident.department,
        riskLevel: ident.riskLevel,
        accounts: ident.accounts,
        contexts: ident.contexts,
        // Cross-lane filtering: store account IDs
        accountIds: Array.from(ident.accountIds || [])
      }
    };

    return {
      node: identityNode,
      reasons: [],
      groupKey: 'identities',
      groupLabel: 'Identities',
      rawData: {
        ...ident,
        accountIds: Array.from(ident.accountIds || [])
      }
    };
  });

  // Apply exclusion rules to filter out unwanted identities (e.g., "UNRESOLVED IDENTITY")
  const laneConfig = LaneDisplayConfig[LaneTypes.IDENTITIES] || {};
  let filteredItems = items;

  if (laneConfig.exclusionList && laneConfig.exclusionList.length > 0) {
    filteredItems = items.filter(item => {
      const displayName = (item.node?.displayName || '').toLowerCase().trim();

      // Check each exclusion rule
      for (const rule of laneConfig.exclusionList) {
        const { fields, values, matchType = 'exact' } = rule;

        // Check if displayName matches any excluded value
        for (const excludeValue of values) {
          const excludeLower = excludeValue.toLowerCase().trim();
          let isMatch = false;

          switch (matchType) {
            case 'contains':
              isMatch = displayName.includes(excludeLower);
              break;
            case 'endsWith':
              isMatch = displayName.endsWith(excludeLower);
              break;
            case 'startsWith':
              isMatch = displayName.startsWith(excludeLower);
              break;
            case 'equals':
            case 'exact':
            default:
              isMatch = displayName === excludeLower;
              break;
          }

          if (isMatch) {
            // console.log(`[buildIdentitiesLane] Excluding identity: "${item.node?.displayName}"`);
            return false; // Exclude this item
          }
        }
      }
      return true; // Keep this item
    });

    // console.log(`[buildIdentitiesLane] Exclusion: ${items.length} -> ${filteredItems.length} identities`);
  }

  // Sort identities alphabetically by displayName
  filteredItems.sort((a, b) =>
    (a.node.displayName || '').toLowerCase().localeCompare((b.node.displayName || '').toLowerCase())
  );

  return {
    laneType: LaneTypes.IDENTITIES,
    totalCount: filteredItems.length,
    items: filteredItems,  // Show ALL items - lane card handles scrolling
    allItemsData: filteredItems,  // All items for maximize view
    canLoadMore: false
  };
}

// Use getNestedValue from accessLensUtils (imported as getNestedValueUtil)
const getNestedValue = getNestedValueUtil;

/**
 * Apply exclusion rules from lane config to filter out unwanted items
 * @param {Array} items - Array of items to filter
 * @param {Array} exclusionList - Array of exclusion rules from LaneDisplayConfig
 * @returns {Array} Filtered items
 */
function applyExclusionRules(items, exclusionList) {
  if (!exclusionList || exclusionList.length === 0) return items;

  let excludedCount = 0;
  let keptCount = 0;

  // Debug logging for exclusion rules
  if (shouldLog('EXCLUSION_RULES')) {
    console.log('[applyExclusionRules] Processing', items.length, 'items with', exclusionList.length, 'exclusion rules');
    if (items.length > 0) {
      console.log('[applyExclusionRules] Sample item structure:', JSON.stringify({
        hasResource: !!items[0].resource,
        resourceName: items[0].resource?.name,
        resourceTypeName: items[0].resource?.resourceType?.name,
        resourceTypeObj: items[0].resource?.resourceType
      }, null, 2));
    }
  }

  const filtered = items.filter((item, index) => {
    const resourceName = getNestedValue(item, 'resource.name') || 'UNKNOWN';
    const resourceType = getNestedValue(item, 'resource.resourceType.name') || 'NO_TYPE';
    const resourceDesc = getNestedValue(item, 'resource.description') || '';

    // Debug log first 5 items
    if (shouldLog('EXCLUSION_RULES') && index < 5) {
      console.log(`[Exclusion Check ${index}] "${resourceName}" type="${resourceType}"`);
    }

    // Check each exclusion rule
    for (const rule of exclusionList) {
      const { fields, values, matchType = 'exact' } = rule;

      // Check each field specified in the rule
      for (const field of fields) {
        const fieldValue = (getNestedValue(item, field) || '').toLowerCase().trim();

        // Check if field value matches any of the excluded values
        for (const excludeValue of values) {
          const excludeLower = excludeValue.toLowerCase().trim();
          // Support multiple match types: exact, contains, endsWith, startsWith
          let isMatch = false;
          switch (matchType) {
            case 'contains':
              isMatch = fieldValue.includes(excludeLower);
              break;
            case 'endsWith':
              isMatch = fieldValue.endsWith(excludeLower);
              break;
            case 'startsWith':
              isMatch = fieldValue.startsWith(excludeLower);
              break;
            case 'exact':
            default:
              isMatch = fieldValue === excludeLower;
              break;
          }

          if (isMatch) {
            if (shouldLog('EXCLUSION_RULES') && excludedCount < 5) {
              console.log(`  EXCLUDED: field "${field}" = "${fieldValue}" matches "${excludeValue}" (${matchType})`);
            }
            excludedCount++;
            return false; // Exclude this item
          }
        }
      }
    }

    // Item passed all rules - keep it
    keptCount++;
    if (shouldLog('EXCLUSION_RULES') && keptCount <= 10) {
      console.log(`  KEPT: "${resourceName}" [type: "${resourceType}"]`);
    }
    return true;
  });

  if (shouldLog('EXCLUSION_RULES')) {
    console.log(`[applyExclusionRules] SUMMARY: ${excludedCount} excluded, ${keptCount} kept out of ${items.length} total`);
  }

  return filtered;
}

/**
 * Build Entitlements lane from assignments data
 * Applies exclusion rules from LaneDisplayConfig
 * Excludes account-type resources (these belong in the Accounts lane)
 */
function buildEntitlementsLane(assignments, filters) {
  // Debug logging to diagnose empty entitlements issue
  if (shouldLog('ENTITLEMENTS') || shouldLog('EXCLUSION_RULES')) {
    console.log('[buildEntitlementsLane] Starting with', assignments.length, 'assignments');
  }

  if (assignments.length === 0) {
    if (shouldLog('ENTITLEMENTS')) {
      console.warn('[buildEntitlementsLane] No assignments provided');
    }
    return {
      laneType: LaneTypes.EFFECTIVE_ENTITLEMENTS,
      totalCount: 0,
      items: [],
      allItemsData: [],
      canLoadMore: false
    };
  }

  // Get lane config for exclusion rules
  const laneConfig = LaneDisplayConfig[LaneTypes.EFFECTIVE_ENTITLEMENTS] || {};

  // Debug logging for exclusion rules
  if (shouldLog('ENTITLEMENTS')) {
    console.log('[buildEntitlementsLane] Exclusion rules:', JSON.stringify(laneConfig.exclusionList, null, 2));
    const withResource = assignments.filter(a => a.resource).length;
    const withoutResource = assignments.length - withResource;
    console.log(`[buildEntitlementsLane] Assignments with resource: ${withResource}, without resource: ${withoutResource}`);
    console.log('[buildEntitlementsLane] Sample assignment structure:',
      JSON.stringify(assignments.slice(0, 3).map(a => ({
        hasResource: !!a.resource,
        resourceName: a.resource?.name,
        resourceTypeName: a.resource?.resourceType?.name,
        resourceDescription: a.resource?.description?.substring(0, 50)
      })), null, 2));
  }

  // Apply exclusion rules from lane config to filter out account-type resources
  const filteredAssignments = applyExclusionRules(assignments, laneConfig.exclusionList);

  const excludedCount = assignments.length - filteredAssignments.length;
  // Log summary info when debugging
  if (shouldLog('ENTITLEMENTS') || shouldLog('EXCLUSION_RULES')) {
    console.log(`[buildEntitlementsLane] After exclusion: ${filteredAssignments.length} kept, ${excludedCount} excluded`);
  }

  if (filteredAssignments.length === 0 && assignments.length > 0) {
    if (shouldLog('ENTITLEMENTS')) {
      console.warn('[buildEntitlementsLane] WARNING: All resources were excluded by exclusion rules or had no resource data!');
    }
  }

  // DEDUPLICATION: Group assignments by resource ID to avoid showing the same entitlement multiple times
  // This is especially important for System-centric view where the same entitlement appears
  // once per identity/account that has it
  const resourceMap = new Map();

  filteredAssignments.forEach((assignment) => {
    const resourceId = assignment.resource?.id;
    if (!resourceId) return;

    if (!resourceMap.has(resourceId)) {
      // First occurrence - create the resource entry
      resourceMap.set(resourceId, {
        resource: assignment.resource,
        assignments: [],
        identityIds: new Set(),
        accountIds: new Set(),
        complianceStatuses: new Set(),
        reasons: [],
        violations: []  // Track violations for this resource
      });
    }

    // Aggregate data from this assignment
    const entry = resourceMap.get(resourceId);
    entry.assignments.push(assignment);
    if (assignment.identity?.id) entry.identityIds.add(assignment.identity.id);
    if (assignment.account?.id) entry.accountIds.add(assignment.account.id);
    if (assignment.complianceStatus) entry.complianceStatuses.add(assignment.complianceStatus);
    if (assignment.reason) entry.reasons.push(assignment.reason);
    // Track violations - each assignment may have violations
    if (assignment.violations && Array.isArray(assignment.violations) && assignment.violations.length > 0) {
      entry.violations.push(...assignment.violations.map(v => ({
        ...v,
        resourceId: resourceId,
        resourceName: assignment.resource?.name
      })));
    }
  });

  if (shouldLog('ENTITLEMENTS') || shouldLog('EXCLUSION_RULES')) {
    const assignmentsWithResourceId = filteredAssignments.filter(a => a.resource?.id).length;
    console.log(`[buildEntitlementsLane] Deduplication: ${filteredAssignments.length} assignments, ${assignmentsWithResourceId} have resource.id -> ${resourceMap.size} unique resources`);
  }

  // Build lane items from deduplicated resources
  const items = Array.from(resourceMap.entries()).map(([resourceId, entry], index) => {
    const resource = entry.resource;
    const firstAssignment = entry.assignments[0]; // Use first assignment for base data

    // Determine overall compliance status (prefer "Not Approved" if any exist)
    let overallComplianceStatus = 'Approved';
    if (entry.complianceStatuses.has('Not Approved')) {
      overallComplianceStatus = 'Not Approved';
    } else if (entry.complianceStatuses.has('Pending')) {
      overallComplianceStatus = 'Pending';
    }

    const entitlementNode = {
      id: resourceId,
      type: NodeTypes.ENTITLEMENT,
      displayName: resource?.name || 'Unknown',
      status: 'active',
      badges: [
        resource?.system?.name,
        resource?.resourceType?.name,
        entry.identityIds.size > 1 ? `${entry.identityIds.size} users` : null
      ].filter(Boolean),
      metadata: {
        system: resource?.system?.name,
        systemId: resource?.system?.id,
        type: resource?.resourceType?.name,
        complianceStatus: overallComplianceStatus,
        validFrom: firstAssignment.validFrom || null,
        validTo: firstAssignment.validTo || null,
        // Aggregated info for cross-lane filtering
        // Store arrays of all related accounts/identities for proper filtering
        accountIds: Array.from(entry.accountIds),
        identityIds: Array.from(entry.identityIds),
        assignmentCount: entry.assignments.length,
        // Keep first assignment's account/identity for backward compatibility
        accountName: firstAssignment.account?.accountName,
        accountId: firstAssignment.account?.id,
        identityId: firstAssignment.identity?.id,
        identityDisplayName: firstAssignment.identity?.displayName,
        // Violation tracking
        hasViolations: entry.violations.length > 0,
        violations: entry.violations
      },
      // Include full resource data for Object Inspector
      rawData: {
        ...resource,
        validFrom: firstAssignment.validFrom,
        validTo: firstAssignment.validTo,
        complianceStatus: overallComplianceStatus,
        disabled: firstAssignment.disabled,
        reason: firstAssignment.reason,
        account: firstAssignment.account,
        identity: firstAssignment.identity,
        violations: firstAssignment.violations,
        // Aggregated data
        _aggregated: {
          assignmentCount: entry.assignments.length,
          identityCount: entry.identityIds.size,
          accountCount: entry.accountIds.size,
          complianceStatuses: Array.from(entry.complianceStatuses)
        }
      }
    };

    // Transform reasons if available (from first assignment)
    const legacyReasons = (firstAssignment.reasons || []).map((r, i) => transformReason(r, i));

    // Map API reasonType values to user-friendly display names
    const reasonTypeDisplayMap = {
      'ActualDirect': 'Direct',
      'Direct': 'Direct',
      'Policy': 'Policy',
      'UnconfirmedActual': 'Pending',
      'ChildResource': 'Inherited',
      'AutoAccount': 'Auto',
      'RoleMembership': 'Role',
      'Birthright': 'Birthright',
      'AccountLink': 'Account Link',
      'SoDException': 'SoD Exception'
    };

    // Build reason pills from ALL unique reason types in the reason array
    // Each reason in the array represents a different assignment path (e.g., Direct + Policy)
    const reasonArray = firstAssignment.reason;
    let apiReasons = [];

    if (Array.isArray(reasonArray) && reasonArray.length > 0) {
      // Track unique reason types to avoid duplicate pills
      const seenReasonTypes = new Set();

      // First pass: collect all unique reason types
      reasonArray.forEach(r => {
        if (r?.reasonType) seenReasonTypes.add(r.reasonType);
      });

      // Check if ActualDirect is the ONLY reason type (assigned outside of Omada)
      const isOnlyActualDirect = seenReasonTypes.size === 1 && seenReasonTypes.has('ActualDirect');

      // Reset for second pass
      seenReasonTypes.clear();

      apiReasons = reasonArray
        .filter(r => {
          const reasonType = r?.reasonType;
          if (!reasonType || seenReasonTypes.has(reasonType)) {
            return false;
          }
          seenReasonTypes.add(reasonType);
          return true;
        })
        .map((r, i) => {
          const reasonType = r?.reasonType;
          // Special case: ActualDirect with no other reasons = "External"
          let displayName;
          if (reasonType === 'ActualDirect' && isOnlyActualDirect) {
            displayName = 'External';
          } else {
            displayName = reasonTypeDisplayMap[reasonType] || reasonType || 'Assignment';
          }
          return {
            id: `reason-${index}-${i}-${reasonType}`,
            type: reasonType,
            reasonType: reasonType,
            title: displayName,
            description: r?.description || `Assigned via ${displayName}`,
            confidence: 'high'
          };
        });
    } else if (reasonArray?.reasonType) {
      // Single reason object (legacy format)
      const reasonType = reasonArray.reasonType;
      // Special case: ActualDirect alone = "External"
      const displayName = reasonType === 'ActualDirect'
        ? 'External'
        : (reasonTypeDisplayMap[reasonType] || reasonType || 'Assignment');
      apiReasons = [{
        id: `reason-${index}-0-${reasonType}`,
        type: reasonType,
        reasonType: reasonType,
        title: displayName,
        description: reasonArray?.description || `Assigned via ${displayName}`,
        confidence: 'high'
      }];
    }

    // Use API reasons if available, otherwise fall back to legacy or default
    const reasons = apiReasons.length > 0 ? apiReasons : (legacyReasons.length > 0 ? legacyReasons : [
      {
        id: `reason-${index}-default`,
        type: ReasonTypes.OTHER,
        title: 'Assignment',
        description: entry.assignments.length > 1
          ? `Assigned to ${entry.identityIds.size} user(s) via ${entry.accountIds.size} account(s)`
          : `Assigned via ${firstAssignment.assignmentType || 'unknown method'}`,
        confidence: 'high'
      }
    ]);

    return {
      node: entitlementNode,
      reasons,
      groupKey: resource?.system?.id,
      groupLabel: resource?.system?.name,
      rawData: firstAssignment
    };
  });

  // Apply filters
  let filteredItems = items;

  if (filters.highRiskOnly) {
    filteredItems = filteredItems.filter(item =>
      item.node.riskScore && item.node.riskScore >= 50
    );
  }

  if (filters.reasonTypes && filters.reasonTypes.length > 0) {
    filteredItems = filteredItems.filter(item =>
      item.reasons?.some(r => filters.reasonTypes.includes(r.type))
    );
  }

  // Sort by resource name (displayName) ascending - default sort order for entitlements
  filteredItems.sort((a, b) => {
    const nameA = (a.node?.displayName || '').toLowerCase();
    const nameB = (b.node?.displayName || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // console.log('[buildEntitlementsLane] Final:', filteredItems.length, 'entitlements');

  return {
    laneType: LaneTypes.EFFECTIVE_ENTITLEMENTS,
    totalCount: filteredItems.length,
    items: filteredItems,  // Show ALL items - lane card handles scrolling
    allItemsData: filteredItems,  // All items for maximize view
    canLoadMore: filteredItems.length > 10
  };
}

/**
 * Fetch explanation for why an identity has an entitlement
 */
export async function fetchExplanationData(focusId, targetId, reasonId, apiContext = {}) {
  const { omadaApi, bearerToken, impersonateUser } = apiContext;

  // Implement real API call when endpoint is available
  // This would typically call an Omada endpoint that returns the
  // access path/reason explanation for why an identity has a specific entitlement

  throw new Error('Explanation API not yet implemented');
}

// ============================================================================
// LANE POPULATION HELPERS - Populate lanes based on NodeType
// ============================================================================

/**
 * Main function to populate all lanes for a given focus node
 * Uses the schema to determine which lanes to show and how to populate them
 *
 * @param {Object} focusNode - The central/focus node
 * @param {Object} apiData - Pre-fetched API data (calculatedAssignments, identityContexts, etc.)
 * @param {Object} filters - Active filters
 * @returns {Array} Array of populated lane objects
 */
export function populateLanesForNodeType(focusNode, apiData = {}, filters = {}) {
  if (!focusNode || !focusNode.type) {
    console.warn('populateLanesForNodeType: No focus node or type provided');
    return [];
  }

  const nodeType = focusNode.type;
  const laneConfig = LaneConfigSchema[nodeType];

  if (!laneConfig) {
    console.warn(`populateLanesForNodeType: No lane config for node type: ${nodeType}`);
    return [];
  }

  if (shouldLog('LANES')) {
    console.log(`=== Populating lanes for ${nodeType} ===`);
    console.log('Available API data:', Object.keys(apiData));
  }

  const lanes = [];

  for (const config of laneConfig.lanes) {
    const lane = populateSingleLane(config, focusNode, apiData, filters);
    if (lane && lane.items.length > 0) {
      lanes.push(lane);
      if (shouldLog('LANES')) {
        console.log(`  Lane ${config.laneType}: ${lane.items.length} items`);
      }
    } else if (shouldLog('LANES')) {
      console.log(`  Lane ${config.laneType}: empty, skipping`);
    }
  }

  return lanes;
}

/**
 * Populate a single lane based on its configuration
 */
function populateSingleLane(laneConfig, focusNode, apiData, filters) {
  const { laneType, apiSource } = laneConfig;

  // Handle different API source types
  switch (apiSource.type) {
    case 'derived':
      return populateDerivedLane(laneConfig, focusNode, apiData, filters);

    case 'GraphQL':
      return populateGraphQLLane(laneConfig, focusNode, apiData, filters);

    case 'OData':
      return populateODataLane(laneConfig, focusNode, apiData, filters);

    default:
      console.warn(`Unknown apiSource type: ${apiSource.type}`);
      return null;
  }
}

/**
 * Populate a lane that derives its data from other API responses
 * Uses the extractorRegistry to look up the appropriate extractor function
 * (e.g., extract systems/accounts from calculatedAssignments)
 */
function populateDerivedLane(laneConfig, focusNode, apiData, filters) {
  const { laneType, apiSource } = laneConfig;
  const { from, extract } = apiSource;

  // Get the source data (may be null for focusNode extractions)
  const sourceData = apiData[from];

  // For 'calculatedAssignments' source, require array data
  if (from === 'calculatedAssignments' && (!sourceData || !Array.isArray(sourceData))) {
    return { laneType, totalCount: 0, items: [], canLoadMore: false };
  }

  // Look up the extractor from the registry
  const extractor = extractorRegistry[extract];
  if (!extractor) {
    console.warn(`No extractor registered for: ${extract}`);
    return { laneType, totalCount: 0, items: [], canLoadMore: false };
  }

  // Build context for extractors that need additional data
  const context = {
    systemDetailsMap: apiData.systemDetailsMap || {},
    // Add more context as needed
  };

  // Execute the extractor
  const items = extractor(sourceData, focusNode, filters, context);

  // Apply filters if any
  const filteredItems = applyLaneFilters(items, filters, laneType);

  return {
    laneType,
    totalCount: filteredItems.length,
    items: filters.showAll ? filteredItems : filteredItems.slice(0, DEFAULTS.ITEMS_PER_LANE),
    canLoadMore: filteredItems.length > DEFAULTS.ITEMS_PER_LANE
  };
}

/**
 * Populate a lane from GraphQL API data
 */
function populateGraphQLLane(laneConfig, focusNode, apiData, filters) {
  const { laneType, apiSource } = laneConfig;
  const { query } = apiSource;

  // Map query names to API data keys
  const queryToDataKey = {
    'getCalculatedAssignmentsDetailed': 'calculatedAssignments',
    'getIdentityContexts': 'identityContexts',
    'getAccountEntitlements': 'accountEntitlements',
    'getIdentitiesWithEntitlement': 'identitiesWithEntitlement'
  };

  const dataKey = queryToDataKey[query];
  const data = apiData[dataKey];

  if (!data) {
    return { laneType, totalCount: 0, items: [], canLoadMore: false };
  }

  let items = [];

  switch (query) {
    case 'getCalculatedAssignmentsDetailed':
      // This is handled by buildEntitlementsLane
      return buildEntitlementsLane(data, filters);

    case 'getIdentityContexts':
      // This is handled by buildContextsLane
      return buildContextsLane(data, filters);

    default:
      console.warn(`Unhandled GraphQL query: ${query}`);
      return { laneType, totalCount: 0, items: [], canLoadMore: false };
  }
}

/**
 * Populate a lane from OData (placeholder - not yet implemented)
 */
function populateODataLane(laneConfig, focusNode, apiData, filters) {
  const { laneType, apiSource } = laneConfig;
  // TODO: Implement OData fetching when needed
  if (shouldLog('LANES')) {
    console.log(`OData lane ${laneType} not yet implemented`);
  }
  return { laneType, totalCount: 0, items: [], canLoadMore: false };
}

/**
 * Extract unique systems from calculated assignments
 */
function extractSystemsFromAssignments(assignments) {
  const systemsMap = new Map();

  assignments.forEach(assignment => {
    const system = assignment.account?.system || assignment.resource?.system;
    if (system && system.id && !systemsMap.has(system.id)) {
      systemsMap.set(system.id, {
        node: {
          id: system.id,
          type: NodeTypes.SYSTEM,
          displayName: system.name || 'Unknown System',
          status: 'active',
          badges: [],
          metadata: {
            accountCount: 0,
            resourceCount: 0
          }
        }
      });
    }

    // Count per system
    if (system && systemsMap.has(system.id)) {
      const sysItem = systemsMap.get(system.id);
      if (assignment.account) sysItem.node.metadata.accountCount++;
      if (assignment.resource) sysItem.node.metadata.resourceCount++;
    }
  });

  return Array.from(systemsMap.values());
}

/**
 * Extract unique accounts from calculated assignments
 */
function extractAccountsFromAssignments(assignments) {
  const accountsMap = new Map();

  assignments.forEach(assignment => {
    const account = assignment.account;
    if (account && account.accountName && !accountsMap.has(account.accountName)) {
      accountsMap.set(account.accountName, {
        node: {
          id: account.accountName,
          type: NodeTypes.ACCOUNT,
          displayName: account.accountName,
          status: 'active',
          badges: [
            account.system?.name,
            account.accountType?.name
          ].filter(Boolean),
          metadata: {
            system: account.system?.name,
            systemId: account.system?.id,
            accountType: account.accountType?.name,
            resourceCount: 0
          }
        },
        groupKey: account.system?.id || 'unknown',
        groupLabel: account.system?.name || 'Unknown System'
      });
    }

    // Count resources per account
    if (account && accountsMap.has(account.accountName)) {
      accountsMap.get(account.accountName).node.metadata.resourceCount++;
    }
  });

  return Array.from(accountsMap.values());
}

/**
 * Extract unique roles from calculated assignments (from reason data)
 */
function extractRolesFromAssignments(assignments) {
  const rolesMap = new Map();

  assignments.forEach(assignment => {
    const reason = assignment.reason;
    if (reason && reason.reasonType === 'RoleMembership' && reason.causeObjectKey) {
      if (!rolesMap.has(reason.causeObjectKey)) {
        rolesMap.set(reason.causeObjectKey, {
          node: {
            id: reason.causeObjectKey,
            type: NodeTypes.ROLE,
            displayName: reason.description || 'Role',
            status: 'active',
            badges: ['Business Role'],
            metadata: {
              entitlementCount: 0
            }
          }
        });
      }
      rolesMap.get(reason.causeObjectKey).node.metadata.entitlementCount++;
    }
  });

  return Array.from(rolesMap.values());
}

/**
 * Extract entitlements from calculated assignments
 */
function extractEntitlementsFromAssignments(assignments) {
  return assignments.map((assignment, index) => ({
    node: {
      id: assignment.resource?.id || `ent-${index}`,
      type: NodeTypes.ENTITLEMENT,
      displayName: assignment.resource?.name || 'Unknown',
      status: 'active',
      badges: [
        assignment.resource?.system?.name,
        assignment.resource?.resourceType?.name
      ].filter(Boolean),
      metadata: {
        system: assignment.resource?.system?.name,
        systemId: assignment.resource?.system?.id,
        type: assignment.resource?.resourceType?.name,
        complianceStatus: assignment.complianceStatus
      }
    },
    reasons: assignment.reason ? [transformReason(assignment.reason, index)] : [],
    groupKey: assignment.resource?.system?.id,
    groupLabel: assignment.resource?.system?.name
  }));
}

/**
 * Apply filters to lane items
 */
function applyLaneFilters(items, filters, laneType) {
  let filtered = [...items];

  if (filters.highRiskOnly) {
    filtered = filtered.filter(item =>
      item.node.riskScore && item.node.riskScore >= 50
    );
  }

  // Add more filter logic as needed

  return filtered;
}

// ============================================================================
// SERVICE CONFIGURATION
// ============================================================================

/**
 * Configure the data service
 */
export function configureDataService(options) {
  if (options.apiBaseUrl) {
    CONFIG.apiBaseUrl = options.apiBaseUrl;
  }
}

/**
 * Build lanes for Entitlement-centric view
 * When an Entitlement (Resource) is the central node, show:
 * - Identities: Who has this entitlement assigned
 * - Accounts: Through which accounts the entitlement is assigned
 * - System: The system this entitlement belongs to (usually just one)
 *
 * @param {Array} assignments - Array of assignment data filtered for this resource
 * @param {Object} filters - Active filters
 * @param {Object} entitlementNode - The entitlement node being viewed
 * @returns {Array} Array of lane objects
 */
export function buildLanesForEntitlement(assignments, filters = {}, entitlementNode = null) {
  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    // console.log('[buildLanesForEntitlement] No assignments provided');
    return [];
  }

  // console.log('[buildLanesForEntitlement] Processing', assignments.length, 'assignments');

  const lanes = [];

  // 1. Build Identities lane - who has this entitlement
  lanes.push(buildIdentitiesLaneForEntitlement(assignments, filters));

  // 2. Build Accounts lane - accounts through which the entitlement is assigned
  lanes.push(buildAccountsLaneForEntitlement(assignments, filters));

  // 3. Build System and/or Logical Application lanes
  // This returns an array: [LogicalApps lane, Systems lane] or just [Systems lane]
  const systemLanes = buildSystemLanesForEntitlement(assignments, filters, entitlementNode);
  lanes.push(...systemLanes);

  // console.log('[buildLanesForEntitlement] Built:', lanes.map(l => `${l.laneType}(${l.items.length})`).join(', '));

  return lanes;
}

/**
 * Build Identities lane for entitlement-centric view
 * Extract unique identities from assignments
 */
function buildIdentitiesLaneForEntitlement(assignments, filters) {
  const identitiesMap = new Map();

  // Suppressed verbose logging for performance
  // if (assignments.length > 0) {
  //   console.log('[buildIdentitiesLaneForEntitlement] First assignment identity:', assignments[0].identity);
  // }

  assignments.forEach((assignment) => {
    const identity = assignment.identity;
    if (!identity || !identity.id) return;

    if (!identitiesMap.has(identity.id)) {
      identitiesMap.set(identity.id, {
        id: identity.id,
        identityId: identity.identityId,
        employeeId: identity.employeeId,
        displayName: identity.displayName || `${identity.firstName || ''} ${identity.lastName || ''}`.trim(),
        firstName: identity.firstName,
        lastName: identity.lastName,
        email: identity.email,
        title: identity.title,
        riskLevel: identity.riskLevel?.name,
        accounts: identity.accounts || [],
        contexts: identity.contexts || [],
        // Track assignment details for this identity
        complianceStatus: assignment.complianceStatus,
        validFrom: assignment.validFrom,
        validTo: assignment.validTo,
        reason: assignment.reason
      });
    }
  });

  const items = Array.from(identitiesMap.values()).map((ident) => ({
    node: {
      id: ident.id,
      type: NodeTypes.IDENTITY,
      displayName: ident.displayName || 'Unknown Identity',
      status: 'active',
      badges: [ident.riskLevel].filter(Boolean),
      metadata: {
        identityId: ident.identityId,
        employeeId: ident.employeeId,
        firstName: ident.firstName,
        lastName: ident.lastName,
        email: ident.email,
        title: ident.title,
        riskLevel: ident.riskLevel,
        complianceStatus: ident.complianceStatus
      },
      rawData: ident
    },
    reasons: ident.reason ? [transformReason(ident.reason, 0)] : [],
    groupKey: 'identities',
    groupLabel: 'Identities with this Entitlement',
    rawData: ident
  }));

  // Apply exclusion rules to filter out unwanted identities (e.g., "UNRESOLVED IDENTITY")
  const laneConfig = LaneDisplayConfig[LaneTypes.IDENTITIES] || {};
  let filteredItems = items;

  if (laneConfig.exclusionList && laneConfig.exclusionList.length > 0) {
    filteredItems = items.filter(item => {
      const displayName = (item.node?.displayName || '').toLowerCase().trim();

      // Check each exclusion rule
      for (const rule of laneConfig.exclusionList) {
        const { values, matchType = 'exact' } = rule;

        // Check if displayName matches any excluded value
        for (const excludeValue of values) {
          const excludeLower = excludeValue.toLowerCase().trim();
          let isMatch = false;

          switch (matchType) {
            case 'contains':
              isMatch = displayName.includes(excludeLower);
              break;
            case 'endsWith':
              isMatch = displayName.endsWith(excludeLower);
              break;
            case 'startsWith':
              isMatch = displayName.startsWith(excludeLower);
              break;
            case 'equals':
            case 'exact':
            default:
              isMatch = displayName === excludeLower;
              break;
          }

          if (isMatch) {
            return false; // Exclude this item
          }
        }
      }
      return true; // Keep this item
    });
  }

  // Sort alphabetically by displayName
  filteredItems.sort((a, b) =>
    (a.node.displayName || '').toLowerCase().localeCompare((b.node.displayName || '').toLowerCase())
  );

  return {
    laneType: LaneTypes.IDENTITIES,
    totalCount: filteredItems.length,
    items: filters.showAll ? filteredItems : filteredItems.slice(0, DEFAULTS.ITEMS_PER_LANE),
    allItemsData: filteredItems,
    canLoadMore: filteredItems.length > 10
  };
}

/**
 * Build Accounts lane for entitlement-centric view
 * Extract unique accounts from assignments
 */
function buildAccountsLaneForEntitlement(assignments, filters) {
  const accountsMap = new Map();

  assignments.forEach((assignment) => {
    const account = assignment.account;
    if (!account || !account.accountName) return;

    const uniqueKey = account.id || `${account.accountName}::${account.system?.id || 'unknown'}`;

    if (!accountsMap.has(uniqueKey)) {
      accountsMap.set(uniqueKey, {
        id: account.id || uniqueKey,
        accountName: account.accountName,
        accountType: account.accountType,
        system: account.system,
        // Track which identity owns this account
        identity: assignment.identity
      });
    }
  });

  const items = Array.from(accountsMap.values()).map((acc) => ({
    node: {
      id: acc.id,
      type: NodeTypes.ACCOUNT,
      displayName: acc.accountName || 'Unknown Account',
      status: 'active',
      badges: [
        acc.system?.name,
        acc.accountType?.name
      ].filter(Boolean),
      metadata: {
        system: acc.system?.name,
        systemId: acc.system?.id,
        accountType: acc.accountType?.name,
        identityId: acc.identity?.id,  // For cross-lane filtering when identity is selected
        identityName: acc.identity?.displayName || `${acc.identity?.firstName || ''} ${acc.identity?.lastName || ''}`.trim()
      },
      rawData: acc
    },
    reasons: [],
    groupKey: acc.identity?.id || 'unknown',
    groupLabel: acc.identity?.displayName || 'Unknown Identity',
    rawData: {
      ...acc,
      identity: acc.identity  // Preserve full identity for cross-lane filtering
    }
  }));

  // Sort items based on LaneSchema defaultSort configuration
  const accountsSchema = LaneSchema[LaneTypes.ACCOUNTS];
  if (accountsSchema?.defaultSort) {
    const { field, order } = accountsSchema.defaultSort;
    items.sort((a, b) => {
      const aValue = (a.node[field] || a.node.displayName || '').toLowerCase();
      const bValue = (b.node[field] || b.node.displayName || '').toLowerCase();
      const comparison = aValue.localeCompare(bValue);
      return order === 'desc' ? -comparison : comparison;
    });
  }

  return {
    laneType: LaneTypes.ACCOUNTS,
    totalCount: items.length,
    items: filters.showAll ? items : items.slice(0, DEFAULTS.ITEMS_PER_LANE),
    allItemsData: items,
    canLoadMore: items.length > 10
  };
}

/**
 * Build System and/or Logical Application lanes for entitlement-centric view
 *
 * This function handles the distinction between:
 * - Physical Systems: Where accounts live and the entitlement is directly on the system
 * - Logical Applications: Where the entitlement lives, but accounts are on a different physical system
 *
 * Detection logic (same as identity-centric view):
 * - Extract resource.system from the API response (assignments) - this is where the entitlement lives
 * - Extract account.system from each assignment - this is where accounts live (physical systems)
 * - If resource.system.id !== any account.system.id: Entitlement is on a logical application
 *   - Show LOGICAL_APPLICATIONS lane for the app (where entitlement lives)
 *   - Show SYSTEMS lane for the physical system(s) where accounts live
 * - If resource.system.id === account.system.id: Physical system (show 1 Systems lane)
 *
 * @param {Array} assignments - Array of assignment data from getIdentitiesHavingResource API
 * @param {Object} filters - Active filters
 * @param {Object} entitlementNode - The entitlement node being viewed (used as fallback only)
 * @returns {Array} Array of lane objects
 */
function buildSystemLanesForEntitlement(assignments, filters, entitlementNode) {
  if (shouldLog('SYSTEMS')) {
    console.log('=== buildSystemLanesForEntitlement ===');
    console.log('Entitlement node:', entitlementNode?.displayName);
    console.log('Assignments count:', assignments?.length);
  }

  const lanes = [];

  // Get the entitlement's system (resource.system) directly from the API response
  // All assignments are for the same entitlement, so take from first assignment
  // This is more reliable than using entitlementNode metadata
  let resourceSystem = null;

  if (assignments && assignments.length > 0) {
    const firstAssignment = assignments[0];
    const apiResourceSystem = firstAssignment.resource?.system;

    if (apiResourceSystem?.id) {
      resourceSystem = {
        id: apiResourceSystem.id,
        name: apiResourceSystem.name || 'Unknown System'
      };
      if (shouldLog('SYSTEMS')) {
        console.log('Got resource.system from API response:', resourceSystem);
      }
    }
  }

  // Fallback to entitlementNode metadata if API didn't have resource.system
  if (!resourceSystem && entitlementNode) {
    if (entitlementNode.metadata?.systemId) {
      resourceSystem = {
        id: entitlementNode.metadata.systemId,
        name: entitlementNode.metadata.system || 'Unknown System'
      };
      if (shouldLog('SYSTEMS')) {
        console.log('Fallback: Got resource system from entitlementNode.metadata:', resourceSystem);
      }
    } else if (entitlementNode.rawData?.system) {
      resourceSystem = {
        id: entitlementNode.rawData.system.id,
        name: entitlementNode.rawData.system.name || 'Unknown System'
      };
      if (shouldLog('SYSTEMS')) {
        console.log('Fallback: Got resource system from entitlementNode.rawData:', resourceSystem);
      }
    }
  }

  if (shouldLog('SYSTEMS')) {
    console.log('Resource system (where entitlement lives):', resourceSystem);
  }

  // Get unique account systems (account.system) - where accounts live (always physical systems)
  const accountSystemsMap = new Map();

  assignments.forEach((assignment) => {
    const accountSystem = assignment.account?.system;
    if (accountSystem?.id && !accountSystemsMap.has(accountSystem.id)) {
      accountSystemsMap.set(accountSystem.id, {
        id: accountSystem.id,
        name: accountSystem.name || 'Unknown System',
        accountCount: 0,
        identityIds: new Set()
      });
    }
    // Count accounts and identities per system
    if (accountSystem?.id) {
      const sys = accountSystemsMap.get(accountSystem.id);
      sys.accountCount++;
      if (assignment.identity?.id) {
        sys.identityIds.add(assignment.identity.id);
      }
    }
  });

  const accountSystems = Array.from(accountSystemsMap.values());
  if (shouldLog('SYSTEMS')) {
    console.log('Account systems (where accounts live):', accountSystems.map(s => s.name));
  }

  // Determine if the entitlement is on a logical application
  // A logical app is when the resource.system is different from all account.systems
  const isLogicalApp = resourceSystem &&
    accountSystems.length > 0 &&
    !accountSystems.some(as => as.id === resourceSystem.id);

  if (shouldLog('SYSTEMS')) {
    console.log('Is entitlement on a logical application?', isLogicalApp);
  }

  if (isLogicalApp) {
    // Show LOGICAL_APPLICATIONS lane for where the entitlement lives
    if (shouldLog('SYSTEMS')) {
      console.log('Building Logical Applications lane for:', resourceSystem.name);
    }

    // Build underlyingSystems array for cross-lane filtering compatibility
    const underlyingSystems = accountSystems.map(sys => ({
      id: sys.id,
      name: sys.name
    }));
    const underlyingSystemIds = accountSystems.map(sys => sys.id);

    const logicalAppItems = [{
      node: {
        id: resourceSystem.id,
        type: NodeTypes.SYSTEM,
        displayName: resourceSystem.name || 'Unknown Application',
        status: 'active',
        badges: ['Logical App'],
        metadata: {
          isLogicalApp: true,
          // These fields are required for cross-lane filtering to work
          underlyingSystems: underlyingSystems,
          underlyingSystemIds: underlyingSystemIds,
          implementedBy: accountSystems.map(s => s.name).join(', ')
        },
        rawData: resourceSystem
      },
      reasons: [],
      groupKey: 'logical-apps',
      groupLabel: 'Application',
      rawData: resourceSystem
    }];

    lanes.push({
      laneType: LaneTypes.LOGICAL_APPLICATIONS,
      totalCount: logicalAppItems.length,
      items: logicalAppItems,
      allItemsData: logicalAppItems,
      canLoadMore: false
    });

    // Show SYSTEMS lane for the physical system(s) where accounts live
    if (shouldLog('SYSTEMS')) {
      console.log('Building Systems lane for physical systems:', accountSystems.map(s => s.name));
    }

    const systemItems = accountSystems.map(sys => ({
      node: {
        id: sys.id,
        type: NodeTypes.SYSTEM,
        displayName: sys.name || 'Unknown System',
        status: 'active',
        badges: [],
        metadata: {
          accountCount: sys.accountCount,
          identityCount: sys.identityIds.size,
          implementsApp: resourceSystem.name,
          implementsAppId: resourceSystem.id
        },
        rawData: sys
      },
      reasons: [],
      groupKey: 'systems',
      groupLabel: 'System (Accounts)',
      rawData: sys
    }));

    lanes.push({
      laneType: LaneTypes.SYSTEMS,
      totalCount: systemItems.length,
      items: systemItems,
      allItemsData: systemItems,
      canLoadMore: false
    });

  } else {
    // Entitlement is on a physical system - just show Systems lane
    // Use resourceSystem if available, otherwise use first account system
    const system = resourceSystem || (accountSystems.length > 0 ? accountSystems[0] : null);

    if (!system) {
      console.warn('Could not determine system for entitlement-centric view');
      lanes.push({
        laneType: LaneTypes.SYSTEMS,
        totalCount: 0,
        items: [],
        allItemsData: [],
        canLoadMore: false
      });
    } else {
      const items = [{
        node: {
          id: system.id,
          type: NodeTypes.SYSTEM,
          displayName: system.name || 'Unknown System',
          status: 'active',
          badges: [],
          metadata: {
            identityCount: new Set(assignments.map(a => a.identity?.id).filter(Boolean)).size,
            accountCount: new Set(assignments.map(a => a.account?.id || a.account?.accountName).filter(Boolean)).size
          },
          rawData: system
        },
        reasons: [],
        groupKey: 'systems',
        groupLabel: 'System',
        rawData: system
      }];

      lanes.push({
        laneType: LaneTypes.SYSTEMS,
        totalCount: items.length,
        items: items,
        allItemsData: items,
        canLoadMore: false
      });
    }
  }

  return lanes;
}

/**
 * Extract unique reason types from calculated assignments data
 * Returns an array of unique reason type strings, sorted alphabetically
 */
export function extractUniqueReasonTypes(assignments) {
  if (!assignments || !Array.isArray(assignments)) return [];

  const reasonTypesSet = new Set();

  assignments.forEach(assignment => {
    // Extract reason type from assignment.reason.reasonType
    if (assignment.reason?.reasonType) {
      reasonTypesSet.add(assignment.reason.reasonType);
    }
    // Also check for reason.description as a fallback identifier
    if (assignment.reason?.description) {
      // Try to categorize based on description keywords
      const desc = assignment.reason.description.toLowerCase();
      if (desc.includes('role')) reasonTypesSet.add('RoleMembership');
      if (desc.includes('direct')) reasonTypesSet.add('DirectAssignment');
      if (desc.includes('birthright')) reasonTypesSet.add('Birthright');
      if (desc.includes('policy')) reasonTypesSet.add('PolicyRule');
    }
  });

  // Return sorted array of unique reason types
  return Array.from(reasonTypesSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Extract unique compliance status values from calculated assignments
 * Returns an array of unique compliance status strings, sorted alphabetically
 */
export function extractUniqueComplianceStatuses(assignments) {
  if (!assignments || !Array.isArray(assignments)) return [];

  const statusSet = new Set();

  assignments.forEach(assignment => {
    if (assignment.complianceStatus) {
      statusSet.add(assignment.complianceStatus);
    }
  });

  // Convert to array and sort alphabetically
  return Array.from(statusSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Parse policy name from assignment reason description
 * The description format is: "Policy Name" [BOT - timestamp]
 * We extract just the policy name between the quotes
 *
 * @param {string} description - The reason description string
 * @returns {string|null} The parsed policy name or null if not found
 */
function parsePolicyNameFromDescription(description) {
  if (!description || typeof description !== 'string') return null;

  // Match text between double quotes at the start of the string
  // Pattern: "Some Policy Name" [BOT - ...]
  const quoteMatch = description.match(/^"([^"]+)"/);
  if (quoteMatch && quoteMatch[1]) {
    return quoteMatch[1].trim();
  }

  // Fallback: if no quotes, try to extract text before the [BOT part
  const botMatch = description.match(/^(.+?)\s*\[BOT/);
  if (botMatch && botMatch[1]) {
    return botMatch[1].trim();
  }

  // Last resort: return the whole description if it's reasonably short
  if (description.length <= 100) {
    return description.trim();
  }

  return null;
}

/**
 * Build Assignment Policies lane from calculated assignments data
 * Extracts unique policies from assignment reasons where reasonType === "Policy"
 *
 * Data source: getCalculatedAssignments API -> assignment.reason array
 * Each reason with reasonType "Policy" represents a policy that assigned an entitlement
 *
 * @param {Array} assignments - Array of assignment data from API
 * @param {Object} filters - Active filters
 * @returns {Object} Lane object with laneType, totalCount, items, etc.
 */
export function buildAssignmentPoliciesLane(assignments, filters = {}) {
  if (shouldLog('POLICIES')) {
    console.log('=== buildAssignmentPoliciesLane: Starting ===');
    console.log('Total assignments received:', assignments?.length);
  }

  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    return {
      laneType: LaneTypes.ASSIGNMENT_POLICIES,
      totalCount: 0,
      items: [],
      allItemsData: [],
      canLoadMore: false
    };
  }

  // Map to track unique policies by their parsed name
  // Key: policy name (parsed from description)
  // Value: { name, description, resourceIds: Set, assignmentCount }
  const policiesMap = new Map();

  // Debug: Log first few assignments to see reason structure
  if (shouldLog('POLICIES')) {
    assignments.slice(0, 3).forEach((assignment, index) => {
      console.log(`Assignment ${index} reason:`, assignment.reason);
    });
  }

  assignments.forEach((assignment) => {
    // Reason can be a single object or an array
    const reasons = Array.isArray(assignment.reason)
      ? assignment.reason
      : (assignment.reason ? [assignment.reason] : []);

    reasons.forEach((reason) => {
      // Only process reasons with reasonType === "Policy"
      if (!reason || reason.reasonType !== 'Policy') return;

      // Parse policy name from description
      const policyName = parsePolicyNameFromDescription(reason.description);
      if (!policyName) {
        if (shouldLog('POLICIES')) {
          console.log('Could not parse policy name from description:', reason.description);
        }
        return;
      }

      // Get resource ID from this assignment
      const resourceId = assignment.resource?.id;

      if (!policiesMap.has(policyName)) {
        policiesMap.set(policyName, {
          name: policyName,
          description: reason.description,  // Keep full description for tooltip
          resourceIds: new Set(),
          assignmentCount: 0,
          causeObjectKey: reason.causeObjectKey || null  // Policy ID if available
        });
      }

      const policy = policiesMap.get(policyName);
      policy.assignmentCount++;
      if (resourceId) {
        policy.resourceIds.add(resourceId);
      }
    });
  });

  if (shouldLog('POLICIES')) {
    console.log('=== buildAssignmentPoliciesLane: Results ===');
    console.log('Unique policies found:', policiesMap.size);
    Array.from(policiesMap.values()).forEach((policy, i) => {
      console.log(`  ${i + 1}. "${policy.name}" - ${policy.resourceIds.size} resources, ${policy.assignmentCount} assignments`);
    });
  }

  // Convert to lane items
  const items = Array.from(policiesMap.values()).map((policy, index) => {
    const policyNode = {
      id: policy.causeObjectKey || `policy-${index}-${policy.name.replace(/\s+/g, '-').toLowerCase()}`,
      type: NodeTypes.POLICY,
      displayName: policy.name,
      status: 'active',
      badges: [
        `${policy.resourceIds.size} entitlement${policy.resourceIds.size !== 1 ? 's' : ''}`
      ],
      metadata: {
        name: policy.name,
        fullDescription: policy.description,
        resourceCount: policy.resourceIds.size,
        assignmentCount: policy.assignmentCount,
        // Cross-lane filtering: store resource IDs this policy assigns
        resourceIds: Array.from(policy.resourceIds)
      },
      rawData: {
        name: policy.name,
        description: policy.description,
        resourceIds: Array.from(policy.resourceIds),
        assignmentCount: policy.assignmentCount,
        causeObjectKey: policy.causeObjectKey
      }
    };

    return {
      node: policyNode,
      reasons: [],
      groupKey: 'assignment-policies',
      groupLabel: 'Assignment Policies',
      rawData: {
        ...policy,
        resourceIds: Array.from(policy.resourceIds)
      }
    };
  });

  // Sort by number of resources (most resources first)
  items.sort((a, b) => b.node.metadata.resourceCount - a.node.metadata.resourceCount);

  return {
    laneType: LaneTypes.ASSIGNMENT_POLICIES,
    totalCount: items.length,
    items: items,  // Show ALL items - lane card handles scrolling
    allItemsData: items,
    canLoadMore: false
  };
}

/**
 * Enrich Assignment Policies lane items with OData details
 * Fetches policy details from OData API to get AP_CONTEXTS (contexts that trigger each policy)
 * This enables cross-lane filtering between Assignment Policies and Contexts
 *
 * @param {Object} policiesLane - The assignment policies lane object
 * @param {Object} apiContext - API context with { omadaApi, bearerToken, impersonateUser }
 * @returns {Promise<Object>} Enriched lane object with AP_CONTEXTS data
 */
export async function enrichPoliciesWithOData(policiesLane, apiContext) {
  if (!policiesLane || !policiesLane.items || policiesLane.items.length === 0) {
    return policiesLane;
  }

  const { omadaApi, bearerToken, impersonateUser } = apiContext;

  if (!omadaApi || !bearerToken) {
    console.warn('[enrichPoliciesWithOData] Missing API context, skipping enrichment');
    return policiesLane;
  }

  if (shouldLog('POLICIES')) {
    console.log(`[enrichPoliciesWithOData] Enriching ${policiesLane.items.length} policies with OData details`);
  }

  // Fetch policy details for each policy with a valid causeObjectKey (policy ID)
  const enrichmentPromises = policiesLane.items.map(async (item) => {
    const policyId = item.node?.rawData?.causeObjectKey || item.rawData?.causeObjectKey;

    if (!policyId) {
      if (shouldLog('POLICIES')) {
        console.log(`[enrichPoliciesWithOData] No policy ID for "${item.node?.displayName}", skipping`);
      }
      return item;
    }

    try {
      const result = await omadaApi.assignmentPolicy.getAssignmentPolicyById(
        policyId,
        bearerToken,
        impersonateUser
      );

      if (result.status === 'success' && result.data) {
        const policyData = result.data;
        const apContexts = policyData.AP_CONTEXTS || [];

        // Extract context UIds for cross-lane filtering
        const contextUIds = apContexts
          .map(ctx => ctx.UId || ctx.uId)
          .filter(Boolean);

        // Enrich the item with AP_CONTEXTS data
        item.node.metadata.contextUIds = contextUIds;
        item.node.metadata.apContexts = apContexts;
        item.node.rawData = {
          ...item.node.rawData,
          AP_CONTEXTS: apContexts,
          contextUIds: contextUIds
        };
        item.rawData = {
          ...item.rawData,
          AP_CONTEXTS: apContexts,
          contextUIds: contextUIds
        };

        if (shouldLog('POLICIES')) {
          console.log(`[enrichPoliciesWithOData] "${item.node?.displayName}" has ${apContexts.length} contexts:`,
            apContexts.map(c => c.DisplayName).join(', '));
        }
      }
    } catch (error) {
      console.warn(`[enrichPoliciesWithOData] Failed to fetch details for policy "${item.node?.displayName}":`, error.message);
    }

    return item;
  });

  // Wait for all enrichment to complete
  await Promise.all(enrichmentPromises);

  if (shouldLog('POLICIES')) {
    console.log('[enrichPoliciesWithOData] Enrichment complete');
  }

  return policiesLane;
}

/**
 * Build Violations lane from calculated assignments
 * Extracts violations from assignments and groups them by unique violation description
 *
 * @param {Array} assignments - Calculated assignments with violations array
 * @param {Object} filters - Optional filters
 * @returns {Object} Lane object with violation items
 */
export function buildViolationsLane(assignments, filters = {}) {
  if (shouldLog('VIOLATIONS')) {
    console.log('=== buildViolationsLane: Starting ===');
    console.log('Total assignments received:', assignments?.length);
  }

  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    return {
      laneType: LaneTypes.VIOLATIONS,
      totalCount: 0,
      items: [],
      allItemsData: [],
      canLoadMore: false
    };
  }

  // Map to track unique violations by description
  // Key: violation description
  // Value: { description, violationStatus, resourceIds: Set, resourceNames: Set }
  const violationsMap = new Map();

  assignments.forEach((assignment) => {
    if (!assignment.violations || !Array.isArray(assignment.violations) || assignment.violations.length === 0) {
      return;
    }

    const resourceId = assignment.resource?.id;
    const resourceName = assignment.resource?.name;

    assignment.violations.forEach((violation) => {
      const key = violation.description || 'Unknown Violation';

      if (!violationsMap.has(key)) {
        violationsMap.set(key, {
          description: violation.description,
          violationStatus: violation.violationStatus,
          resourceIds: new Set(),
          resourceNames: new Set(),
          accountIds: new Set(),
          systemIds: new Set()
        });
      }

      const entry = violationsMap.get(key);
      if (resourceId) entry.resourceIds.add(resourceId);
      if (resourceName) entry.resourceNames.add(resourceName);
      if (assignment.account?.id) entry.accountIds.add(assignment.account.id);
      if (assignment.resource?.system?.id) entry.systemIds.add(assignment.resource.system.id);
    });
  });

  if (shouldLog('VIOLATIONS')) {
    console.log('=== buildViolationsLane: Results ===');
    console.log('Unique violations found:', violationsMap.size);
  }

  // Convert to lane items
  const items = Array.from(violationsMap.values()).map((violation, index) => {
    // Parse the violation description to extract the conflicting entitlement name
    // Format: 'In violation with "EntitlementName". '
    const conflictMatch = violation.description?.match(/In violation with "([^"]+)"/);
    const conflictingEntitlement = conflictMatch ? conflictMatch[1] : null;

    const violationNode = {
      id: `violation-${index}-${violation.description?.replace(/\s+/g, '-').substring(0, 30).toLowerCase()}`,
      type: NodeTypes.VIOLATION,
      displayName: conflictingEntitlement
        ? `Conflict: ${conflictingEntitlement}`
        : violation.description?.substring(0, 50) || 'Violation',
      status: violation.violationStatus || 'DECISION_PENDING_NOT_ALLOWED',
      badges: [
        violation.violationStatus?.replace(/_/g, ' ') || 'Pending',
        `${violation.resourceIds.size} entitlement${violation.resourceIds.size !== 1 ? 's' : ''}`
      ],
      metadata: {
        description: violation.description,
        violationStatus: violation.violationStatus,
        conflictingEntitlement: conflictingEntitlement,
        resourceCount: violation.resourceIds.size,
        // Cross-lane filtering: store resource IDs involved in this violation
        resourceIds: Array.from(violation.resourceIds),
        resourceNames: Array.from(violation.resourceNames),
        accountIds: Array.from(violation.accountIds),
        systemIds: Array.from(violation.systemIds)
      },
      rawData: {
        description: violation.description,
        violationStatus: violation.violationStatus,
        conflictingEntitlement: conflictingEntitlement,
        resourceIds: Array.from(violation.resourceIds),
        resourceNames: Array.from(violation.resourceNames),
        accountIds: Array.from(violation.accountIds),
        systemIds: Array.from(violation.systemIds)
      }
    };

    return {
      node: violationNode,
      reasons: [],
      groupKey: 'violations',
      groupLabel: 'Violations',
      rawData: {
        ...violation,
        resourceIds: Array.from(violation.resourceIds),
        resourceNames: Array.from(violation.resourceNames),
        accountIds: Array.from(violation.accountIds),
        systemIds: Array.from(violation.systemIds)
      }
    };
  });

  // Sort by number of resources involved (most first)
  items.sort((a, b) => b.node.metadata.resourceCount - a.node.metadata.resourceCount);

  return {
    laneType: LaneTypes.VIOLATIONS,
    totalCount: items.length,
    items: items,
    allItemsData: items,
    canLoadMore: false
  };
}

/**
 * Extract total violation count from assignments (for FocusCard indicator)
 * Deduplicates violations by description to avoid counting the same violation
 * multiple times when it appears on multiple assignments (multi-path entitlements)
 * @param {Array} assignments - Calculated assignments
 * @returns {number} Total number of unique violations
 */
export function extractViolationCount(assignments) {
  if (!assignments || !Array.isArray(assignments)) return 0;

  // Use a Set to track unique violations by description
  // This matches the deduplication logic in buildViolationsLane
  const uniqueViolations = new Set();

  assignments.forEach(assignment => {
    if (assignment.violations && Array.isArray(assignment.violations)) {
      assignment.violations.forEach(violation => {
        // Use description as the unique key (same as buildViolationsLane)
        const key = violation.description || `violation-${violation.violationStatus || 'unknown'}`;
        uniqueViolations.add(key);
      });
    }
  });

  return uniqueViolations.size;
}

/**
 * Export for use in AccessLens
 */
export default {
  fetchFocusData,
  fetchExplanationData,
  configureDataService,
  extractUniqueReasonTypes,
  extractUniqueComplianceStatuses,
  extractViolationCount,
  transformIdentityToNode,
  transformRoleToNode,
  transformAccountToNode,
  transformEntitlementToNode,
  transformSystemToNode,
  transformPolicyToNode,
  transformContextToNode,
  transformReason,
  buildContextsLane,
  buildLanesFromAssignments,
  buildLanesForEntitlement,
  buildAssignmentPoliciesLane,
  enrichPoliciesWithOData,
  buildViolationsLane,
  populateLanesForNodeType,
  // Extractor registry functions
  getExtractor,
  registerExtractor
};
