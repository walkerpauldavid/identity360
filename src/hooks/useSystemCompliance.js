/**
 * useSystemCompliance Hook
 *
 * Fetches all systems from OData and their calculated assignments to build
 * compliance statistics for the heatmap visualization.
 *
 * For local testing, set USE_LOCAL_HEATMAP_DATA to true to load from a local JSON file
 * instead of making API calls. This significantly speeds up development.
 */

import { useState, useEffect, useCallback } from 'react';
import { omadaApi } from '../services/omadaApi';

// ============================================================================
// FEATURE FLAG: Local Heatmap Data
// Set to true to load heatmap data from local JSON file (faster for testing)
// Set to false to fetch data from GraphQL API (production behavior)
//
// FIRST TIME SETUP:
// 1. Keep this as 'false' and load the heatmap page
// 2. The data will auto-download as 'heatmapData.json'
// 3. Move that file to public/data/heatmapData.json
// 4. Then set this to 'true' for instant loading
// ============================================================================
const USE_LOCAL_HEATMAP_DATA = true;

// Path to the local heatmap data file (relative to public folder)
const LOCAL_HEATMAP_DATA_PATH = '/data/heatmapData.json';

/**
 * Export systems data as a downloadable JSON file
 * Call this after fetching from API to save the data for local testing
 * @param {Array} systems - Array of system objects with compliance data
 */
