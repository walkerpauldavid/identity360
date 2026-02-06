/**
 * ReasonChips Component
 * Displays reason tags for entitlement effectiveness with overflow handling
 */

import { getReasonColor } from './accessLensTypes';

/**
 * Get the tooltip text for a reason chip
 * For "Inherited" reasons, includes the parent resource name if available
 * @param {Object} reason - The reason object
 * @param {Object} parentResource - The parent resource from API (for inherited reasons)
 * @returns {string} Tooltip text
 */
const getReasonTooltip = (reason, parentResource) => {
  // Check if this is an "Inherited" reason (ChildResource type)
  const isInherited = reason.title === 'Inherited' ||
                      reason.type === 'ChildResource' ||
                      reason.reasonType === 'ChildResource';

  if (isInherited) {
    // First try parentResource.name from API
    if (parentResource?.name) {
      return `Inherited from: ${parentResource.name}`;
    }

    // Fall back to parsing "Ancestors: ..." from reason.description
    // Format: "Ancestors: Parent Name" or "Ancestors: Grandparent / Parent"
    if (reason.description && reason.description.startsWith('Ancestors:')) {
      const ancestorPath = reason.description.substring('Ancestors:'.length).trim();
      return `Inherited from: ${ancestorPath}`;
    }
  }

  return reason.description || reason.title;
};

const ReasonChips = ({ reasons, maxVisible = 2, onReasonClick, selectedReasonId, parentResource }) => {
  if (!reasons || reasons.length === 0) return null;

  const visibleReasons = reasons.slice(0, maxVisible);
  const hiddenCount = reasons.length - maxVisible;

  return (
    <div className="reason-chips">
      {visibleReasons.map((reason) => (
        <button
          key={reason.id}
          className={`reason-chip ${selectedReasonId === reason.id ? 'selected' : ''}`}
          style={{
            backgroundColor: getReasonColor(reason.type),
            borderColor: getReasonColor(reason.type),
            color: '#ffffff'
          }}
          onClick={(e) => {
            e.stopPropagation();
            onReasonClick?.(reason);
          }}
          title={getReasonTooltip(reason, parentResource)}
        >
          {reason.title}
        </button>
      ))}
      {hiddenCount > 0 && (
        <span className="reason-overflow">+{hiddenCount} more</span>
      )}
    </div>
  );
};

export default ReasonChips;
