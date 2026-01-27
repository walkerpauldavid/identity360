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
  onToggleObjectInspector, // Callback to toggle Object Inspector visibility
  hasActiveCrossLaneFilter = false, // Whether any cross-lane filter (lane selection) is active
  onClearAllSelections // Callback to clear all lane selections
}) => {
  const {
    visibleLanes = Object.values(LaneTypes),
    reasonTypes = [],
    complianceStatuses = [],
    entitlementType = 'all', // 'all', 'direct', 'inherited'
    multiPathOnly = false // Filter to show only entitlements with multiple assignment paths
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
      {/* View Mode Toggle removed */}

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

      {/* Clear All Selections Button - only show when cross-lane filtering is active */}
      {hasActiveCrossLaneFilter && (
        <>
          <div className="filter-divider"></div>
          <div className="filter-group">
            <button
              className="clear-selections-btn"
              onClick={onClearAllSelections}
              title="Clear all access card selections"
            >
              ✕ Clear Selections
            </button>
          </div>
        </>
      )}

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

      {/* Multi-Path Filter Toggle */}
      <div className={`filter-group multi-path-filter ${multiPathOnly ? 'filter-active' : ''}`}>
        <button
          className={`toggle-btn multi-path-toggle ${multiPathOnly ? 'active' : ''}`}
          onClick={() => onFilterChange({ ...filters, multiPathOnly: !multiPathOnly })}
          title={multiPathOnly ? 'Showing entitlements with multiple assignment paths - Click to show all' : 'Show only entitlements with multiple assignment paths (overlapping policies)'}
        >
          ⚡ Multi-Path
        </button>
        {multiPathOnly && (
          <span className="filtering-indicator">Filtering</span>
        )}
      </div>

      {/* Reason Type Filter */}
      <div className="filter-group reason-filter">
        <div className="filter-dropdown">
          <button className="dropdown-trigger" title="Filter entitlements by how they were assigned">
            Reason Types {reasonTypes.length > 0 && `(${reasonTypes.length})`} ▾
          </button>
          <div className="dropdown-menu reason-types-menu">
            {/* Help text header */}
            <div className="dropdown-help-header">
              <span className="help-icon">ℹ️</span>
              <span className="help-text">Filter by assignment method</span>
            </div>
            <div className="dropdown-divider"></div>
            {/* Base reason types - always shown with descriptions */}
            {Object.values(BaseReasonTypes).map((type) => {
              const sanitizedId = `reason-type-${type.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
              // Help descriptions for each reason type
              const reasonTypeHelp = {
                'Direct': 'Assignments made directly through Omada (managed direct assignments)',
                'External': 'Assignments made outside of Omada in the target system (unmanaged)',
                'Implicit': 'Assignments inherited through group membership or hierarchy',
                'Explicit': 'Assignments explicitly granted to the user'
              };
              return (
                <label
                  key={type}
                  className="dropdown-item with-help"
                  htmlFor={sanitizedId}
                  title={reasonTypeHelp[type] || type}
                >
                  <input
                    type="checkbox"
                    id={sanitizedId}
                    name={sanitizedId}
                    checked={reasonTypes.includes(type)}
                    onChange={() => toggleReasonType(type)}
                  />
                  <span className="reason-type-label">
                    {type}
                    <span className="reason-type-hint">{reasonTypeHelp[type]}</span>
                  </span>
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
        <div className={`filter-group compliance-filter ${complianceStatuses.length > 0 ? 'filter-active' : ''}`}>
          <div className={`filter-dropdown ${complianceStatuses.length > 0 ? 'filtering' : ''}`}>
            <button className="dropdown-trigger">
              Compliance {complianceStatuses.length > 0 && `(${complianceStatuses.length})`} ▾
            </button>
            {complianceStatuses.length > 0 && (
              <span className="filtering-indicator">Filtering</span>
            )}
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
