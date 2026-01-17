/**
 * Object Inspector Panel Component
 * Shows detailed information for selected items from lanes
 * Collapsible panel with smooth animation
 */

import { getNodeIcon, getNodeColor, getReasonColor, FocusNodeSchema, extractFieldValue, NodeTypes } from './accessLensTypes';

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
 */
const formatDateValue = (value) => {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value; // Return original if invalid
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
 * Get display value from a potentially complex value
 */
const getDisplayValue = (value, type = 'text') => {
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
    return value;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
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
      {explanation && (
        <button className="explanation-close" onClick={onClose} title="Clear selection">✕</button>
      )}
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

    // First, add metadata from the node
    if (selectedNode.metadata) {
      Object.entries(selectedNode.metadata).forEach(([key, value]) => {
        // Try to find a schema label for this field
        const schemaAttr = schema?.attributes?.find(
          a => a.field.toLowerCase().includes(key.toLowerCase())
        );
        const fieldType = schemaAttr?.type || (key.toLowerCase().includes('valid') || key.toLowerCase().includes('date') ? 'date' : 'text');
        const displayVal = getDisplayValue(value, fieldType);
        if (displayVal && displayVal !== 'null' && displayVal !== 'undefined') {
          items.push({
            label: schemaAttr?.label || formatLabel(key),
            value: displayVal,
            type: fieldType
          });
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
        // Detect date fields by key name
        const isDateField = key.toLowerCase().includes('valid') ||
                           key.toLowerCase().includes('date') ||
                           key.toLowerCase().includes('created') ||
                           key.toLowerCase().includes('modified') ||
                           key.toLowerCase().includes('lastlogin');
        const fieldType = isDateField ? 'date' : 'text';
        const displayVal = getDisplayValue(value, fieldType);
        if (displayVal &&
            displayVal !== 'null' &&
            displayVal !== 'undefined' &&
            !items.some(i => i.label.toLowerCase() === formatLabel(key).toLowerCase())) {
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
              {metadataItems.map((item, i) => (
                <div key={i} className="fact-item">
                  <span className="fact-label">{item.label}:</span>
                  <span className={`fact-value ${item.type === 'badge' ? 'fact-badge' : ''}`}>
                    {item.value}
                  </span>
                </div>
              ))}
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
