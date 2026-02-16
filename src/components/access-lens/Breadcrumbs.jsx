/**
 * Breadcrumbs Component
 * Navigation history for pivot operations
 */

import { getNodeIcon, getNodeColor } from './accessLensTypes';

const Breadcrumbs = ({ history, currentIndex, onNavigate, onRemove }) => {
  if (!history || history.length === 0) return null;

  // Use currentIndex if provided, otherwise default to last item
  const activeIndex = currentIndex !== undefined ? currentIndex : history.length - 1;

  // Handle remove click - prevent event from bubbling to navigate
  const handleRemove = (e, index) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(index);
    }
  };

  return (
    <div className="access-lens-breadcrumbs">
      <span className="breadcrumb-label">Navigation History:</span>
      {history.map((node, index) => (
        <span key={node.id} className="breadcrumb-item">
          {index > 0 && <span className="breadcrumb-separator">→</span>}
          <button
            className={`breadcrumb-btn ${index === activeIndex ? 'current' : ''}`}
            onClick={() => index !== activeIndex && onNavigate(node, index)}
            disabled={index === activeIndex}
            style={{
              borderColor: index === activeIndex ? getNodeColor(node.type) : 'transparent'
            }}
          >
            <span className="breadcrumb-icon">{getNodeIcon(node.type)}</span>
            <span className="breadcrumb-name">{node.displayName}</span>
            {/* Remove button - only show if not the current item and we have a callback */}
            {onRemove && index !== activeIndex && (
              <span
                className="breadcrumb-remove"
                onClick={(e) => handleRemove(e, index)}
                title="Remove from history"
              >
                ×
              </span>
            )}
          </button>
        </span>
      ))}
      {activeIndex > 0 && (
        <button
          className="breadcrumb-back"
          onClick={() => onNavigate(history[activeIndex - 1], activeIndex - 1)}
          title="Go back"
        >
          ← Back
        </button>
      )}
    </div>
  );
};

export default Breadcrumbs;
