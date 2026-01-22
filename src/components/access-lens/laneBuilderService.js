/**
 * Lane Builder Service
 *
 * Provides schema-driven lane building for Identity360.
 * Consolidates multiple lane builder functions into a single generic service
 * that uses configuration to extract and transform data.
 */

import {
  LaneTypes,
  NodeTypes,
  LaneSchema,
  LaneConfigSchema,
  LaneDisplayConfig,
  shouldLog
} from './accessLensTypes';

// Import shared utilities from canonical source
import { getNestedValue, getStringValue } from './accessLensUtils';

// Re-export utilities for backward compatibility
export { getNestedValue, getStringValue };

// ============================================================================
// FIELD MAPPINGS - Define how to extract data from different sources
// ============================================================================

/**
 * Field mappings for extracting lane items from assignments
 * Each mapping defines: source path, target property, and optional transform
 */
export const FieldMappings = {
  // Identity extraction from assignment
  identity: {
    id: 'identity.id',
    identityId: 'identity.identityId',
    displayName: 'identity.displayName|identity.firstName+identity.lastName',
    firstName: 'identity.firstName',
    lastName: 'identity.lastName',
    riskLevel: 'identity.riskLevel.name',
    status: 'identity.status'
  },

  // Account extraction from assignment
  account: {
    id: 'account.id',
    accountName: 'account.accountName',
    displayName: 'account.accountName',  // For consistency
    accountType: 'account.accountType.name',
    system: 'account.system.name',
    systemId: 'account.system.id'
  },

  // Resource/Entitlement extraction from assignment
  resource: {
    id: 'resource.id',
    name: 'resource.name',
    displayName: 'resource.name',
    description: 'resource.description',
    system: 'resource.system.name',
    systemId: 'resource.system.id',
    resourceType: 'resource.resourceType.name',
    resourceTypeId: 'resource.resourceType.id'
  },

  // System extraction from assignment (either account.system or resource.system)
  system: {
    id: 'account.system.id|resource.system.id',
    name: 'account.system.name|resource.system.name',
    displayName: 'account.system.name|resource.system.name'
  }
};

// ============================================================================
// GENERIC LANE BUILDERS
// ============================================================================

/**
 * Generic function to extract unique items from assignments
 *
 * @param {Array} assignments - Array of assignment objects
 * @param {string} extractType - Type of extraction ('identity', 'account', 'resource', 'system')
 * @param {Object} options - Additional options
 * @returns {Map} Map of unique items keyed by ID
 */
export const extractUniqueItems = (assignments, extractType, options = {}) => {
  const itemsMap = new Map();
  const fieldMapping = FieldMappings[extractType];

  if (!fieldMapping) {
    console.warn(`No field mapping found for extract type: ${extractType}`);
    return itemsMap;
  }

  assignments.forEach((assignment, index) => {
    // Extract the base item using field mappings
    const extractedItem = {};
    let hasData = false;

    for (const [targetField, sourcePath] of Object.entries(fieldMapping)) {
      // Handle special case for displayName with firstName + lastName
      if (sourcePath.includes('+')) {
        const parts = sourcePath.split('+');
        const values = parts.map(p => getNestedValue(assignment, p.trim())).filter(Boolean);
        extractedItem[targetField] = values.join(' ').trim() || undefined;
      } else {
        extractedItem[targetField] = getNestedValue(assignment, sourcePath);
      }
      if (extractedItem[targetField]) hasData = true;
    }

    if (!hasData || !extractedItem.id) return;

    const uniqueKey = String(extractedItem.id);

    if (!itemsMap.has(uniqueKey)) {
      // Initialize the item with cross-reference tracking
      itemsMap.set(uniqueKey, {
        ...extractedItem,
        // Cross-reference tracking for filtering
        _assignmentCount: 1,
        _identityIds: new Set(),
        _accountIds: new Set(),
        _resourceIds: new Set(),
        _systemIds: new Set()
      });

      // Track identity if available
      if (assignment.identity?.id) {
        itemsMap.get(uniqueKey)._identityIds.add(assignment.identity.id);
      }
      // Track account if available
      if (assignment.account?.id) {
        itemsMap.get(uniqueKey)._accountIds.add(assignment.account.id);
      }
      // Track resource if available
      if (assignment.resource?.id) {
        itemsMap.get(uniqueKey)._resourceIds.add(assignment.resource.id);
      }
      // Track system if available
      const systemId = assignment.account?.system?.id || assignment.resource?.system?.id;
      if (systemId) {
        itemsMap.get(uniqueKey)._systemIds.add(systemId);
      }
    } else {
      // Item exists - update cross-references
      const item = itemsMap.get(uniqueKey);
      item._assignmentCount++;

      if (assignment.identity?.id) {
        item._identityIds.add(assignment.identity.id);
      }
      if (assignment.account?.id) {
        item._accountIds.add(assignment.account.id);
      }
      if (assignment.resource?.id) {
        item._resourceIds.add(assignment.resource.id);
      }
      const systemId = assignment.account?.system?.id || assignment.resource?.system?.id;
      if (systemId) {
        item._systemIds.add(systemId);
      }
    }
  });

  return itemsMap;
};

