/**
 * LaneItemRow Component
 * Displays a single item within a lane with node info and optional reasons
 */

import { getNodeIcon, getNodeColor, getRiskColor, getStatusColor } from './accessLensTypes';
import ReasonChips from './ReasonChips';

const LaneItemRow = ({
  item,
  isSelected,
  isActiveFilter = false,
  onClick,
  onPivot,
  onReasonClick,
  selectedReasonId,
  showReasons = false,
  viewMode = 'explore'
}) => {
  const { node, edge, reasons, rawData } = item;
  const nodeColor = getNodeColor(node.type);

  // Check if this is a logical system (has resources but no direct accounts)
  const isLogicalSystem = node.metadata?.isLogical === true;

  // Check if this is a system type node (has enriched OData details)
  const isSystemNode = node.type === 'System';
  const systemType = node.metadata?.systemType || null;
  const systemOwner = node.metadata?.owner || null;
  const systemClassification = node.metadata?.classification || null;

  // Get system description from multiple possible sources (OData enrichment)
  const systemDescription = node.description ||
    node.metadata?.description ||
    rawData?.DESCRIPTION ||
    rawData?.Description ||
    rawData?.description ||
    item.rawData?.DESCRIPTION ||
    item.rawData?.Description ||
    item.rawData?.description ||
    null;

  // Debug: Log system node data to verify OData enrichment
  if (isSystemNode) {
    console.log(`[LaneItemRow] System "${node.displayName}":`, {
      description: systemDescription,
      type: systemType,
      owner: systemOwner,
      classification: systemClassification,
      nodeMetadata: node.metadata,
      rawData: rawData
    });
  }

  // Build hover text from description - check multiple sources
  // For systems, build a more comprehensive tooltip
  let hoverDescription = systemDescription;

  // Build enhanced hover tooltip for system nodes
  if (isSystemNode) {
    const tooltipParts = [node.displayName];
    if (systemType) tooltipParts.push(`Type: ${systemType}`);
    if (systemClassification) tooltipParts.push(`Classification: ${systemClassification}`);
    if (systemOwner) tooltipParts.push(`Owner: ${systemOwner}`);
    if (hoverDescription) tooltipParts.push(`\n${hoverDescription}`);
    hoverDescription = tooltipParts.join('\n');
  }

  // Handle click with proper event handling
  const handleClick = (e) => {
    e.stopPropagation(); // Prevent drag/parent interference
    console.log('LaneItemRow clicked:', node.displayName);
    onClick?.(item);
  };

  return (
    <div
      className={`lane-item-row ${isSelected ? 'selected' : ''} ${isActiveFilter ? 'active-filter' : ''} ${viewMode === 'risk' && node.riskScore >= 50 ? 'high-risk' : ''} ${isLogicalSystem ? 'logical-system' : ''}`}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
      title={hoverDescription || node.displayName}
    >
      {/* Node Icon */}
      <span className="lane-item-icon" style={{ color: isLogicalSystem ? '#8fbcbb' : nodeColor }}>
        {getNodeIcon(node.type)}
      </span>

      {/* Main Content */}
      <div className="lane-item-content">
        <div className="lane-item-header">
          <span className={`lane-item-name ${isLogicalSystem ? 'logical-system-name' : ''}`}>
            {node.displayName}
          </span>
          {node.status && node.status !== 'active' && (
            <span
              className="lane-item-status"
              style={{ backgroundColor: getStatusColor(node.status) }}
            >
              {node.status}
            </span>
          )}
          {node.riskScore !== undefined && node.riskScore >= 50 && (
            <span
              className="lane-item-risk"
              style={{ backgroundColor: getRiskColor(node.riskScore) }}
            >
              {node.riskScore}
            </span>
          )}
        </div>

        {/* System description subtitle (for enriched system nodes from OData) */}
        {isSystemNode && systemDescription && (
          <div className="lane-item-description">
            {systemDescription}
          </div>
        )}

        {/* System owner (for enriched system nodes) */}
        {isSystemNode && systemOwner && (
          <div className="lane-item-subtitle">
            <span className="system-owner">👤 {systemOwner}</span>
          </div>
        )}

        {/* Badges */}
        {node.badges && node.badges.length > 0 && (
          <div className="lane-item-badges">
            {node.badges.slice(0, 3).map((badge, i) => (
              <span key={i} className="lane-item-badge">{badge}</span>
            ))}
          </div>
        )}

        {/* Reasons (for effective entitlements) */}
        {showReasons && reasons && reasons.length > 0 && (
          <ReasonChips
            reasons={reasons}
            maxVisible={2}
            onReasonClick={onReasonClick}
            selectedReasonId={selectedReasonId}
          />
        )}

        {/* Edge info */}
        {edge && edge.flags && (
          <div className="lane-item-flags">
            {edge.flags.highRisk && <span className="flag-badge high-risk">High Risk</span>}
            {edge.flags.sodViolation && <span className="flag-badge sod">SoD</span>}
            {edge.flags.exception && <span className="flag-badge exception">Exception</span>}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="lane-item-actions">
        {viewMode === 'review' && (
          <>
            <button
              className="action-btn certify"
              onClick={(e) => { e.stopPropagation(); alert('Certify action (stub)'); }}
              title="Certify"
            >
              ✓
            </button>
            <button
              className="action-btn revoke"
              onClick={(e) => { e.stopPropagation(); alert('Revoke action (stub)'); }}
              title="Revoke"
            >
              ✕
            </button>
          </>
        )}
        <button
          className="action-btn pivot"
          onClick={(e) => { e.stopPropagation(); onPivot?.(node); }}
          title={`Focus on ${node.displayName}`}
        >
          →
        </button>
      </div>
    </div>
  );
};

export default LaneItemRow;
