/**
 * AccessLens Data Service
 * Data contract interface for Omada OData and GraphQL APIs
 *
 * This service provides an abstraction layer between the AccessLens UI and
 * the Omada backend. It can be configured to use mock data for development
 * or real API calls for production.
 */

import { NodeTypes, LaneTypes, ReasonTypes, LaneConfigSchema, FocusNodeSchema, LaneDisplayConfig, extractFieldValue } from './accessLensTypes';

// Configuration
const CONFIG = {
  odataPageSizeLimit: 1000, // Omada OData page size limit
  apiBaseUrl: '', // Will be set from environment or omadaApi
  graphqlEndpoint: '/graphql',
  odataEndpoint: '/odata'
};

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
        { page: 1, rows: 100 }
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
      _raw: context
    }
  };
};

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
 * This is the main function to transform API response into Access Lens lanes
 * @param {Array} assignments - Array of assignment data from API
 * @param {Object} filters - Active filters
 * @param {Object} options - Options for lane building
 * @param {boolean} options.includeIdentities - Include identities lane (for system-centric view)
 * @param {Object} options.systemDetailsMap - Map of systemId -> OData system details
 */
export function buildLanesFromAssignments(assignments, filters = {}, options = {}) {
  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    return [];
  }

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
  lanes.push(buildAccountsLane(assignments, filters));

  // Build Entitlements/Resources lane
  lanes.push(buildEntitlementsLane(assignments, filters));

  // Build Identities lane (for system-centric view)
  if (options.includeIdentities) {
    lanes.push(buildIdentitiesLane(assignments, filters));
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
  console.log('=== buildSystemsLane: Starting ===');
  console.log('Total assignments received:', assignments.length);
  console.log('System details available for:', Object.keys(systemDetailsMap).length, 'systems');

  // Extract unique systems from BOTH accounts and resources
  const systemsMap = new Map();

  assignments.forEach((assignment, index) => {
    // Extract system from account
    const accountSystem = assignment.account?.system;
    if (accountSystem && accountSystem.id && !systemsMap.has(accountSystem.id)) {
      // Debug: Log the full system object to see available fields
      if (index < 3) {
        console.log(`[buildSystemsLane] Raw account.system object:`, accountSystem);
      }
      systemsMap.set(accountSystem.id, {
        id: accountSystem.id,
        name: accountSystem.name || '',
        accountCount: 0,
        resourceCount: 0
      });
      if (index < 5) {
        console.log(`Found account system: "${accountSystem.name}" (id: ${accountSystem.id})`);
      }
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
      console.log(`Found resource system: "${resourceSystem.name}" (id: ${resourceSystem.id}) - different from account system`);
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

  console.log('All systems found:', systemsMap.size);
  Array.from(systemsMap.values()).forEach(sys => {
    const logicalLabel = sys.isLogical ? ' (LOGICAL - excluded)' : '';
    console.log(`  - ${sys.name}${logicalLabel}: ${sys.accountCount} accounts, ${sys.resourceCount} resources`);
  });

  // Filter to only PHYSICAL systems (exclude logical applications)
  const physicalSystems = Array.from(systemsMap.values())
    .filter(sys => !sys.isLogical)
    .sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()));

  console.log('Physical systems (for Systems lane):', physicalSystems.length);

  // Debug: Log systemDetailsMap keys
  console.log('[buildSystemsLane] systemDetailsMap keys:', Object.keys(systemDetailsMap));

  const items = physicalSystems.map((sys) => {
    // Get enriched details from OData if available
    const odataDetails = systemDetailsMap[sys.id] || {};

    // Debug: Log OData lookup for each system - show ALL keys to find correct field names
    console.log(`[buildSystemsLane] System "${sys.name}" (ID: ${sys.id}):`, {
      hasODataDetails: Object.keys(odataDetails).length > 0,
      allODataKeys: Object.keys(odataDetails),
      DESCRIPTION: odataDetails.DESCRIPTION,
      SYSTEMTYPE: odataDetails.SYSTEMTYPE,
      C_SYSTEMTYPE: odataDetails.C_SYSTEMTYPE,  // Alternative field name
      OWNERREF: odataDetails.OWNERREF,
      CLT_TAGS: odataDetails.CLT_TAGS
    });

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
  console.log('=== buildLogicalApplicationsLane: Starting ===');
  console.log('System details available for:', Object.keys(systemDetailsMap).length, 'systems');

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

  console.log('Logical Applications found:', logicalApps.length);
  logicalApps.forEach(app => {
    const physicalIds = logicalToPhysicalMap.get(app.id);
    const physicalNames = physicalIds
      ? Array.from(physicalIds).map(id => systemsMap.get(id)?.name || id).join(', ')
      : 'Unknown';
    console.log(`  - ${app.name}: ${app.resourceCount} resources, implemented via: ${physicalNames}`);
  });

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
      type: NodeTypes.SYSTEM,
      displayName: app.name || 'Unknown Application',
      description: description,  // For hover tooltip
      status: 'active',
      badges: badges.slice(0, 3),
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
 * Build Accounts lane from assignments data (extract unique accounts)
 * Data source: getCalculatedAssignments API -> assignment.account
 *
 * IMPORTANT: Uses composite key (accountId OR accountName+systemId) to ensure
 * accounts with the same name on different systems are treated as separate accounts.
 */
function buildAccountsLane(assignments, filters) {
  console.log('=== buildAccountsLane: Starting ===');
  console.log('Total assignments received:', assignments.length);

  // Debug: Show full structure of first few assignments to understand account data
  if (assignments.length > 0) {
    console.log('First assignment account structure:', JSON.stringify(assignments[0]?.account, null, 2));
    console.log('First assignment account.system:', assignments[0]?.account?.system);
  }

  // Extract unique accounts from assignments
  // Use composite key: account.id if available, otherwise accountName + systemId
  const accountsMap = new Map();

  assignments.forEach((assignment, index) => {
    const account = assignment.account;

    if (!account) {
      if (index < 5) {
        console.log(`Assignment ${index}: No account data`);
      }
      return;
    }

    // Create a unique key for this account
    // Prefer account.id if available, otherwise use accountName + systemId
    const accountId = account.id;
    const systemId = account.system?.id;
    const accountName = account.accountName;

    // Composite key ensures same account name on different systems are unique
    const uniqueKey = accountId || `${accountName}::${systemId || 'unknown'}`;

    // Debug: Show all unique accounts being found
    if (index < 10 || !accountsMap.has(uniqueKey)) {
      console.log(`Assignment ${index}: Account "${accountName}" on system "${account.system?.name}" (key: ${uniqueKey})`);
    }

    if (accountName && !accountsMap.has(uniqueKey)) {
      accountsMap.set(uniqueKey, {
        id: accountId || uniqueKey,
        accountName: accountName,
        accountType: account.accountType,
        system: account.system,
        resourceCount: 0
      });
    }

    // Count resources per account
    if (accountName && accountsMap.has(uniqueKey)) {
      accountsMap.get(uniqueKey).resourceCount++;
    }
  });

  console.log('=== buildAccountsLane: Results ===');
  console.log('Unique accounts extracted:', accountsMap.size);
  console.log('Account details:');
  Array.from(accountsMap.values()).forEach((acc, i) => {
    console.log(`  ${i + 1}. ${acc.accountName} on ${acc.system?.name || 'Unknown'} (${acc.resourceCount} resources)`);
  });

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
        resourceCount: acc.resourceCount
      },
      rawData: {
        id: acc.id,
        accountName: acc.accountName,
        accountType: acc.accountType,
        system: acc.system,
        resourceCount: acc.resourceCount
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
        resourceCount: acc.resourceCount
      }
    };
  });

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
  console.log('=== buildIdentitiesLane: Starting ===');
  console.log('Total assignments received:', assignments.length);

  // Extract unique identities from assignments
  const identitiesMap = new Map();

  assignments.forEach((assignment, index) => {
    const identity = assignment.identity;

    // Debug first few assignments
    if (index < 3) {
      console.log(`Assignment ${index}:`);
      console.log('  - identity:', identity);
      console.log('  - identity.displayName:', identity?.displayName);
    }

    if (identity && identity.id && !identitiesMap.has(identity.id)) {
      identitiesMap.set(identity.id, {
        id: identity.id,
        identityId: identity.identityId,
        displayName: identity.displayName || `${identity.firstName || ''} ${identity.lastName || ''}`.trim(),
        firstName: identity.firstName,
        lastName: identity.lastName,
        riskLevel: identity.riskLevel?.name,
        accounts: identity.accounts || [],
        contexts: identity.contexts || [],
        resourceCount: 0
      });
    }

    // Count resources per identity
    if (identity && identity.id && identitiesMap.has(identity.id)) {
      identitiesMap.get(identity.id).resourceCount++;
    }
  });

  console.log('Unique identities extracted:', identitiesMap.size);
  console.log('Identity names:', Array.from(identitiesMap.values()).map(i => i.displayName));

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
        riskLevel: ident.riskLevel,
        accountCount: ident.accounts?.length || 0,
        resourceCount: ident.resourceCount
      },
      rawData: {
        id: ident.id,
        identityId: ident.identityId,
        displayName: ident.displayName,
        firstName: ident.firstName,
        lastName: ident.lastName,
        riskLevel: ident.riskLevel,
        accounts: ident.accounts,
        contexts: ident.contexts
      }
    };

    return {
      node: identityNode,
      reasons: [],
      groupKey: 'identities',
      groupLabel: 'Identities',
      rawData: ident
    };
  });

  // Sort identities alphabetically by displayName
  items.sort((a, b) =>
    (a.node.displayName || '').toLowerCase().localeCompare((b.node.displayName || '').toLowerCase())
  );

  return {
    laneType: LaneTypes.IDENTITIES,
    totalCount: items.length,
    items: items,  // Show ALL items - lane card handles scrolling
    allItemsData: items,  // All items for maximize view
    canLoadMore: false
  };
}

