/**
 * LaneItemRow Component
 * Displays a single item within a lane with node info and optional reasons
 * Wrapped with React.memo for performance optimization
 */

import { memo } from 'react';
import { getNodeIcon, getNodeColor, getRiskColor, getStatusColor } from './accessLensTypes';
import { sanitizeAPDescription } from './accessLensUtils';
import ReasonChips from './ReasonChips';

/**
 * Format a date as MM/YY (e.g., 07/26 for July 2026)
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date or null if invalid
 */
const formatValidityDate = (dateString) => {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${year}`;
  } catch {
    return null;
  }
};

/**
 * Get the validity period display text for an assignment
 * Rules:
 * - If validTo is null/undefined OR year is 9999 → "Never expires"
 * - If validFrom year is 1999 → don't show validFrom
 * - Format: MM/YY (e.g., 07/26 for July 2026)
 * @param {string} validFrom - ISO date string for start
 * @param {string} validTo - ISO date string for end
 * @returns {Object} { text: string, isExpiring: boolean }
 */
const getValidityDisplay = (validFrom, validTo) => {
  const fromDate = validFrom ? new Date(validFrom) : null;
  const toDate = validTo ? new Date(validTo) : null;

  const fromYear = fromDate?.getFullYear();
  const toYear = toDate?.getFullYear();

  const isFromDefault = !fromDate || fromYear === 1999;
  // Never expires if: no validTo date, OR validTo year is 9999
  const isNeverExpires = !toDate || toYear === 9999;

  // Check if expiring soon (within 90 days)
  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const isExpiringSoon = toDate && !isNeverExpires && toDate <= ninetyDaysFromNow;

  // Build display text
  if (isFromDefault && isNeverExpires) {
    return { text: 'Never expires', isExpiring: false, isExpiringSoon: false, isNeverExpires: true };
  }

  if (isFromDefault && !isNeverExpires) {
    // Only show end date
    const toFormatted = formatValidityDate(validTo);
    return { text: `Until ${toFormatted}`, isExpiring: true, isExpiringSoon, isNeverExpires: false };
  }

  if (!isFromDefault && isNeverExpires) {
    // Show start date and "Never expires"
    const fromFormatted = formatValidityDate(validFrom);
    return { text: `From ${fromFormatted} · Never expires`, isExpiring: false, isExpiringSoon: false, isNeverExpires: true };
  }

  // Both dates are real
  const fromFormatted = formatValidityDate(validFrom);
  const toFormatted = formatValidityDate(validTo);
  return { text: `${fromFormatted} → ${toFormatted}`, isExpiring: true, isExpiringSoon, isNeverExpires: false };
};

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
  // Check if this entitlement has violations
  const hasViolations = node.metadata?.hasViolations || rawData?.hasViolations || (node.metadata?.violations?.length > 0) || (rawData?.violations?.length > 0);

  // Check for multiple assignment paths (reason array with more than one entry)
  // This indicates overlapping policies/reasons granting the same entitlement
  const reasonArray = rawData?.reason;
  const assignmentPathCount = Array.isArray(reasonArray) ? reasonArray.length : (reasonArray ? 1 : 0);
  const hasMultiplePaths = assignmentPathCount > 1;

  // Get validity period for entitlements (validFrom/validTo at assignment level)
  const validFrom = rawData?.validFrom || node.metadata?.validFrom;
  const validTo = rawData?.validTo || node.metadata?.validTo;
  const validityDisplay = isEntitlementNode ? getValidityDisplay(validFrom, validTo) : null;


  // Check if this is a Violation type node
  const isViolationNode = node.type === 'Violation';

  // Check if this is an Account type node (for entitlement count display)
  const isAccountNode = node.type === 'Account';
  const accountResourceCount = node.metadata?.resourceCount || rawData?.resourceCount || 0;

  // Check if this is a Logical Application type node (for entitlement count display)
  const isLogicalAppNode = node.type === 'LogicalApplication' || (node.type === 'System' && isLogicalSystem);
  const logicalAppResourceCount = node.metadata?.resourceCount || rawData?.resourceCount || 0;

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
  // Apply AP description substitution for policy nodes
  let hoverDescription = sanitizeAPDescription(systemDescription);

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
      className={`lane-item-row ${isSelected ? 'selected' : ''} ${isActiveFilter ? 'active-filter' : ''} ${viewMode === 'risk' && node.riskScore >= 50 ? 'high-risk' : ''} ${isLogicalSystem ? 'logical-system' : ''} ${hasViolations ? 'has-violations' : ''} ${isViolationNode ? 'violation-node' : ''} ${hasMultiplePaths ? 'multi-path' : ''}`}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
      title={hoverDescription || node.displayName}
    >
      {/* Node Icon with optional path count below */}
      <div className="lane-item-icon-wrapper">
        <span className="lane-item-icon" style={{ color: isLogicalSystem ? '#8fbcbb' : nodeColor }}>
          {getNodeIcon(node.type)}
        </span>
        {/* Multi-path indicator below the icon */}
        {hasMultiplePaths && (
          <span
            className="lane-item-path-count"
            title={`${assignmentPathCount} assignment paths: This entitlement is granted through multiple overlapping policies or reasons`}
          >
            <span className="path-icon">⚡</span>{assignmentPathCount}
          </span>
        )}
      </div>

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
          {/* Violation indicator for entitlements - shows "Violation!" badge when violations exist */}
          {isEntitlementNode && hasViolations && (
            <span className="lane-item-violation-badge" title="Has Violations">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '3px', verticalAlign: 'middle' }}>
                <path d="M12 2L1 21h22L12 2z" fill="#f59e0b" stroke="#d97706" strokeWidth="1.5"/>
                <text x="12" y="17" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold" fontFamily="Arial">!</text>
              </svg>
              Violation!
            </span>
          )}
          {/* Compliance status for entitlements - always show on header line after resource name */}
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

        {/* Logical Application entitlement count */}
        {isLogicalAppNode && logicalAppResourceCount > 0 && (
          <div className="lane-item-account-details">
            <span className="account-entitlement-count">
              {logicalAppResourceCount} entitlement{logicalAppResourceCount !== 1 ? 's' : ''}
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

        {/* Reasons and extra info (for effective entitlements without violations) */}
        {showReasons && (
          <div className="lane-item-reasons-row">
            {/* Show validity period when NO violations (compliance is now always in header) */}
            {isEntitlementNode && !hasViolations && validityDisplay && (
              <span
                className={`lane-item-validity ${validityDisplay.isExpiring ? 'time-limited' : 'permanent'} ${validityDisplay.isExpiringSoon ? 'expiring-soon' : ''} ${validityDisplay.isNeverExpires ? 'never-expires' : ''}`}
                title={`Assignment validity: ${validityDisplay.text}`}
              >
                {validityDisplay.text}
              </span>
            )}
            {/* Reason chips after compliance/validity info */}
            {reasons && reasons.length > 0 && (
              <ReasonChips
                reasons={reasons}
                maxVisible={2}
                onReasonClick={onReasonClick}
                selectedReasonId={selectedReasonId}
                parentResource={rawData?.parentResource}
              />
            )}
          </div>
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
  if (prevNode?.metadata?.hasViolations !== nextNode?.metadata?.hasViolations) return false;

  // Props are effectively equal
  return true;
};

export default memo(LaneItemRow, arePropsEqual);
