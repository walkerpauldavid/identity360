/**
 * Cross-Lane Filter Service
 *
 * Provides schema-driven cross-lane filtering for Identity360.
 * This service reads filter configurations from LaneConfigSchema and applies
 * filters based on lane selections, replacing hardcoded filtering logic.
 */

import {
  LaneConfigSchema,
  LaneSchema,
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

  // Both source AND target are arrays - check for intersection
  if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
    // Use pre-computed sourceSet if available, otherwise create it
    const srcSet = sourceSet || new Set(sourceValue.map(sv => String(sv)));
    // Check if any element in target array is in source array
    return targetValue.some(tv => tv != null && srcSet.has(String(tv)));
  }

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
 * Normalize a name for comparison
 * Removes bracketed suffixes like "[GBG]", trims whitespace, and lowercases
 * @param {string} name - Name to normalize
 * @returns {string} Normalized name
 */
const normalizeName = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name.replace(/\s*\[.*?\]\s*$/, '').trim().toLowerCase();
};

/**
 * Apply array contains filter with name-based fallback
 * First tries ID matching, then falls back to normalized name matching
 * This handles cases where GraphQL and OData return different UUIDs for the same logical entity
 * @param {Object} item - Item to check
 * @param {*} sourceValue - Primary source value (ID)
 * @param {string} targetField - Field path to get primary target value (ID array)
 * @param {*} fallbackSourceValue - Fallback source value (name)
 * @param {string} fallbackTargetField - Field path to get fallback target value (name array)
 */
const applyArrayContainsWithNameFallback = (item, sourceValue, targetField, fallbackSourceValue, fallbackTargetField) => {
  const targetValue = getItemValue(item, targetField);
  const itemName = item.node?.displayName || 'unknown';

  // First try: ID-based matching
  if (targetValue && Array.isArray(targetValue)) {
    const sourceStr = sourceValue != null ? String(sourceValue) : '';
    const targetSet = new Set(targetValue.map(tv => String(tv)));
    if (targetSet.has(sourceStr)) {
      return true;
    }
  }

  // Fallback: Name-based matching
  if (fallbackSourceValue && fallbackTargetField) {
    const fallbackTargetValue = getItemValue(item, fallbackTargetField);
    if (fallbackTargetValue && Array.isArray(fallbackTargetValue)) {
      const normalizedSource = normalizeName(String(fallbackSourceValue));
      if (normalizedSource) {
        // Check if any target name matches the normalized source name
        const matched = fallbackTargetValue.some(tv => {
          const normalizedTarget = typeof tv === 'string' ? tv : normalizeName(String(tv));
          return normalizedTarget === normalizedSource;
        });
        if (matched) {
          return true;
        }
      }
    }
  }

  return false;
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

  // Step 2b: Resolve logical application IDs to underlying physical system IDs
  // When filtering Systems lane with systemId fields, some extracted IDs may be
  // logical application IDs. We need to resolve these to their underlying physical systems.
  const isFilteringSystemLane = matchTargetFields.some(f => f === 'id' || f === 'displayName');
  const isExtractingSystemFields = extractFields.some(f => f.includes('systemId') || f.includes('system'));

  if (isFilteringSystemLane && isExtractingSystemFields) {
    // Find the Logical Applications lane
    const logicalAppsLane = allLanes.find(l => l.laneType === LaneTypes.LOGICAL_APPLICATIONS);
    if (logicalAppsLane?.items) {
      // Build a map of logical app IDs/names to their underlying system IDs
      const logicalAppsMap = new Map();
      for (const item of logicalAppsLane.items) {
        if (item.node?.id) {
          logicalAppsMap.set(String(item.node.id), item.node);
        }
        if (item.node?.displayName) {
          logicalAppsMap.set(item.node.displayName, item.node);
        }
      }

      // For each extracted value, check if it's a logical app and add underlying systems
      const additionalSystemIds = new Set();
      for (const extractedValue of extractedValuesSet) {
        const logicalApp = logicalAppsMap.get(extractedValue);
        if (logicalApp?.metadata?.underlyingSystemIds) {
          for (const underlyingId of logicalApp.metadata.underlyingSystemIds) {
            if (underlyingId != null) {
              additionalSystemIds.add(String(underlyingId));
            }
          }
        }
        if (logicalApp?.metadata?.underlyingSystems) {
          for (const underlyingSystem of logicalApp.metadata.underlyingSystems) {
            if (underlyingSystem?.id) additionalSystemIds.add(String(underlyingSystem.id));
            if (underlyingSystem?.name) additionalSystemIds.add(underlyingSystem.name);
          }
        }
      }

      // Add underlying system IDs to the extracted values set
      for (const sysId of additionalSystemIds) {
        extractedValuesSet.add(sysId);
      }
    }
  }

  // Step 3: Filter target items using Set for O(1) lookup
  // Support multiple target fields - match if ANY target field matches ANY extracted value
  // Also handles arrays - if target value is an array, check if ANY element matches
  const filteredTargetItems = targetItems.filter(item => {
    for (const tField of matchTargetFields) {
      const targetValue = getItemValue(item, tField);
      if (targetValue == null) continue;

      // Handle array target values (e.g., resourceIds array in policies)
      if (Array.isArray(targetValue)) {
        // Check if ANY element of the target array is in the extracted values
        if (targetValue.some(tv => tv != null && extractedValuesSet.has(String(tv)))) {
          return true;
        }
      } else {
        // Single value - direct lookup
        if (extractedValuesSet.has(String(targetValue))) {
          return true;
        }
      }
    }
    return false;
  });

  return filteredTargetItems;
};

