/**
 * FilterBar Component
 * Top bar filters for AccessLens
 */

import { LaneTypes, ViewModes } from './accessLensTypes';
import { usePreferences } from '../../contexts/PreferencesContext';

// Reason types are now dynamically populated from the API
// The old BaseReasonTypes (Direct, External, Implicit, Explicit) have been removed

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
  onClearAllSelections, // Callback to clear all lane selections
  onExpandAll, // Callback to expand all lanes
  onResetLayout, // Callback to reset lane positions and clear filters
  onExportCSV, // Callback to export current view to CSV
  currentTheme = 'dark', // Current theme
  onThemeChange, // Callback to change theme
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
      {/* Layout Actions */}
      <div className="filter-group layout-actions">
        <button className="expand-all-btn" onClick={onExpandAll} title="Expand all lanes">
          ⊞ Expand All
        </button>
        <button className="reset-positions-btn" onClick={onResetLayout} title="Reset lane positions and clear filters">
          ↺ Reset Layout
        </button>
        {onExportCSV && (
          <button className="export-csv-btn" onClick={onExportCSV} title="Export current view to CSV">
            ⬇ Export CSV
          </button>
        )}
      </div>

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
            {/* Dynamic reason types from API */}
            {availableReasonTypes.length > 0 ? (
              availableReasonTypes
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
                })
            ) : (
              <div className="dropdown-item disabled">No reason types available</div>
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

      {/* Theme Toggle (right-aligned) */}
      <div className="filter-group toolbar-right">
        {/* Theme Toggle */}
        <button
          className="theme-toggle-compact"
          onClick={() => onThemeChange?.(currentTheme === 'dark' ? 'light' : 'dark')}
          title={currentTheme === 'dark' ? 'Switch to Light Theme (Omada)' : 'Switch to Dark Theme'}
        >
          <span className="theme-icon">{currentTheme === 'dark' ? '🌙' : '☀️'}</span>
          <span className="theme-label">{currentTheme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </div>
  );
};

export default FilterBar;
