/**
 * useSystemCompliance Hook
 *
 * Fetches all systems from OData and their calculated assignments to build
 * compliance statistics for the heatmap visualization.
 */

import { useState, useEffect, useCallback } from 'react';
import { omadaApi } from '../services/omadaApi';

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
    // Validate bearerToken is a non-empty string
    if (!bearerToken || typeof bearerToken !== 'string') {
      console.log('[useSystemCompliance] No valid bearer token, skipping fetch. Got:', typeof bearerToken);
      return;
    }

    if (!impersonateUser) {
      console.log('[useSystemCompliance] No impersonateUser, skipping fetch');
      return;
    }

    setIsLoading(true);
    setError(null);
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
            compliance: stats
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

    } catch (err) {
      console.error('[useSystemCompliance] Error:', err);
      setError(err.message || 'Failed to fetch compliance data');
    } finally {
      setIsLoading(false);
    }
  }, [bearerToken, impersonateUser, maxSystems, assignmentsPerSystem]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchComplianceData();
  }, [fetchComplianceData]);

  return {
    systems,
    isLoading,
    error,
    progress,
    refetch: fetchComplianceData
  };
};

export default useSystemCompliance;
