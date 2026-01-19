/**
 * Object Inspector Panel Component
 * Shows detailed information for selected items from lanes
 * Collapsible panel with smooth animation
 */

import { getNodeIcon, getNodeColor, getReasonColor, FocusNodeSchema, extractFieldValue, NodeTypes, LaneTypes, LaneSchema } from './accessLensTypes';

/**
 * Fields to hide in Object Inspector by node type
 * These are technical/internal fields that don't provide value to end users
 */
const HIDDEN_FIELDS_BY_TYPE = {
  [NodeTypes.ENTITLEMENT]: [
    // IDs - internal/technical
    'id', 'Id', 'ID',
    'system.id', 'systemId', 'SystemId',
    'resourceType.id', 'resourceTypeId', 'ResourceTypeId',
    'resourceCategory.id', 'resourceCategoryId',
    'resourceFolder.id', 'resourceFolderId',
    'account.id', 'accountId',
    // System - already shown as badge (avoid duplication)
    'system', 'System', 'system.name', 'systemName', 'SystemName',
    // Resource Type - already shown as badge (avoid duplication)
    'resourceType', 'ResourceType', 'resourceType.name', 'resourceTypeName', 'ResourceTypeName', 'type', 'Type'
  ],
  [NodeTypes.ACCOUNT]: [
    'id', 'Id', 'ID',
    'system.id', 'systemId', 'SystemId'
  ],
  [NodeTypes.SYSTEM]: [
    'id', 'Id', 'ID',
    'PROVCLAIMEXPIREDAYS', 'ProvClaimExpireDays', 'provClaimExpireDays',
    'FAILEDPROVCLAIMEXPIREDAYS', 'FailedProvClaimExpireDays', 'failedProvClaimExpireDays'
  ]
};

/**
 * Check if a field should be hidden based on node type
 * Checks both the hardcoded list and the schema's inspectorConfig.hideAttributes
 */
const shouldHideField = (fieldKey, nodeType) => {
  const keyLower = fieldKey.toLowerCase();

  // Check hardcoded list first
  const hiddenFields = HIDDEN_FIELDS_BY_TYPE[nodeType] || [];
  if (hiddenFields.some(hidden => keyLower === hidden.toLowerCase())) {
    return true;
  }

  // Also check the FocusNodeSchema inspectorConfig
  const schema = FocusNodeSchema[nodeType];
  const schemaHiddenFields = schema?.inspectorConfig?.hideAttributes || [];
  if (schemaHiddenFields.some(hidden => keyLower === hidden.toLowerCase())) {
    return true;
  }

  return false;
};

/**
 * Format a camelCase or PascalCase key to a readable label
 */
const formatLabel = (key) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

/**
 * Format a date value for display
 * Handles special case where year 9999 means "no expiration"
 */
const formatDateValue = (value) => {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value; // Return original if invalid

    // Check for year 9999 which means "no expiration" / "no ValidTo exists"
    if (date.getFullYear() === 9999) {
      return 'No Expiration';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return value;
  }
};

/**
 * Check if a value is a JSON string that should be parsed
 * Looks for objects or arrays with account-like, reference-like, or reason-like structure
 */