const exportHeatmapData = (systems) => {
  const exportData = {
    description: "Heatmap compliance data exported from Omada API. Copy this file to public/data/heatmapData.json",
    generatedAt: new Date().toISOString(),
    systems: systems
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'heatmapData.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log('[useSystemCompliance] Data exported! Move the downloaded file to public/data/heatmapData.json');
};

/**
 * Calculate compliance statistics from assignments
 * @param {Array} assignments - Array of assignment objects
 * @returns {Object} Compliance statistics
 */
const calculateComplianceStats = (assignments) => {
  if (!assignments || assignments.length === 0) {
    return {
      total: 0,
      compliant: 0,
      nonCompliant: 0,
      pending: 0,
      complianceRate: 0,
      byStatus: {}
    };
  }

  const byStatus = {};
  let compliant = 0;
  let nonCompliant = 0;
  let pending = 0;

  assignments.forEach(assignment => {
    const status = assignment.complianceStatus || 'Unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;

    // Categorize by compliance - check if status CONTAINS these keywords
    const statusLower = status.toLowerCase();

    // Compliant statuses: anything with "approved" in it (Approved, Implicitly Approved, Explicitly Approved, etc.)
    if (statusLower.includes('approved') || statusLower.includes('compliant')) {
      compliant++;
    }
    // Non-compliant statuses: "not approved", "violation", "non-compliant", "rejected"
    else if (statusLower.includes('not approved') ||
             statusLower.includes('violation') ||
             statusLower.includes('non-compliant') ||
             statusLower.includes('rejected')) {
      nonCompliant++;
    }
    // Pending statuses
    else if (statusLower.includes('pending') ||
             statusLower.includes('review') ||
             statusLower.includes('waiting')) {
      pending++;
    }
    // Unknown/other status - count as non-compliant for risk assessment
    else {
      nonCompliant++;
    }
  });

  const total = assignments.length;
  const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 0;

  return {
    total,
    compliant,
    nonCompliant,
    pending,
    complianceRate,
    byStatus
  };
};

/**
 * Extract unique accounts from assignments
 * @param {Array} assignments - Array of assignment objects
 * @returns {number} Number of unique accounts
 */
const countUniqueAccounts = (assignments) => {
  if (!assignments || assignments.length === 0) return 0;

  const accountIds = new Set();
  assignments.forEach(assignment => {
    if (assignment.account?.id) {
      accountIds.add(assignment.account.id);
    } else if (assignment.account?.accountName) {
      accountIds.add(assignment.account.accountName);
    }
  });

  return accountIds.size;
};

/**
 * Extract unique identities from assignments
 * @param {Array} assignments - Array of assignment objects
 * @returns {number} Number of unique identities
 */
const countUniqueIdentities = (assignments) => {
  if (!assignments || assignments.length === 0) return 0;

  const identityIds = new Set();
  assignments.forEach(assignment => {
    if (assignment.identity?.id) {
      identityIds.add(assignment.identity.id);
    }
  });

  return identityIds.size;
};

/**
 * Count assignments with multiple assignment paths (overlapping policies/reasons)
 * An assignment has multiple paths if its reason array has more than one entry
 * @param {Array} assignments - Array of assignment objects
 * @returns {Object} { multiPathCount, totalCount, multiPathRate }
 */
const countMultiPathAssignments = (assignments) => {
  if (!assignments || assignments.length === 0) {
    return { multiPathCount: 0, totalCount: 0, multiPathRate: 0 };
  }

  let multiPathCount = 0;
  assignments.forEach(assignment => {
    const reasonArray = assignment.reason;
    const pathCount = Array.isArray(reasonArray) ? reasonArray.length : (reasonArray ? 1 : 0);
    if (pathCount > 1) {
      multiPathCount++;
    }
  });

  const totalCount = assignments.length;
  const multiPathRate = totalCount > 0 ? Math.round((multiPathCount / totalCount) * 100) : 0;

  return { multiPathCount, totalCount, multiPathRate };
};

/**
 * Load heatmap data from local JSON file
 * @returns {Promise<Array>} Array of system objects with compliance data
 */
const loadLocalHeatmapData = async () => {
  try {
    console.log('[useSystemCompliance] Loading data from local file:', LOCAL_HEATMAP_DATA_PATH);
    const response = await fetch(LOCAL_HEATMAP_DATA_PATH);

    if (!response.ok) {
      throw new Error(`Failed to load local data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.systems || !Array.isArray(data.systems)) {
      throw new Error('Invalid data format: missing systems array');
    }

    console.log(`[useSystemCompliance] Loaded ${data.systems.length} systems from local file`);
    console.log('[useSystemCompliance] Data generated at:', data.generatedAt || 'unknown');

    return data.systems;
  } catch (err) {
    console.error('[useSystemCompliance] Error loading local data:', err);
    throw err;
  }
};

/**
 * Hook to fetch system compliance data for heatmap
 *
 * @param {string} bearerToken - OAuth bearer token
 * @param {string} impersonateUser - User email for impersonation
 * @param {Object} options - Hook options
 * @param {number} options.maxSystems - Maximum number of systems to fetch (default: 50)
 * @param {number} options.assignmentsPerSystem - Max assignments per system (default: 500)
 * @returns {Object} { systems, isLoading, error, progress, refetch }
 */
export const useSystemCompliance = (bearerToken, impersonateUser, options = {}) => {
  const { maxSystems = 50, assignmentsPerSystem = 500 } = options;

  const [systems, setSystems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentSystem: '' });

  const fetchComplianceData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // ========================================================================
    // LOCAL FILE DATA SOURCE (for faster local testing)
    // ========================================================================
    if (USE_LOCAL_HEATMAP_DATA) {
      setProgress({ current: 0, total: 1, currentSystem: 'Loading from local file...' });

      try {
        const localSystems = await loadLocalHeatmapData();

        // Sort by account count (larger systems first for heatmap sizing)
        localSystems.sort((a, b) => b.accountCount - a.accountCount);

        setSystems(localSystems);
        setProgress({ current: 1, total: 1, currentSystem: 'Complete' });
        console.log('[useSystemCompliance] Using LOCAL data source (USE_LOCAL_HEATMAP_DATA=true)');
      } catch (err) {
        setError(err.message || 'Failed to load local heatmap data');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // ========================================================================
    // API DATA SOURCE (production behavior)
    // ========================================================================
    console.log('[useSystemCompliance] Using API data source (USE_LOCAL_HEATMAP_DATA=false)');

    // Validate bearerToken is a non-empty string
    if (!bearerToken || typeof bearerToken !== 'string') {
      console.log('[useSystemCompliance] No valid bearer token, skipping fetch. Got:', typeof bearerToken);
      setIsLoading(false);
      return;
    }

    if (!impersonateUser) {
      console.log('[useSystemCompliance] No impersonateUser, skipping fetch');
      setIsLoading(false);
      return;
    }

    setProgress({ current: 0, total: 0, currentSystem: 'Fetching systems...' });

    try {
      // Step 1: Fetch all systems using OData
      // Don't use $select - let OData return default fields to avoid field name issues
      console.log('[useSystemCompliance] Fetching systems from OData...');
      const systemsResult = await omadaApi.odata.query(
        'System',
        bearerToken,
        impersonateUser,
        {
          top: maxSystems
        }
      );

      if (systemsResult.status !== 'success' || !systemsResult.data) {
        throw new Error('Failed to fetch systems');
      }

      const systemsList = systemsResult.data;
      console.log(`[useSystemCompliance] Found ${systemsList.length} systems`);

      if (systemsList.length === 0) {
        setSystems([]);
        setIsLoading(false);
        return;
      }

      setProgress({ current: 0, total: systemsList.length, currentSystem: 'Starting...' });

      // Step 2: Fetch assignments for each system
      const systemsWithCompliance = [];

      // Debug: Log the first system to see available fields
      if (systemsList.length > 0) {
        console.log('[useSystemCompliance] First system fields:', Object.keys(systemsList[0]));
        console.log('[useSystemCompliance] First system data:', systemsList[0]);
      }

      for (let i = 0; i < systemsList.length; i++) {
        const system = systemsList[i];
        // Try multiple field name variations (OData can use different casing)
        const systemName = system.DISPLAYNAME || system.DisplayName || system.displayName ||
                          system.NAME || system.Name || system.name || `System ${i + 1}`;
        const systemUid = system.UId || system.Uid || system.UID || system.uid || system.Id || system.id;

        setProgress({
          current: i + 1,
          total: systemsList.length,
          currentSystem: systemName
        });

        try {
          // Fetch calculated assignments for this system
          // Signature: (identityUIds, bearerToken, impersonateUser, filters, pagination)
          const assignmentsResult = await omadaApi.assignment.getCalculatedAssignmentsDetailed(
            null, // No identity filter
            bearerToken,
            impersonateUser,
            { systemId: systemUid }, // Filter by system
            { page: 1, rows: assignmentsPerSystem }
          );

          const assignments = assignmentsResult.data || [];
          const totalAssignments = assignmentsResult.total || assignments.length;

          // Calculate statistics
          const stats = calculateComplianceStats(assignments);
          const accountCount = countUniqueAccounts(assignments);
          const identityCount = countUniqueIdentities(assignments);
          const multiPathStats = countMultiPathAssignments(assignments);

          // Extract description and systemType with multiple field name variations
          const description = system.DESCRIPTION || system.Description || system.description || '';
          const systemTypeObj = system.SYSTEMTYPE || system.SystemType || system.systemType;
          const systemType = systemTypeObj?.DisplayName || systemTypeObj?.Name || systemTypeObj?.displayName ||
                            systemTypeObj?.name || (typeof systemTypeObj === 'string' ? systemTypeObj : 'Unknown');

          systemsWithCompliance.push({
            id: systemUid,
            name: systemName,
            description,
            systemType,
            assignmentCount: totalAssignments,
            accountCount,
            identityCount,
            compliance: stats,
            multiPath: multiPathStats
          });

          console.log(`[useSystemCompliance] ${systemName}: ${totalAssignments} assignments, ${stats.complianceRate}% compliant`);
          console.log(`[useSystemCompliance] ${systemName} status breakdown:`, stats.byStatus);

        } catch (err) {
          console.warn(`[useSystemCompliance] Failed to fetch assignments for ${systemName}:`, err.message);
          // Include system with zero stats on error
          const description = system.DESCRIPTION || system.Description || system.description || '';
          const systemTypeObj = system.SYSTEMTYPE || system.SystemType || system.systemType;
          const systemType = systemTypeObj?.DisplayName || systemTypeObj?.Name || systemTypeObj?.displayName ||
                            systemTypeObj?.name || (typeof systemTypeObj === 'string' ? systemTypeObj : 'Unknown');

          systemsWithCompliance.push({
            id: systemUid,
            name: systemName,
            description,
            systemType,
            assignmentCount: 0,
            accountCount: 0,
            identityCount: 0,
            compliance: calculateComplianceStats([]),
            multiPath: { multiPathCount: 0, totalCount: 0, multiPathRate: 0 },
            error: err.message
          });
        }

        // Small delay to avoid overwhelming the API
        if (i < systemsList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Sort by account count (larger systems first for heatmap sizing)
      systemsWithCompliance.sort((a, b) => b.accountCount - a.accountCount);

      setSystems(systemsWithCompliance);
      console.log(`[useSystemCompliance] Completed. ${systemsWithCompliance.length} systems with compliance data.`);

      // Auto-export the data when fetched from API (for saving to local file)
      console.log('[useSystemCompliance] Exporting data for local caching...');
      exportHeatmapData(systemsWithCompliance);

    } catch (err) {
      console.error('[useSystemCompliance] Error:', err);
      setError(err.message || 'Failed to fetch compliance data');
    } finally {
      setIsLoading(false);
    }
  }, [bearerToken, impersonateUser, maxSystems, assignmentsPerSystem]);

  // Manual export function - call this to download the current data
  const exportData = useCallback(() => {
    if (systems.length > 0) {
      exportHeatmapData(systems);
    } else {
      console.warn('[useSystemCompliance] No data to export');
    }
  }, [systems]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchComplianceData();
  }, [fetchComplianceData]);

  return {
    systems,
    isLoading,
    error,
    progress,
    refetch: fetchComplianceData,
    exportData  // Call this to manually export/download the data as JSON
  };
};

export default useSystemCompliance;
