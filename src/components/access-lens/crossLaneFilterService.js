/**
 * Cross-Lane Filter Service
 *
 * Provides schema-driven cross-lane filtering for Access Lens.
 * This service reads filter configurations from LaneConfigSchema and applies
 * filters based on lane selections, replacing hardcoded filtering logic.
 */

import {
  LaneConfigSchema,
  CrossLaneFilterType,
  LaneTypes,
  NodeTypes,
  getRequiredLanes,
  getCrossLaneFilterConfig
} from './accessLensTypes';

/**
 * Get a nested value from an object using dot notation
 * @param {Object} obj - The object to extract from
 * @param {string} path - Dot-notation path (e.g., 'metadata.systemId')
 * @returns {*} The value at the path, or undefined
 */
const getNestedValue = (obj, path) => {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

/**
 * Get value from an item, checking both node and item level
 * @param {Object} item - Lane item with node property
 * @param {string} path - Field path
 * @returns {*} The value
 */
const getItemValue = (item, path) => {
  // Try node first, then item root, then rawData
  return getNestedValue(item.node, path) ??
         getNestedValue(item, path) ??
         getNestedValue(item.rawData, path) ??
         getNestedValue(item.node?.rawData, path);
};

/**
 * Apply a single field match filter
 * Checks if sourceValue equals targetValue
 */
const applyFieldMatch = (item, sourceValue, targetField) => {
  const targetValue = getItemValue(item, targetField);
  if (targetValue === undefined || targetValue === null) return false;
  return String(targetValue) === String(sourceValue);
};

/**
 * Apply an array contains filter
 * Checks if sourceValue is contained in target array, or if source array contains target value
 */
const applyArrayContains = (item, sourceValue, targetField) => {
  const targetValue = getItemValue(item, targetField);

  // Source is array, target is single value
  if (Array.isArray(sourceValue)) {
    const match = sourceValue.some(sv => String(sv) === String(targetValue));
    // Debug logging for array filters (only log first few items)
    if (item.node?.displayName && sourceValue.length > 0) {
      console.log(`[ArrayContains] Source array[${sourceValue.length}] -> target "${targetValue}" (${item.node.displayName}): ${match}`);
    }
    return match;
  }

  // Target is array, source is single value
  if (Array.isArray(targetValue)) {
    const match = targetValue.some(tv => String(tv) === String(sourceValue));
    // Debug logging for array filters
    if (item.node?.displayName && targetValue.length > 0) {
      console.log(`[ArrayContains] Source "${sourceValue}" -> target array[${targetValue.length}] (${item.node.displayName}): ${match}`);
    }
    return match;
  }

  // Both single values - fall back to field match
  return String(targetValue) === String(sourceValue);
};

/**
 * Apply a multi-field match filter
 * Checks if any source field matches any target field
 */
const applyMultiFieldMatch = (item, selectedNode, sourceFields, targetFields) => {
  for (const sourceField of sourceFields) {
    const sourceValue = getNestedValue(selectedNode, sourceField) ??
                        getNestedValue(selectedNode, `metadata.${sourceField}`);
    if (!sourceValue) continue;

    for (const targetField of targetFields) {
      const targetValue = getItemValue(item, targetField);
      if (!targetValue) continue;

      if (String(sourceValue) === String(targetValue)) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Apply a cascaded filter through an intermediate lane
 * This is a two-step filter:
 * 1. First filter the intermediate lane using sourceField -> intermediateTargetField
 * 2. Extract values from the filtered intermediate items using intermediateExtractField
 * 3. Filter target items to only include those whose targetField matches extracted values
 *
 * @param {Array} targetItems - Items in the target lane to filter
 * @param {Object} selectedNode - The selected node (e.g., Policy)
 * @param {Object} filterMapping - The filter mapping configuration
 * @param {Array} allLanes - All lanes (to find intermediate lane)
 * @returns {Array} Filtered target items
 */
const applyCascadedFilter = (targetItems, selectedNode, filterMapping, allLanes) => {
  const {
    intermediateLane,
    sourceField,
    intermediateTargetField,
    intermediateExtractField,
    intermediateExtractFields,  // Support for multiple extract fields
    targetField,
    targetFields                 // Support for multiple target fields
  } = filterMapping;

  // Normalize to arrays for unified handling
  const extractFields = intermediateExtractFields || (intermediateExtractField ? [intermediateExtractField] : []);
  const matchTargetFields = targetFields || (targetField ? [targetField] : []);

  console.log('[CascadedFilter] Starting cascaded filter');
  console.log('[CascadedFilter] Source field:', sourceField);
  console.log('[CascadedFilter] Intermediate lane:', intermediateLane);
  console.log('[CascadedFilter] Intermediate extract fields:', extractFields);

  // Get the source values (e.g., resourceIds from Policy)
  const sourceValues = getNestedValue(selectedNode, sourceField) ??
                       getNestedValue(selectedNode, `metadata.${sourceField}`);

  if (!sourceValues || (Array.isArray(sourceValues) && sourceValues.length === 0)) {
    console.log('[CascadedFilter] No source values found, returning all items');
    return targetItems;
  }

  const sourceValuesArray = Array.isArray(sourceValues) ? sourceValues : [sourceValues];
  console.log('[CascadedFilter] Source values:', sourceValuesArray.length, 'items');

  // Find the intermediate lane
  const intermediateL = allLanes.find(l => l.laneType === intermediateLane);
  if (!intermediateL || !intermediateL.items) {
    console.log('[CascadedFilter] Intermediate lane not found or has no items');
    return targetItems;
  }

  console.log('[CascadedFilter] Intermediate lane has', intermediateL.items.length, 'items');

  // Step 1: Filter intermediate items that match the source values
  // Handle both single values and arrays for intermediateTargetField
  const filteredIntermediateItems = intermediateL.items.filter(item => {
    const itemValue = getItemValue(item, intermediateTargetField);
    if (!itemValue) return false;

    // If itemValue is an array (e.g., accountIds), check if any source value is in the array
    if (Array.isArray(itemValue)) {
      return sourceValuesArray.some(sv =>
        itemValue.some(iv => String(iv) === String(sv))
      );
    }

    // Otherwise, simple match
    return sourceValuesArray.some(sv => String(sv) === String(itemValue));
  });

  console.log('[CascadedFilter] Filtered intermediate items:', filteredIntermediateItems.length);

  // Step 2: Extract unique values from filtered intermediate items
  // Handle both single values and arrays (for deduplicated entitlements with accountIds/identityIds arrays)
  // Also handle multiple extract fields - try each field and collect all non-null values
  const extractedValues = new Set();
  filteredIntermediateItems.forEach(item => {
    // Try each extract field and collect all values found
    for (const extractField of extractFields) {
      const value = getItemValue(item, extractField);
      if (value) {
        if (Array.isArray(value)) {
          // If the extracted value is an array, add each element
          value.forEach(v => {
            if (v != null) extractedValues.add(String(v));
          });
        } else {
          extractedValues.add(String(value));
        }
      }
    }
  });

  const extractedValuesArray = Array.from(extractedValues);
  console.log('[CascadedFilter] Extracted values from intermediate:', extractedValuesArray.length, 'unique values');
  if (extractedValuesArray.length > 0 && extractedValuesArray.length <= 10) {
    console.log('[CascadedFilter] Extracted values:', extractedValuesArray);
  }

  if (extractedValuesArray.length === 0) {
    console.log('[CascadedFilter] No values extracted from intermediate, returning empty');
    return [];
  }

  // Step 3: Filter target items to only those matching extracted values
  // Support multiple target fields - match if ANY target field matches ANY extracted value
  const filteredTargetItems = targetItems.filter(item => {
    for (const tField of matchTargetFields) {
      const targetValue = getItemValue(item, tField);
      if (targetValue && extractedValuesArray.includes(String(targetValue))) {
        return true;
      }
    }
    return false;
  });

  console.log('[CascadedFilter] Final filtered target items:', filteredTargetItems.length, 'of', targetItems.length);

  return filteredTargetItems;
};

/**
 * Apply a filter mapping to a lane's items
 * @param {Array} items - Lane items to filter
 * @param {Object} selectedNode - The selected node that drives filtering
 * @param {Object} filterMapping - The filter mapping configuration
 * @param {Array} allLanes - All lanes (needed for cascaded filters)
 * @returns {Array} Filtered items
 */
const applyFilterMapping = (items, selectedNode, filterMapping, allLanes = []) => {
  if (!items || !selectedNode || !filterMapping) return items;

  const { type, sourceField, sourceFields, targetField, targetFields } = filterMapping;

  // Special handling for cascaded filters (needs access to all lanes)
  if (type === CrossLaneFilterType.CASCADED_THROUGH) {
    return applyCascadedFilter(items, selectedNode, filterMapping, allLanes);
  }

  return items.filter(item => {
    switch (type) {
      case CrossLaneFilterType.FIELD_MATCH: {
        const sourceValue = getNestedValue(selectedNode, sourceField) ??
                           getNestedValue(selectedNode, `metadata.${sourceField}`);
        if (!sourceValue) return true; // No source value, don't filter
        return applyFieldMatch(item, sourceValue, targetField);
      }

      case CrossLaneFilterType.ARRAY_CONTAINS: {
        const sourceValue = getNestedValue(selectedNode, sourceField) ??
                           getNestedValue(selectedNode, `metadata.${sourceField}`);
        if (!sourceValue) return true;
        return applyArrayContains(item, sourceValue, targetField);
      }

      case CrossLaneFilterType.MULTI_FIELD_MATCH: {
        return applyMultiFieldMatch(item, selectedNode, sourceFields, targetFields);
      }

      default:
        console.warn(`Unknown filter type: ${type}`);
        return true;
    }
  });
};

/**
 * Find a lane by type in the lanes array
 */
const findLane = (lanes, laneType) => {
  return lanes.find(l => l.laneType === laneType);
};

/**
 * Find an item in a lane by ID
 */
const findItemById = (lane, itemId) => {
  if (!lane?.items || !itemId) return null;
  const itemIdStr = String(itemId);
  return lane.items.find(item => String(item.node?.id) === itemIdStr);
};

/**
 * Apply cross-lane filters based on current selections
 *
 * @param {Array} lanes - Array of lane objects
 * @param {string} focusNodeType - The NodeTypes value for the central node
 * @param {Object} selections - Object containing current lane selections
 *   { accountId, systemId, identityId, logicalAppId }
 * @param {Object} additionalFilters - Additional filter criteria (reasonTypes, complianceStatuses, etc.)
 * @returns {Array} Filtered lanes with updated items
 */
export const applyCrossLaneFilters = (
  lanes,
  focusNodeType,
  selections = {},
  additionalFilters = {}
) => {
  if (!lanes || !focusNodeType) return lanes;

  const config = LaneConfigSchema[focusNodeType];
  if (!config) {
    console.warn(`No LaneConfigSchema found for focus node type: ${focusNodeType}`);
    return lanes;
  }

  // Build a map of selection lane type to selected node
  const selectionMap = {};

  if (selections.identityId) {
    const identitiesLane = findLane(lanes, LaneTypes.IDENTITIES);
    const selectedItem = findItemById(identitiesLane, selections.identityId);
    if (selectedItem) {
      selectionMap[LaneTypes.IDENTITIES] = selectedItem.node;
    }
  }

  if (selections.accountId) {
    const accountsLane = findLane(lanes, LaneTypes.ACCOUNTS);
    const selectedItem = findItemById(accountsLane, selections.accountId);
    if (selectedItem) {
      selectionMap[LaneTypes.ACCOUNTS] = selectedItem.node;
    }
  }

  if (selections.systemId) {
    const systemsLane = findLane(lanes, LaneTypes.SYSTEMS);
    const selectedItem = findItemById(systemsLane, selections.systemId);
    if (selectedItem) {
      selectionMap[LaneTypes.SYSTEMS] = selectedItem.node;
    }
  }

  if (selections.logicalAppId) {
    const logicalAppsLane = findLane(lanes, LaneTypes.LOGICAL_APPLICATIONS);
    const selectedItem = findItemById(logicalAppsLane, selections.logicalAppId);
    if (selectedItem) {
      selectionMap[LaneTypes.LOGICAL_APPLICATIONS] = selectedItem.node;
    }
  }

  if (selections.policyId) {
    const policiesLane = findLane(lanes, LaneTypes.ASSIGNMENT_POLICIES);
    const selectedItem = findItemById(policiesLane, selections.policyId);
    if (selectedItem) {
      selectionMap[LaneTypes.ASSIGNMENT_POLICIES] = selectedItem.node;
      // console.log('[CrossLaneFilter] Policy selected:', selectedItem.node?.displayName);
    }
  }

  if (selections.entitlementId) {
    const entitlementsLane = findLane(lanes, LaneTypes.EFFECTIVE_ENTITLEMENTS);
    const selectedItem = findItemById(entitlementsLane, selections.entitlementId);
    if (selectedItem) {
      selectionMap[LaneTypes.EFFECTIVE_ENTITLEMENTS] = selectedItem.node;
      // console.log('[CrossLaneFilter] Entitlement selected:', selectedItem.node?.displayName);
    }
  }

  // Track which lanes have been filtered
  const filteredLaneTypes = new Set();

  // Apply cross-lane filters based on schema
  const filteredLanes = lanes.map(lane => {
    const laneConfig = config.lanes.find(l => l.laneType === lane.laneType);
    if (!laneConfig?.crossLaneFilters?.filteredByLanes) {
      return lane;
    }

    let filteredItems = [...lane.items];
    let wasFiltered = false;

    // Check each lane type that can filter this lane
    for (const filteringLaneType of laneConfig.crossLaneFilters.filteredByLanes) {
      const selectedNode = selectionMap[filteringLaneType];
      if (!selectedNode) continue;

      // Don't filter a lane by itself
      if (filteringLaneType === lane.laneType) continue;

      // Get the filter mapping for this relationship
      // Check if the filtering lane has a mapping for this target lane
      const filteringLaneConfig = config.lanes.find(l => l.laneType === filteringLaneType);
      const filterMapping = filteringLaneConfig?.crossLaneFilters?.filterMappings?.[lane.laneType];

      if (filterMapping) {
        const beforeCount = filteredItems.length;
        // Pass all lanes for cascaded filters that need to access intermediate lanes
        filteredItems = applyFilterMapping(filteredItems, selectedNode, filterMapping, lanes);

        if (filteredItems.length !== beforeCount) {
          wasFiltered = true;
          filteredLaneTypes.add(lane.laneType);
          console.log(`[CrossLaneFilter] ${filteringLaneType} -> ${lane.laneType}: ${beforeCount} -> ${filteredItems.length} items`);
        }
      }
    }

    if (wasFiltered) {
      return {
        ...lane,
        items: filteredItems,
        totalCount: filteredItems.length,
        isFiltered: true
      };
    }

    return lane;
  });

  return filteredLanes;
};

/**
 * Filter lanes based on visibility rules
 * Required lanes are always visible; others are hidden when empty
 *
 * @param {Array} lanes - Array of lane objects
 * @param {string} focusNodeType - The NodeTypes value for the central node
 * @param {Array} visibleLanes - Array of lane types that should be visible (user preference)
 * @returns {Array} Filtered lanes
 */
export const filterVisibleLanes = (lanes, focusNodeType, visibleLanes = []) => {
  if (!lanes) return [];

  const requiredLanes = getRequiredLanes(focusNodeType);

  return lanes.filter(lane => {
    // Check user visibility preference first
    if (visibleLanes.length > 0 && !visibleLanes.includes(lane.laneType)) {
      return false;
    }

    // Required lanes are always visible
    if (requiredLanes.includes(lane.laneType)) {
      return true;
    }

    // Non-required lanes need items to be visible
    return lane.items && lane.items.length > 0;
  });
};

/**
 * Get the filter source lane type (which lane is driving the filter)
 *
 * @param {Object} selections - Current selections
 * @returns {string|null} The LaneTypes value of the filter source, or null
 */
export const getFilterSourceLaneType = (selections) => {
  if (selections.identityId) return LaneTypes.IDENTITIES;
  if (selections.accountId) return LaneTypes.ACCOUNTS;
  if (selections.systemId) return LaneTypes.SYSTEMS;
  if (selections.logicalAppId) return LaneTypes.LOGICAL_APPLICATIONS;
  if (selections.policyId) return LaneTypes.ASSIGNMENT_POLICIES;
  if (selections.entitlementId) return LaneTypes.EFFECTIVE_ENTITLEMENTS;
  return null;
};

/**
 * Determine if a lane is being filtered by current selections
 *
 * @param {string} laneType - The lane type to check
 * @param {string} focusNodeType - The focus node type
 * @param {Object} selections - Current selections
 * @returns {boolean} True if the lane is being filtered
 */
export const isLaneFiltered = (laneType, focusNodeType, selections) => {
  const filterConfig = getCrossLaneFilterConfig(focusNodeType, laneType);
  if (!filterConfig?.filteredByLanes) return false;

  return filterConfig.filteredByLanes.some(filteringLaneType => {
    switch (filteringLaneType) {
      case LaneTypes.IDENTITIES: return !!selections.identityId;
      case LaneTypes.ACCOUNTS: return !!selections.accountId;
      case LaneTypes.SYSTEMS: return !!selections.systemId;
      case LaneTypes.LOGICAL_APPLICATIONS: return !!selections.logicalAppId;
      case LaneTypes.ASSIGNMENT_POLICIES: return !!selections.policyId;
      case LaneTypes.EFFECTIVE_ENTITLEMENTS: return !!selections.entitlementId;
      default: return false;
    }
  });
};

/**
 * Determine if a lane is the filter source
 *
 * @param {string} laneType - The lane type to check
 * @param {Object} selections - Current selections
 * @returns {boolean} True if this lane is the filter source
 */
export const isLaneFilterSource = (laneType, selections) => {
  switch (laneType) {
    case LaneTypes.IDENTITIES: return !!selections.identityId;
    case LaneTypes.ACCOUNTS: return !!selections.accountId;
    case LaneTypes.SYSTEMS: return !!selections.systemId;
    case LaneTypes.LOGICAL_APPLICATIONS: return !!selections.logicalAppId;
    case LaneTypes.ASSIGNMENT_POLICIES: return !!selections.policyId;
    case LaneTypes.EFFECTIVE_ENTITLEMENTS: return !!selections.entitlementId;
    default: return false;
  }
};

export default {
  applyCrossLaneFilters,
  filterVisibleLanes,
  getFilterSourceLaneType,
  isLaneFiltered,
  isLaneFilterSource,
  getRequiredLanes
};