const isParseableJsonString = (value) => {
  if (typeof value !== 'string') return false;
  if (!value.startsWith('{') && !value.startsWith('[')) return false;
  try {
    const parsed = JSON.parse(value);

    // Handle arrays - check first element
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return false;
      const firstItem = parsed[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        const keys = Object.keys(firstItem);
        // Look for reason-like or reference-like patterns
        const hasKnownFields = keys.some(k =>
          ['description', 'reasontype', 'id', 'name', 'displayname', 'accountname', 'accounttype', 'system', 'type'].includes(k.toLowerCase())
        );
        return hasKnownFields;
      }
      return false;
    }

    // Handle objects
    if (typeof parsed === 'object' && parsed !== null) {
      const keys = Object.keys(parsed);
      // Look for common reference object patterns
      const hasReferenceFields = keys.some(k =>
        ['id', 'name', 'displayname', 'accountname', 'accounttype', 'system', 'type', 'description', 'reasontype'].includes(k.toLowerCase())
      );
      return hasReferenceFields;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Fields to skip when parsing JSON for display
 * These are technical/internal fields that don't provide user value
 */
const SKIP_FIELDS = ['id', 'uid', '@odata.type', 'causeobjectkey'];

/**
 * Check if a string value looks like technical/XML data that should be skipped
 */
const isTechnicalValue = (value) => {
  if (typeof value !== 'string') return false;
  // Skip values that look like XML or complex technical identifiers
  return value.includes('<') && value.includes('>') && value.includes('</');
};

/**
 * Parse a single object into display-friendly name-value pairs
 */
const parseObjectToPairs = (obj, prefix = '') => {
  if (typeof obj !== 'object' || obj === null) return [];

  const pairs = [];

  Object.entries(obj).forEach(([key, value]) => {
    // Skip internal/technical fields
    if (SKIP_FIELDS.includes(key.toLowerCase())) return;

    // Skip technical/XML values
    if (isTechnicalValue(value)) return;

    let displayValue;

    if (value === null || value === undefined) {
      return; // Skip null/undefined values
    } else if (typeof value === 'object' && value !== null) {
      // For nested objects, try to extract a meaningful display value
      displayValue = value.displayName || value.DisplayName ||
                     value.name || value.Name ||
                     value.value || value.Value;
      // If no meaningful value found, skip
      if (!displayValue) return;
    } else if (typeof value === 'boolean') {
      displayValue = value ? 'Yes' : 'No';
    } else {
      displayValue = String(value);
    }

    pairs.push({
      label: prefix ? `${prefix} ${formatLabel(key)}` : formatLabel(key),
      value: displayValue
    });
  });

  return pairs;
};

/**
 * Parse a JSON object or array into display-friendly name-value pairs
 * Handles nested objects by extracting their 'name' or 'displayName' properties
 * Handles arrays by parsing each item with an index prefix
 */
const parseJsonToDisplayPairs = (jsonValue) => {
  let obj = jsonValue;

  // Parse if it's a string
  if (typeof jsonValue === 'string') {
    try {
      obj = JSON.parse(jsonValue);
    } catch {
      return null;
    }
  }

  if (obj === null || obj === undefined) return null;

  // Handle arrays
  if (Array.isArray(obj)) {
    const allPairs = [];

    obj.forEach((item, index) => {
      if (typeof item === 'object' && item !== null) {
        // For single-item arrays, don't add index prefix
        const prefix = obj.length > 1 ? `#${index + 1}` : '';
        const itemPairs = parseObjectToPairs(item, prefix);
        allPairs.push(...itemPairs);

        // Add separator between array items (except after last)
        if (obj.length > 1 && index < obj.length - 1 && itemPairs.length > 0) {
          allPairs.push({ label: '---', value: '', type: 'separator' });
        }
      }
    });

    return allPairs.length > 0 ? allPairs : null;
  }

  // Handle single object
  if (typeof obj === 'object') {
    const pairs = parseObjectToPairs(obj);
    return pairs.length > 0 ? pairs : null;
  }

  return null;
};

/**
 * Check if a value is a complex object or array that should be expanded into multiple fields
 * Handles both objects with nested data and arrays of reason-like objects
 */
const isExpandableObject = (value) => {
  if (typeof value !== 'object' || value === null) return false;

  // Handle arrays - check if it's an array of expandable objects (like reasons)
  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    const firstItem = value[0];
    if (typeof firstItem === 'object' && firstItem !== null) {
      const keys = Object.keys(firstItem);
      // Check for reason-like or reference-like patterns
      const hasExpandableFields = keys.some(k =>
        ['description', 'reasontype', 'accountname', 'accounttype', 'system', 'identity', 'resource', 'name', 'displayname'].includes(k.toLowerCase())
      );
      return hasExpandableFields;
    }
    return false;
  }

  // Handle single objects
  const keys = Object.keys(value);
  // Check if it has account-like, reference-like, or reason-like structure
  const hasExpandableFields = keys.some(k =>
    ['accountname', 'accounttype', 'system', 'identity', 'resource', 'description', 'reasontype'].includes(k.toLowerCase())
  );
  return hasExpandableFields;
};

/**
 * Get display value from a potentially complex value
 * @param {any} value - The value to format
 * @param {string} type - The field type (text, date, etc.)
 * @param {string} fieldName - Optional field name for context-aware formatting
 */
const getDisplayValue = (value, type = 'text', fieldName = '') => {
  if (value === null || value === undefined) return null;

  // Handle date type specifically
  if (type === 'date') {
    return formatDateValue(value);
  }

  if (typeof value === 'string') {
    // Check if it looks like a date string
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return formatDateValue(value);
    }
    // Don't stringify JSON strings - they'll be handled separately
    if (isParseableJsonString(value)) {
      return { type: 'json', data: value };
    }
    return value;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    // Handle empty arrays - show friendly message based on field name
    if (Array.isArray(value) && value.length === 0) {
      const lowerFieldName = fieldName.toLowerCase();
      if (lowerFieldName.includes('violation')) {
        return 'No Violation';
      }
      return 'None';
    }
    // Check if this is an expandable object that should be shown as nested fields
    if (isExpandableObject(value)) {
      return { type: 'expandable', data: value };
    }
    return value.DisplayName || value.Name || value.Value || value.displayName || value.name || JSON.stringify(value);
  }
  return String(value);
};

