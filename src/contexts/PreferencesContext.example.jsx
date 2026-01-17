/**
 * usePreferences Hook - Usage Examples
 *
 * This file demonstrates how to use the preferences hook throughout the app.
 */

import { usePreferences } from './PreferencesContext';

// ============================================================================
// Example 1: Basic Usage - Get and Set a Single Preference
// ============================================================================
function ExampleComponent1() {
  const { getPreference, setPreference } = usePreferences();

  const pageSize = getPreference('identitiesTablePageSize');

  const handlePageSizeChange = (newSize) => {
    setPreference('identitiesTablePageSize', newSize);
  };

  return (
    <div>
      <p>Current page size: {pageSize}</p>
      <button onClick={() => handlePageSizeChange(50)}>
        Set page size to 50
      </button>
    </div>
  );
}

// ============================================================================
// Example 2: Using Direct State Access
// ============================================================================
function ExampleComponent2() {
  const { preferences, setPreference } = usePreferences();

  // Access preferences directly from the preferences object
  const { identitiesTablePageSize, theme, enableNotifications } = preferences;

  return (
    <div>
      <p>Page Size: {identitiesTablePageSize}</p>
      <p>Theme: {theme}</p>
      <p>Notifications: {enableNotifications ? 'Enabled' : 'Disabled'}</p>

      <button onClick={() => setPreference('enableNotifications', !enableNotifications)}>
        Toggle Notifications
      </button>
    </div>
  );
}

// ============================================================================
// Example 3: Updating Multiple Preferences at Once
// ============================================================================
function ExampleComponent3() {
  const { updatePreferences } = usePreferences();

  const handleResetTableSettings = () => {
    updatePreferences({
      identitiesTablePageSize: 25,
      identitiesTableSortColumn: null,
      identitiesTableSortDirection: 'asc',
    });
  };

  return (
    <button onClick={handleResetTableSettings}>
      Reset All Table Settings
    </button>
  );
}

// ============================================================================
// Example 4: Initialize Component State from Preferences
// ============================================================================
import { useState } from 'react';

function ExampleComponent4() {
  const { preferences, setPreference } = usePreferences();

  // Initialize state from preferences
  const [pageSize, setPageSize] = useState(preferences.identitiesTablePageSize);

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPreference('identitiesTablePageSize', newSize);
  };

  return (
    <select value={pageSize} onChange={(e) => handlePageSizeChange(Number(e.target.value))}>
      <option value={10}>10</option>
      <option value={25}>25</option>
      <option value={50}>50</option>
      <option value={100}>100</option>
    </select>
  );
}

// ============================================================================
// Example 5: Reset Preferences
// ============================================================================
function ExampleComponent5() {
  const { resetPreferences, resetPreference } = usePreferences();

  return (
    <div>
      <button onClick={() => resetPreference('identitiesTablePageSize')}>
        Reset Page Size to Default
      </button>

      <button onClick={resetPreferences}>
        Reset All Preferences to Defaults
      </button>
    </div>
  );
}

// ============================================================================
// Example 6: Real-World Usage - Table with Persistent Settings
// ============================================================================
function DataTable() {
  const { preferences, setPreference } = usePreferences();
  const [currentPage, setCurrentPage] = useState(1);

  // Get preferences
  const pageSize = preferences.identitiesTablePageSize;
  const sortColumn = preferences.identitiesTableSortColumn;
  const sortDirection = preferences.identitiesTableSortDirection;

  // Handlers that save preferences
  const handleSort = (column) => {
    if (sortColumn === column) {
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      setPreference('identitiesTableSortDirection', newDirection);
    } else {
      setPreference('identitiesTableSortColumn', column);
      setPreference('identitiesTableSortDirection', 'asc');
    }
  };

  const handlePageSizeChange = (newSize) => {
    setPreference('identitiesTablePageSize', newSize);
    setCurrentPage(1);
  };

  return (
    <div>
      {/* Table implementation */}
      <p>Sorted by: {sortColumn || 'none'} ({sortDirection})</p>
      <p>Page size: {pageSize}</p>
    </div>
  );
}

// ============================================================================
// Example 7: Using Preferences for Feature Flags
// ============================================================================
function FeatureComponent() {
  const { preferences, setPreference } = usePreferences();

  // Check if a feature is enabled
  if (!preferences.enableNotifications) {
    return null; // Don't render if feature is disabled
  }

  return (
    <div className="notifications-panel">
      <h3>Notifications</h3>
      <button onClick={() => setPreference('enableNotifications', false)}>
        Disable Notifications
      </button>
    </div>
  );
}

// ============================================================================
// Example 8: Auto-refresh Based on Preferences
// ============================================================================
import { useEffect } from 'react';

function AutoRefreshComponent() {
  const { preferences } = usePreferences();
  const [data, setData] = useState(null);

  useEffect(() => {
    const interval = preferences.autoRefreshInterval;

    if (interval > 0) {
      const timer = setInterval(() => {
        // Fetch fresh data
        fetchData();
      }, interval);

      return () => clearInterval(timer);
    }
  }, [preferences.autoRefreshInterval]);

  const fetchData = async () => {
    // Fetch implementation
  };

  return <div>{/* Component content */}</div>;
}

// ============================================================================
// Available Preference Keys (from DEFAULT_PREFERENCES)
// ============================================================================
/*
  // Table preferences
  identitiesTablePageSize: 25
  identitiesTableSortColumn: null
  identitiesTableSortDirection: 'asc'

  // Filter preferences
  lastIdentityStatusFilters: []
  lastIdentityRiskLevelFilters: []

  // UI preferences
  theme: 'dark'
  expandedCategories: []

  // Navigation
  lastVisitedPage: '/dashboard'

  // API Logs
  apiLogsPageSize: 50
  apiLogsShowOnlyErrors: false

  // Feature flags
  enableNotifications: true
  autoRefreshInterval: 0
*/
