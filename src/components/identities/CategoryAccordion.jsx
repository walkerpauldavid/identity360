/**
 * Category Accordion Component
 * Collapsible section for each identity category
 */

import IdentitiesTable from './IdentitiesTable';
import './IdentitiesList.css';

const CategoryAccordion = ({
  categoryName,
  identities,
  count,
  color,
  isExpanded,
  onToggle,
  isLoading = false
}) => {
  // Use count prop if provided, otherwise fall back to identities.length
  const displayCount = count !== undefined ? count : (identities?.length || 0);

  return (
    <div className="category-accordion">
      <div
        className={`accordion-header ${isExpanded ? 'expanded' : ''}`}
        onClick={onToggle}
        style={{ borderLeftColor: color }}
      >
        <div className="accordion-title">
          <span className="category-indicator" style={{ backgroundColor: color }} />
          <h3>{categoryName}</h3>
          <span className="count-badge">{displayCount}</span>
        </div>
        <div className="accordion-toggle">
          {isExpanded ? '−' : '+'}
        </div>
      </div>

      {isExpanded && (
        <div className="accordion-content">
          {isLoading ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading identities...</p>
            </div>
          ) : identities && identities.length > 0 ? (
            <IdentitiesTable identities={identities} categoryColor={color} />
          ) : (
            <div className="empty-state">
              <p>No identities in this category</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CategoryAccordion;