/**
 * Apply a cascaded filter with name fallback for the first level
 * This is for Context -> Policy -> Entitlement/Account/System cascading
 * where Context -> Policy needs name fallback due to UUID mismatch between GraphQL and OData
 *
 * @param {Array} targetItems - Items in the target lane to filter
 * @param {Object} selectedNode - The selected node (e.g., Context)
 * @param {Object} filterMapping - The filter mapping configuration
 * @param {Array} allLanes - All lanes (to find intermediate lane)
 * @returns {Array} Filtered target items
 */
const applyCascadedWithNameFallback = (targetItems, selectedNode, filterMapping, allLanes) => {
  const {
    intermediateLane,
    sourceField,
    fallbackSourceField,
    intermediateTargetField,
    fallbackIntermediateTargetField,
    intermediateExtractField,
    intermediateExtractFields,
    targetField,
    targetFields
  } = filterMapping;

  // Normalize to arrays for unified handling
  const extractFields = intermediateExtractFields || (intermediateExtractField ? [intermediateExtractField] : []);
  const matchTargetFields = targetFields || (targetField ? [targetField] : []);

  // Get primary source value (ID)
  const sourceValue = getNestedValue(selectedNode, sourceField) ??
                      getNestedValue(selectedNode, `metadata.${sourceField}`);

  // Get fallback source value (displayName)
  const fallbackSourceValue = fallbackSourceField ?
    (getNestedValue(selectedNode, fallbackSourceField) ??
     getNestedValue(selectedNode, `metadata.${fallbackSourceField}`)) : null;

  if (!sourceValue && !fallbackSourceValue) {
    return targetItems;
  }

  // Find the intermediate lane (e.g., Assignment Policies)
  const intermediateL = allLanes.find(l => l.laneType === intermediateLane);
  if (!intermediateL || !intermediateL.items) {
    return targetItems;
  }

  // Step 1: Filter intermediate items using name fallback logic
  const filteredIntermediateItems = intermediateL.items.filter(item => {
    // First try: ID-based matching
    const itemTargetValue = getItemValue(item, intermediateTargetField);
    if (itemTargetValue && Array.isArray(itemTargetValue) && sourceValue) {
      const sourceStr = String(sourceValue);
      const targetSet = new Set(itemTargetValue.map(tv => String(tv)));
      if (targetSet.has(sourceStr)) {
        return true;
      }
    }

    // Fallback: Name-based matching
    if (fallbackSourceValue && fallbackIntermediateTargetField) {
      const fallbackTargetValue = getItemValue(item, fallbackIntermediateTargetField);
      if (fallbackTargetValue && Array.isArray(fallbackTargetValue)) {
        const normalizedSource = normalizeName(String(fallbackSourceValue));
        if (normalizedSource) {
          const matched = fallbackTargetValue.some(tv => {
            const normalizedTarget = typeof tv === 'string' ? tv : normalizeName(String(tv));
            return normalizedTarget === normalizedSource;
          });
          if (matched) {
            return true;
          }
        }
      }
    }

    return false;
  });

  if (filteredIntermediateItems.length === 0) {
    return [];
  }

  // Step 2: Extract values from filtered intermediate items
  const extractedValuesSet = new Set();
  for (const item of filteredIntermediateItems) {
    for (const extractField of extractFields) {
      const value = getItemValue(item, extractField);
      if (value != null) {
        if (Array.isArray(value)) {
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

  // Step 3: Filter target items using extracted values
  const filteredTargetItems = targetItems.filter(item => {
    for (const tField of matchTargetFields) {
      const targetValue = getItemValue(item, tField);
      if (targetValue == null) continue;

      if (Array.isArray(targetValue)) {
        if (targetValue.some(tv => tv != null && extractedValuesSet.has(String(tv)))) {
          return true;
        }
      } else {
        if (extractedValuesSet.has(String(targetValue))) {
          return true;
        }
      }
    }
    return false;
  });

  return filteredTargetItems;
};

/**
 * Apply a 3-level cascaded filter with name fallback for the first level
 * This handles: Context -> Assignment Policies -> Entitlements -> Accounts/Systems/LogicalApps
 *
 * @param {Array} targetItems - Items in the final target lane to filter
 * @param {Object} selectedNode - The selected node (e.g., Context)
 * @param {Object} filterMapping - The filter mapping configuration
 * @param {Array} allLanes - All lanes (to find intermediate lanes)
 * @returns {Array} Filtered target items
 */
const applyTripleCascadedWithNameFallback = (targetItems, selectedNode, filterMapping, allLanes) => {
  const {
    // Level 1: Source -> Intermediate1 (e.g., Context -> Assignment Policies)
    intermediate1Lane,
    sourceField,
    fallbackSourceField,
    intermediate1TargetField,
    fallbackIntermediate1TargetField,
    intermediate1ExtractField,
    // Level 2: Intermediate1 -> Intermediate2 (e.g., Assignment Policies -> Entitlements)
    intermediate2Lane,
    intermediate2TargetField,
    intermediate2ExtractField,
    intermediate2ExtractFields,
    // Level 3: Intermediate2 -> Target (e.g., Entitlements -> Accounts/Systems)
    targetField,
    targetFields
  } = filterMapping;

  // Normalize to arrays for unified handling
  const level2ExtractFields = intermediate2ExtractFields || (intermediate2ExtractField ? [intermediate2ExtractField] : []);
  const matchTargetFields = targetFields || (targetField ? [targetField] : []);

  // Get source values (ID and fallback name)
  const sourceValue = getNestedValue(selectedNode, sourceField) ??
                      getNestedValue(selectedNode, `metadata.${sourceField}`);
  const fallbackSourceValue = fallbackSourceField ?
    (getNestedValue(selectedNode, fallbackSourceField) ??
     getNestedValue(selectedNode, `metadata.${fallbackSourceField}`)) : null;

  if (!sourceValue && !fallbackSourceValue) {
    return targetItems;
  }

  // Find intermediate lanes
  const intermediate1L = allLanes.find(l => l.laneType === intermediate1Lane);
  const intermediate2L = allLanes.find(l => l.laneType === intermediate2Lane);

  if (!intermediate1L?.items || !intermediate2L?.items) {
    return targetItems;
  }

  // LEVEL 1: Filter intermediate1 items (e.g., filter Assignment Policies by Context)
  // Uses name fallback because GraphQL and OData return different UUIDs for contexts
  const filteredIntermediate1Items = intermediate1L.items.filter(item => {
    // First try: ID-based matching
    const itemTargetValue = getItemValue(item, intermediate1TargetField);
    if (itemTargetValue && Array.isArray(itemTargetValue) && sourceValue) {
      const sourceStr = String(sourceValue);
      const targetSet = new Set(itemTargetValue.map(tv => String(tv)));
      if (targetSet.has(sourceStr)) {
        return true;
      }
    }

    // Fallback: Name-based matching
    if (fallbackSourceValue && fallbackIntermediate1TargetField) {
      const fallbackTargetValue = getItemValue(item, fallbackIntermediate1TargetField);
      if (fallbackTargetValue && Array.isArray(fallbackTargetValue)) {
        const normalizedSource = normalizeName(fallbackSourceValue);
        const normalizedTargets = fallbackTargetValue.map(tv => normalizeName(tv));
        if (normalizedTargets.includes(normalizedSource)) {
          return true;
        }
      }
    }

    return false;
  });

  if (filteredIntermediate1Items.length === 0) {
    return [];
  }

  // LEVEL 2: Extract values from filtered intermediate1 items (e.g., get resourceIds from Policies)
  const intermediate1ExtractedSet = new Set();
  for (const item of filteredIntermediate1Items) {
    const value = getItemValue(item, intermediate1ExtractField);
    if (value != null) {
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v != null) intermediate1ExtractedSet.add(String(v));
        }
      } else {
        intermediate1ExtractedSet.add(String(value));
      }
    }
  }

  if (intermediate1ExtractedSet.size === 0) {
    return [];
  }

  // Filter intermediate2 items (e.g., filter Entitlements by resourceIds)
  const filteredIntermediate2Items = intermediate2L.items.filter(item => {
    const targetValue = getItemValue(item, intermediate2TargetField);
    if (targetValue == null) return false;

    if (Array.isArray(targetValue)) {
      return targetValue.some(tv => tv != null && intermediate1ExtractedSet.has(String(tv)));
    } else {
      return intermediate1ExtractedSet.has(String(targetValue));
    }
  });

  if (filteredIntermediate2Items.length === 0) {
    return [];
  }

  // LEVEL 3: Extract values from filtered intermediate2 items (e.g., get accountIds/systemId from Entitlements)
  const intermediate2ExtractedSet = new Set();
  for (const item of filteredIntermediate2Items) {
    for (const extractField of level2ExtractFields) {
      const value = getItemValue(item, extractField);
      if (value != null) {
        if (Array.isArray(value)) {
          for (const v of value) {
            if (v != null) intermediate2ExtractedSet.add(String(v));
          }
        } else {
          intermediate2ExtractedSet.add(String(value));
        }
      }
    }
  }

  if (intermediate2ExtractedSet.size === 0) {
    return [];
  }

  // Filter final target items (e.g., filter Accounts/Systems by extracted IDs)
  const filteredTargetItems = targetItems.filter(item => {
    for (const tField of matchTargetFields) {
      const targetValue = getItemValue(item, tField);
      if (targetValue == null) continue;

      if (Array.isArray(targetValue)) {
        if (targetValue.some(tv => tv != null && intermediate2ExtractedSet.has(String(tv)))) {
          return true;
        }
      } else {
        if (intermediate2ExtractedSet.has(String(targetValue))) {
          return true;
        }
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

  // Cascaded filter with name fallback for first level (e.g., Context -> Policy -> Entitlements)
  if (type === CrossLaneFilterType.CASCADED_WITH_NAME_FALLBACK) {
    return applyCascadedWithNameFallback(items, selectedNode, filterMapping, allLanes);
  }

  // 3-level cascaded filter with name fallback (e.g., Context -> Policies -> Entitlements -> Accounts/Systems)
  if (type === CrossLaneFilterType.TRIPLE_CASCADED_WITH_NAME_FALLBACK) {
    return applyTripleCascadedWithNameFallback(items, selectedNode, filterMapping, allLanes);
  }

  // Pre-compute source values once (outside the filter loop)
  let sourceValue = null;
  let sourceSet = null;
  let sourceStr = null;

  if (type === CrossLaneFilterType.FIELD_MATCH || type === CrossLaneFilterType.ARRAY_CONTAINS || type === CrossLaneFilterType.ARRAY_CONTAINS_WITH_NAME_FALLBACK) {
    sourceValue = getNestedValue(selectedNode, sourceField) ??
                  getNestedValue(selectedNode, `metadata.${sourceField}`);
    // For name fallback type, we can proceed even without primary source value
    if (!sourceValue && type !== CrossLaneFilterType.ARRAY_CONTAINS_WITH_NAME_FALLBACK) return items;

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
  let sourceFieldValuesSet = null;
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

    // Resolve logical app IDs to underlying physical system IDs when filtering Systems
    // This handles the case where an entitlement's systemId points to a logical app
    const isFilteringSystemFields = targetFields?.some(f => f === 'id' || f === 'displayName');
    const isSourceSystemFields = sourceFields?.some(f => f.includes('systemId') || f.includes('system'));

    if (isFilteringSystemFields && isSourceSystemFields && allLanes.length > 0) {
      const logicalAppsLane = allLanes.find(l => l.laneType === LaneTypes.LOGICAL_APPLICATIONS);
      if (logicalAppsLane?.items) {
        // Build a map of logical app IDs/names to their underlying system IDs
        const logicalAppsMap = new Map();
        for (const item of logicalAppsLane.items) {
          if (item.node?.id) {
            logicalAppsMap.set(String(item.node.id), item.node);
          }
          if (item.node?.displayName) {
            logicalAppsMap.set(item.node.displayName, item.node);
          }
        }

        // For each source value, check if it's a logical app and add underlying systems
        const additionalSystemIds = [];
        for (const srcVal of sourceFieldValues) {
          const logicalApp = logicalAppsMap.get(srcVal);
          if (logicalApp?.metadata?.underlyingSystemIds) {
            for (const underlyingId of logicalApp.metadata.underlyingSystemIds) {
              if (underlyingId != null) {
                additionalSystemIds.push(String(underlyingId));
              }
            }
          }
          if (logicalApp?.metadata?.underlyingSystems) {
            for (const underlyingSystem of logicalApp.metadata.underlyingSystems) {
              if (underlyingSystem?.id) additionalSystemIds.push(String(underlyingSystem.id));
              if (underlyingSystem?.name) additionalSystemIds.push(underlyingSystem.name);
            }
          }
        }

        // Add underlying system IDs to source values
        sourceFieldValues = [...sourceFieldValues, ...additionalSystemIds];
      }
    }

    // Create Set for O(1) lookup
    sourceFieldValuesSet = new Set(sourceFieldValues);
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

      case CrossLaneFilterType.ARRAY_CONTAINS_WITH_NAME_FALLBACK: {
        // Get fallback source value (displayName for name-based matching)
        const { fallbackSourceField, fallbackTargetField } = filterMapping;
        const fallbackSourceValue = getNestedValue(selectedNode, fallbackSourceField) ??
                                    getNestedValue(selectedNode, `metadata.${fallbackSourceField}`);
        return applyArrayContainsWithNameFallback(item, sourceValue, targetField, fallbackSourceValue, fallbackTargetField);
      }

      case CrossLaneFilterType.MULTI_FIELD_MATCH: {
        // Use pre-computed source values Set for O(1) lookup
        for (const tf of targetFields) {
          const targetValue = getItemValue(item, tf);
          if (targetValue != null && sourceFieldValuesSet.has(String(targetValue))) {
            return true;
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
 * @param {Array} previousFilteredLanes - Previous visibleLanes state to preserve filtered items when lane becomes filter source
 * @returns {Array} Filtered lanes with updated items
 */
export const applyCrossLaneFilters = (
  lanes,
  focusNodeType,
  selections = {},
  additionalFilters = {},
  previousFilteredLanes = []
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
    [selections.entitlementId, LaneTypes.EFFECTIVE_ENTITLEMENTS],
    [selections.violationId, LaneTypes.VIOLATIONS],
    [selections.contextId, LaneTypes.CONTEXTS],
    [selections.requestId, LaneTypes.REQUESTS]
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
  // Data-driven: maps selection key → lane type for DRY iteration
  const selectionMap = {};

  for (const [selectionId, laneType] of selectionLaneTypes) {
    if (selectionId) {
      const lane = laneMap.get(laneType);
      const selectedItem = findItemById(lane, selectionId, itemIdMaps.get(laneType));
      if (selectedItem) {
        selectionMap[laneType] = selectedItem.node;
      }
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

    // If this lane has a selection (is the master filter source),
    // preserve its current items to avoid visual refresh/repopulation
    // The clicked lane becomes the filter source, so don't filter it
    // IMPORTANT: Use the PREVIOUS filtered state, not the raw lane data
    if (selectionMap[lane.laneType]) {
      // Find this lane in the previous filtered state
      const previousLane = previousFilteredLanes.find(pl => pl.laneType === lane.laneType);
      // If we have a previous filtered state for this lane, use it to preserve the filtered items
      // This prevents the access card from repopulating when an item within it is selected
      if (previousLane && previousLane.items) {
        return previousLane;
      }
      // Fallback to raw lane if no previous state exists (first selection)
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

        // A filter mapping was found and applied — mark as filtered regardless of whether
        // item count changed. Even if all items pass the filter, the lane IS being filtered
        // by the active cross-lane selection (user expects "Filtered" visual indicator).
        wasFiltered = true;
        filteredLaneTypes.add(lane.laneType);

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
 * Schema-driven: iterates LaneSchema to find which lane has an active selection
 *
 * @param {Object} selections - Current selections
 * @returns {string|null} The LaneTypes value of the filter source, or null
 */
export const getFilterSourceLaneType = (selections) => {
  for (const [laneType, schema] of Object.entries(LaneSchema)) {
    if (schema.selectionStateKey && selections[schema.selectionStateKey]) {
      return laneType;
    }
  }
  return null;
};

/**
 * Determine if a lane is being filtered by current selections
 * Schema-driven: uses LaneSchema[laneType].selectionStateKey to check selections
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
    const key = LaneSchema[filteringLaneType]?.selectionStateKey;
    return key ? !!selections[key] : false;
  });
};

/**
 * Determine if a lane is the filter source
 * Schema-driven: uses LaneSchema[laneType].selectionStateKey to check selections
 *
 * @param {string} laneType - The lane type to check
 * @param {Object} selections - Current selections
 * @returns {boolean} True if this lane is the filter source
 */
export const isLaneFilterSource = (laneType, selections) => {
  const key = LaneSchema[laneType]?.selectionStateKey;
  return key ? !!selections[key] : false;
};

export default {
  applyCrossLaneFilters,
  filterVisibleLanes,
  getFilterSourceLaneType,
  isLaneFiltered,
  isLaneFilterSource,
  getRequiredLanes
};
