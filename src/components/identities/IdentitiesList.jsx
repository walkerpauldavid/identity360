/**
 * Identities List Page
 * Displays all identities grouped by category with accordion sections
 * Uses efficient OData $count with configured category IDs
 */

import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGetIdentityCategoryCounts, useGetIdentitiesByCategoryId } from '../../hooks/useOmadaApi';
import CategoryAccordion from './CategoryAccordion';
import './IdentitiesList.css';

// Component for a single category accordion with lazy loading and filtering
const CategoryAccordionWrapper = ({ category, bearerToken, impersonateUser, selectedStatuses, selectedRiskLevels }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Only fetch identities when expanded - use category ID
  const { data, isLoading } = useGetIdentitiesByCategoryId(
    category.id,
    bearerToken,
    impersonateUser,
    isExpanded // enabled only when expanded
  );

  const allIdentities = data?.data || [];

  // Filter identities by selected statuses and risk levels
  const filteredIdentities = useMemo(() => {
    let filtered = allIdentities;

    // Apply status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(identity => {
        let status = identity.IDENTITYSTATUS;
        if (typeof status === 'object' && status !== null) {
          status = status.value || status.Value || status.DisplayName || status.KeyValue;
        }
        return selectedStatuses.includes(status);
      });
    }

    // Apply risk level filter
    if (selectedRiskLevels.length > 0) {
      filtered = filtered.filter(identity => {
        let riskLevel = identity.RISKLEVEL;
        if (typeof riskLevel === 'object' && riskLevel !== null) {
          riskLevel = riskLevel.value || riskLevel.Value || riskLevel.DisplayName || riskLevel.KeyValue;
        }
        return selectedRiskLevels.includes(riskLevel);
      });
    }

    return filtered;
  }, [allIdentities, selectedStatuses, selectedRiskLevels]);

  return (
    <CategoryAccordion
      categoryName={category.name}
      identities={filteredIdentities}
      count={category.count}
      color={category.color}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      isLoading={isLoading}
    />
  );
};

const IdentitiesList = () => {
  const { getBearerToken, user } = useAuth();
  const bearerToken = getBearerToken();
  const impersonateUser = user?.email;

  // Track selected filters
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedRiskLevels, setSelectedRiskLevels] = useState([]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Fetch category counts efficiently (uses configured category IDs)
  const { data: countsData, isLoading, error } = useGetIdentityCategoryCounts(
    bearerToken,
    impersonateUser
  );

  // For now, hardcode available filters until we can fetch them from API
  const availableStatuses = ['Active', 'Inactive', 'Disabled', 'Pending'];
  const availableRiskLevels = ['Low', 'Medium', 'High', 'Critical'];

  // Toggle status filter
  const toggleStatus = (status) => {
    setSelectedStatuses(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  // Toggle risk level filter
  const toggleRiskLevel = (riskLevel) => {
    setSelectedRiskLevels(prev => {
      if (prev.includes(riskLevel)) {
        return prev.filter(r => r !== riskLevel);
      } else {
        return [...prev, riskLevel];
      }
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedStatuses([]);
    setSelectedRiskLevels([]);
  };

  if (isLoading) {
    return (
      <div className="identities-list-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading category counts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="identities-list-page">
        <div className="error-container">
          <h2>Error Loading Identities</h2>
          <p>{error.message || 'Failed to load identity counts'}</p>
        </div>
      </div>
    );
  }

  const categories = countsData?.categories || [];
  const totalCount = countsData?.total || 0;

  // Filter out categories with 0 count and sort by name
  const categoriesWithData = categories
    .filter(cat => cat.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="identities-list-page">
      {/* Stats Bar */}
      <div className="identities-stats-bar">
        <div className="total-count">
          Total: <span className="count-number">{totalCount}</span> identities
          {(selectedStatuses.length > 0 || selectedRiskLevels.length > 0) && (
            <span className="filtered-indicator"> (filtered)</span>
          )}
        </div>
      </div>

      {/* Combined Filters Section */}
      <div className="filters-container">
        <div className="filters-toggle-header" onClick={() => setFiltersExpanded(!filtersExpanded)}>
          <div className="filters-toggle-title">
            <span className="filters-icon">🔍</span>
            <span className="filters-title">Filters</span>
            {(selectedStatuses.length > 0 || selectedRiskLevels.length > 0) && (
              <span className="active-filters-count">
                {selectedStatuses.length + selectedRiskLevels.length} active
              </span>
            )}
          </div>
          <div className="filters-toggle-actions">
            {(selectedStatuses.length > 0 || selectedRiskLevels.length > 0) && (
              <button
                onClick={(e) => { e.stopPropagation(); clearAllFilters(); }}
                className="btn-clear-all-filters"
              >
                Clear All
              </button>
            )}
            <span className="filters-toggle-arrow">{filtersExpanded ? '▼' : '▶'}</span>
          </div>
        </div>

        {filtersExpanded && (
          <div className="filters-content">
            <div className="filters-row">
              {/* Identity Status Filters */}
              <div className="filter-group">
                <div className="filter-group-header">
                  <span className="filter-label">Identity Status:</span>
                  {selectedStatuses.length > 0 && (
                    <button onClick={() => setSelectedStatuses([])} className="btn-clear-filters">
                      Clear
                    </button>
                  )}
                </div>
                <div className="filter-pills">
                  {availableStatuses.map(status => (
                    <button
                      key={status}
                      onClick={() => toggleStatus(status)}
                      className={`filter-pill ${selectedStatuses.includes(status) ? 'active' : ''}`}
                    >
                      {status}
                      {selectedStatuses.includes(status) && <span className="pill-check">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk Level Filters */}
              <div className="filter-group">
                <div className="filter-group-header">
                  <span className="filter-label">Risk Level:</span>
                  {selectedRiskLevels.length > 0 && (
                    <button onClick={() => setSelectedRiskLevels([])} className="btn-clear-filters">
                      Clear
                    </button>
                  )}
                </div>
                <div className="filter-pills">
                  {availableRiskLevels.map(riskLevel => (
                    <button
                      key={riskLevel}
                      onClick={() => toggleRiskLevel(riskLevel)}
                      className={`filter-pill ${selectedRiskLevels.includes(riskLevel) ? 'active' : ''}`}
                    >
                      {riskLevel}
                      {selectedRiskLevels.includes(riskLevel) && <span className="pill-check">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category Accordions */}
      <div className="categories-container">
        {categoriesWithData.length === 0 ? (
          <div className="empty-state">
            <p>No identities found</p>
          </div>
        ) : (
          categoriesWithData.map((category) => (
            <CategoryAccordionWrapper
              key={category.id}
              category={category}
              bearerToken={bearerToken}
              impersonateUser={impersonateUser}
              selectedStatuses={selectedStatuses}
              selectedRiskLevels={selectedRiskLevels}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default IdentitiesList;
