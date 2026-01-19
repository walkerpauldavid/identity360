/**
 * LaneItemRow Component
 * Displays a single item within a lane with node info and optional reasons
 * Wrapped with React.memo for performance optimization
 */

import { memo } from 'react';
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

  // Check if this is an Identity type node (for enhanced display in access cards)
  const isIdentityNode = node.type === 'Identity';
  // Employee ID: try metadata.identityId (from GraphQL), metadata.employeeId (from OData), or rawData variants
  const identityEmployeeId = node.metadata?.identityId || node.metadata?.employeeId || rawData?.identityId || rawData?.employeeId || rawData?.IDENTITYID || rawData?.EMPLOYEEID || null;
  // Job title: try metadata.title (from OData enrichment), or rawData variants
  const identityTitle = node.metadata?.title || rawData?.title || rawData?.JOBTITLE || rawData?.jobTitle || rawData?.TITLE || null;
  // Email: try metadata.email (from OData enrichment), or rawData variants
  const identityEmail = node.metadata?.email || rawData?.email || rawData?.EMAIL || rawData?.mail || null;

  // Check if this is an Entitlement type node (for compliance status display)
  const isEntitlementNode = node.type === 'Entitlement' || node.type === 'Resource';
  const complianceStatus = node.metadata?.complianceStatus || rawData?.complianceStatus || null;

  // Check if this is an Account type node (for entitlement count display)
  const isAccountNode = node.type === 'Account';
  const accountResourceCount = node.metadata?.resourceCount || rawData?.resourceCount || 0;

  // Debug: Log identity node data to trace attribute flow (suppressed for performance)
  // if (isIdentityNode) {
  //   console.log(`[LaneItemRow] Identity "${node.displayName}":`, {
  //     employeeId: identityEmployeeId,
  //     title: identityTitle,
  //     email: identityEmail,
  //     metadata: node.metadata,
  //     rawData: rawData
  //   });
  // }

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

  // Debug: Log system node data to verify OData enrichment (suppressed for performance)
  // if (isSystemNode) {
  //   console.log(`[LaneItemRow] System "${node.displayName}":`, {
  //     description: systemDescription,
  //     type: systemType,
  //     owner: systemOwner,
  //     classification: systemClassification,
  //     nodeMetadata: node.metadata,
  //     rawData: rawData
  //   });
  // }

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
    // console.log('LaneItemRow clicked:', node.displayName);  // Suppressed for performance
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
          {/* Compliance status for entitlements */}
          {isEntitlementNode && complianceStatus && (
            <span
              className={`lane-item-compliance ${complianceStatus === 'Approved' ? 'approved' : complianceStatus === 'Not Approved' ? 'not-approved' : 'pending'}`}
            >
              {complianceStatus}
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

        {/* Identity details (for identity nodes in access cards) */}
        {/* Note: riskLevel is shown as a badge, so not duplicated here */}
        {isIdentityNode && (identityEmployeeId || identityTitle || identityEmail) && (
          <div className="lane-item-identity-details">
            {identityEmployeeId && (
              <span className="identity-employee-id">{identityEmployeeId}</span>
            )}
            {identityTitle && (
              <span className="identity-title">{identityTitle}</span>
            )}
            {identityEmail && (
              <span className="identity-email">{identityEmail}</span>
            )}
          </div>
        )}

        {/* Account entitlement count */}
        {isAccountNode && accountResourceCount > 0 && (
          <div className="lane-item-account-details">
            <span className="account-entitlement-count">
              {accountResourceCount} entitlement{accountResourceCount !== 1 ? 's' : ''}
            </span>
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

// Custom comparison function for React.memo
// Only re-render if props that affect display have changed
const arePropsEqual = (prevProps, nextProps) => {
  // Check callback identity - IMPORTANT: must re-render if callbacks change
  // to avoid stale closure bugs where old callbacks capture outdated state
  if (prevProps.onClick !== nextProps.onClick) return false;
  if (prevProps.onPivot !== nextProps.onPivot) return false;
  if (prevProps.onReasonClick !== nextProps.onReasonClick) return false;

  // Check item identity
  if (prevProps.item?.node?.id !== nextProps.item?.node?.id) return false;

  // Check selection state
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isActiveFilter !== nextProps.isActiveFilter) return false;
  if (prevProps.selectedReasonId !== nextProps.selectedReasonId) return false;

  // Check display options
  if (prevProps.showReasons !== nextProps.showReasons) return false;
  if (prevProps.viewMode !== nextProps.viewMode) return false;

  // Check if item content changed (deep comparison of key fields)
  const prevNode = prevProps.item?.node;
  const nextNode = nextProps.item?.node;
  if (prevNode?.displayName !== nextNode?.displayName) return false;
  if (prevNode?.status !== nextNode?.status) return false;

  // Props are effectively equal
  return true;
};

export default memo(LaneItemRow, arePropsEqual);