/**
 * Get nested field value from object using dot notation path
 * e.g., 'resource.resourceType.name' -> assignment.resource.resourceType.name
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Apply exclusion rules from lane config to filter out unwanted items
 * @param {Array} items - Array of items to filter
 * @param {Array} exclusionList - Array of exclusion rules from LaneDisplayConfig
 * @returns {Array} Filtered items
 */
function applyExclusionRules(items, exclusionList) {
  if (!exclusionList || exclusionList.length === 0) return items;

  let excludedCount = 0;

  const filtered = items.filter(item => {
    // Check each exclusion rule
    for (const rule of exclusionList) {
      const { fields, values } = rule;

      // Check each field specified in the rule
      for (const field of fields) {
        const fieldValue = (getNestedValue(item, field) || '').toLowerCase();

        // Check if field value contains any of the excluded values
        for (const excludeValue of values) {
          if (fieldValue.includes(excludeValue.toLowerCase())) {
            if (excludedCount < 3) {
              console.log(`Exclusion match: field "${field}" = "${fieldValue}" contains "${excludeValue}"`);
            }
            excludedCount++;
            return false; // Exclude this item
          }
        }
      }
    }
    return true; // Keep this item
  });

  if (excludedCount > 0) {
    console.log(`Total items excluded by rules: ${excludedCount}`);
  }

  return filtered;
}