/**
 * Build a lane item node from extracted data
 *
 * @param {Object} extractedData - Data extracted from assignments
 * @param {string} nodeType - The NodeTypes value
 * @param {Object} assignment - Optional original assignment for rawData
 * @returns {Object} Lane item with node structure
 */
export const buildLaneItemNode = (extractedData, nodeType, assignment = null) => {
  const schema = LaneSchema[nodeType] || {};

  // Convert Sets to Arrays for the final node
  const identityIds = Array.from(extractedData._identityIds || []);
  const accountIds = Array.from(extractedData._accountIds || []);
  const resourceIds = Array.from(extractedData._resourceIds || []);
  const systemIds = Array.from(extractedData._systemIds || []);

  const node = {
    id: extractedData.id,
    type: nodeType,
    displayName: extractedData.displayName || extractedData.name || extractedData.accountName || 'Unknown',
    status: extractedData.status || 'active',
    badges: [],
    metadata: {
      // Include extracted fields
      ...extractedData,
      // Cross-reference IDs for filtering
      identityIds,
      accountIds,
      resourceIds,
      systemIds,
      // Counts
      assignmentCount: extractedData._assignmentCount || 1
    },
    rawData: {
      ...extractedData,
      identityIds,
      accountIds,
      resourceIds,
      systemIds
    }
  };

  // Build badges based on node type
  switch (nodeType) {
    case NodeTypes.IDENTITY:
      if (extractedData.riskLevel) node.badges.push(extractedData.riskLevel);
      break;
    case NodeTypes.ACCOUNT:
      if (extractedData.system) node.badges.push(extractedData.system);
      if (extractedData.accountType) node.badges.push(extractedData.accountType);
      node.metadata.system = extractedData.system;
      node.metadata.systemId = extractedData.systemId;
      break;
    case NodeTypes.ENTITLEMENT:
      if (extractedData.system) node.badges.push(extractedData.system);
      if (extractedData.resourceType) node.badges.push(extractedData.resourceType);
      node.metadata.system = extractedData.system;
      node.metadata.systemId = extractedData.systemId;
      node.metadata.type = extractedData.resourceType;
      break;
    case NodeTypes.SYSTEM:
      // Systems may have type/category badges
      break;
  }

  // Filter out empty badges
  node.badges = node.badges.filter(Boolean);

  return node;
};

/**
 * Generic lane builder function
 *
 * @param {string} laneType - The LaneTypes value
 * @param {Array} assignments - Array of assignment objects
 * @param {string} extractType - Type of extraction ('identity', 'account', 'resource', 'system')
 * @param {Object} options - Additional options (filters, sorting, etc.)
 * @returns {Object} Lane object with items
 */
