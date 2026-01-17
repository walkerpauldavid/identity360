/**
 * Tile Component
 * Displays a metric tile with title and value
 */

import './Tile.css';

const Tile = ({
  title,
  value,
  loading = false,
  error = null,
  onClick,
  subtitle,
  expanded,
  onToggleExpand,
  onRemove,
  isDragging = false
}) => {
  const hasSubtitle = !!subtitle;

  const handleToggleClick = (e) => {
    e.stopPropagation();
    if (onToggleExpand) onToggleExpand();
  };

  const handleRemoveClick = (e) => {
    e.stopPropagation();
    if (onRemove) onRemove();
  };

  return (
    <div className={`tile ${expanded ? 'tile-expanded' : 'tile-collapsed'} ${isDragging ? 'tile-dragging' : ''}`} onClick={onClick}>
      <div className="tile-header">
        <h3 className="tile-title">{title}</h3>
        <div className="tile-actions">
          {onRemove && (
            <button className="tile-remove" onClick={handleRemoveClick} title="Remove from dashboard">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          {hasSubtitle && (
            <button className="tile-toggle" onClick={handleToggleClick} title={expanded ? 'Collapse' : 'Expand'}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                {expanded ? (
                  <path d="M2 8L6 4L10 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                ) : (
                  <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                )}
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="tile-content">
        {loading ? (
          <div className="tile-loading">
            <div className="spinner-small"></div>
          </div>
        ) : error ? (
          <div className="tile-error">Error</div>
        ) : (
          <>
            {value !== null && value !== undefined && (
              <div className="tile-value">{value}</div>
            )}
            {subtitle && expanded && <div className="tile-subtitle">{subtitle}</div>}
            {!subtitle && (value === null || value === undefined) && (
              <div className="tile-value">-</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Tile;