const ExplanationPanel = ({
  explanation,
  selectedReasonId,
  onReasonSelect,
  onClose,
  isLoading,
  isCollapsed = false,
  onToggleCollapse
}) => {
  // Panel header with collapse toggle and magnifying glass icon
  const renderHeader = (title = 'Object Inspector') => (
    <div className="explanation-header">
      <div className="header-left">
        <button
          className="collapse-toggle"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        {/* Magnifying Glass Icon */}
        <svg
          className="inspector-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3 className="explanation-title">{title}</h3>
      </div>
      <button className="explanation-close" onClick={onClose} title="Close inspector">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );

  // Empty state - no selection
  if (!explanation && !isLoading) {
    return (
      <div className={`explanation-panel ${isCollapsed ? 'collapsed' : ''}`}>
        {renderHeader()}
        <div className="explanation-body">
          <div className="explanation-placeholder">
            <span className="placeholder-icon">🔍</span>
            <h4>Object Inspector</h4>
            <p>Select an item from any lane to view its details</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`explanation-panel ${isCollapsed ? 'collapsed' : ''}`}>
        {renderHeader('Loading...')}
        <div className="explanation-body">
          <div className="explanation-loading">
            <div className="explanation-spinner"></div>
            <p>Loading details...</p>
          </div>
        </div>
      </div>
    );
  }

  const { title, summaryText, reasons, facts, riskNotes, selectedNode, rawData } = explanation;
  const selectedReason = reasons?.find(r => r.id === selectedReasonId) || reasons?.[0];

  // Build metadata display from node data
  const buildMetadataDisplay = () => {
    const items = [];

    if (!selectedNode) return items;

    // Get the schema for this node type to use proper labels
    const schema = FocusNodeSchema[selectedNode.type];

    // For Entitlements, show Resource ID at the top (the UUID is useful for API calls, debugging, etc.)
    if (selectedNode.type === NodeTypes.ENTITLEMENT) {
      const resourceId = selectedNode.id || selectedNode.metadata?.id || rawData?.id || rawData?.resource?.id;
      if (resourceId) {
        items.push({
          label: 'Resource ID',
          value: resourceId,
          type: 'id'
        });
      }
    }

    // First, add metadata from the node
    if (selectedNode.metadata) {
      Object.entries(selectedNode.metadata).forEach(([key, value]) => {
        // Skip hidden fields based on node type
        if (shouldHideField(key, selectedNode.type)) {
          return;
        }

        // Try to find a schema label for this field
        const schemaAttr = schema?.attributes?.find(
          a => a.field.toLowerCase().includes(key.toLowerCase())
        );
        const fieldType = schemaAttr?.type || (key.toLowerCase().includes('valid') || key.toLowerCase().includes('date') ? 'date' : 'text');
        const displayVal = getDisplayValue(value, fieldType, key);
        if (displayVal && displayVal !== 'null' && displayVal !== 'undefined') {
          // Handle special return types from getDisplayValue (json/expandable objects)
          if (typeof displayVal === 'object' && (displayVal.type === 'json' || displayVal.type === 'expandable')) {
            // Parse and add as nested fields or skip if not parseable
            const parsedPairs = parseJsonToDisplayPairs(displayVal.data);
            if (parsedPairs && parsedPairs.length > 0) {
              items.push({
                label: schemaAttr?.label || formatLabel(key),
                value: '', // Empty value for group header
                type: 'group'
              });
              parsedPairs.forEach(pair => {
                items.push({
                  ...pair,
                  type: 'nested'
                });
              });
            }
          } else {
            items.push({
              label: schemaAttr?.label || formatLabel(key),
              value: displayVal,
              type: fieldType
            });
          }
        }
      });
    }

    // Add badges as metadata if present
    if (selectedNode.badges && selectedNode.badges.length > 0) {
      items.push({
        label: 'Tags',
        value: selectedNode.badges.join(', '),
        type: 'badge'
      });
    }

    // Add any raw data fields not already covered
    if (rawData && typeof rawData === 'object') {
      Object.entries(rawData).forEach(([key, value]) => {
        // Skip hidden fields based on node type
        if (shouldHideField(key, selectedNode.type)) {
          return;
        }

        // Skip if already have this field
        if (items.some(i => i.label.toLowerCase() === formatLabel(key).toLowerCase())) {
          return;
        }

        // Detect date fields by key name
        const isDateField = key.toLowerCase().includes('valid') ||
                           key.toLowerCase().includes('date') ||
                           key.toLowerCase().includes('created') ||
                           key.toLowerCase().includes('modified') ||
                           key.toLowerCase().includes('lastlogin');
        const fieldType = isDateField ? 'date' : 'text';
        const displayVal = getDisplayValue(value, fieldType, key);

        if (!displayVal || displayVal === 'null' || displayVal === 'undefined') {
          return;
        }

        // Handle special return types from getDisplayValue
        if (typeof displayVal === 'object' && (displayVal.type === 'json' || displayVal.type === 'expandable')) {
          // Parse JSON/expandable and add as nested fields
          const parsedPairs = parseJsonToDisplayPairs(displayVal.data);
          if (parsedPairs && parsedPairs.length > 0) {
            // Add a group header for the field
            items.push({
              label: formatLabel(key),
              value: null,
              type: 'group-header'
            });
            // Add each parsed field as a nested item, preserving separator types
            parsedPairs.forEach(pair => {
              items.push({
                label: pair.label,
                value: pair.value,
                type: pair.type || 'nested'  // Preserve separator type if present
              });
            });
          }
        } else {
          // Regular field
          items.push({
            label: formatLabel(key),
            value: displayVal,
            type: fieldType
          });
        }
      });
    }

    return items;
  };

  const metadataItems = buildMetadataDisplay();

  return (
    <div className={`explanation-panel ${isCollapsed ? 'collapsed' : ''}`}>
      {renderHeader(title || selectedNode?.displayName || 'Object Inspector')}

      <div className="explanation-body">
        {/* Selected Node Info */}
        {selectedNode && (
          <div className="selected-node-info">
            <div className="node-icon-wrapper" style={{ backgroundColor: getNodeColor(selectedNode.type) }}>
              {getNodeIcon(selectedNode.type)}
            </div>
            <div className="node-details">
              <span className="node-type">{selectedNode.type}</span>
              <span className="node-name">{selectedNode.displayName}</span>
              {selectedNode.status && (
                <span className={`node-status status-${selectedNode.status}`}>
                  {selectedNode.status}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Summary / Description */}
        {summaryText && (
          <p className="explanation-summary">{summaryText}</p>
        )}

        {/* Risk Notes */}
        {riskNotes && riskNotes.length > 0 && (
          <div className="explanation-risk-notes">
            {riskNotes.map((note, i) => (
              <div key={i} className="risk-note">
                <span className="risk-icon">⚠️</span>
                {note}
              </div>
            ))}
          </div>
        )}

        {/* Metadata / Details Section */}
        {metadataItems.length > 0 && (
          <div className="explanation-facts">
            <h4>Details</h4>
            <div className="facts-list">
              {metadataItems.map((item, i) => {
                // Separator between array items
                if (item.type === 'separator') {
                  return (
                    <div key={i} className="fact-separator" />
                  );
                }
                // Group header - displays the field name without a value
                if (item.type === 'group-header') {
                  return (
                    <div key={i} className="fact-item fact-group-header">
                      <span className="fact-label fact-group-label">{item.label}</span>
                    </div>
                  );
                }
                // Nested item - indented under a group header
                if (item.type === 'nested') {
                  return (
                    <div key={i} className="fact-item fact-nested">
                      <span className="fact-label">{item.label}:</span>
                      <span className="fact-value">{item.value}</span>
                    </div>
                  );
                }
                // Regular item
                return (
                  <div key={i} className="fact-item">
                    <span className="fact-label">{item.label}:</span>
                    <span className={`fact-value ${item.type === 'badge' ? 'fact-badge' : ''} ${item.type === 'id' ? 'fact-id' : ''}`}>
                      {item.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reasons List */}
        {reasons && reasons.length > 0 && (
          <div className="explanation-reasons">
            <h4>Reasons ({reasons.length})</h4>
            <div className="reasons-list">
              {reasons.map((reason) => (
                <button
                  key={reason.id}
                  className={`reason-item ${selectedReasonId === reason.id ? 'selected' : ''}`}
                  onClick={() => onReasonSelect?.(reason.id)}
                  style={{
                    borderLeftColor: getReasonColor(reason.type)
                  }}
                >
                  <div className="reason-item-header">
                    <span
                      className="reason-type-badge"
                      style={{ backgroundColor: getReasonColor(reason.type) }}
                    >
                      {reason.type.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    {reason.confidence && (
                      <span className={`confidence-badge ${reason.confidence}`}>
                        {reason.confidence}
                      </span>
                    )}
                  </div>
                  <span className="reason-title">{reason.title}</span>
                  {reason.description && (
                    <p className="reason-description">{reason.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Evidence Path */}
        {selectedReason?.evidencePath && (
          <div className="explanation-path">
            <h4>Evidence Path</h4>
            <div className="path-visualization">
              {selectedReason.evidencePath.nodes.map((node, i) => (
                <div key={node.id} className="path-node">
                  <span
                    className="path-node-icon"
                    style={{ backgroundColor: getNodeColor(node.type) }}
                  >
                    {getNodeIcon(node.type)}
                  </span>
                  <div className="path-node-info">
                    <span className="path-node-type">{node.type}</span>
                    <span className="path-node-name">{node.displayName}</span>
                  </div>
                  {i < selectedReason.evidencePath.nodes.length - 1 && (
                    <div className="path-connector">
                      <span className="connector-line"></span>
                      <span className="connector-arrow">↓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show message if no details available */}
        {!selectedNode && !summaryText && metadataItems.length === 0 && (!reasons || reasons.length === 0) && (
          <div className="explanation-placeholder">
            <p>No additional details available for this item.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExplanationPanel;