export const buildLane = (laneType, assignments, extractType, options = {}) => {
  if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
    return {
      laneType,
      totalCount: 0,
      items: [],
      allItemsData: [],
      canLoadMore: false
    };
  }

  const laneSchema = LaneSchema[laneType];
  const nodeType = laneSchema?.dataType || extractType;

  if (shouldLog('LANES')) {
    console.log(`[LaneBuilder] Building ${laneType} lane from ${assignments.length} assignments`);
  }

  // Extract unique items
  const itemsMap = extractUniqueItems(assignments, extractType, options);

  if (shouldLog('LANES')) {
    console.log(`[LaneBuilder] Extracted ${itemsMap.size} unique items`);
  }

  // Convert to lane items
  const items = Array.from(itemsMap.values()).map(extractedData => {
    const node = buildLaneItemNode(extractedData, nodeType);

    return {
      node,
      reasons: [],
      groupKey: extractedData.systemId || extractedData.system || 'default',
      groupLabel: extractedData.system || 'Default',
      rawData: extractedData
    };
  });

  // Apply sorting if configured
  const sortConfig = laneSchema?.defaultSort;
  if (sortConfig) {
    const { field, order } = sortConfig;
    items.sort((a, b) => {
      const aValue = (a.node[field] || a.node.displayName || '').toLowerCase();
      const bValue = (b.node[field] || b.node.displayName || '').toLowerCase();
      const comparison = aValue.localeCompare(bValue);
      return order === 'desc' ? -comparison : comparison;
    });
  } else {
    // Default sort by displayName
    items.sort((a, b) =>
      (a.node.displayName || '').toLowerCase().localeCompare(
        (b.node.displayName || '').toLowerCase()
      )
    );
  }

  return {
    laneType,
    totalCount: items.length,
    items,
    allItemsData: items,
    canLoadMore: false
  };
};

// ============================================================================
// SPECIALIZED LANE BUILDERS (using generic buildLane)
// ============================================================================

/**
 * Build Identities lane from assignments
 */
export const buildIdentitiesLane = (assignments, options = {}) => {
  return buildLane(LaneTypes.IDENTITIES, assignments, 'identity', options);
};

/**
 * Build Accounts lane from assignments
 */
export const buildAccountsLane = (assignments, options = {}) => {
  return buildLane(LaneTypes.ACCOUNTS, assignments, 'account', options);
};

/**
 * Build Entitlements lane from assignments
 */
export const buildEntitlementsLane = (assignments, options = {}) => {
  // Apply exclusion rules if configured
  const laneConfig = LaneDisplayConfig?.[LaneTypes.EFFECTIVE_ENTITLEMENTS] || {};
  let filteredAssignments = assignments;

  if (laneConfig.exclusionList && laneConfig.exclusionList.length > 0) {
    filteredAssignments = assignments.filter(assignment => {
      const resource = assignment.resource;
      if (!resource) return false;

      // Check exclusion rules
      for (const rule of laneConfig.exclusionList) {
        // Support both old (field/condition) and new (fields/matchType) property names
        const fields = rule.fields || (rule.field ? [rule.field] : []);
        const values = rule.values || [];
        const matchType = rule.matchType || rule.condition || 'exact';

        // Check each field specified in the rule
        for (const field of fields) {
          const fieldValue = getNestedValue(resource, field);
          const normalizedValue = getStringValue(fieldValue).toLowerCase().trim();

          // Check if field value matches any of the excluded values
          for (const excludeValue of values) {
            const excludeLower = excludeValue.toLowerCase().trim();
            let isMatch = false;

            switch (matchType) {
              case 'contains':
                isMatch = normalizedValue.includes(excludeLower);
                break;
              case 'endsWith':
                isMatch = normalizedValue.endsWith(excludeLower);
                break;
              case 'startsWith':
                isMatch = normalizedValue.startsWith(excludeLower);
                break;
              case 'equals':
              case 'exact':
              default:
                isMatch = normalizedValue === excludeLower;
                break;
            }

            if (isMatch) {
              return false;  // Exclude this item
            }
          }
        }
      }

      return true;
    });
  }

  const lane = buildLane(LaneTypes.EFFECTIVE_ENTITLEMENTS, filteredAssignments, 'resource', options);

  // Add compliance status and other assignment-level data to each item
  lane.items = lane.items.map((item, index) => {
    // Find the original assignment for this resource
    const assignment = filteredAssignments.find(a => a.resource?.id === item.node.id);
    if (assignment) {
      item.node.metadata.complianceStatus = assignment.complianceStatus;
      item.node.metadata.validFrom = assignment.validFrom;
      item.node.metadata.validTo = assignment.validTo;
      item.node.metadata.accountId = assignment.account?.id;
      item.node.metadata.accountName = assignment.account?.accountName;
      item.node.metadata.identityId = assignment.identity?.id;

      item.rawData = {
        ...item.rawData,
        complianceStatus: assignment.complianceStatus,
        validFrom: assignment.validFrom,
        validTo: assignment.validTo,
        reason: assignment.reason,
        account: assignment.account,
        identity: assignment.identity,
        violations: assignment.violations
      };
    }
    return item;
  });

  return lane;
};

