/**
 * Access Lens Utility Functions
 * Shared utilities for field extraction, value normalization, and data manipulation
 *
 * This module provides the canonical implementations of common utilities used across
 * the Access Lens component suite. Use these functions instead of duplicating logic.
 */

// ============================================================================
// FIELD EXTRACTION UTILITIES
// ============================================================================

/**
 * Get a nested value from an object using dot-notation path
 * Supports fallback paths separated by | (pipe)
 *
 * @param {Object} obj - The object to extract from
 * @param {string} path - Dot-notation path with optional | for fallbacks
 *                        Examples: 'user.name', 'DisplayName|Name|name'
 * @returns {*} The value at the path, or undefined if not found
 *
 * @example
 * getNestedValue({ user: { name: 'John' } }, 'user.name') // 'John'
 * getNestedValue({ Name: 'Test' }, 'DisplayName|Name') // 'Test'
 */
export const getNestedValue = (obj, path) => {
  if (!obj || !path) return undefined;

  // Handle fallback paths (e.g., 'DisplayName|Name')
  if (path.includes('|')) {
    const paths = path.split('|');
    for (const p of paths) {
      const value = getNestedValue(obj, p.trim());
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
  }

  return path.split('.').reduce((current, key) => current?.[key], obj);
};

/**
 * Safely get a string value from a field that might be string or object
 * Handles common Omada field patterns (DisplayName, Name, Value, etc.)
 *
 * @param {*} value - The value to extract from
 * @param {string} defaultValue - Default value if extraction fails
 * @returns {string} The extracted string value
 *
 * @example
 * getStringValue('hello') // 'hello'
 * getStringValue({ DisplayName: 'Test' }) // 'Test'
 * getStringValue(null, 'default') // 'default'
 */
export const getStringValue = (value, defaultValue = '') => {
  if (!value) return defaultValue;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value.DisplayName || value.displayName ||
           value.Name || value.name ||
           value.Value || value.value ||
           defaultValue;
  }
  return String(value);
};

/**
 * Get value from item, checking node, root, and rawData
 * Used for lane item value extraction where data structure may vary
 *
 * @param {Object} item - Lane item object (may have .node, .rawData)
 * @param {string} path - Dot-notation path to the value
 * @returns {*} The value found, or undefined
 *
 * @example
 * getItemValue({ node: { id: '123' } }, 'id') // '123'
 * getItemValue({ metadata: { system: 'AD' } }, 'metadata.system') // 'AD'
 */
export const getItemValue = (item, path) => {
  // Try node first, then item root, then rawData
  return getNestedValue(item?.node, path) ??
         getNestedValue(item, path) ??
         getNestedValue(item?.rawData, path) ??
         getNestedValue(item?.node?.rawData, path);
};

// ============================================================================
// STRING MANIPULATION UTILITIES
// ============================================================================

/**
 * Convert a camelCase or PascalCase string to Title Case with spaces
 *
 * @param {string} str - The string to convert
 * @returns {string} The formatted string
 *
 * @example
 * formatFieldName('firstName') // 'First Name'
 * formatFieldName('DISPLAYNAME') // 'Displayname'
 * formatFieldName('resourceType') // 'Resource Type'
 */
export const formatFieldName = (str) => {
  if (!str) return '';

  // Handle all-caps (e.g., 'DISPLAYNAME' -> 'Displayname')
  if (str === str.toUpperCase() && str.length > 1) {
    str = str.charAt(0) + str.slice(1).toLowerCase();
  }

  // Insert space before capital letters and capitalize first letter
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
};

/**
 * Truncate a string to a maximum length with ellipsis
 *
 * @param {string} str - The string to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} The truncated string
 */
export const truncateString = (str, maxLength = 50) => {
  if (!str || str.length <= maxLength) return str || '';
  return str.substring(0, maxLength - 3) + '...';
};

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Safely flatten an array that may contain nested arrays
 *
 * @param {Array} arr - The array to flatten
 * @param {number} depth - Maximum depth to flatten (default 1)
 * @returns {Array} The flattened array
 */
export const flattenArray = (arr, depth = 1) => {
  if (!Array.isArray(arr)) return [];
  return arr.flat(depth);
};

/**
 * Remove duplicates from an array based on a key function
 *
 * @param {Array} arr - The array to deduplicate
 * @param {Function} keyFn - Function to extract the unique key from each item
 * @returns {Array} Array with duplicates removed
 *
 * @example
 * uniqueBy([{ id: 1 }, { id: 1 }, { id: 2 }], item => item.id)
 * // [{ id: 1 }, { id: 2 }]
 */
export const uniqueBy = (arr, keyFn) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  return arr.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// ============================================================================
// TYPE CHECKING UTILITIES
// ============================================================================

/**
 * Check if a value is a non-null object (not array)
 *
 * @param {*} value - The value to check
 * @returns {boolean} True if value is a plain object
 */
export const isPlainObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 *
 * @param {*} value - The value to check
 * @returns {boolean} True if value is considered empty
 */
export const isEmpty = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  return false;
};

// ============================================================================
// COMPARISON UTILITIES
// ============================================================================

/**
 * Case-insensitive string comparison
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings are equal (case-insensitive)
 */
export const equalsIgnoreCase = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
};

/**
 * Compare two values for equality, handling string conversion
 * Used in cross-lane filtering where IDs may be strings or numbers
 *
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean} True if values are equal (with string normalization)
 */
export const looseEquals = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Field extraction
  getNestedValue,
  getStringValue,
  getItemValue,

  // String manipulation
  formatFieldName,
  truncateString,

  // Array utilities
  flattenArray,
  uniqueBy,

  // Type checking
  isPlainObject,
  isEmpty,

  // Comparison
  equalsIgnoreCase,
  looseEquals
};
