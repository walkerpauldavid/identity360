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
 * Get a string value from a field that might be an object
 */
const getDisplayValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value.DisplayName || value.Name || value.Value || value.displayName || value.name || null;
  }
  return String(value);
};

const FocusCard = ({ node, onNavigateBack }) => {
  if (!node) return null;

  const nodeColor = getNodeColor(node.type);

  // Get schema for this node type
  const schema = FocusNodeSchema[node.type] || FocusNodeSchema[NodeTypes.IDENTITY];

  // Extract display attributes from the node using the schema
  // First check node.rawData (full API response), then node.metadata, then node itself
  const sourceData = node.rawData || node.metadata || node;

  // Debug: Log what data FocusCard is receiving
  console.log('=== FocusCard Debug ===');
  console.log('Node type:', node.type);
  console.log('Node rawData:', node.rawData);
  console.log('Node metadata:', node.metadata);
  console.log('Source data used:', sourceData);
  console.log('Schema attributes:', schema?.attributes?.map(a => a.field));

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

      // Convert object values to display strings
      value = getDisplayValue(value);

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

  // Fallback: if no schema attributes found, use metadata directly
  if (displayAttributes.length === 0 && node.metadata) {
    Object.entries(node.metadata).forEach(([key, value]) => {
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
          {node.type}
        </span>
      </div>

      {/* Display Name */}
      <h2 className="focus-name">{node.displayName}</h2>

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

      {/* Badges */}
      {node.badges && node.badges.length > 0 && (
        <div className="focus-badges">
          {node.badges.map((badge, i) => (
            <span key={i} className="focus-badge">{badge}</span>
          ))}
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
