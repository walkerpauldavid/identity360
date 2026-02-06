/**
 * useSystemCompliance Hook
 *
 * Fetches system compliance health data from the Compliance Workbench API
 * in a single GraphQL call, replacing the previous iterative approach.
 */

import { useState, useEffect, useCallback } from 'react';
import { omadaApi } from '../services/omadaApi';

/**
 * Transform complianceWorkbenchData API response into the heatmap data structure
 * @param {Array} workbenchData - Array of system entries from complianceWorkbenchData
 * @returns {Array} Array of system objects formatted for the heatmap
 */
const transformWorkbenchData = (workbenchData) => {
  if (!workbenchData || !Array.isArray(workbenchData)) return [];

  return workbenchData.map(entry => {
    const system = entry.system || {};
    const status = entry.complianceStatus || {};

    // Sum up all status counts
    const explicitlyApproved = status.explicitlyApproved || 0;
    const implicitlyApproved = status.implicitlyApproved || 0;
    const implicitlyAssigned = status.implicitlyAssigned || 0;
    const notApproved = status.notApproved || 0;
    const none = status.none || 0;
    const inViolation = status.inViolation || 0;
    const orphaned = status.orhpaned || 0;  // Note: API typo "orhpaned"
    const pendingDeprovisioning = status.pendingDeprovisioning || 0;

    // Categorise into compliant / non-compliant / pending
    const compliant = explicitlyApproved + implicitlyApproved;
    const nonCompliant = notApproved + inViolation + orphaned + none;
    const pending = pendingDeprovisioning + implicitlyAssigned;
    const total = compliant + nonCompliant + pending;
    const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 0;

    // Build byStatus breakdown using the original field names for display
    const byStatus = {};
    if (explicitlyApproved > 0) byStatus['Explicitly Approved'] = explicitlyApproved;
    if (implicitlyApproved > 0) byStatus['Implicitly Approved'] = implicitlyApproved;
    if (implicitlyAssigned > 0) byStatus['Implicitly Assigned'] = implicitlyAssigned;
    if (notApproved > 0) byStatus['Not Approved'] = notApproved;
    if (none > 0) byStatus['None'] = none;
    if (inViolation > 0) byStatus['In Violation'] = inViolation;
    if (orphaned > 0) byStatus['Orphan Assignment'] = orphaned;
    if (pendingDeprovisioning > 0) byStatus['Pending Deprovisioning'] = pendingDeprovisioning;

    return {
      id: system.id,
      name: system.name || 'Unknown System',
      systemCategory: system.systemCategory?.displayName || '',
      systemHealth: entry.systemHealth,
      assignmentCount: total,
      compliance: {
        total,
        compliant,
        nonCompliant,
        pending,
        complianceRate,
        byStatus
      }
    };
  });
};

/**
 * Hook to fetch system compliance data for heatmap
 *
 * @param {string} bearerToken - OAuth bearer token
 * @param {string} impersonateUser - User email for impersonation
 * @param {Object} options - Hook options (kept for API compatibility)
 * @returns {Object} { systems, isLoading, error, progress, refetch }
 */
export const useSystemCompliance = (bearerToken, impersonateUser, options = {}) => {
  const [systems, setSystems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentSystem: '' });

  const fetchComplianceData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Validate bearerToken is a non-empty string
    if (!bearerToken || typeof bearerToken !== 'string') {
      console.log('[useSystemCompliance] No valid bearer token, skipping fetch.');
      setIsLoading(false);
      return;
    }

    if (!impersonateUser) {
      console.log('[useSystemCompliance] No impersonateUser, skipping fetch');
      setIsLoading(false);
      return;
    }

    setProgress({ current: 0, total: 1, currentSystem: 'Fetching compliance data...' });

    try {
      console.log('[useSystemCompliance] Fetching from Compliance Workbench API...');

      const result = await omadaApi.compliance.getComplianceWorkbenchData(
        bearerToken,
        impersonateUser,
        { showAccounts: true }
      );

      if (result.status !== 'success' || !result.data) {
        throw new Error('Failed to fetch compliance workbench data');
      }

      const workbenchData = result.data;
      console.log(`[useSystemCompliance] Received ${workbenchData.length} systems from Compliance Workbench`);

      // Transform API response into heatmap data structure
      const systemsWithCompliance = transformWorkbenchData(workbenchData);

      // Sort by total assignments (larger systems first for heatmap sizing)
      systemsWithCompliance.sort((a, b) => b.assignmentCount - a.assignmentCount);

      setSystems(systemsWithCompliance);
      setProgress({ current: 1, total: 1, currentSystem: 'Complete' });

      console.log(`[useSystemCompliance] Completed. ${systemsWithCompliance.length} systems with compliance data.`);

    } catch (err) {
      console.error('[useSystemCompliance] Error:', err);
      setError(err.message || 'Failed to fetch compliance data');
    } finally {
      setIsLoading(false);
    }
  }, [bearerToken, impersonateUser]);

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
