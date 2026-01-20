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
  getCrossLaneFilterConfig,
  shouldLog
} from './accessLensTypes';
import { getNestedValue, getItemValue } from './accessLensUtils';

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
 * @param {Object} item - Item to check
 * @param {*} sourceValue - Source value (can be array)
 * @param {string} targetField - Field path to get target value from item
 * @param {Set} [sourceSet] - Pre-computed Set of string source values for O(1) lookup
 */
const applyArrayContains = (item, sourceValue, targetField, sourceSet = null) => {
  const targetValue = getItemValue(item, targetField);

  // Source is array, target is single value - use pre-computed Set if available
  if (Array.isArray(sourceValue)) {
    const targetStr = targetValue != null ? String(targetValue) : '';
    // Use pre-computed Set for O(1) lookup if available
    if (sourceSet) {
      return sourceSet.has(targetStr);
    }
    // Fallback to linear search
    return sourceValue.some(sv => String(sv) === targetStr);
  }

  // Target is array, source is single value
  if (Array.isArray(targetValue)) {
    const sourceStr = sourceValue != null ? String(sourceValue) : '';
    // Create Set from target for O(1) lookup (amortizes well for repeated checks)
    const targetSet = new Set(targetValue.map(tv => String(tv)));
    return targetSet.has(sourceStr);
  }

  // Both single values - fall back to field match
  const sourceStr = sourceValue != null ? String(sourceValue) : '';
  const targetStr = targetValue != null ? String(targetValue) : '';
  return targetStr === sourceStr;
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

  // Get the source values (e.g., resourceIds from Policy)
  const sourceValues = getNestedValue(selectedNode, sourceField) ??
                       getNestedValue(selectedNode, `metadata.${sourceField}`);

  if (!sourceValues || (Array.isArray(sourceValues) && sourceValues.length === 0)) {
    return targetItems;
  }

  // Pre-convert source values to Set of strings for O(1) lookup
  const sourceValuesArray = Array.isArray(sourceValues) ? sourceValues : [sourceValues];
  const sourceValuesSet = new Set(sourceValuesArray.map(v => String(v)));

  // Find the intermediate lane
  const intermediateL = allLanes.find(l => l.laneType === intermediateLane);
  if (!intermediateL || !intermediateL.items) {
    return targetItems;
  }

  // Step 1: Filter intermediate items that match the source values using Set for O(1) lookup
  const filteredIntermediateItems = intermediateL.items.filter(item => {
    const itemValue = getItemValue(item, intermediateTargetField);
    if (itemValue == null) return false;

    // If itemValue is an array (e.g., accountIds), check if any value is in source Set
    if (Array.isArray(itemValue)) {
      return itemValue.some(iv => iv != null && sourceValuesSet.has(String(iv)));
    }

    // Otherwise, simple Set lookup
    return sourceValuesSet.has(String(itemValue));
  });

  // Step 2: Extract unique values from filtered intermediate items into a Set
  // Handle both single values and arrays
  const extractedValuesSet = new Set();
  for (const item of filteredIntermediateItems) {
    // Try each extract field and collect all values found
    for (const extractField of extractFields) {
      const value = getItemValue(item, extractField);
      if (value != null) {
        if (Array.isArray(value)) {
          // If the extracted value is an array, add each element
          for (const v of value) {
            if (v != null) extractedValuesSet.add(String(v));
          }
        } else {
          extractedValuesSet.add(String(value));
        }
      }
    }
  }

  if (extractedValuesSet.size === 0) {
    return [];
  }

  // Step 3: Filter target items using Set for O(1) lookup
  // Support multiple target fields - match if ANY target field matches ANY extracted value
  const filteredTargetItems = targetItems.filter(item => {
    for (const tField of matchTargetFields) {
      const targetValue = getItemValue(item, tField);
      if (targetValue != null && extractedValuesSet.has(String(targetValue))) {
        return true;
      }
    }
    return false;
  });

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

  // Pre-compute source values once (outside the filter loop)
  let sourceValue = null;
  let sourceSet = null;
  let sourceStr = null;

  if (type === CrossLaneFilterType.FIELD_MATCH || type === CrossLaneFilterType.ARRAY_CONTAINS) {
    sourceValue = getNestedValue(selectedNode, sourceField) ??
                  getNestedValue(selectedNode, `metadata.${sourceField}`);
    if (!sourceValue) return items; // No source value, don't filter

    // Pre-compute string conversion for FIELD_MATCH
    if (type === CrossLaneFilterType.FIELD_MATCH) {
      sourceStr = String(sourceValue);
    }

    // Pre-compute Set for ARRAY_CONTAINS with array source
    if (type === CrossLaneFilterType.ARRAY_CONTAINS && Array.isArray(sourceValue)) {
      sourceSet = new Set(sourceValue.map(v => String(v)));
    }
  }

  // Pre-compute source field values for MULTI_FIELD_MATCH
  let sourceFieldValues = null;
  if (type === CrossLaneFilterType.MULTI_FIELD_MATCH && sourceFields) {
    sourceFieldValues = [];
    for (const sf of sourceFields) {
      const val = getNestedValue(selectedNode, sf) ??
                  getNestedValue(selectedNode, `metadata.${sf}`);
      if (val != null) {
        sourceFieldValues.push(String(val));
      }
    }
    if (sourceFieldValues.length === 0) return items; // No source values found
  }

  return items.filter(item => {
    switch (type) {
      case CrossLaneFilterType.FIELD_MATCH: {
        const targetValue = getItemValue(item, targetField);
        if (targetValue == null) return false;
        return String(targetValue) === sourceStr;
      }

      case CrossLaneFilterType.ARRAY_CONTAINS: {
        return applyArrayContains(item, sourceValue, targetField, sourceSet);
      }

      case CrossLaneFilterType.MULTI_FIELD_MATCH: {
        // Use pre-computed source values
        for (const sourceStr of sourceFieldValues) {
          for (const tf of targetFields) {
            const targetValue = getItemValue(item, tf);
            if (targetValue != null && String(targetValue) === sourceStr) {
              return true;
            }
          }
        }
        return false;
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
 * Build a Map of item IDs to items for O(1) lookup
 * @param {Object} lane - Lane object with items array
 * @returns {Map} Map of string ID to item object
 */
const buildItemIdMap = (lane) => {
  const map = new Map();
  if (!lane?.items) return map;
  for (const item of lane.items) {
    if (item.node?.id != null) {
      map.set(String(item.node.id), item);
    }
  }
  return map;
};

/**
 * Find an item in a lane by ID using pre-built map or linear search
 * @param {Object} lane - Lane object
 * @param {string|number} itemId - ID to find
 * @param {Map} [itemIdMap] - Optional pre-built map for O(1) lookup
 */
const findItemById = (lane, itemId, itemIdMap = null) => {
  if (!lane?.items || !itemId) return null;
  const itemIdStr = String(itemId);

  // Use pre-built map for O(1) lookup if available
  if (itemIdMap) {
    return itemIdMap.get(itemIdStr) || null;
  }

  // Fallback to linear search
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

  // Build lane lookup map for O(1) lane access
  const laneMap = new Map();
  for (const lane of lanes) {
    laneMap.set(lane.laneType, lane);
  }

  // Build item ID maps for lanes that have selections (O(n) once, then O(1) lookups)
  const itemIdMaps = new Map();
  const selectionLaneTypes = [
    [selections.identityId, LaneTypes.IDENTITIES],
    [selections.accountId, LaneTypes.ACCOUNTS],
    [selections.systemId, LaneTypes.SYSTEMS],
    [selections.logicalAppId, LaneTypes.LOGICAL_APPLICATIONS],
    [selections.policyId, LaneTypes.ASSIGNMENT_POLICIES],
    [selections.entitlementId, LaneTypes.EFFECTIVE_ENTITLEMENTS]
  ];

  for (const [selectionId, laneType] of selectionLaneTypes) {
    if (selectionId) {
      const lane = laneMap.get(laneType);
      if (lane) {
        itemIdMaps.set(laneType, buildItemIdMap(lane));
      }
    }
  }

  // Build a map of selection lane type to selected node using O(1) lookups
  const selectionMap = {};

  if (selections.identityId) {
    const identitiesLane = laneMap.get(LaneTypes.IDENTITIES);
    const selectedItem = findItemById(identitiesLane, selections.identityId, itemIdMaps.get(LaneTypes.IDENTITIES));
    if (selectedItem) {
      selectionMap[LaneTypes.IDENTITIES] = selectedItem.node;
    }
  }

  if (selections.accountId) {
    const accountsLane = laneMap.get(LaneTypes.ACCOUNTS);
    const selectedItem = findItemById(accountsLane, selections.accountId, itemIdMaps.get(LaneTypes.ACCOUNTS));
    if (selectedItem) {
      selectionMap[LaneTypes.ACCOUNTS] = selectedItem.node;
    }
  }

  if (selections.systemId) {
    const systemsLane = laneMap.get(LaneTypes.SYSTEMS);
    const selectedItem = findItemById(systemsLane, selections.systemId, itemIdMaps.get(LaneTypes.SYSTEMS));
    if (selectedItem) {
      selectionMap[LaneTypes.SYSTEMS] = selectedItem.node;
    }
  }

  if (selections.logicalAppId) {
    const logicalAppsLane = laneMap.get(LaneTypes.LOGICAL_APPLICATIONS);
    const selectedItem = findItemById(logicalAppsLane, selections.logicalAppId, itemIdMaps.get(LaneTypes.LOGICAL_APPLICATIONS));
    if (selectedItem) {
      selectionMap[LaneTypes.LOGICAL_APPLICATIONS] = selectedItem.node;
    }
  }

  if (selections.policyId) {
    const policiesLane = laneMap.get(LaneTypes.ASSIGNMENT_POLICIES);
    const selectedItem = findItemById(policiesLane, selections.policyId, itemIdMaps.get(LaneTypes.ASSIGNMENT_POLICIES));
    if (selectedItem) {
      selectionMap[LaneTypes.ASSIGNMENT_POLICIES] = selectedItem.node;
    }
  }

  if (selections.entitlementId) {
    const entitlementsLane = laneMap.get(LaneTypes.EFFECTIVE_ENTITLEMENTS);
    const selectedItem = findItemById(entitlementsLane, selections.entitlementId, itemIdMaps.get(LaneTypes.EFFECTIVE_ENTITLEMENTS));
    if (selectedItem) {
      selectionMap[LaneTypes.EFFECTIVE_ENTITLEMENTS] = selectedItem.node;
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
          if (shouldLog('FILTERS')) {
            console.log(`[CrossLaneFilter] ${filteringLaneType} -> ${lane.laneType}: ${beforeCount} -> ${filteredItems.length} items`);
          }
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
