/**
 * User Preferences Context
 * Manages user preferences with localStorage persistence
 * Provides a custom hook for easy access throughout the app
 */

import { createContext, useContext, useState, useEffect } from 'react';

// Default preferences
const DEFAULT_PREFERENCES = {
  // Table preferences
  identitiesTablePageSize: 25,
  identitiesTableSortColumn: null,
  identitiesTableSortDirection: 'asc',

  // Filter preferences
  lastIdentityStatusFilters: [],
  lastIdentityRiskLevelFilters: [],

  // UI preferences
  theme: 'dark',
  expandedCategories: [], // Array of category IDs that should be expanded by default

  // Localization
  locale: 'en-US',
  timezone: 'America/New_York',

  // Navigation
  lastVisitedPage: '/dashboard',

  // API Logs
  apiLogsPageSize: 50,
  apiLogsShowOnlyErrors: false,

  // Feature flags
  enableNotifications: true,
  autoRefreshInterval: 0, // 0 = disabled, otherwise milliseconds

  // Welcome animation
  welcomeAnimationSpeed: 5000, // milliseconds between language changes

  // Dashboard display
  dashboardTileLayout: 'horizontal', // 'horizontal' or 'vertical'

  // Dashboard layout
  dashboardTiles: {
    order: ['identities', 'myTeam', 'accessRequests', 'approvals', 'reviews', 'other'],
    hidden: []
  },

  // Debugging preferences
  debugEnablePolicyAnalysis: true, // Enable policy analysis debug helper (window.policyAnalysis)
  debugEnableApiConsoleLogging: true, // Log OData and GraphQL API calls to browser console
  debugEnableAccessLensLogging: false, // Enable verbose Identity360 component logging

  // Identity360 display preferences
  identity360LanesCollapsedOnLoad: true, // Start with lanes collapsed when Identity360 first loads
  identity360CollapseLanesOnFocusChange: true, // Collapse lanes when changing the focus node (identity)
  identity360ShowDisabledAssignments: true // Include disabled assignments in Identity360 queries (default: show them)
};

// Preferences Context
const PreferencesContext = createContext(null);

// Storage key
const STORAGE_KEY = 'app_user_preferences';

/**
 * Preferences Provider Component
 */
export const PreferencesProvider = ({ children }) => {
  const [preferences, setPreferences] = useState(() => {
    // Initialize from localStorage or use defaults
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure new preferences are added
        const merged = { ...DEFAULT_PREFERENCES, ...parsed };

        // Special handling for dashboardTiles - merge new tiles into existing order
        if (parsed.dashboardTiles && DEFAULT_PREFERENCES.dashboardTiles) {
          const savedOrder = parsed.dashboardTiles.order || [];
          const defaultOrder = DEFAULT_PREFERENCES.dashboardTiles.order || [];
          const savedHidden = parsed.dashboardTiles.hidden || [];

          // Find new tiles that aren't in saved order or hidden
          const newTiles = defaultOrder.filter(
            tile => !savedOrder.includes(tile) && !savedHidden.includes(tile)
          );

          // Add new tiles to the end of the saved order
          if (newTiles.length > 0) {
            merged.dashboardTiles = {
              ...parsed.dashboardTiles,
              order: [...savedOrder, ...newTiles]
            };
          }
        }

        return merged;
      }
    } catch (error) {
      console.error('Error loading preferences from localStorage:', error);
    }
    return DEFAULT_PREFERENCES;
  });

  // Persist to localStorage whenever preferences change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving preferences to localStorage:', error);
    }
  }, [preferences]);

  /**
   * Update a single preference
   * @param {string} key - Preference key
   * @param {any} value - New value
   */
  const setPreference = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  /**
   * Update multiple preferences at once
   * @param {Object} updates - Object with preference updates
   */
  const updatePreferences = (updates) => {
    setPreferences(prev => ({
      ...prev,
      ...updates
    }));
  };

  /**
   * Get a single preference
   * @param {string} key - Preference key
   * @param {any} defaultValue - Default value if preference not found
   * @returns {any} Preference value
   */
  const getPreference = (key, defaultValue = null) => {
    return preferences[key] !== undefined ? preferences[key] : defaultValue;
  };

  /**
   * Reset all preferences to defaults
   */
  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
  };

  /**
   * Reset a single preference to its default value
   * @param {string} key - Preference key
   */
  const resetPreference = (key) => {
    if (DEFAULT_PREFERENCES[key] !== undefined) {
      setPreference(key, DEFAULT_PREFERENCES[key]);
    }
  };

  const value = {
    preferences,
    setPreference,
    updatePreferences,
    getPreference,
    resetPreferences,
    resetPreference,
  };

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};

/**
 * Custom hook to use preferences
 * @returns {Object} Preferences context value
 * @throws {Error} If used outside PreferencesProvider
 */
export const usePreferences = () => {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }

  return context;
};

// Export default preferences for reference
export { DEFAULT_PREFERENCES };
