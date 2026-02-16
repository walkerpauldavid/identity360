/**
 * Identity360 Page
 * Standalone fullscreen page for the Identity360 component
 * Prompts for identity selection when opened from toolbar
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePreferences } from '../../contexts/PreferencesContext';
import { omadaApi } from '../../services/omadaApi';
import Navbar from '../layout/Navbar';
import AccessLens from './AccessLens';
import IdentitySearchDialog from './IdentitySearchDialog';
import { LaneSchema, LaneTypes, shouldLog } from './accessLensTypes';
import { usePolicyAnalysis } from '../../hooks/usePolicyAnalysis';
import './AccessLensPage.css';

/**
 * Build reverse lookup maps for identity details to avoid O(n×m) fallback scans
 * (H-03/NEW-1 fix: pre-build lookup maps before enrichment loops)
 * @param {Object} identityDetailsMap - Map of identity details keyed by some ID
 * @returns {Object} Object with uIdMap and idMap for O(1) lookups by UId or Id
 */
const buildIdentityLookupMaps = (identityDetailsMap) => {
  const uIdMap = new Map();
  const idMap = new Map();

  for (const details of Object.values(identityDetailsMap)) {
    if (details.UId) uIdMap.set(String(details.UId), details);
    if (details.Id) idMap.set(String(details.Id), details);
  }

  return { uIdMap, idMap };
};

/**
 * Find identity details using pre-built lookup maps (O(1) instead of O(n))
 * @param {Object} identityDetailsMap - Original map for direct lookup
 * @param {Map} uIdMap - Pre-built UId lookup map
 * @param {Map} idMap - Pre-built Id lookup map
 * @param {string} identityId - The identity ID to look up
 * @returns {Object|undefined} The identity details or undefined
 */
const findIdentityDetails = (identityDetailsMap, uIdMap, idMap, identityId) => {
  // Try direct lookup first
  let details = identityDetailsMap[identityId];
  if (details) return details;

  // Use pre-built maps for O(1) fallback lookups instead of O(n) scan
  details = uIdMap.get(identityId) || idMap.get(identityId);
  return details;
};

const AccessLensPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getBearerToken, user } = useAuth();
  const { preferences } = usePreferences();

  // Get user preference for including disabled assignments (default: true)
  const includeDisabledAssignments = preferences.identity360ShowDisabledAssignments ?? true;

  // Initialize policy analysis debug helper (exposes window.policyAnalysis)
  usePolicyAnalysis();

  // Note: No default identity - user must select one via search dialog or URL parameter

  // State for identity selection
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  // Start with loading=true so the loading screen shows immediately (no flash of empty content)
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...'); // Current loading step description
  const [loadError, setLoadError] = useState(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // State for system-centric view (when navigating from heatmap)
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [systemLanes, setSystemLanes] = useState(null);
  const [systemReasonTypes, setSystemReasonTypes] = useState([]);
  const [systemComplianceStatuses, setSystemComplianceStatuses] = useState([]);

  // Cache hit visual feedback — spinner flashes green on IndexedDB cache hits
  const [cacheHitFlash, setCacheHitFlash] = useState(false);
  const cacheHitTimer = useRef(null);

  useEffect(() => {
    const handler = () => {
      setCacheHitFlash(true);
      // Clear any pending timer so rapid hits extend the flash
      if (cacheHitTimer.current) clearTimeout(cacheHitTimer.current);
      cacheHitTimer.current = setTimeout(() => setCacheHitFlash(false), 300);
    };
    window.addEventListener('omada-cache-hit', handler);
    return () => {
      window.removeEventListener('omada-cache-hit', handler);
      if (cacheHitTimer.current) clearTimeout(cacheHitTimer.current);
    };
  }, []);

  // Listen for toolbar Identity360 button clicks to reopen search dialog
  useEffect(() => {
    const handleOpenSearch = () => setShowSearchDialog(true);
    window.addEventListener('identity360-open-search', handleOpenSearch);
    return () => window.removeEventListener('identity360-open-search', handleOpenSearch);
  }, []);

  // On mount: Check URL for identity or system parameter
  useEffect(() => {
    if (initialLoadDone) return;

    const identityParam = searchParams.get('identity');
    const systemParam = searchParams.get('system');

    if (systemParam) {
      // System ID provided in URL - load system-centric view
      // System name will be fetched from OData using the system ID
      if (shouldLog('INIT')) console.log('[URL Init] System param detected:', systemParam);
      loadSystemData(systemParam);
    } else if (identityParam) {
      if (shouldLog('INIT')) console.log('[URL Init] Identity param detected:', identityParam);
      // Identity UId provided in URL - create a temporary identity object and load data
      const identityFromUrl = { UId: identityParam };
      setSelectedIdentity(identityFromUrl);
      // loadIdentityData will be called by the next effect
    } else {
      // No URL params - show search dialog for identity selection
      // Stop loading state since we're waiting for user input
      setIsLoadingData(false);
      setLoadingStatus('');
      setShowSearchDialog(true);
    }

    setInitialLoadDone(true);
  }, [searchParams, initialLoadDone]);

  // Load data when selectedIdentity changes
  useEffect(() => {
    if (selectedIdentity?.UId && initialLoadDone) {
      loadIdentityData(selectedIdentity);
    }
  }, [selectedIdentity?.UId, initialLoadDone]);

  // Data loaded from APIs
  const [calculatedAssignments, setCalculatedAssignments] = useState(null);
  const [identityContexts, setIdentityContexts] = useState(null);
  const [systemDetailsMap, setSystemDetailsMap] = useState({});  // Map of systemId -> system details from OData

  /**
   * Fetch system details from OData by system UId (UUID)
   * Extracts: SYSTEMTYPE, DESCRIPTION, OWNERREF, CLT_TAGS (classification)
   * @param {string} systemUId - The system UId (UUID format from GraphQL)
   * @returns {Promise<object>} System details from OData
   */
  const fetchSystemDetails = useCallback(async (systemUId, bearerToken, impersonateUser) => {
    try {
      // OData query: /OData/DataObjects/System?$filter=UId eq {systemUId}
      // Note: UId is a UUID string, so it needs to be passed as a GUID
      // Don't use $select - OData reference properties (OWNERREF, CLT_TAGS, SYSTEMTYPE) may not work with $select
      const result = await omadaApi.odata.query(
        'System',
        bearerToken,
        impersonateUser,
        {
          filter: `UId eq ${systemUId}`
        }
      );

      if (result.status === 'success' && result.data?.length > 0) {
        return result.data[0];
      }
      return null;
    } catch (err) {
      return null;
    }
  }, []);

  /**
   * Fetch identity details from OData by userName (IDENTITYID filter)
   * Used for Request requester lookup where GraphQL id is not a valid OData UId.
   * @param {string} userName - The identity userName (email-format identifier from GraphQL)
   * @returns {Promise<object>} Identity details from OData
   */
  const fetchIdentityDetailsByUserName = useCallback(async (userName, bearerToken, impersonateUser) => {
    if (!userName) return null;
    try {
      const result = await omadaApi.identity.searchIdentities(
        null,
        bearerToken,
        impersonateUser,
        {
          filter: `IDENTITYID eq '${userName}'`,
          select: 'UId,Id,FIRSTNAME,LASTNAME,DISPLAYNAME,EMAIL,EMPLOYEEID,IDENTITYID,JOBTITLE,OUREF,IDENTITYCATEGORY,IDENTITYSTATUS,RISKLEVEL'
        }
      );
      if (result.status === 'success' && result.data?.length > 0) {
        return result.data[0];
      }
      return null;
    } catch (err) {
      return null;
    }
  }, []);

  /**
   * Fetch identity details from OData by identity UId (UUID)
   * Extracts: EMAIL, JOBTITLE, EMPLOYEEID, DEPARTMENT, etc.
   * @param {string} identityUId - The identity UId (UUID format from GraphQL)
   * @returns {Promise<object>} Identity details from OData
   */
  const fetchIdentityDetails = useCallback(async (identityUId, bearerToken, impersonateUser) => {
    try {
      // Use the same method as loadIdentityData - omadaApi.identity.searchIdentities
      const result = await omadaApi.identity.searchIdentities(
        null, // No search filter
        bearerToken,
        impersonateUser,
        {
          filter: `UId eq ${identityUId}`,
          select: 'UId,Id,FIRSTNAME,LASTNAME,DISPLAYNAME,EMAIL,EMPLOYEEID,IDENTITYID,JOBTITLE,OUREF,IDENTITYCATEGORY,IDENTITYSTATUS,RISKLEVEL'
        }
      );

      if (result.status === 'success' && result.data?.length > 0) {
        return result.data[0];
      }
      return null;
    } catch (err) {
      return null;
    }
  }, []);

  /**
   * Fetch details for all unique identities from assignments
   * @param {Array} assignments - Array of calculated assignments
   * @returns {Promise<Object>} Map of identityId -> identity details
   */
  const fetchAllIdentityDetails = useCallback(async (assignments, bearerToken, impersonateUser) => {
    if (!assignments || assignments.length === 0) {
      return {};
    }

    // Extract unique identity IDs from assignments
    const identityIdsSet = new Set();
    assignments.forEach((assignment) => {
      const identityId = assignment.identity?.id;
      if (identityId) {
        identityIdsSet.add(identityId);
      }
    });

    const identityIds = Array.from(identityIdsSet);

    if (identityIds.length === 0) {
      return {};
    }

    // Fetch identity details in small batches to avoid overwhelming the browser
    // Chrome limits concurrent connections to ~6 per domain, so we batch conservatively
    const batchSize = 5;  // Reduced from 10 to avoid ERR_INSUFFICIENT_RESOURCES
    const detailsMap = {};

    for (let i = 0; i < identityIds.length; i += batchSize) {
      const batch = identityIds.slice(i, i + batchSize);

      const batchPromises = batch.map(id =>
        fetchIdentityDetails(id, bearerToken, impersonateUser)
      );
      const batchResults = await Promise.all(batchPromises);

      batch.forEach((id, index) => {
        if (batchResults[index]) {
          // Use string key for consistent lookup
          detailsMap[String(id)] = batchResults[index];
        }
      });

      // Yield to the event loop between batches so the UI thread can paint
      if (i + batchSize < identityIds.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return detailsMap;
  }, [fetchIdentityDetails]);

  /**
   * Fetch details for all unique systems from assignments
   * @param {Array} assignments - Array of calculated assignments
   * @returns {Promise<Object>} Map of systemId -> system details
   */
  const fetchAllSystemDetails = useCallback(async (assignments, bearerToken, impersonateUser) => {
    if (!assignments || assignments.length === 0) {
      return {};
    }

    // Extract unique system IDs from both account.system and resource.system
    const systemIdsSet = new Set();

    assignments.forEach((assignment) => {
      // From account's system
      const accountSystemId = assignment.account?.system?.id;
      if (accountSystemId) {
        systemIdsSet.add(accountSystemId);
      }

      // From resource's system (may be different, e.g., logical applications)
      const resourceSystemId = assignment.resource?.system?.id;
      if (resourceSystemId) {
        systemIdsSet.add(resourceSystemId);
      }
    });

    const systemIds = Array.from(systemIdsSet);

    if (systemIds.length === 0) {
      return {};
    }

    // Fetch system details in small batches to avoid overwhelming the browser
    // Chrome limits concurrent connections to ~6 per domain
    const batchSize = 5;
    const detailsMap = {};

    for (let i = 0; i < systemIds.length; i += batchSize) {
      const batch = systemIds.slice(i, i + batchSize);

      const batchPromises = batch.map(id =>
        fetchSystemDetails(id, bearerToken, impersonateUser)
      );
      const batchResults = await Promise.all(batchPromises);

      batch.forEach((id, index) => {
        if (batchResults[index]) {
          detailsMap[id] = batchResults[index];
        }
      });

      // Yield to the event loop between batches so the UI thread can paint
      if (i + batchSize < systemIds.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return detailsMap;
  }, [fetchSystemDetails]);

  // Load data when identity is selected
  const loadIdentityData = useCallback(async (identity) => {
    if (!identity?.UId) return;

    setIsLoadingData(true);
    setLoadError(null);
    setLoadingStatus('Retrieving identity profile...');

    try {
      const bearerToken = getBearerToken();
      const impersonateUser = user?.email;

      // Fetch full identity details via OData
      // Note: DESCRIPTION is not available on Identity entity type
      // IDENTITYID is the employee/identity ID displayed to users (e.g., EMP12345)
      const identityResult = await omadaApi.identity.searchIdentities(
        null, // No filter
        bearerToken,
        impersonateUser,
        {
          filter: `UId eq ${identity.UId}`,
          select: 'UId,Id,FIRSTNAME,LASTNAME,DISPLAYNAME,EMAIL,EMPLOYEEID,IDENTITYID,JOBTITLE,OUREF,IDENTITYCATEGORY,IDENTITYSTATUS,RISKLEVEL'
        }
      );

      if (identityResult.status === 'success' && identityResult.data?.length > 0) {
        const fullIdentity = identityResult.data[0];
        setSelectedIdentity(fullIdentity);
      }

      // Update status for assignments fetch
      setLoadingStatus('Calculating effective access assignments...');

      // Call assignments and contexts APIs in parallel
      const [assignmentsResult, contextsResult] = await Promise.all([
        omadaApi.assignment.getCalculatedAssignmentsDetailed(
          identity.UId,
          bearerToken,
          impersonateUser,
          { includeDisabled: includeDisabledAssignments },
          { page: 1, rows: 100 }
        ),
        omadaApi.identity.getIdentityContexts(
          identity.UId,
          bearerToken,
          impersonateUser
        )
      ]);

      if (assignmentsResult.status === 'success') {
        const assignmentCount = assignmentsResult.data?.length || 0;

        // Debug logging for identity assignments
        if (shouldLog('INIT')) {
          console.log('[Identity Load] Total assignments:', assignmentCount);
          if (assignmentsResult.data && assignmentsResult.data.length > 0) {
            const withResource = assignmentsResult.data.filter(a => a.resource).length;
            const withResourceId = assignmentsResult.data.filter(a => a.resource?.id).length;
            console.log('[Identity Load] Assignments with resource:', withResource, '| with resource.id:', withResourceId);
            console.log('[Identity Load] First assignment resource:', assignmentsResult.data[0].resource ? {
              id: assignmentsResult.data[0].resource.id,
              name: assignmentsResult.data[0].resource.name,
              type: assignmentsResult.data[0].resource.resourceType?.name
            } : 'NULL');
          }
        }

        setCalculatedAssignments(assignmentsResult.data);

        // Update status for system details fetch
        setLoadingStatus(`Enriching system metadata for ${assignmentCount} assignments...`);

        // Fetch system details for all unique systems in the assignments
        const systemDetails = await fetchAllSystemDetails(
          assignmentsResult.data,
          bearerToken,
          impersonateUser
        );
        setSystemDetailsMap(systemDetails);

        // Update status for final processing
        setLoadingStatus('Building access relationship graph...');
      }

      if (contextsResult.status === 'success') {
        setIdentityContexts(contextsResult.data);
      }

    } catch (err) {
      setLoadError(err.message || 'Failed to load identity data');
    } finally {
      setIsLoadingData(false);
      setLoadingStatus('');
    }
  }, [getBearerToken, user, fetchAllSystemDetails]);

  // Load data when system ID is provided (from heatmap navigation or URL)
  // System details (name, type, etc.) are fetched from OData using the system UUID
  const loadSystemData = useCallback(async (systemId) => {
    if (shouldLog('SYSTEMS')) console.log('[loadSystemData] CALLED with systemId:', systemId);
    if (!systemId) return;

    setIsLoadingData(true);
    setLoadError(null);
    setLoadingStatus('Fetching system details...');

    try {
      const bearerToken = getBearerToken();
      const impersonateUser = user?.email;

      // Fetch system details from OData using system UUID
      let systemDetails = null;
      try {
        const systemResult = await omadaApi.odata.query(
          'System',
          bearerToken,
          impersonateUser,
          {
            filter: `UId eq ${systemId}`
          }
        );

        if (systemResult.status === 'success' && systemResult.data?.length > 0) {
          systemDetails = systemResult.data[0];
        }
      } catch (err) {
        // Could not load system details from OData - continue with basic info
      }

      // Create a system node for the focus - all details come from OData
      // Try multiple field name variations since OData field names can vary
      const systemDisplayName = systemDetails?.DISPLAYNAME
        || systemDetails?.DisplayName
        || systemDetails?.Name
        || systemDetails?.name
        || 'Unknown System';

      const systemNode = {
        id: systemId,
        type: 'System',
        displayName: systemDisplayName,
        metadata: {
          systemType: systemDetails?.SYSTEMTYPE?.DisplayName || systemDetails?.SYSTEMTYPE?.Name || systemDetails?.SYSTEMTYPE || 'Unknown',
          description: systemDetails?.DESCRIPTION || systemDetails?.Description || '',
          owner: systemDetails?.OWNERREF?.DisplayName || systemDetails?.OWNERREF?.DisplayNameValue || null
        },
        rawData: systemDetails || { id: systemId },
        status: 'active',
        badges: []
      };

      setSelectedSystem(systemNode);
      setLoadingStatus('Calculating access assignments for system...');

      // Fetch assignments for this system
      if (shouldLog('SYSTEMS')) {
        console.log('[System API] Fetching calculatedAssignments for systemId:', systemId);
      }

      const assignmentsResult = await omadaApi.assignment.getCalculatedAssignmentsDetailed(
        null, // No identity filter - we're filtering by system instead
        bearerToken,
        impersonateUser,
        { systemId: systemId, includeDisabled: includeDisabledAssignments },
        { page: 1, rows: 5000 } // Large page size to fetch all assignments
      );

      // Debug logging for system API response
      if (shouldLog('SYSTEMS')) {
        console.log('[System API] Response:', assignmentsResult.status, '- Total:', assignmentsResult.total);
        if (assignmentsResult.data && assignmentsResult.data.length > 0) {
          const withResource = assignmentsResult.data.filter(a => a.resource).length;
          const withResourceId = assignmentsResult.data.filter(a => a.resource?.id).length;
          const withResourceName = assignmentsResult.data.filter(a => a.resource?.name).length;
          console.log('[System API] Assignments breakdown:');
          console.log('  - Total:', assignmentsResult.data.length);
          console.log('  - With resource object:', withResource);
          console.log('  - With resource.id:', withResourceId);
          console.log('  - With resource.name:', withResourceName);
          // Log first 3 assignments to compare structure
          console.log('[System API] First 3 assignments:');
          assignmentsResult.data.slice(0, 3).forEach((a, i) => {
            console.log(`  [${i}] resource:`, a.resource ? { id: a.resource.id, name: a.resource.name, type: a.resource.resourceType?.name } : 'NULL');
            console.log(`  [${i}] account:`, a.account ? { id: a.account.id, name: a.account.accountName, system: a.account.system?.name } : 'NULL');
          });
        }
      }

      if (assignmentsResult.status === 'success') {

        setLoadingStatus('Building access relationship graph...');

        // Import and use the data service functions
        const { buildLanesFromAssignments, extractUniqueReasonTypes, extractUniqueComplianceStatuses } =
          await import('./accessLensDataService');

        // Build lanes for system-centric view (includes Identities lane and Logical Apps if applicable)
        let lanes = buildLanesFromAssignments(assignmentsResult.data, {}, {
          includeIdentities: true,
          focusSystemId: systemId  // Pass system ID to build Logical Apps lane
        });
        const reasonTypes = extractUniqueReasonTypes(assignmentsResult.data);
        const complianceStatuses = extractUniqueComplianceStatuses(assignmentsResult.data);

        if (shouldLog('LANES')) {
          console.log('[Lane Building] Built', lanes.length, 'system-centric lanes');
          lanes.forEach(lane => {
            console.log(`  - ${lane.laneType}: ${lane.items.length} items`);
          });
        }

        // IDENTITY ENRICHMENT - Fetch OData details for identities in the lane
        setLoadingStatus('Enriching identity details...');

        // Find the Identities lane to enrich
        const identitiesLane = lanes.find(l => l.laneType === 'Identities');

        let identityDetailsMap = {};
        try {
          identityDetailsMap = await fetchAllIdentityDetails(assignmentsResult.data, bearerToken, impersonateUser);
          if (shouldLog('INIT')) {
            console.log('[Identity Enrichment] Retrieved details for', Object.keys(identityDetailsMap).length, 'identities');
          }
        } catch (enrichError) {
          console.error('[Identity Enrichment] ERROR:', enrichError.message);
        }

        // Apply identity enrichment to the Identities lane
        const mapKeys = Object.keys(identityDetailsMap);

        if (mapKeys.length > 0 && identitiesLane) {
          // H-03/NEW-1 fix: Pre-build lookup maps for O(1) fallback instead of O(n) scan
          const { uIdMap, idMap } = buildIdentityLookupMaps(identityDetailsMap);

          lanes = lanes.map(lane => {
            if (lane.laneType === 'Identities') {
              const enrichedItems = lane.items.map((item) => {
                const identityId = String(item.node.id);
                // Use helper function with pre-built maps for O(1) lookups
                const odataDetails = findIdentityDetails(identityDetailsMap, uIdMap, idMap, identityId);

                if (odataDetails) {
                  // Enrich the node with OData details
                  return {
                    ...item,
                    node: {
                      ...item.node,
                      metadata: {
                        ...item.node.metadata,
                        email: odataDetails.EMAIL,
                        title: odataDetails.JOBTITLE,
                        employeeId: odataDetails.EMPLOYEEID || odataDetails.IDENTITYID,
                        department: odataDetails.DEPARTMENT,
                        category: odataDetails.IDENTITYCATEGORY?.DisplayName,
                        status: odataDetails.IDENTITYSTATUS?.DisplayName
                      },
                      rawData: {
                        ...item.node.rawData,
                        ...odataDetails
                      }
                    },
                    rawData: {
                      ...item.rawData,
                      ...odataDetails
                    }
                  };
                }
                return item;
              });

              return {
                ...lane,
                items: enrichedItems,
                allItemsData: enrichedItems
              };
            }
            return lane;
          });
        }

        setSystemLanes(lanes);
        setSystemReasonTypes(reasonTypes);
        setSystemComplianceStatuses(complianceStatuses);
      } else {
        console.warn('Failed to load system assignments:', assignmentsResult);
        setLoadError('Failed to load system access data');
      }

    } catch (err) {
      console.error('Error loading system data:', err);
      setLoadError(err.message || 'Failed to load system data');
    } finally {
      setIsLoadingData(false);
      setLoadingStatus('');
    }
  }, [getBearerToken, user, fetchAllIdentityDetails]);

  // Handle identity selection from dialog
  const handleIdentitySelect = useCallback((identity) => {
    // Clear any system selection when switching to identity
    setSelectedSystem(null);
    setSystemLanes(null);
    setSelectedIdentity(identity);
    setShowSearchDialog(false);
    loadIdentityData(identity);
  }, [loadIdentityData]);

  // Handle reopening search dialog
  const handleChangeIdentity = useCallback(() => {
    setShowSearchDialog(true);
  }, []);

  /**
   * Fetch full object details from OData when a lane item is clicked
   * Uses the LaneSchema to determine the correct endpoint and filter field
   * @param {string} laneType - The type of lane (e.g., 'Systems', 'Accounts')
   * @param {object} item - The clicked item with node data
   * @returns {Promise<object>} The full object details from OData
   */
  const fetchObjectDetails = useCallback(async (laneType, item, context = {}) => {
    const laneConfig = LaneSchema[laneType];
    if (!laneConfig?.apiSource) {
      console.warn('No API source configured for lane type:', laneType);
      return null;
    }

    const { apiSource, inspectorConfig } = laneConfig;

    // Only handle OData sources for now
    if (apiSource.type !== 'OData') {
      return { data: item.node?.rawData || item.rawData || item.node, inspectorConfig };
    }

    const { endpoint, filterField } = apiSource;

    // Get the value to filter by (use displayName for name-based filters)
    const filterValue = item.node?.displayName || item.node?.name || item.node?.Name;

    if (!filterValue) {
      return null;
    }

    try {
      const bearerToken = getBearerToken();
      const impersonateUser = user?.email;

      // Build the OData query
      const result = await omadaApi.odata.query(
        endpoint,
        bearerToken,
        impersonateUser,
        {
          filter: `${filterField} eq '${filterValue}'`
        }
      );

      if (result.status === 'success' && result.data?.length > 0) {
        // Fetch assigned identities for entitlements in Request pivot
        let relatedIdentities = null;

        if (laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS && context.focusNodeType === 'Request') {
          const resourceId = item.node?.id || item.node?.rawData?.id;
          if (resourceId) {
            try {
              const assignmentResult = await omadaApi.assignment.getIdentitiesHavingResource(
                resourceId, null, bearerToken, impersonateUser,
                { page: 1, rows: 100 },
                null, null, includeDisabledAssignments
              );
              if (assignmentResult.status === 'success' && assignmentResult.data?.length > 0) {
                const identityMap = new Map();
                assignmentResult.data.forEach(assignment => {
                  const identity = assignment.identity;
                  if (identity?.id && !identityMap.has(identity.id)) {
                    identityMap.set(identity.id, {
                      displayName: identity.displayName || `${identity.firstName || ''} ${identity.lastName || ''}`.trim(),
                      email: identity.identityId || '',
                      firstName: identity.firstName,
                      lastName: identity.lastName
                    });
                  }
                });
                relatedIdentities = Array.from(identityMap.values());
              }
            } catch (err) {
              // Non-critical — skip identity list
            }
          }
        }

        return {
          data: result.data[0],
          relatedIdentities,
          inspectorConfig,
          objectType: laneConfig.dataType,
          laneType
        };
      }
      return null;
    } catch (err) {
      console.error(`Error fetching ${endpoint} details:`, err.message);
      return null;
    }
  }, [getBearerToken, user, includeDisabledAssignments]);

  /**
   * Handle pivot to a different node - fetch data appropriate for that node type
   * and return the focus node with its lanes
   * @param {object} node - The node being pivoted to (from a lane item)
   * @param {object} filters - Optional filters to apply (e.g., { complianceStatus: 'Not Approved' })
   * @returns {Promise<object>} The pivot result with focusNode and lanes
   */
  const handlePivotToNode = useCallback(async (node, filters = {}) => {
    if (shouldLog('PIVOT')) {
      console.log('[Pivot] handlePivotToNode called:', node?.type, node?.displayName, node?.id);
    }

    if (!node) return null;

    const bearerToken = getBearerToken();
    const impersonateUser = user?.email;

    try {
      // Import all data service functions once (avoids redundant dynamic imports per switch case)
      const {
        buildLanesFromAssignments,
        extractUniqueReasonTypes,
        extractUniqueComplianceStatuses,
        buildContextsLane,
        buildLanesForEntitlement,
        buildContextsLaneFromAPData,
        buildSystemsLane,
        buildEntitlementsLaneFromAPResources,
        buildResourceLaneForRequest,
        buildSystemLaneForRequest,
        buildRequesterIdentityLaneForRequest,
        buildBeneficiaryIdentityLaneForRequest,
        buildApproversLaneForRequest
      } = await import('./accessLensDataService');

      // Different handling based on node type
      switch (node.type) {
        case 'Identity': {
          // Pivoting to an Identity - fetch their calculated assignments
          // Get the identity UId from the node
          const identityUId = node.id || node.rawData?.UId || node.metadata?.UId;
          if (!identityUId) {
            console.error('No identity UId found in node');
            return null;
          }

          // Fetch assignments and contexts for this identity
          const [assignmentsResult, contextsResult] = await Promise.all([
            omadaApi.assignment.getCalculatedAssignmentsDetailed(
              identityUId,
              bearerToken,
              impersonateUser,
              { includeDisabled: includeDisabledAssignments },
              { page: 1, rows: 100 }
            ),
            omadaApi.identity.getIdentityContexts(
              identityUId,
              bearerToken,
              impersonateUser
            )
          ]);

          let lanes = [];
          let reasonTypes = [];
          let complianceStatuses = [];

          if (assignmentsResult.status === 'success') {
            // Debug logging for identity-centric assignments
            if (shouldLog('PIVOT')) {
              console.log('[Identity API] Response - Total:', assignmentsResult.total);
              if (assignmentsResult.data && assignmentsResult.data.length > 0) {
                const withResource = assignmentsResult.data.filter(a => a.resource).length;
                console.log('[Identity API] Assignments with resource:', withResource, 'of', assignmentsResult.data.length);
                console.log('[Identity API] First assignment resource:', assignmentsResult.data[0].resource ? {
                  id: assignmentsResult.data[0].resource.id,
                  name: assignmentsResult.data[0].resource.name,
                  type: assignmentsResult.data[0].resource.resourceType?.name
                } : 'NULL');
              }
            }
            lanes = buildLanesFromAssignments(assignmentsResult.data, {});
            reasonTypes = extractUniqueReasonTypes(assignmentsResult.data);
            complianceStatuses = extractUniqueComplianceStatuses(assignmentsResult.data);
          }

          // Build contexts lane if available
          if (contextsResult.status === 'success' && contextsResult.data?.length > 0) {
            const contextsLane = buildContextsLane(contextsResult.data, {});
            if (contextsLane) {
              lanes.push(contextsLane);
            }
          }

          return {
            focusNode: node,
            lanes,
            reasonTypes,
            complianceStatuses,
            assignments: assignmentsResult.status === 'success' ? assignmentsResult.data : []
          };
        }

        case 'System': {
          if (shouldLog('PIVOT')) console.log('[System Pivot] ENTERED System case');
          // Pivoting to a System - fetch assignments for that system
          // Get the system ID from the node - could be in different places
          const systemId = node.id || node.rawData?.Id || node.rawData?.id || node.rawData?.UId || node.metadata?.id;
          const systemName = node.displayName || node.rawData?.Name || node.rawData?.name || node.rawData?.DISPLAYNAME;
          if (shouldLog('PIVOT')) console.log('[System Pivot] systemId:', systemId, 'systemName:', systemName);

          if (!systemId) {
            console.error('No system ID found in node');
            return null;
          }

          // Fetch system details from OData to enrich the focus node (same as direct load)
          let systemDetails = null;
          try {
            const systemODataResult = await omadaApi.odata.query(
              'System',
              bearerToken,
              impersonateUser,
              { filter: `UId eq ${systemId}` }
            );
            if (systemODataResult.status === 'success' && systemODataResult.data?.length > 0) {
              systemDetails = systemODataResult.data[0];
            }
          } catch (err) {
            // Silently continue - we'll use node data as fallback
          }

          // Create enriched system node (same structure as direct load)
          const enrichedSystemNode = {
            id: systemId,
            type: 'System',
            displayName: systemDetails?.DISPLAYNAME || systemDetails?.DisplayName || systemDetails?.Name || systemName || 'Unknown System',
            metadata: {
              systemType: systemDetails?.SYSTEMTYPE?.DisplayName || systemDetails?.SYSTEMTYPE?.Name || node.metadata?.systemType || 'Unknown',
              description: systemDetails?.DESCRIPTION || systemDetails?.Description || node.metadata?.description || '',
              owner: systemDetails?.OWNERREF?.DisplayName || systemDetails?.OWNERREF?.DisplayNameValue || node.metadata?.owner || null
            },
            rawData: systemDetails || node.rawData || { id: systemId },
            status: 'active',
            badges: node.badges || []
          };

          // Fetch assignments with large page size to get all results
          if (shouldLog('PIVOT')) console.log('[System Pivot] Fetching assignments for systemId:', systemId);
          const assignmentsResult = await omadaApi.assignment.getCalculatedAssignmentsDetailed(
            null, // No identity filter - we're filtering by system instead
            bearerToken,
            impersonateUser,
            { systemId: systemId, includeDisabled: includeDisabledAssignments }, // Filter by system ID
            { page: 1, rows: 5000 } // Large page size to fetch all assignments
          );

          // Debug logging for system pivot assignments
          if (shouldLog('PIVOT')) {
            console.log('[System Pivot] Response - Total:', assignmentsResult.total, 'Status:', assignmentsResult.status);
            if (assignmentsResult.data && assignmentsResult.data.length > 0) {
              const withResource = assignmentsResult.data.filter(a => a.resource).length;
              console.log('[System Pivot] Assignments with resource:', withResource, 'of', assignmentsResult.data.length);
              console.log('[System Pivot] First assignment resource:', assignmentsResult.data[0].resource ? {
                id: assignmentsResult.data[0].resource.id,
                name: assignmentsResult.data[0].resource.name,
                type: assignmentsResult.data[0].resource.resourceType?.name
              } : 'NULL');
            }
          }

          let lanes = [];
          let reasonTypes = [];
          let complianceStatuses = [];

          if (assignmentsResult.status === 'success') {
            // Build lanes for system-centric view:
            // - Identities (who has access to this system)
            // - Accounts (accounts on this system)
            // - Entitlements (resources on this system)
            // - Logical Applications (apps implemented by this system)
            lanes = buildLanesFromAssignments(assignmentsResult.data, {}, {
              includeIdentities: true,
              focusSystemId: systemId
            });
            reasonTypes = extractUniqueReasonTypes(assignmentsResult.data);

            complianceStatuses = extractUniqueComplianceStatuses(assignmentsResult.data);

            // IDENTITY ENRICHMENT - Fetch OData details for identities in the lane
            const identitiesLane = lanes.find(l => l.laneType === 'Identities');
            if (identitiesLane) {
              try {
                const identityDetailsMap = await fetchAllIdentityDetails(assignmentsResult.data, bearerToken, impersonateUser);
                if (Object.keys(identityDetailsMap).length > 0) {
                  // H-03/NEW-1 fix: Pre-build lookup maps for O(1) fallback instead of O(n) scan
                  const { uIdMap, idMap } = buildIdentityLookupMaps(identityDetailsMap);

                  lanes = lanes.map(lane => {
                    if (lane.laneType === 'Identities') {
                      const enrichedItems = lane.items.map((item) => {
                        const identityId = String(item.node.id);
                        // Use helper function with pre-built maps for O(1) lookups
                        const odataDetails = findIdentityDetails(identityDetailsMap, uIdMap, idMap, identityId);

                        if (odataDetails) {
                          return {
                            ...item,
                            node: {
                              ...item.node,
                              metadata: {
                                ...item.node.metadata,
                                email: odataDetails.EMAIL,
                                title: odataDetails.JOBTITLE,
                                employeeId: odataDetails.EMPLOYEEID || odataDetails.IDENTITYID,
                                department: odataDetails.DEPARTMENT,
                                category: odataDetails.IDENTITYCATEGORY?.DisplayName,
                                status: odataDetails.IDENTITYSTATUS?.DisplayName
                              },
                              rawData: {
                                ...item.node.rawData,
                                ...odataDetails
                              }
                            },
                            rawData: {
                              ...item.rawData,
                              ...odataDetails
                            }
                          };
                        }
                        return item;
                      });

                      return {
                        ...lane,
                        items: enrichedItems,
                        allItemsData: enrichedItems
                      };
                    }
                    return lane;
                  });
                }
              } catch (enrichError) {
                console.error('[System Pivot] Identity enrichment error:', enrichError.message);
              }
            }

            if (shouldLog('LANES')) {
              console.log('[Pivot] Built', lanes.length, 'system-centric lanes');
            }
          }

          return {
            focusNode: enrichedSystemNode,  // Use enriched node instead of original
            lanes,
            reasonTypes,
            complianceStatuses
          };
        }

        case 'LogicalApplication': {
          // Pivoting to a Logical Application - similar to System but for apps without direct accounts
          // Get the logical app ID from the node
          const logicalAppId = node.id || node.rawData?.Id || node.rawData?.id || node.rawData?.UId || node.metadata?.id;
          const logicalAppName = node.displayName || node.rawData?.Name || node.rawData?.name || node.rawData?.DISPLAYNAME;

          if (!logicalAppId) {
            console.error('No logical application ID found in node');
            return null;
          }

          // Fetch system details from OData to enrich the focus node
          let systemDetails = null;
          try {
            const systemODataResult = await omadaApi.odata.query(
              'System',
              bearerToken,
              impersonateUser,
              { filter: `UId eq ${logicalAppId}` }
            );
            if (systemODataResult.status === 'success' && systemODataResult.data?.length > 0) {
              systemDetails = systemODataResult.data[0];
            }
          } catch (err) {
            // Silently continue - we'll use node data as fallback
          }

          // Create enriched logical app node
          const enrichedLogicalAppNode = {
            id: logicalAppId,
            type: 'LogicalApplication',
            displayName: systemDetails?.DISPLAYNAME || systemDetails?.DisplayName || systemDetails?.Name || logicalAppName || 'Unknown Application',
            metadata: {
              systemType: systemDetails?.SYSTEMTYPE?.DisplayName || systemDetails?.SYSTEMTYPE?.Name || node.metadata?.systemType || 'Logical App',
              description: systemDetails?.DESCRIPTION || systemDetails?.Description || node.metadata?.description || '',
              owner: systemDetails?.OWNERREF?.DisplayName || systemDetails?.OWNERREF?.DisplayNameValue || node.metadata?.owner || null,
              isLogical: true,
              underlyingSystemIds: node.metadata?.underlyingSystemIds || node.rawData?.underlyingSystemIds || [],
              underlyingSystems: node.metadata?.underlyingSystems || node.rawData?.underlyingSystems || []
            },
            rawData: systemDetails || node.rawData || { id: logicalAppId, isLogical: true },
            status: 'active',
            badges: node.badges || []
          };

          // Fetch assignments filtered by this logical app as the resource system
          // This gets all assignments where the resource is on this logical application
          const assignmentsResult = await omadaApi.assignment.getCalculatedAssignmentsDetailed(
            null, // No identity filter
            bearerToken,
            impersonateUser,
            { systemId: logicalAppId, includeDisabled: includeDisabledAssignments }, // Filter by this logical app as the system
            { page: 1, rows: 5000 } // Large page size to fetch all assignments
          );

          let lanes = [];
          let reasonTypes = [];
          let complianceStatuses = [];

          if (assignmentsResult.status === 'success') {
            // Build lanes for logical-app-centric view
            lanes = buildLanesFromAssignments(assignmentsResult.data, {}, {
              includeIdentities: true,
              focusSystemId: logicalAppId
            });
            reasonTypes = extractUniqueReasonTypes(assignmentsResult.data);

            complianceStatuses = extractUniqueComplianceStatuses(assignmentsResult.data);

            // IDENTITY ENRICHMENT - Fetch OData details for identities in the lane
            const identitiesLane = lanes.find(l => l.laneType === 'Identities');
            if (identitiesLane) {
              try {
                const identityDetailsMap = await fetchAllIdentityDetails(assignmentsResult.data, bearerToken, impersonateUser);
                if (Object.keys(identityDetailsMap).length > 0) {
                  // H-03/NEW-1 fix: Pre-build lookup maps for O(1) fallback instead of O(n) scan
                  const { uIdMap, idMap } = buildIdentityLookupMaps(identityDetailsMap);

                  lanes = lanes.map(lane => {
                    if (lane.laneType === 'Identities') {
                      const enrichedItems = lane.items.map((item) => {
                        const identityId = String(item.node.id);
                        // Use helper function with pre-built maps for O(1) lookups
                        const odataDetails = findIdentityDetails(identityDetailsMap, uIdMap, idMap, identityId);

                        if (odataDetails) {
                          return {
                            ...item,
                            node: {
                              ...item.node,
                              metadata: {
                                ...item.node.metadata,
                                email: odataDetails.EMAIL,
                                title: odataDetails.JOBTITLE,
                                employeeId: odataDetails.EMPLOYEEID || odataDetails.IDENTITYID,
                                department: odataDetails.DEPARTMENT,
                                category: odataDetails.IDENTITYCATEGORY?.DisplayName,
                                status: odataDetails.IDENTITYSTATUS?.DisplayName
                              },
                              rawData: {
                                ...item.node.rawData,
                                ...odataDetails
                              }
                            },
                            rawData: {
                              ...item.rawData,
                              ...odataDetails
                            }
                          };
                        }
                        return item;
                      });

                      return {
                        ...lane,
                        items: enrichedItems,
                        allItemsData: enrichedItems
                      };
                    }
                    return lane;
                  });
                }
              } catch (enrichError) {
                console.error('[LogicalApp Pivot] Identity enrichment error:', enrichError.message);
              }
            }

            if (shouldLog('LANES')) {
              console.log('[Pivot] Built', lanes.length, 'logical-app-centric lanes');
            }
          }

          return {
            focusNode: enrichedLogicalAppNode,
            lanes,
            reasonTypes,
            complianceStatuses
          };
        }

        case 'Account': {
          // Pivoting to an Account - show related identity, system, entitlements, policies, and logical apps
          // Get the account name and identity UId from the node
          const accountName = node.displayName || node.rawData?.accountName || node.rawData?.AccountName ||
                              node.metadata?.accountName || node.rawData?.name || node.rawData?.Name;
          const accountIdentityId = node.metadata?.identityId || node.rawData?.identity?.id ||
                                    node.rawData?.identityId || node.rawData?.IdentityId;
          const accountSystemId = node.metadata?.systemId || node.rawData?.system?.id ||
                                  node.rawData?.systemId || node.rawData?.SystemId;
          const accountSystemName = node.metadata?.system || node.rawData?.system?.name ||
                                    node.rawData?.systemName || node.rawData?.SystemName;

          if (shouldLog('PIVOT')) {
            console.log('[Account Pivot] accountName:', accountName);
            console.log('[Account Pivot] identityId:', accountIdentityId);
            console.log('[Account Pivot] systemId:', accountSystemId);
          }

          if (!accountName) {
            console.error('No account name found in node');
            return { focusNode: node, lanes: [], reasonTypes: [] };
          }

          // Fetch assignments filtered by identity AND accountName (exact match)
          // The identity filter ensures we only get assignments for the account's owner
          // The accountName filter ensures we only get assignments for this specific account
          const assignmentsResult = await omadaApi.assignment.getCalculatedAssignmentsDetailed(
            accountIdentityId || null,  // Use identity UId if available
            bearerToken,
            impersonateUser,
            {
              accountName: accountName,
              accountNameExact: true,  // Use EQUALS operator for exact match
              includeDisabled: includeDisabledAssignments
            },
            { page: 1, rows: 5000 }  // Large page size to get all assignments
          );

          if (shouldLog('PIVOT')) {
            console.log('[Account Pivot] Response - Total:', assignmentsResult.total, 'Status:', assignmentsResult.status);
            if (assignmentsResult.data && assignmentsResult.data.length > 0) {
              const withResource = assignmentsResult.data.filter(a => a.resource).length;
              console.log('[Account Pivot] Assignments with resource:', withResource, 'of', assignmentsResult.data.length);
            }
          }

          let lanes = [];
          let reasonTypes = [];
          let complianceStatuses = [];

          if (assignmentsResult.status === 'success' && assignmentsResult.data) {
            // Build lanes for account-centric view:
            // - Identities (owner of this account)
            // - Systems (system this account is on)
            // - Entitlements (resources this account has access to)
            // - Assignment Policies (policies that assigned entitlements)
            // - Logical Applications (business apps accessible via this account)
            lanes = buildLanesFromAssignments(assignmentsResult.data, {}, {
              includeIdentities: true,
              focusAccountName: accountName  // Pass account name for context
            });
            reasonTypes = extractUniqueReasonTypes(assignmentsResult.data);

            complianceStatuses = extractUniqueComplianceStatuses(assignmentsResult.data);

            if (shouldLog('LANES')) {
              console.log('[Account Pivot] Built', lanes.length, 'account-centric lanes');
            }
          }

          // Enrich the focus node with system info if not already present
          const enrichedAccountNode = {
            ...node,
            id: node.id || node.rawData?.id,
            type: 'Account',
            displayName: accountName,
            metadata: {
              ...node.metadata,
              identityId: accountIdentityId,
              systemId: accountSystemId,
              system: accountSystemName
            }
          };

          return {
            focusNode: enrichedAccountNode,
            lanes,
            reasonTypes,
            complianceStatuses
          };
        }

        case 'Entitlement': {
          // Pivoting to an Entitlement - show who has it, through which accounts, on which system
          // Use the first valid UUID we find
          const resourceId = node.id || node.rawData?.id || node.rawData?.resource?.id || node.metadata?.id;
          const resourceName = node.displayName || node.rawData?.name || node.metadata?.name;
          const systemId = node.metadata?.systemId || node.rawData?.system?.id || node.rawData?.systemId;

          // Validate that we have the resource ID (should be a UUID)
          if (!resourceId) {
            console.error('No resource ID found in node');
            return { focusNode: node, lanes: [], reasonTypes: [] };
          }

          // Extract complianceStatus from filters if provided
          const complianceStatus = filters.complianceStatus || null;

          // Use the dedicated API to fetch identities having this resource
          let assignmentsResult;
          try {
            assignmentsResult = await omadaApi.assignment.getIdentitiesHavingResource(
              resourceId,
              resourceName,
              bearerToken,
              impersonateUser,
              { page: 1, rows: 100 },
              systemId,
              complianceStatus,  // Pass the compliance filter to the API
              includeDisabledAssignments  // Include disabled assignments based on user preference
            );
          } catch (apiError) {
            console.error('Entitlement pivot API error:', apiError.message);
            return { focusNode: node, lanes: [], reasonTypes: [] };
          }

          let lanes = [];
          let reasonTypes = [];
          let complianceStatuses = [];

          // Fetch Resource details from OData FIRST to get CHILDROLES and owner information
          // This must be done before building lanes so child resources can be included
          let resourceOwners = null;
          let childRoles = [];
          let resourceOdataData = null;
          try {
            const resourceOdataResult = await omadaApi.odata.query(
              'Resource',
              bearerToken,
              impersonateUser,
              {
                filter: `Uid eq ${resourceId}`,  // Use Uid (UUID field), not Id (integer)
                top: 1
                // Don't use $select or $expand - they may cause 400 errors on Resource entity
                // Let OData return all default fields instead
              }
            );

            if (resourceOdataResult.status === 'success' && resourceOdataResult.data?.length > 0) {
              resourceOdataData = resourceOdataResult.data[0];

              // Extract CHILDROLES for building child resources lane
              childRoles = resourceOdataData.CHILDROLES || [];
              if (childRoles.length > 0) {
                console.log(`[Entitlement Pivot] Found ${childRoles.length} CHILDROLES from OData for ${resourceName}`);

                // Enrich CHILDROLES with full resource details (resource type, system name, description)
                // OData CHILDROLES only contains minimal reference data (DisplayName, UId)
                // We need to fetch full details for each child resource
                const MAX_CHILDREN_TO_ENRICH = 50;  // Limit to avoid too many requests
                const childrenToEnrich = childRoles.slice(0, MAX_CHILDREN_TO_ENRICH);

                const enrichedChildRoles = await Promise.all(
                  childrenToEnrich.map(async (child) => {
                    const childUId = child.UId || child.Id || child.id;
                    if (!childUId) return child;

                    try {
                      const childOdataResult = await omadaApi.odata.query(
                        'Resource',
                        bearerToken,
                        impersonateUser,
                        {
                          filter: `Uid eq ${childUId}`,
                          top: 1
                        }
                      );

                      if (childOdataResult.status === 'success' && childOdataResult.data?.length > 0) {
                        const childData = childOdataResult.data[0];
                        // Merge the full resource data with the original CHILDROLES reference
                        return {
                          ...child,
                          // Resource type from OData
                          RESOURCETYPE: childData.RESOURCETYPE?.DisplayName ||
                                       childData.RESOURCETYPE?.Name ||
                                       childData.RESOURCETYPEDISPLAYNAME ||
                                       child.RESOURCETYPE,
                          // System name from OData
                          SYSTEMNAME: childData.SYSTEMDISPLAYNAME ||
                                     childData.SYSTEM?.DisplayName ||
                                     childData.SYSTEM?.Name ||
                                     childData.SYSTEMNAME ||
                                     child.SYSTEMNAME,
                          // Description from OData
                          DESCRIPTION: childData.DESCRIPTION ||
                                      childData.Description ||
                                      child.DESCRIPTION,
                          // Full raw data for reference
                          _enrichedData: childData
                        };
                      }
                      return child;
                    } catch (err) {
                      console.warn(`[Entitlement Pivot] Failed to enrich child resource ${childUId}:`, err.message);
                      return child;
                    }
                  })
                );

                // Replace childRoles with enriched version
                childRoles = enrichedChildRoles;
                console.log(`[Entitlement Pivot] Enriched ${enrichedChildRoles.length} child resources with full details`);
              }

              // Extract owner information
              // OWNERREF and EXPLICITOWNER are typically arrays of identity references
              const ownerRef = resourceOdataData.OWNERREF;
              const explicitOwner = resourceOdataData.EXPLICITOWNER;

              // Parse owners - could be array or single object
              // OData returns DisplayNameValue for the owner's display name
              const parseOwner = (ownerData) => {
                if (!ownerData) return null;
                if (Array.isArray(ownerData)) {
                  return ownerData.map(o => ({
                    id: o.Id || o.UId,
                    displayName: o.DisplayNameValue || o.DisplayName || o.DISPLAYNAME || o.Name,
                    type: 'OWNERREF'
                  })).filter(o => o.displayName);
                }
                if (typeof ownerData === 'object') {
                  return [{
                    id: ownerData.Id || ownerData.UId,
                    displayName: ownerData.DisplayNameValue || ownerData.DisplayName || ownerData.DISPLAYNAME || ownerData.Name,
                    type: 'OWNERREF'
                  }].filter(o => o.displayName);
                }
                return null;
              };

              const owners = parseOwner(ownerRef) || [];
              const explicitOwners = parseOwner(explicitOwner)?.map(o => ({ ...o, type: 'EXPLICITOWNER' })) || [];

              resourceOwners = {
                owners: owners,
                explicitOwners: explicitOwners,
                allOwners: [...owners, ...explicitOwners]
              };
            }
          } catch (ownerError) {
            console.warn('[Entitlement Pivot] OData query failed:', ownerError.message);
            // Continue without owner info and CHILDROLES - not critical
          }

          // Create enriched node with CHILDROLES from OData for lane building
          const nodeWithChildRoles = {
            ...node,
            id: resourceId,
            displayName: resourceName,
            rawData: {
              ...node.rawData,
              CHILDROLES: childRoles,
              // Also include any other OData data that might be useful
              ...(resourceOdataData ? {
                description: resourceOdataData.DESCRIPTION || node.rawData?.description,
                DISPLAYNAME: resourceOdataData.DISPLAYNAME
              } : {})
            }
          };

          if (assignmentsResult.status === 'success' && assignmentsResult.data) {
            // Enrich assignments with identity details from OData
            let enrichedAssignments = assignmentsResult.data;

            if (assignmentsResult.data.length > 0) {
              // Extract unique identity UUIDs for OData enrichment (use UUID, not identityId code)
              const uniqueIdentityUIds = [...new Set(
                assignmentsResult.data
                  .map(a => a.identity?.id)  // Use UUID (id) not identityId code
                  .filter(Boolean)
              )];

              // Fetch additional identity details via OData (email, title, etc.)
              let identityDetailsMap = {};
              // Limit to first 50 identities to avoid too many requests
              const MAX_IDENTITIES_TO_ENRICH = 50;
              const identitiesToFetch = uniqueIdentityUIds.slice(0, MAX_IDENTITIES_TO_ENRICH);

              if (identitiesToFetch.length > 0) {
                try {
                  // Process one at a time
                  for (let i = 0; i < identitiesToFetch.length; i++) {
                    const uid = identitiesToFetch[i];

                    try {
                      const odataResult = await omadaApi.odata.query(
                        'Identity',
                        bearerToken,
                        impersonateUser,
                        {
                          filter: `UId eq ${uid}`,
                          select: 'UId,IDENTITYID,EMAIL,JOBTITLE,FIRSTNAME,LASTNAME,DISPLAYNAME,EMPLOYEEID',
                          top: 1
                        }
                      );

                      if (odataResult.status === 'success' && odataResult.data?.length > 0) {
                        const ident = odataResult.data[0];
                        identityDetailsMap[ident.UId] = {
                          email: ident.EMAIL,
                          title: ident.JOBTITLE,
                          employeeId: ident.EMPLOYEEID || ident.IDENTITYID,
                          firstName: ident.FIRSTNAME,
                          lastName: ident.LASTNAME,
                          displayName: ident.DISPLAYNAME
                        };
                      }
                    } catch (singleError) {
                      // Continue - not critical
                    }
                  }
                } catch (odataError) {
                  // Continue without enrichment - not critical
                }
              }

              // Enrich assignments with OData details before building lanes
              enrichedAssignments = assignmentsResult.data.map(assignment => {
                const identityUId = assignment.identity?.id;  // Use UUID for lookup
                const odataDetails = identityUId ? identityDetailsMap[identityUId] : null;
                if (odataDetails) {
                  return {
                    ...assignment,
                    identity: {
                      ...assignment.identity,
                      email: odataDetails.email,
                      title: odataDetails.title,
                      employeeId: odataDetails.employeeId
                    }
                  };
                }
                return assignment;
              });

              reasonTypes = extractUniqueReasonTypes(enrichedAssignments);
              complianceStatuses = extractUniqueComplianceStatuses(enrichedAssignments);
            }

            // Build lanes for entitlement-centric view
            // ALWAYS call buildLanesForEntitlement even if no assignments, so child resources lane can be built from CHILDROLES
            lanes = buildLanesForEntitlement(enrichedAssignments, {}, nodeWithChildRoles);

            if (shouldLog('LANES')) {
              console.log('[Pivot] Built', lanes.length, 'entitlement-centric lanes (assignments:', enrichedAssignments.length, ', CHILDROLES:', childRoles.length, ')');
            }
          } else {
            console.error('Entitlement pivot: API call failed');
            // Even if API failed, try to build lanes with CHILDROLES from OData
            if (childRoles.length > 0) {
              lanes = buildLanesForEntitlement([], {}, nodeWithChildRoles);
              console.log('[Pivot] Built lanes from CHILDROLES only (no assignments)');
            }
          }

          // Extract childResourceIds from GraphQL response (simpler than CHILDROLES enrichment)
          // The GraphQL API returns childResourceIds as an array of UUIDs in resource block
          const childResourceIds = assignmentsResult.data?.[0]?.resource?.childResourceIds ||
                                   node.rawData?.resource?.childResourceIds ||
                                   node.rawData?.childResourceIds ||
                                   [];

          if (childResourceIds.length > 0) {
            console.log(`[Entitlement Pivot] Found ${childResourceIds.length} childResourceIds from GraphQL API`);
          }

          // Create a clean entitlement-focused node without relationship data
          // When the entitlement is the central focus, we only want entitlement properties,
          // NOT the relationship data from the previous Identity→Entitlement assignment
          const cleanEntitlementNode = {
            id: resourceId,
            type: 'Entitlement',
            displayName: resourceName,
            // Keep only entitlement-intrinsic properties
            metadata: {
              systemId: systemId,
              system: node.metadata?.system || node.rawData?.system?.name,
              resourceType: node.metadata?.resourceType || node.rawData?.resourceType?.name,
              resourceTypeId: node.metadata?.resourceTypeId || node.rawData?.resourceType?.id,
              description: node.metadata?.description || node.rawData?.description || resourceOdataData?.DESCRIPTION,
              // Owner information from OData
              owners: resourceOwners?.owners || [],
              explicitOwners: resourceOwners?.explicitOwners || [],
              allOwners: resourceOwners?.allOwners || [],
              // childResourceIds from GraphQL API (simpler approach)
              childResourceIds: childResourceIds
            },
            // Clean rawData - only entitlement properties, no relationship data
            rawData: {
              id: resourceId,
              name: resourceName,
              description: node.rawData?.description || node.rawData?.resource?.description || resourceOdataData?.DESCRIPTION,
              system: node.rawData?.system || node.rawData?.resource?.system,
              resourceType: node.rawData?.resourceType || node.rawData?.resource?.resourceType,
              resourceCategory: node.rawData?.resourceCategory || node.rawData?.resource?.resourceCategory,
              resourceFolder: node.rawData?.resourceFolder || node.rawData?.resource?.resourceFolder,
              maxValidity: node.rawData?.maxValidity || node.rawData?.resource?.maxValidity,
              // CHILDROLES for child resources lane building (OData fallback)
              CHILDROLES: childRoles,
              // childResourceIds from GraphQL API (preferred simpler approach)
              childResourceIds: childResourceIds,
              // Owner information
              owners: resourceOwners?.owners || [],
              explicitOwners: resourceOwners?.explicitOwners || [],
              allOwners: resourceOwners?.allOwners || []
              // Explicitly NOT including: complianceStatus, validFrom, validTo, reason, violations, disabled
            },
            status: 'active',
            badges: node.badges?.filter(b =>
              // Keep entitlement-related badges, remove relationship badges like risk level
              !['High', 'Medium', 'Low'].includes(b)
            ) || []
          };

          return {
            focusNode: cleanEntitlementNode,
            lanes,
            reasonTypes,
            complianceStatuses
          };
        }

        case 'Policy':
        case 'AssignmentPolicy': {
          // ============================================================
          // Assignment Policy Pivot
          // Handles both NodeTypes.POLICY ('Policy') from lane items and
          // NodeTypes.ASSIGNMENT_POLICY ('AssignmentPolicy') from schemas
          // Fetches policy OData details, then uses AP_RESOURCES to find
          // affected identities/accounts/systems via getIdentitiesHavingResource
          // ============================================================
          const policyId = node.id || node.rawData?.causeObjectKey || node.rawData?.UId || node.rawData?.Id || node.metadata?.id;
          const policyName = node.displayName || node.rawData?.DISPLAYNAME || node.rawData?.name || 'Unknown Policy';

          if (!policyId) {
            console.error('[AP Pivot] No policy ID found in node');
            return { focusNode: node, lanes: [], reasonTypes: [] };
          }

          if (shouldLog('PIVOT')) console.log('[AP Pivot] Policy ID:', policyId, 'Name:', policyName);

          // Step 1: Fetch full Assignment Policy details via OData
          let policyDetails = null;
          try {
            const policyResult = await omadaApi.assignmentPolicy.getAssignmentPolicyById(
              policyId,
              bearerToken,
              impersonateUser
            );
            if (policyResult.status === 'success' && policyResult.data) {
              policyDetails = policyResult.data;
              if (shouldLog('PIVOT')) console.log('[AP Pivot] OData policy loaded:', policyDetails.DISPLAYNAME || policyDetails.DisplayName);
            }
          } catch (err) {
            console.error('[AP Pivot] Failed to fetch policy details:', err.message);
          }

          // Step 2: Build enriched focus node
          const apContexts = policyDetails?.AP_CONTEXTS || node.rawData?.AP_CONTEXTS || [];
          const apResources = policyDetails?.AP_RESOURCES || node.rawData?.AP_RESOURCES || [];
          const apAccountResources = policyDetails?.AP_ACCOUNTRESOURCES || node.rawData?.AP_ACCOUNTRESOURCES || [];

          const enrichedPolicyNode = {
            id: policyId,
            type: 'AssignmentPolicy',
            displayName: policyDetails?.DISPLAYNAME || policyDetails?.DisplayName || policyName,
            status: (policyDetails?.ISACTIVE === false) ? 'disabled' : 'active',
            badges: node.badges || [],
            metadata: {
              description: policyDetails?.DESCRIPTION || node.metadata?.description || '',
              isActive: policyDetails?.ISACTIVE ?? true,
              validFrom: policyDetails?.VALIDFROM || null,
              validTo: policyDetails?.VALIDTO || null,
              owner: policyDetails?.OWNERREF?.DisplayName || policyDetails?.OWNERREF?.DisplayNameValue || null,
              contextCount: apContexts.length,
              resourceCount: apResources.length,
              accountResourceCount: apAccountResources.length,
              contextUIds: apContexts.map(ctx => ctx.UId || ctx.uId).filter(Boolean),
              apContexts: apContexts,
              resourceIds: apResources.map(r => r.UId || r.Id || r.id).filter(Boolean)
            },
            rawData: policyDetails || node.rawData || { id: policyId }
          };

          // Step 3: Fetch assignments via getIdentitiesHavingResource for each AP_RESOURCE
          const MAX_RESOURCES_TO_QUERY = 10;
          const resourcesToQuery = apResources.slice(0, MAX_RESOURCES_TO_QUERY);
          let allAssignments = [];

          if (shouldLog('PIVOT')) console.log(`[AP Pivot] Querying ${resourcesToQuery.length} of ${apResources.length} resources for identities`);

          for (const resource of resourcesToQuery) {
            const resourceId = resource.UId || resource.Id || resource.id;
            const resourceName = resource.DisplayName || resource.Name;
            if (!resourceId) continue;

            try {
              const result = await omadaApi.assignment.getIdentitiesHavingResource(
                resourceId,
                resourceName,
                bearerToken,
                impersonateUser,
                { page: 1, rows: 200 },
                null,   // systemId
                null,   // complianceStatus
                includeDisabledAssignments
              );
              if (result.status === 'success' && result.data) {
                allAssignments = allAssignments.concat(result.data);
              }
            } catch (err) {
              if (shouldLog('PIVOT')) console.warn(`[AP Pivot] Failed to fetch identities for resource ${resourceName}:`, err.message);
            }
          }

          if (shouldLog('PIVOT')) console.log(`[AP Pivot] Total assignments collected: ${allAssignments.length}`);

          // Step 4: Build lanes from collected assignments
          let lanes = [];
          let reasonTypes = [];
          let complianceStatuses = [];

          if (allAssignments.length > 0) {
            lanes = buildLanesFromAssignments(allAssignments, {}, {
              includeIdentities: true
            });

            // buildLanesFromAssignments with includeIdentities skips Systems lane (designed for System-centric view).
            // For AP pivot we need the Systems lane, so build it explicitly.
            const systemsLane = buildSystemsLane(allAssignments, {});
            if (systemsLane && systemsLane.items.length > 0) {
              lanes.push(systemsLane);
            }

            reasonTypes = extractUniqueReasonTypes(allAssignments);
            complianceStatuses = extractUniqueComplianceStatuses(allAssignments);
          }

          // Step 4b: Replace Entitlements lane with one built from AP_RESOURCES
          // AP_RESOURCES provides the authoritative list; assignments provide system info
          if (apResources.length > 0) {
            const apEntitlementsLane = buildEntitlementsLaneFromAPResources(apResources, allAssignments);
            // Remove assignment-derived Entitlements lane and use AP_RESOURCES one instead
            lanes = lanes.filter(l => l.laneType !== LaneTypes.EFFECTIVE_ENTITLEMENTS);
            if (apEntitlementsLane && apEntitlementsLane.items.length > 0) {
              lanes.push(apEntitlementsLane);
            }
            if (shouldLog('PIVOT')) console.log(`[AP Pivot] Built Entitlements lane with ${apEntitlementsLane.items.length} items from AP_RESOURCES`);
          }

          // Step 6a: Add Contexts lane from AP_CONTEXTS (not derived from assignments)
          if (apContexts.length > 0) {
            const contextsLane = buildContextsLaneFromAPData(apContexts);
            if (contextsLane && contextsLane.items.length > 0) {
              lanes.push(contextsLane);
            }
          }

          // Step 6b: Enrich identities with OData details
          const apIdentitiesLane = lanes.find(l => l.laneType === 'Identities');
          if (apIdentitiesLane && apIdentitiesLane.items.length > 0 && allAssignments.length > 0) {
            try {
              const identityDetailsMap = await fetchAllIdentityDetails(allAssignments, bearerToken, impersonateUser);
              if (Object.keys(identityDetailsMap).length > 0) {
                // H-03/NEW-1 fix: Pre-build lookup maps for O(1) fallback instead of O(n) scan
                const { uIdMap, idMap } = buildIdentityLookupMaps(identityDetailsMap);

                lanes = lanes.map(lane => {
                  if (lane.laneType !== 'Identities') return lane;
                  const enrichedItems = lane.items.map((item) => {
                    const identityId = String(item.node.id);
                    // Use helper function with pre-built maps for O(1) lookups
                    const odataDetails = findIdentityDetails(identityDetailsMap, uIdMap, idMap, identityId);

                    if (odataDetails) {
                      return {
                        ...item,
                        node: {
                          ...item.node,
                          metadata: {
                            ...item.node.metadata,
                            email: odataDetails.EMAIL,
                            title: odataDetails.JOBTITLE,
                            employeeId: odataDetails.EMPLOYEEID || odataDetails.IDENTITYID,
                            department: odataDetails.DEPARTMENT,
                            category: odataDetails.IDENTITYCATEGORY?.DisplayName,
                            status: odataDetails.IDENTITYSTATUS?.DisplayName
                          },
                          rawData: { ...item.node.rawData, ...odataDetails }
                        },
                        rawData: { ...item.rawData, ...odataDetails }
                      };
                    }
                    return item;
                  });
                  return { ...lane, items: enrichedItems, allItemsData: enrichedItems };
                });
              }
            } catch (enrichError) {
              console.error('[AP Pivot] Identity enrichment error:', enrichError.message);
            }
          }

          if (shouldLog('PIVOT')) console.log(`[AP Pivot] Built ${lanes.length} lanes:`, lanes.map(l => `${l.laneType}(${l.items?.length || 0})`).join(', '));

          return {
            focusNode: enrichedPolicyNode,
            lanes,
            reasonTypes,
            complianceStatuses
          };
        }

        case 'Request': {
          // ============================================================
          // Request Pivot — 4 lanes: Resource, System, Requester, Beneficiary
          // Requester uses userName (IDENTITYID) lookup; Beneficiary uses UId lookup
          // System cards enriched with OData details
          // ============================================================
          const requestedBy = node.rawData?.requestedBy;
          const requesterId = requestedBy?.id;
          const requesterUserName = requestedBy?.userName;
          const requesterIdentityId = requestedBy?.identityId;
          const beneficiaryId = node.rawData?.beneficiary?.id;

          // Fetch OData enrichment for requester and beneficiary identities
          let requesterOData = null;
          let beneficiaryOData = null;

          // Collect unique system UIds for OData enrichment
          const systemIds = new Set();
          if (node.rawData?.resource?.system?.id) systemIds.add(node.rawData.resource.system.id);
          if (Array.isArray(node.rawData?.childAssignments)) {
            node.rawData.childAssignments.forEach(child => {
              if (child.resource?.system?.id) systemIds.add(child.resource.system.id);
            });
          }

          // Check if requester and beneficiary are the same person
          const requesterIsBeneficiary = requesterUserName && node.rawData?.beneficiary?.userName
            && requesterUserName === node.rawData.beneficiary.userName;

          if (requesterIsBeneficiary) {
            // Same person — fetch beneficiary by UId (reliable), then reuse for requester
            beneficiaryOData = await fetchIdentityDetails(beneficiaryId, bearerToken, impersonateUser);
            requesterOData = beneficiaryOData;
          } else {
            // Different people — fetch in parallel
            // Requester: try UId first (same as beneficiary), then IDENTITYID, then EMAIL fallbacks
            // Beneficiary: search by UId (works correctly)
            const odataPromises = [];
            odataPromises.push(requesterId
              ? fetchIdentityDetails(requesterId, bearerToken, impersonateUser)
              : Promise.resolve(null));
            odataPromises.push(beneficiaryId
              ? fetchIdentityDetails(beneficiaryId, bearerToken, impersonateUser)
              : Promise.resolve(null));
            [requesterOData, beneficiaryOData] = await Promise.all(odataPromises);

            // Fallback chain if UId lookup failed for requester
            if (!requesterOData) {
              // Try IDENTITYID lookup (userName or identityId from GraphQL)
              const identityIdValue = requesterIdentityId || requesterUserName;
              if (identityIdValue) {
                requesterOData = await fetchIdentityDetailsByUserName(identityIdValue, bearerToken, impersonateUser);
              }
              // Try EMAIL lookup as last resort
              if (!requesterOData && requesterUserName) {
                try {
                  const emailResult = await omadaApi.identity.searchIdentities(
                    null, bearerToken, impersonateUser,
                    {
                      filter: `EMAIL eq '${requesterUserName}'`,
                      select: 'UId,Id,FIRSTNAME,LASTNAME,DISPLAYNAME,EMAIL,EMPLOYEEID,IDENTITYID,JOBTITLE,OUREF,IDENTITYCATEGORY,IDENTITYSTATUS,RISKLEVEL'
                    }
                  );
                  if (emailResult.status === 'success' && emailResult.data?.length > 0) {
                    requesterOData = emailResult.data[0];
                  }
                } catch (err) {
                  // Non-critical — continue without OData enrichment for requester
                }
              }
            }
          }

          // Fetch system OData in parallel
          const systemODataMap = {};
          if (systemIds.size > 0) {
            const systemPromises = Array.from(systemIds).map(async (sysId) => {
              const details = await fetchSystemDetails(sysId, bearerToken, impersonateUser);
              if (details) systemODataMap[sysId] = details;
            });
            await Promise.all(systemPromises);
          }

          // Fetch approval workflow info (Steps 2→3→4) in parallel with lane building
          let approvalInfo = null;
          const resourceName = node.rawData?.resource?.name;
          const beneficiaryName = node.rawData?.beneficiary?.displayName;
          if (resourceName && beneficiaryName) {
            try {
              approvalInfo = await omadaApi.accessRequest.getApprovalInfoForRequest(
                resourceName, beneficiaryName, bearerToken, impersonateUser
              );
            } catch (err) {
              if (shouldLog('PIVOT')) console.warn('[Request Pivot] Failed to fetch approval info:', err.message);
            }
          }

          // Build lanes — Resource, System, Requester, Beneficiary, + Approvers (if data exists)
          const resourceLane = buildResourceLaneForRequest(node);
          const systemLane = buildSystemLaneForRequest(node, systemODataMap);
          const requesterLane = buildRequesterIdentityLaneForRequest(node, requesterOData);
          const beneficiaryLane = buildBeneficiaryIdentityLaneForRequest(node, beneficiaryOData);
          const approversLane = buildApproversLaneForRequest(approvalInfo);

          const lanes = [resourceLane, systemLane, requesterLane, beneficiaryLane, approversLane].filter(l => l.items.length > 0);

          // Build enriched focus node with badges
          const enrichedFocusNode = {
            ...node,
            badges: [
              node.rawData?.status?.approvalStatus,
              node.rawData?.resource?.name,
              node.rawData?.reason
            ].filter(Boolean)
          };

          if (shouldLog('PIVOT')) console.log(`[Request Pivot] Built ${lanes.length} lanes (incl ${approversLane.items.length} approvers)`);

          return {
            focusNode: enrichedFocusNode,
            lanes,
            reasonTypes: [],
            complianceStatuses: []
          };
        }

        default: {
          return {
            focusNode: node,
            lanes: [],
            reasonTypes: [],
            complianceStatuses: []
          };
        }
      }
    } catch (err) {
      console.error('Error in handlePivotToNode:', err.message);
      return null;
    }
  }, [getBearerToken, user]);

  // Get theme from preferences for page wrapper
  const currentTheme = preferences.theme || 'light';

  return (
    <div className={`access-lens-page theme-${currentTheme}`}>
      {/* Omada Top Banner */}
      <Navbar title="Identity360" />

      <div className="access-lens-page-content">
        {/* System-centric view (from heatmap navigation) */}
        {selectedSystem ? (
          <>
            {isLoadingData ? (
              <div className="data-loading-overlay">
                <div className={`data-loading-spinner ${cacheHitFlash ? 'cache-hit' : ''}`}></div>
                <h3 className="loading-title">Populating Identity360</h3>
                <p className="loading-status">{loadingStatus || 'Initializing...'}</p>
                <div className="loading-details">
                  <span>Analyzing system access across identities, accounts, and entitlements</span>
                </div>
              </div>
            ) : (
              <>
                {loadError && (
                  <div className="data-load-error">
                    <span className="error-icon">⚠️</span>
                    {loadError}
                  </div>
                )}
                <AccessLens
                  identity={null}
                  initialFocusNode={selectedSystem}
                  initialLanes={systemLanes}
                  initialReasonTypes={systemReasonTypes}
                  initialComplianceStatuses={systemComplianceStatuses}
                  isFullscreen={true}
                  onClose={() => navigate(-1)}
                  onFetchObjectDetails={fetchObjectDetails}
                  onPivotToNode={handlePivotToNode}
                  apiContext={{ omadaApi, bearerToken: getBearerToken(), impersonateUser: user?.email }}
                />
              </>
            )}
          </>
        ) : selectedIdentity ? (
          <>
            {/* Show loading overlay while fetching data - don't render AccessLens until we have full identity data */}
            {isLoadingData ? (
              <div className="data-loading-overlay">
                <div className={`data-loading-spinner ${cacheHitFlash ? 'cache-hit' : ''}`}></div>
                <h3 className="loading-title">Populating Identity360</h3>
                <p className="loading-status">{loadingStatus || 'Initializing...'}</p>
                <div className="loading-details">
                  <span>Analyzing identity access across systems, accounts, and entitlements</span>
                </div>
              </div>
            ) : (
              <>
                {loadError && (
                  <div className="data-load-error">
                    <span className="error-icon">⚠️</span>
                    {loadError}
                  </div>
                )}
                <AccessLens
                  identity={selectedIdentity}
                  isFullscreen={true}
                  onClose={() => navigate(-1)}
                  calculatedAssignments={calculatedAssignments}
                  identityContexts={identityContexts}
                  systemDetailsMap={systemDetailsMap}
                  onFetchObjectDetails={fetchObjectDetails}
                  onPivotToNode={handlePivotToNode}
                  apiContext={{ omadaApi, bearerToken: getBearerToken(), impersonateUser: user?.email }}
                />
              </>
            )}
          </>
        ) : isLoadingData ? (
          // Show loading overlay when loading from URL params (before selectedIdentity is set)
          <div className="data-loading-overlay">
            <div className={`data-loading-spinner ${cacheHitFlash ? 'cache-hit' : ''}`}></div>
            <h3 className="loading-title">Populating Identity360</h3>
            <p className="loading-status">{loadingStatus || 'Initializing...'}</p>
            <div className="loading-details">
              <span>Preparing to load identity data...</span>
            </div>
          </div>
        ) : (
          <div className="no-identity-selected">
            <div className="empty-state">
              <span className="empty-icon">👤</span>
              <h2>Select an Identity</h2>
              <p>Search for an identity to explore their access relationships</p>
              <button
                className="select-identity-btn"
                onClick={() => setShowSearchDialog(true)}
              >
                Search Identities
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Identity Search Dialog */}
      <IdentitySearchDialog
        isOpen={showSearchDialog}
        onClose={() => setShowSearchDialog(false)}
        onSelectIdentity={handleIdentitySelect}
      />
    </div>
  );
};

export default AccessLensPage;
