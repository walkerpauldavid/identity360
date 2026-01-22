/**
 * usePolicyAnalysis Hook
 *
 * React hook to analyze policy assignments for a system.
 * Can be used in components or exposed to window for console debugging.
 *
 * Usage in component:
 *   const { analyze, isLoading, results, error } = usePolicyAnalysis();
 *   await analyze('35cc1d03-a6bd-46e5-95a8-77156232bf3d');
 *
 * Usage from browser console (after hook is mounted):
 *   window.policyAnalysis.analyze('35cc1d03-a6bd-46e5-95a8-77156232bf3d');
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { omadaApi } from '../services/omadaApi';
import {
  analyzeMultiplePolicyAssignments,
  quickCheckMultiplePolicies,
  fetchAllPagesForSystem,
  filterByReasonType,
  analyzeMultiplePolicies,
  saveToJsonFile,
  analyzeAndSave,
  fetchAndSaveRaw,
  fetchPolicyAssignmentsAndSave
} from '../utils/policyAssignmentDebug';

export function usePolicyAnalysis() {
  const { getBearerToken, user } = useAuth();
  const { getPreference } = usePreferences();
  const impersonateUser = user?.email;
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // Check if policy analysis debug is enabled in preferences
  const isDebugEnabled = getPreference('debugEnablePolicyAnalysis', true);

  // Get bearer token on mount to check if ready
  useEffect(() => {
    const initToken = async () => {
      try {
        const token = await getBearerToken();
        if (token) {
          setIsReady(true);
        }
      } catch (err) {
        console.error('[PolicyAnalysis] Failed to get bearer token:', err);
      }
    };
    initToken();
  }, [getBearerToken]);

  /**
   * Run full analysis for a system
   */
  const analyze = useCallback(async (systemId) => {
    const token = await getBearerToken();
    if (!token) {
      const err = new Error('API context not available. Make sure you are authenticated.');
      setError(err);
      console.error('[PolicyAnalysis]', err.message);
      return null;
    }

    setIsLoading(true);
    setError(null);
    setProgress({ currentPage: 0, totalPages: 0, fetchedSoFar: 0 });

    try {
      console.log('[PolicyAnalysis] Starting analysis for system:', systemId);

      const result = await analyzeMultiplePolicyAssignments(
        systemId,
        omadaApi,
        token,
        impersonateUser,
        (progressUpdate) => setProgress(progressUpdate)
      );

      setResults(result);
      console.log('[PolicyAnalysis] Analysis complete:', result.analysis.summary);
      return result;
    } catch (err) {
      console.error('[PolicyAnalysis] Error:', err);
      setError(err);
      return null;
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, [getBearerToken, impersonateUser]);

  /**
   * Quick check - just summary without raw data
   */
  const quickCheck = useCallback(async (systemId) => {
    const token = await getBearerToken();
    if (!token) {
      const err = new Error('API context not available. Make sure you are authenticated.');
      setError(err);
      console.error('[PolicyAnalysis]', err.message);
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await quickCheckMultiplePolicies(
        systemId,
        omadaApi,
        token,
        impersonateUser
      );

      setResults(result);
      return result;
    } catch (err) {
      console.error('[PolicyAnalysis] Error:', err);
      setError(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getBearerToken, impersonateUser]);

  /**
   * Fetch raw assignments (for custom analysis)
   */
  const fetchRaw = useCallback(async (systemId) => {
    const token = await getBearerToken();
    if (!token) {
      console.error('[PolicyAnalysis] API context not available');
      return null;
    }

    setIsLoading(true);
    try {
      const assignments = await fetchAllPagesForSystem(
        systemId,
        omadaApi,
        token,
        impersonateUser,
        (progressUpdate) => setProgress(progressUpdate)
      );
      return assignments;
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, [getBearerToken, impersonateUser]);

  /**
   * Analyze and save results to JSON file
   */
  const analyzeAndSaveToFile = useCallback(async (systemId, options = {}) => {
    const token = await getBearerToken();
    if (!token) {
      console.error('[PolicyAnalysis] API context not available');
      return null;
    }

    setIsLoading(true);
    setProgress({ currentPage: 0, totalPages: 0, fetchedSoFar: 0 });

    try {
      const result = await analyzeAndSave(
        systemId,
        omadaApi,
        token,
        impersonateUser,
        {
          ...options,
          onProgress: (progressUpdate) => setProgress(progressUpdate)
        }
      );
      setResults(result);
      return result;
    } catch (err) {
      console.error('[PolicyAnalysis] Error:', err);
      setError(err);
      return null;
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, [getBearerToken, impersonateUser]);

  /**
   * Fetch raw assignments and save to file
   */
  const fetchRawAndSave = useCallback(async (systemId) => {
    const token = await getBearerToken();
    if (!token) {
      console.error('[PolicyAnalysis] API context not available');
      return null;
    }

    setIsLoading(true);
    try {
      const assignments = await fetchAndSaveRaw(
        systemId,
        omadaApi,
        token,
        impersonateUser,
        (progressUpdate) => setProgress(progressUpdate)
      );
      return assignments;
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, [getBearerToken, impersonateUser]);

  /**
   * Fetch policy assignments only and save to file
   */
  const fetchPolicyAndSave = useCallback(async (systemId) => {
    const token = await getBearerToken();
    if (!token) {
      console.error('[PolicyAnalysis] API context not available');
      return null;
    }

    setIsLoading(true);
    try {
      const assignments = await fetchPolicyAssignmentsAndSave(
        systemId,
        omadaApi,
        token,
        impersonateUser,
        (progressUpdate) => setProgress(progressUpdate)
      );
      return assignments;
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, [getBearerToken, impersonateUser]);

  /**
   * Expose to window for console debugging (if enabled in preferences)
   */
  useEffect(() => {
    if (isReady && isDebugEnabled) {
      window.policyAnalysis = {
        // Analysis functions
        analyze: (systemId) => analyze(systemId),
        quickCheck: (systemId) => quickCheck(systemId),
        fetchRaw: (systemId) => fetchRaw(systemId),

        // Save to file functions
        analyzeAndSave: (systemId, options) => analyzeAndSaveToFile(systemId, options),
        fetchRawAndSave: (systemId) => fetchRawAndSave(systemId),
        fetchPolicyAndSave: (systemId) => fetchPolicyAndSave(systemId),
        saveToFile: saveToJsonFile,

        // Utility functions
        filterByReasonType,
        analyzeMultiplePolicies,

        // Quick helper with preset system ID
        analyzeActiveDirectory: () => analyzeAndSaveToFile('35cc1d03-a6bd-46e5-95a8-77156232bf3d'),

        help: () => {
          console.log(`
=== Policy Analysis Debug Helper ===

ANALYSIS COMMANDS (with file download):

1. Full analysis + save to file (RECOMMENDED):
   await window.policyAnalysis.analyzeAndSave('SYSTEM-UUID')
   // Downloads: policy-analysis-XXXXXXXX-2024-01-21T10-30-00.json

2. Full analysis + save WITH raw data (larger file):
   await window.policyAnalysis.analyzeAndSave('SYSTEM-UUID', { saveRawData: true })

3. Preset analysis for Active Directory:
   await window.policyAnalysis.analyzeActiveDirectory()

SAVE RAW DATA COMMANDS:

4. Fetch ALL assignments and save to file:
   await window.policyAnalysis.fetchRawAndSave('SYSTEM-UUID')
   // Downloads: raw-assignments-XXXXXXXX-2024-01-21T10-30-00.json

5. Fetch POLICY assignments only and save to file:
   await window.policyAnalysis.fetchPolicyAndSave('SYSTEM-UUID')
   // Downloads: policy-assignments-XXXXXXXX-2024-01-21T10-30-00.json

ANALYSIS WITHOUT FILE SAVE:

6. Analyze without saving (console only):
   const result = await window.policyAnalysis.analyze('SYSTEM-UUID')

7. Quick check (summary only):
   const summary = await window.policyAnalysis.quickCheck('SYSTEM-UUID')

8. Fetch raw data (no save):
   const data = await window.policyAnalysis.fetchRaw('SYSTEM-UUID')

UTILITY FUNCTIONS:

9. Save any data to JSON file:
   window.policyAnalysis.saveToFile(myData, 'my-filename')

10. Filter data by reason type:
    const policies = window.policyAnalysis.filterByReasonType(data, 'Policy')

11. Analyze filtered data:
    const analysis = window.policyAnalysis.analyzeMultiplePolicies(policies)

YOUR SYSTEM ID: 35cc1d03-a6bd-46e5-95a8-77156232bf3d

QUICK START:
   await window.policyAnalysis.analyzeActiveDirectory()
          `);
        }
      };

      console.log('[PolicyAnalysis] Debug helper available. Type window.policyAnalysis.help() for usage.');
    } else if (isReady && !isDebugEnabled) {
      // Clean up if disabled
      if (window.policyAnalysis) {
        delete window.policyAnalysis;
        console.log('[PolicyAnalysis] Debug helper disabled via preferences.');
      }
    }

    return () => {
      delete window.policyAnalysis;
    };
  }, [isReady, isDebugEnabled, analyze, quickCheck, fetchRaw, analyzeAndSaveToFile, fetchRawAndSave, fetchPolicyAndSave]);

  return {
    // Analysis functions
    analyze,
    quickCheck,
    fetchRaw,
    // Save to file functions
    analyzeAndSave: analyzeAndSaveToFile,
    fetchRawAndSave,
    fetchPolicyAndSave,
    saveToFile: saveToJsonFile,
    // State
    isLoading,
    progress,
    results,
    error,
    isReady,
    // Utility functions
    filterByReasonType,
    analyzeMultiplePolicies
  };
}

export default usePolicyAnalysis;
