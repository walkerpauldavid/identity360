/**
 * Breadcrumbs Component
 * Navigation history for pivot operations
 */

import { getNodeIcon, getNodeColor } from './accessLensTypes';

const Breadcrumbs = ({ history, onNavigate }) => {
  if (!history || history.length === 0) return null;

  return (
    <div className="access-lens-breadcrumbs">
      <span className="breadcrumb-label">Navigation:</span>
      {history.map((node, index) => (
        <span key={node.id} className="breadcrumb-item">
          {index > 0 && <span className="breadcrumb-separator">→</span>}
          <button
            className={`breadcrumb-btn ${index === history.length - 1 ? 'current' : ''}`}
            onClick={() => index < history.length - 1 && onNavigate(node, index)}
            disabled={index === history.length - 1}
            style={{
              borderColor: index === history.length - 1 ? getNodeColor(node.type) : 'transparent'
            }}
          >
            <span className="breadcrumb-icon">{getNodeIcon(node.type)}</span>
            <span className="breadcrumb-name">{node.displayName}</span>
          </button>
        </span>
      ))}
      {history.length > 1 && (
        <button
          className="breadcrumb-back"
          onClick={() => onNavigate(history[history.length - 2], history.length - 2)}
          title="Go back"
        >
          ← Back
        </button>
      )}
    </div>
  );
};

export default Breadcrumbs;
