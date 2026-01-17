/**
 * ReasonChips Component
 * Displays reason tags for entitlement effectiveness with overflow handling
 */

import { getReasonColor } from './accessLensTypes';

const ReasonChips = ({ reasons, maxVisible = 2, onReasonClick, selectedReasonId }) => {
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
            backgroundColor: `${getReasonColor(reason.type)}20`,
            borderColor: getReasonColor(reason.type),
            color: getReasonColor(reason.type)
          }}
          onClick={(e) => {
            e.stopPropagation();
            onReasonClick?.(reason);
          }}
          title={reason.description || reason.title}
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
