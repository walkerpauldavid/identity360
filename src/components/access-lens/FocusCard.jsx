/**
 * FocusCard Component
 * Displays the currently focused node in the center of the AccessLens
 * Uses FocusNodeSchema to determine which attributes to display
 */

import {
  getNodeIcon,
  getNodeColor,
  getRiskColor,
  getStatusColor,
  FocusNodeSchema,
  extractFieldValue,
  NodeTypes
} from './accessLensTypes';

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
      day: 'numeric'
    });
  } catch {
    return value;
  }
};

/**
 * Get a string value from a field that might be an object
 * @param {any} value - The value to format
 * @param {string} type - Optional type hint (e.g., 'date')
 */
const getDisplayValue = (value, type = null) => {
  if (value === null || value === undefined) return null;

  // Handle date type specifically
  if (type === 'date') {
    return formatDateValue(value);
  }

  if (typeof value === 'string') {
    // Check if it looks like a date string (ISO format)
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return formatDateValue(value);
    }
    return value;
  }
  if (typeof value === 'object') {
    return value.DisplayName || value.Name || value.Value || value.displayName || value.name || null;
  }
  return String(value);
};

const FocusCard = ({ node, onNavigateBack, isLoading = false, selectedIdentityCompliance = null, violationCount = 0 }) => {
  // Show loading placeholder when loading or no node
  if (isLoading || !node) {
    return (
      <div className="focus-card focus-card-loading">
        <div className="focus-loading-content">
          <div className="focus-loading-spinner"></div>
          <span className="focus-loading-text">Populating Identity360... please wait</span>
        </div>
      </div>
    );
  }

  const nodeColor = getNodeColor(node.type);

  // Get schema for this node type
  const schema = FocusNodeSchema[node.type] || FocusNodeSchema[NodeTypes.IDENTITY];

  // Extract display attributes from the node using the schema
  // First check node.rawData (full API response), then node.metadata, then node itself
  const sourceData = node.rawData || node.metadata || node;

  // Build the display attributes based on schema
  const displayAttributes = [];

  if (schema?.attributes) {
    for (const attr of schema.attributes) {
      // Skip status and risk as they are shown separately
      if (attr.type === 'status' || attr.type === 'risk') continue;

      // Extract value using the field path
      let value = extractFieldValue(sourceData, attr.field);

      // If not found in sourceData, check node.metadata directly with simple key
      if ((value === null || value === undefined) && node.metadata) {
        const simpleKey = attr.field.split('.')[0].split('|')[0];
        value = node.metadata[simpleKey.toLowerCase()] || node.metadata[simpleKey];
      }

      // Convert object values to display strings, passing type for proper formatting
      value = getDisplayValue(value, attr.type);

      // Only add if we have a value, or if it's a required field
      if (value) {
        displayAttributes.push({
          label: attr.label,
          value: value,
          type: attr.type
        });
      }
    }
  }

  // Get list of attributes to hide from schema inspectorConfig
  const hideAttributes = schema?.inspectorConfig?.hideAttributes || [];

  // Fallback: if no schema attributes found, use metadata directly
  if (displayAttributes.length === 0 && node.metadata) {
    Object.entries(node.metadata).forEach(([key, value]) => {
      // Skip hidden attributes (check case-insensitive)
      const keyLower = key.toLowerCase();
      if (hideAttributes.some(h => h.toLowerCase() === keyLower)) {
        return;
      }

      const displayVal = getDisplayValue(value);
      if (displayVal) {
        displayAttributes.push({
          label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
          value: displayVal,
          type: 'text'
        });
      }
    });
  }

  return (
    <div className="focus-card" style={{ borderColor: nodeColor }}>
      {/* Node Icon and Type */}
      <div className="focus-card-header">
        <span className="focus-icon" style={{ backgroundColor: nodeColor }}>
          {getNodeIcon(node.type)}
        </span>
        <span className="focus-type-badge" style={{ backgroundColor: nodeColor }}>
          {/* Show user-friendly type names */}
          {node.type === NodeTypes.LOGICAL_APPLICATION
            ? 'Logical Application'
            : node.type === NodeTypes.SYSTEM && (node.metadata?.isLogical || node.rawData?.isLogical)
              ? 'Logical Application'
              : node.type}
        </span>
      </div>

      {/* Display Name - with IDENTITYID for Identity nodes */}
      <h2 className="focus-name">
        {node.displayName}
        {node.type === NodeTypes.IDENTITY && (node.identityId || node.rawData?.IDENTITYID || node.metadata?.identityId) && (
          <span className="focus-identity-id">
            ({node.identityId || node.rawData?.IDENTITYID || node.metadata?.identityId})
          </span>
        )}
      </h2>

      {/* Status and Risk */}
      <div className="focus-meta">
        {node.status && (
          <span
            className="focus-status"
            style={{ backgroundColor: getStatusColor(node.status) }}
          >
            {node.status}
          </span>
        )}
        {node.riskScore !== undefined && (
          <span
            className="focus-risk"
            style={{ backgroundColor: getRiskColor(node.riskScore) }}
          >
            Risk: {node.riskScore}
          </span>
        )}
      </div>

      {/* Violation Indicator - Warning triangle with count */}
      {violationCount > 0 && node.type === NodeTypes.IDENTITY && (
        <div className="focus-violations-indicator" title={`${violationCount} Violation${violationCount !== 1 ? 's' : ''}`}>
          <span className="violation-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2L1 21h22L12 2z"
                fill="#f59e0b"
                stroke="#d97706"
                strokeWidth="1.5"
              />
              <text
                x="12"
                y="17"
                textAnchor="middle"
                fill="#fff"
                fontSize="12"
                fontWeight="bold"
                fontFamily="Arial, sans-serif"
              >!</text>
            </svg>
          </span>
          <span className="violation-count">{violationCount} Violation{violationCount !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Badges */}
      {node.badges && node.badges.length > 0 && (
        <div className="focus-badges">
          {node.badges.map((badge, i) => (
            <span key={i} className="focus-badge">{badge}</span>
          ))}
        </div>
      )}

      {/* Resource Owners (only shown for Entitlement when owner info is available) */}
      {node.type === NodeTypes.ENTITLEMENT && (node.metadata?.allOwners?.length > 0 || node.rawData?.allOwners?.length > 0) && (
        <div className="focus-owners">
          <div className="owners-row">
            <span className="owner-icon" title="Resource Owners">👤</span>
            <div className="owners-list">
              {(node.metadata?.allOwners || node.rawData?.allOwners || []).map((owner, i) => (
                <span key={i} className={`owner-name ${owner.type === 'EXPLICITOWNER' ? 'explicit-owner' : ''}`} title={owner.type === 'EXPLICITOWNER' ? 'Explicit Owner' : 'Owner'}>
                  {owner.displayName}
                  {owner.type === 'EXPLICITOWNER' && <span className="owner-badge">explicit</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected Identity's Compliance Status (only shown for Entitlement when Identity is selected) */}
      {selectedIdentityCompliance && node.type === NodeTypes.ENTITLEMENT && (
        <div className="focus-identity-compliance">
          <div className="compliance-header">
            <span className="compliance-identity-name">{selectedIdentityCompliance.identityName}</span>
          </div>
          <div className="compliance-status-row">
            <span className="compliance-label">Compliance:</span>
            <span className={`compliance-value compliance-${(selectedIdentityCompliance.complianceStatus || 'unknown').toLowerCase().replace(/\s+/g, '-')}`}>
              {selectedIdentityCompliance.complianceStatus || 'Unknown'}
            </span>
          </div>
        </div>
      )}

      {/* Display Attributes from Schema */}
      {displayAttributes.length > 0 && (
        <div className="focus-metadata">
          {displayAttributes.slice(0, 5).map((attr, i) => (
            <div key={i} className="focus-meta-item">
              <span className="meta-label">{attr.label}:</span>
              {attr.type === 'email' ? (
                <a href={`mailto:${attr.value}`} className="meta-value meta-email">
                  {attr.value}
                </a>
              ) : (
                <span className="meta-value">{attr.value}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FocusCard;