/**
 * Build Entitlements lane from assignments data
 * Applies exclusion rules from LaneDisplayConfig
 * Excludes account-type resources (these belong in the Accounts lane)
 */
function buildEntitlementsLane(assignments, filters) {
  console.log('=== buildEntitlementsLane: Starting ===');
  console.log('Total assignments received:', assignments.length);

  // Debug: Show ALL assignments by system to understand the data
  const bySystem = {};
  assignments.forEach(a => {
    const sysName = a.resource?.system?.name || 'Unknown';
    if (!bySystem[sysName]) bySystem[sysName] = [];
    bySystem[sysName].push(a.resource?.name);
  });
  console.log('Assignments by system:');
  Object.entries(bySystem).forEach(([sys, resources]) => {
    console.log(`  ${sys}: ${resources.length} resources`);
    if (sys.toLowerCase().includes('servicenow')) {
      console.log('    ServiceNow resources:', resources.slice(0, 10));
    }
  });

  // Get lane config for exclusion rules
  const laneConfig = LaneDisplayConfig[LaneTypes.EFFECTIVE_ENTITLEMENTS] || {};

  // Apply exclusion rules from lane config
  const filteredAssignments = applyExclusionRules(assignments, laneConfig.exclusionList);

  console.log('After exclusion rules:', filteredAssignments.length, 'assignments (excluded:', assignments.length - filteredAssignments.length, ')');

  // Debug: Show what was excluded
  if (assignments.length !== filteredAssignments.length) {
    const excluded = assignments.filter(a => !filteredAssignments.includes(a));
    console.log('Excluded assignments (' + excluded.length + ' total):');
    excluded.slice(0, 10).forEach((a, i) => {
      console.log(`  ${i}: "${a.resource?.name}" - type: "${a.resource?.resourceType?.name}", category: "${a.resource?.resourceCategory?.name}", system: "${a.resource?.system?.name}"`);
    });

    // Check if any ServiceNow resources were excluded
    const excludedServiceNow = excluded.filter(a =>
      (a.resource?.system?.name || '').toLowerCase().includes('servicenow')
    );
    if (excludedServiceNow.length > 0) {
      console.log('WARNING: ServiceNow resources excluded:', excludedServiceNow.length);
      excludedServiceNow.slice(0, 5).forEach((a, i) => {
        console.log(`  ${i}: "${a.resource?.name}" - type: "${a.resource?.resourceType?.name}"`);
      });
    }
  }

  // Debug: Show sample of included assignments
  console.log('Included assignments (' + filteredAssignments.length + ' total):');
  filteredAssignments.slice(0, 10).forEach((a, i) => {
    console.log(`  ${i}: "${a.resource?.name}" - type: "${a.resource?.resourceType?.name}", system: "${a.resource?.system?.name}"`);
  });

  const items = filteredAssignments.map((assignment, index) => {
    const entitlementNode = {
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
        complianceStatus: assignment.complianceStatus,
        validFrom: assignment.validFrom || null,
        validTo: assignment.validTo || null,
        // Account info for cross-lane filtering
        accountName: assignment.account?.accountName,
        accountId: assignment.account?.id
      },
      // Include full assignment data for Object Inspector
      rawData: {
        ...assignment.resource,
        validFrom: assignment.validFrom,
        validTo: assignment.validTo,
        complianceStatus: assignment.complianceStatus,
        disabled: assignment.disabled,
        reason: assignment.reason,
        account: assignment.account,
        violations: assignment.violations
      }
    };

    // Transform reasons if available
    const reasons = (assignment.reasons || []).map((r, i) => transformReason(r, i));

    return {
      node: entitlementNode,
      reasons: reasons.length > 0 ? reasons : [
        {
          id: `reason-${index}-default`,
          type: ReasonTypes.OTHER,
          title: 'Assignment',
          description: `Assigned via ${assignment.assignmentType || 'unknown method'}`,
          confidence: 'high'
        }
      ],
      groupKey: assignment.resource?.system?.id,
      groupLabel: assignment.resource?.system?.name,
      rawData: assignment
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

  console.log('=== buildEntitlementsLane: Final ===');
  console.log('Total entitlement items:', filteredItems.length);

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

  console.log(`=== Populating lanes for ${nodeType} ===`);
  console.log('Available API data:', Object.keys(apiData));

  const lanes = [];

  for (const config of laneConfig.lanes) {
    const lane = populateSingleLane(config, focusNode, apiData, filters);
    if (lane && lane.items.length > 0) {
      lanes.push(lane);
      console.log(`  Lane ${config.laneType}: ${lane.items.length} items`);
    } else {
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
 * (e.g., extract systems/accounts from calculatedAssignments)
 */
function populateDerivedLane(laneConfig, focusNode, apiData, filters) {
  const { laneType, apiSource } = laneConfig;
  const { from, extract } = apiSource;

  // Get the source data
  const sourceData = apiData[from];
  if (!sourceData || !Array.isArray(sourceData)) {
    return { laneType, totalCount: 0, items: [], canLoadMore: false };
  }

  let items = [];

  switch (extract) {
    case 'systems':
      items = extractSystemsFromAssignments(sourceData);
      break;

    case 'accounts':
      items = extractAccountsFromAssignments(sourceData);
      break;

    case 'roles':
      items = extractRolesFromAssignments(sourceData);
      break;

    case 'entitlements':
      items = extractEntitlementsFromAssignments(sourceData);
      break;

    case 'system':
      // Single system from focus node
      if (focusNode.metadata?.system) {
        items = [{
          node: {
            id: focusNode.metadata.systemId || 'system-1',
            type: NodeTypes.SYSTEM,
            displayName: focusNode.metadata.system,
            status: 'active',
            badges: [],
            metadata: {}
          }
        }];
      }
      break;

    case 'identity':
      // Single identity from focus node
      if (focusNode.metadata?.identity) {
        items = [{
          node: {
            id: focusNode.metadata.identityId || 'identity-1',
            type: NodeTypes.IDENTITY,
            displayName: focusNode.metadata.identity,
            status: 'active',
            badges: [],
            metadata: {}
          }
        }];
      }
      break;

    default:
      console.warn(`Unknown extract type: ${extract}`);
  }

  // Apply filters if any
  const filteredItems = applyLaneFilters(items, filters, laneType);

  return {
    laneType,
    totalCount: filteredItems.length,
    items: filters.showAll ? filteredItems : filteredItems.slice(0, 10),
    canLoadMore: filteredItems.length > 10
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
  console.log(`OData lane ${laneType} not yet implemented`);
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
    console.log('buildLanesForEntitlement: No assignments provided');
    return [];
  }

  console.log('=== buildLanesForEntitlement ===');
  console.log('Processing', assignments.length, 'assignments for entitlement-centric view');

  const lanes = [];

  // 1. Build Identities lane - who has this entitlement
  lanes.push(buildIdentitiesLaneForEntitlement(assignments, filters));

  // 2. Build Accounts lane - accounts through which the entitlement is assigned
  lanes.push(buildAccountsLaneForEntitlement(assignments, filters));

  // 3. Build System lane - the system this entitlement belongs to
  lanes.push(buildSystemLaneForEntitlement(assignments, filters, entitlementNode));

  console.log('Built lanes for entitlement-centric view:');
  lanes.forEach(lane => {
    console.log(`  - ${lane.laneType}: ${lane.items.length} items`);
  });

  return lanes;
}

/**
 * Build Identities lane for entitlement-centric view
 * Extract unique identities from assignments
 */
function buildIdentitiesLaneForEntitlement(assignments, filters) {
  const identitiesMap = new Map();

  assignments.forEach((assignment) => {
    const identity = assignment.identity;
    if (!identity || !identity.id) return;

    if (!identitiesMap.has(identity.id)) {
      identitiesMap.set(identity.id, {
        id: identity.id,
        identityId: identity.identityId,
        displayName: identity.displayName || `${identity.firstName || ''} ${identity.lastName || ''}`.trim(),
        firstName: identity.firstName,
        lastName: identity.lastName,
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
        firstName: ident.firstName,
        lastName: ident.lastName,
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

  // Sort alphabetically by displayName
  items.sort((a, b) =>
    (a.node.displayName || '').toLowerCase().localeCompare((b.node.displayName || '').toLowerCase())
  );

  return {
    laneType: LaneTypes.IDENTITIES,
    totalCount: items.length,
    items: filters.showAll ? items : items.slice(0, 10),
    allItemsData: items,
    canLoadMore: items.length > 10
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
        identityName: acc.identity?.displayName || `${acc.identity?.firstName || ''} ${acc.identity?.lastName || ''}`.trim()
      },
      rawData: acc
    },
    reasons: [],
    groupKey: acc.identity?.id || 'unknown',
    groupLabel: acc.identity?.displayName || 'Unknown Identity',
    rawData: acc
  }));

  return {
    laneType: LaneTypes.ACCOUNTS,
    totalCount: items.length,
    items: filters.showAll ? items : items.slice(0, 10),
    allItemsData: items,
    canLoadMore: items.length > 10
  };
}

/**
 * Build System lane for entitlement-centric view
 * Extract the system from the entitlement's resource data
 */
function buildSystemLaneForEntitlement(assignments, filters, entitlementNode) {
  // Try to get system from the entitlement node first
  let system = null;

  if (entitlementNode?.metadata?.systemId || entitlementNode?.rawData?.system) {
    system = {
      id: entitlementNode.metadata?.systemId || entitlementNode.rawData?.system?.id,
      name: entitlementNode.metadata?.system || entitlementNode.rawData?.system?.name
    };
  }

  // Fallback: extract from first assignment's resource
  if (!system && assignments.length > 0) {
    const resourceSystem = assignments[0]?.resource?.system;
    if (resourceSystem) {
      system = {
        id: resourceSystem.id,
        name: resourceSystem.name
      };
    }
  }

  if (!system || !system.id) {
    return {
      laneType: LaneTypes.SYSTEMS,
      totalCount: 0,
      items: [],
      allItemsData: [],
      canLoadMore: false
    };
  }

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

  return {
    laneType: LaneTypes.SYSTEMS,
    totalCount: items.length,
    items: items,
    allItemsData: items,
    canLoadMore: false
  };
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
 * Export for use in AccessLens
 */
export default {
  fetchFocusData,
  fetchExplanationData,
  configureDataService,
  extractUniqueReasonTypes,
  extractUniqueComplianceStatuses,
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
  populateLanesForNodeType
};