/**
 * Build Systems lane from assignments
 */
export const buildSystemsLane = (assignments, options = {}) => {
  return buildLane(LaneTypes.SYSTEMS, assignments, 'system', options);
};

/**
 * Build Violations lane from assignments
 * Extracts unique violations from assignment data and creates lane items
 */
const buildViolationsLaneFromAssignments = (assignments, options = {}) => {
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
    console.log('[LaneBuilder] Violations found:', violationsMap.size);
  }

  // Convert to lane items
  const items = Array.from(violationsMap.values()).map((violation, index) => {
    // Parse the violation description to extract the conflicting entitlement name
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
};

// ============================================================================
// LANE BUILDER ORCHESTRATOR
// ============================================================================

/**
 * Build all lanes for a focus node type from assignments
 *
 * @param {string} focusNodeType - The NodeTypes value
 * @param {Array} assignments - Array of assignment objects
 * @param {Object} options - Additional options
 * @returns {Array} Array of lane objects
 */
export const buildLanesForFocusNode = (focusNodeType, assignments, options = {}) => {
  const config = LaneConfigSchema[focusNodeType];
  if (!config) {
    console.warn(`No LaneConfigSchema found for focus node type: ${focusNodeType}`);
    return [];
  }

  const lanes = [];

  for (const laneConfig of config.lanes) {
    const { laneType, apiSource } = laneConfig;

    // Only build lanes that derive from calculatedAssignments
    if (apiSource?.type !== 'derived' || apiSource?.from !== 'calculatedAssignments') {
      continue;  // Skip - this lane needs different data source
    }

    const extractType = apiSource.extract;
    let lane;

    switch (extractType) {
      case 'identities':
        lane = buildIdentitiesLane(assignments, options);
        break;
      case 'accounts':
        lane = buildAccountsLane(assignments, options);
        break;
      case 'entitlements':
      case 'resources':
        lane = buildEntitlementsLane(assignments, options);
        break;
      case 'systems':
        lane = buildSystemsLane(assignments, options);
        break;
      case 'violations':
        // Violations are built by the specialized function in accessLensDataService
        // We need to dynamically import it to avoid circular dependency
        lane = buildViolationsLaneFromAssignments(assignments, options);
        break;
      default:
        console.warn(`Unknown extract type: ${extractType}`);
        continue;
    }

    if (lane) {
      lanes.push(lane);
    }
  }

  if (shouldLog('LANES')) {
    console.log(`[LaneBuilder] Built ${lanes.length} lanes for ${focusNodeType}:`,
      lanes.map(l => `${l.laneType}(${l.items.length})`).join(', '));
  }

  return lanes;
};

export default {
  buildLane,
  buildIdentitiesLane,
  buildAccountsLane,
  buildEntitlementsLane,
  buildSystemsLane,
  buildLanesForFocusNode,
  extractUniqueItems,
  buildLaneItemNode,
  getNestedValue,
  getStringValue,
  FieldMappings
};
