/**
 * FilterBar Component
 * Top bar filters for AccessLens
 */

import { LaneTypes, BaseReasonTypes, ViewModes } from './accessLensTypes';

const FilterBar = ({
  filters,
  onFilterChange,
  viewMode,
  onViewModeChange,
  onSearch,
  availableReasonTypes = [], // Dynamic reason types from API
  availableComplianceStatuses = [], // Compliance statuses from API
  showObjectInspector = true, // Whether to show Object Inspector on item click
  onToggleObjectInspector // Callback to toggle Object Inspector visibility
}) => {
  const {
    visibleLanes = Object.values(LaneTypes),
    reasonTypes = [],
    complianceStatuses = [],
    entitlementType = 'all' // 'all', 'direct', 'inherited'
  } = filters;

  const toggleLane = (laneType) => {
    const newLanes = visibleLanes.includes(laneType)
      ? visibleLanes.filter(l => l !== laneType)
      : [...visibleLanes, laneType];
    onFilterChange({ ...filters, visibleLanes: newLanes });
  };

  const toggleReasonType = (reasonType) => {
    const newTypes = reasonTypes.includes(reasonType)
      ? reasonTypes.filter(t => t !== reasonType)
      : [...reasonTypes, reasonType];
    onFilterChange({ ...filters, reasonTypes: newTypes });
  };

  const toggleComplianceStatus = (status) => {
    const newStatuses = complianceStatuses.includes(status)
      ? complianceStatuses.filter(s => s !== status)
      : [...complianceStatuses, status];
    onFilterChange({ ...filters, complianceStatuses: newStatuses });
  };

  return (
    <div className="filter-bar">
      {/* View Mode Toggle */}
      <div className="filter-group view-modes">
        <button
          className={`mode-btn ${viewMode === ViewModes.EXPLORE ? 'active' : ''}`}
          onClick={() => onViewModeChange(ViewModes.EXPLORE)}
          title="Explore Mode"
        >
          🔍 Explore
        </button>
        <button
          className={`mode-btn ${viewMode === ViewModes.RISK ? 'active' : ''}`}
          onClick={() => onViewModeChange(ViewModes.RISK)}
          title="Risk Mode"
        >
          ⚠️ Risk
        </button>
        <button
          className={`mode-btn ${viewMode === ViewModes.REVIEW ? 'active' : ''}`}
          onClick={() => onViewModeChange(ViewModes.REVIEW)}
          title="Review Mode"
        >
          ✓ Review
        </button>
      </div>

      {/* Divider */}
      <div className="filter-divider"></div>

      {/* Lane Toggles */}
      <div className="filter-group lane-toggles">
        <span className="filter-label">Show:</span>
        {[
          { type: LaneTypes.ROLES, label: 'Roles', icon: '👥' },
          { type: LaneTypes.ACCOUNTS, label: 'Accounts', icon: '💻' },
          { type: LaneTypes.EFFECTIVE_ENTITLEMENTS, label: 'Entitlements', icon: '🔑' },
          { type: LaneTypes.POLICIES, label: 'Policies', icon: '📋' },
          { type: LaneTypes.SYSTEMS, label: 'Systems', icon: '🖥️' },
          { type: LaneTypes.IDENTITIES, label: 'Identities', icon: '👤' }
        ].map(({ type, label, icon }) => (
          <button
            key={type}
            className={`toggle-btn ${visibleLanes.includes(type) ? 'active' : ''}`}
            onClick={() => toggleLane(type)}
            title={label}
          >
            {icon}
          </button>
        ))}
        {/* Object Inspector Toggle */}
        <button
          className={`toggle-btn inspector-toggle ${showObjectInspector ? 'active' : ''}`}
          onClick={onToggleObjectInspector}
          title={showObjectInspector ? 'Hide Object Inspector' : 'Show Object Inspector'}
        >
          🔍
        </button>
      </div>

      {/* Divider */}
      <div className="filter-divider"></div>

      {/* Entitlement Type Filter */}
      <div className="filter-group">
        <select
          id="entitlement-type-filter"
          name="entitlement-type-filter"
          className="filter-select"
          value={entitlementType}
          onChange={(e) => onFilterChange({ ...filters, entitlementType: e.target.value })}
          autoComplete="off"
        >
          <option value="all">All Entitlements</option>
          <option value="direct">Direct Only</option>
          <option value="inherited">Inherited Only</option>
        </select>
      </div>

      {/* Reason Type Filter */}
      <div className="filter-group reason-filter">
        <div className="filter-dropdown">
          <button className="dropdown-trigger">
            Reason Types {reasonTypes.length > 0 && `(${reasonTypes.length})`} ▾
          </button>
          <div className="dropdown-menu">
            {/* Base reason types - always shown */}
            {Object.values(BaseReasonTypes).map((type) => {
              const sanitizedId = `reason-type-${type.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
              return (
                <label key={type} className="dropdown-item" htmlFor={sanitizedId}>
                  <input
                    type="checkbox"
                    id={sanitizedId}
                    name={sanitizedId}
                    checked={reasonTypes.includes(type)}
                    onChange={() => toggleReasonType(type)}
                  />
                  {type}
                </label>
              );
            })}
            {/* Dynamic reason types from API */}
            {availableReasonTypes.length > 0 && (
              <>
                <div className="dropdown-divider"></div>
                {availableReasonTypes
                  .filter(type => !Object.values(BaseReasonTypes).includes(type))
                  .sort((a, b) => a.localeCompare(b))
                  .map((type) => {
                    const sanitizedId = `reason-type-${type.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
                    return (
                      <label key={type} className="dropdown-item" htmlFor={sanitizedId}>
                        <input
                          type="checkbox"
                          id={sanitizedId}
                          name={sanitizedId}
                          checked={reasonTypes.includes(type)}
                          onChange={() => toggleReasonType(type)}
                        />
                        {type.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                    );
                  })}
              </>
            )}
            {reasonTypes.length > 0 && (
              <button
                className="dropdown-clear"
                onClick={() => onFilterChange({ ...filters, reasonTypes: [] })}
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Compliance Status Filter - Multi-select dropdown */}
      {availableComplianceStatuses.length > 0 && (
        <div className="filter-group compliance-filter">
          <div className="filter-dropdown">
            <button className="dropdown-trigger">
              Compliance {complianceStatuses.length > 0 && `(${complianceStatuses.length})`} ▾
            </button>
            <div className="dropdown-menu">
              {availableComplianceStatuses.map((status) => {
                const sanitizedId = `compliance-status-${status.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
                return (
                  <label key={status} className="dropdown-item" htmlFor={sanitizedId}>
                    <input
                      type="checkbox"
                      id={sanitizedId}
                      name={sanitizedId}
                      checked={complianceStatuses.includes(status)}
                      onChange={() => toggleComplianceStatus(status)}
                    />
                    {status}
                  </label>
                );
              })}
              {complianceStatuses.length > 0 && (
                <button
                  className="dropdown-clear"
                  onClick={() => onFilterChange({ ...filters, complianceStatuses: [] })}
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="filter-group search-group">
        <input
          type="text"
          id="access-lens-search"
          name="access-lens-search"
          className="filter-search"
          placeholder="Search..."
          autoComplete="off"
          onChange={(e) => onSearch?.(e.target.value)}
        />
      </div>
    </div>
  );
};

export default FilterBar;
