/**
 * Access Lens Page
 * Standalone fullscreen page for the Access Lens component
 * Prompts for identity selection when opened from toolbar
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { omadaApi } from '../../services/omadaApi';
import AccessLens from './AccessLens';
import IdentitySearchDialog from './IdentitySearchDialog';
import { LaneSchema, LaneTypes } from './accessLensTypes';
import './AccessLensPage.css';

const AccessLensPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getBearerToken, user } = useAuth();

  // Default identity for testing (used when no identity parameter is provided)
  const defaultIdentity = {
    UId: '5da7f8fc-0119-46b0-a6b4-06e5c78edf68',
    FIRSTNAME: 'Berry',
    LASTNAME: 'Black',
    DISPLAYNAME: 'Berry Black',
    EMAIL: 'berry.black@example.com',
    IDENTITYSTATUS: 'Active'
  };

  // State for identity selection
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Debug: Log when showSearchDialog changes
  useEffect(() => {
    console.log('AccessLensPage: showSearchDialog changed to', showSearchDialog);
  }, [showSearchDialog]);

  // On mount: Check URL for identity parameter, otherwise use default
  useEffect(() => {
    if (initialLoadDone) return;

    const identityParam = searchParams.get('identity');

    if (identityParam) {
      // Identity UId provided in URL - create a temporary identity object and load data
      console.log('AccessLensPage: Loading identity from URL param:', identityParam);
      const identityFromUrl = { UId: identityParam };
      setSelectedIdentity(identityFromUrl);
      // loadIdentityData will be called by the next effect
    } else {
      // No identity param - use default identity
      console.log('AccessLensPage: Using default identity');
      setSelectedIdentity(defaultIdentity);
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
      console.log(`[System OData] Fetching details for system UId: ${systemUId}`);

      // OData query: /OData/DataObjects/System?$filter=UId eq {systemUId}
      // Note: UId is a UUID string, so it needs to be passed as a GUID
      const result = await omadaApi.odata.query(
        'System',
        bearerToken,
        impersonateUser,
        {
          filter: `UId eq ${systemUId}`
        }
      );

      console.log(`[System OData] Result for ${systemUId}:`, result);

      if (result.status === 'success' && result.data?.length > 0) {
        const systemData = result.data[0];
        console.log(`[System OData] System ${systemUId} enriched data:`, {
          name: systemData.DISPLAYNAME || systemData.Name,
          type: systemData.SYSTEMTYPE?.DisplayName || systemData.SYSTEMTYPE?.Name,
          description: systemData.DESCRIPTION,
          owner: systemData.OWNERREF?.DisplayName,
          classification: systemData.CLT_TAGS?.DisplayName,
          fullData: systemData
        });
        return systemData;
      } else {
        console.warn(`[System OData] No data returned for system ${systemUId}`);
      }
      return null;
    } catch (err) {
      console.error(`[System OData] Error fetching system ${systemUId}:`, err);
      return null;
    }
  }, []);

  /**
   * Fetch details for all unique systems from assignments
   * @param {Array} assignments - Array of calculated assignments
   * @returns {Promise<Object>} Map of systemId -> system details
   */
  const fetchAllSystemDetails = useCallback(async (assignments, bearerToken, impersonateUser) => {
    console.log('[System OData] === fetchAllSystemDetails called ===');
    console.log('[System OData] Assignments count:', assignments?.length);

    if (!assignments || assignments.length === 0) {
      console.warn('[System OData] No assignments provided, skipping system details fetch');
      return {};
    }

    // Extract unique system IDs from both account.system and resource.system
    const systemIdsSet = new Set();

    assignments.forEach((assignment, i) => {
      // From account's system
      const accountSystemId = assignment.account?.system?.id;
      if (accountSystemId) {
        systemIdsSet.add(accountSystemId);
        if (i < 3) {
          console.log(`[System OData] Found account system: ${assignment.account.system.name} (ID: ${accountSystemId})`);
        }
      }

      // From resource's system (may be different, e.g., logical applications)
      const resourceSystemId = assignment.resource?.system?.id;
      if (resourceSystemId) {
        systemIdsSet.add(resourceSystemId);
        if (i < 3) {
          console.log(`[System OData] Found resource system: ${assignment.resource?.system?.name} (ID: ${resourceSystemId})`);
        }
      }
    });

    const systemIds = Array.from(systemIdsSet);
    console.log(`[System OData] === Fetching OData details for ${systemIds.length} unique systems ===`);
    console.log('[System OData] System IDs:', systemIds);

    if (systemIds.length === 0) {
      console.warn('[System OData] No system IDs found in assignments');
      return {};
    }

    // Fetch all system details in parallel
    const detailsPromises = systemIds.map(id =>
      fetchSystemDetails(id, bearerToken, impersonateUser)
    );

    const detailsResults = await Promise.all(detailsPromises);

    // Build map of systemId -> system details
    const detailsMap = {};
    systemIds.forEach((id, index) => {
      if (detailsResults[index]) {
        detailsMap[id] = detailsResults[index];
      }
    });

    console.log(`[System OData] === Completed: Fetched details for ${Object.keys(detailsMap).length} systems ===`);
    console.log('[System OData] Systems with details:', Object.keys(detailsMap));
    return detailsMap;
  }, [fetchSystemDetails]);

  // Load data when identity is selected
  const loadIdentityData = useCallback(async (identity) => {
    if (!identity?.UId) return;

    setIsLoadingData(true);
    setLoadError(null);

    try {
      const bearerToken = getBearerToken();
      const impersonateUser = user?.email;

      // First, fetch full identity details from OData if we only have basic info
      console.log('=== Loading identity data for UId:', identity.UId, '===');

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
        console.log('Loaded full identity details:', fullIdentity);
        setSelectedIdentity(fullIdentity);
      } else {
        console.warn('Could not load full identity details, using provided identity');
      }

      // Call assignments and contexts APIs in parallel
      const [assignmentsResult, contextsResult] = await Promise.all([
        omadaApi.assignment.getCalculatedAssignmentsDetailed(
          identity.UId,
          bearerToken,
          impersonateUser,
          {},
          { page: 1, rows: 100 }
        ),
        omadaApi.identity.getIdentityContexts(
          identity.UId,
          bearerToken,
          impersonateUser
        )
      ]);

      if (assignmentsResult.status === 'success') {
        setCalculatedAssignments(assignmentsResult.data);
        console.log('Loaded calculated assignments:', assignmentsResult.data?.length, 'items');
        if (assignmentsResult.data?.length > 0) {
          console.log('First assignment sample:', assignmentsResult.data[0]);
        }

        // Fetch system details for all unique systems in the assignments
        console.log('[System OData] Starting system details fetch...');
        const systemDetails = await fetchAllSystemDetails(
          assignmentsResult.data,
          bearerToken,
          impersonateUser
        );
        console.log('[System OData] Setting systemDetailsMap with', Object.keys(systemDetails).length, 'systems');
        setSystemDetailsMap(systemDetails);
      } else {
        console.warn('Failed to load assignments:', assignmentsResult);
      }

      if (contextsResult.status === 'success') {
        setIdentityContexts(contextsResult.data);
        console.log('Loaded identity contexts:', contextsResult.data?.length, 'items');
      } else {
        console.warn('Failed to load contexts:', contextsResult);
      }

    } catch (err) {
      console.error('Error loading identity data:', err);
      setLoadError(err.message || 'Failed to load identity data');
    } finally {
      setIsLoadingData(false);
    }
  }, [getBearerToken, user, fetchAllSystemDetails]);

  // Handle identity selection from dialog
  const handleIdentitySelect = useCallback((identity) => {
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
  const fetchObjectDetails = useCallback(async (laneType, item) => {
    const laneConfig = LaneSchema[laneType];
    if (!laneConfig?.apiSource) {
      console.warn('No API source configured for lane type:', laneType);
      return null;
    }

    const { apiSource, inspectorConfig } = laneConfig;

    // Only handle OData sources for now
    if (apiSource.type !== 'OData') {
      console.log('Non-OData source, returning item data as-is:', apiSource.type);
      return { data: item.node?.rawData || item.rawData || item.node, inspectorConfig };
    }

    const { endpoint, filterField } = apiSource;

    // Get the value to filter by (use displayName for name-based filters)
    const filterValue = item.node?.displayName || item.node?.name || item.node?.Name;

    if (!filterValue) {
      console.warn('No filter value available for item:', item);
      return null;
    }

    console.log(`=== Fetching ${endpoint} details ===`);
    console.log(`Filter: ${filterField} eq '${filterValue}'`);

    try {
      const bearerToken = getBearerToken();
      const impersonateUser = user?.email;

      // Build the OData query
      // Format: /OData/DataObjects/{endpoint}?$filter={filterField} eq '{value}'
      const result = await omadaApi.odata.query(
        endpoint,
        bearerToken,
        impersonateUser,
        {
          filter: `${filterField} eq '${filterValue}'`
        }
      );

      if (result.status === 'success' && result.data?.length > 0) {
        console.log(`Loaded ${endpoint} details:`, result.data[0]);
        return {
          data: result.data[0],
          inspectorConfig,
          objectType: laneConfig.dataType,
          laneType
        };
      } else {
        console.warn(`No ${endpoint} found with ${filterField} = '${filterValue}'`);
        return null;
      }
    } catch (err) {
      console.error(`Error fetching ${endpoint} details:`, err);
      return null;
    }
  }, [getBearerToken, user]);

  /**
   * Handle pivot to a different node - fetch data appropriate for that node type
   * and return the focus node with its lanes
   * @param {object} node - The node being pivoted to (from a lane item)
   * @returns {Promise<object>} The pivot result with focusNode and lanes
   */
  const handlePivotToNode = useCallback(async (node) => {
    console.log('=== handlePivotToNode called ===');
    console.log('Node:', node);
    console.log('Node type:', node?.type);

    if (!node) return null;

    const bearerToken = getBearerToken();
    const impersonateUser = user?.email;

    try {
      // Import the data service functions
      const { buildLanesFromAssignments, extractUniqueReasonTypes } = await import('./accessLensDataService');

      // Different handling based on node type
      switch (node.type) {
        case 'Identity': {
          // Pivoting to an Identity - fetch their calculated assignments
          console.log('Pivoting to Identity:', node.displayName);

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
              {},
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

          if (assignmentsResult.status === 'success') {
            lanes = buildLanesFromAssignments(assignmentsResult.data, {});
            reasonTypes = extractUniqueReasonTypes(assignmentsResult.data);
            console.log('Built lanes from identity assignments:', lanes.length);
          }

          // Build contexts lane if available
          if (contextsResult.status === 'success' && contextsResult.data?.length > 0) {
            const { buildContextsLane } = await import('./accessLensDataService');
            const contextsLane = buildContextsLane(contextsResult.data, {});
            if (contextsLane) {
              lanes.push(contextsLane);
            }
          }

          return {
            focusNode: node,
            lanes,
            reasonTypes
          };
        }

        case 'System': {
          // Pivoting to a System - fetch assignments for that system
          console.log('Pivoting to System:', node.displayName);

          // Get the system ID from the node - could be in different places
          const systemId = node.id || node.rawData?.Id || node.rawData?.id || node.metadata?.id;
          const systemName = node.displayName || node.rawData?.Name || node.rawData?.name;

          if (!systemId) {
            console.error('No system ID found in node:', node);
            return null;
          }

          console.log('Fetching assignments for systemId:', systemId);

          // Fetch assignments filtered by this system using systemId parameter
          const assignmentsResult = await omadaApi.assignment.getCalculatedAssignmentsDetailed(
            null, // No identity filter - we're filtering by system instead
            bearerToken,
            impersonateUser,
            { systemId: systemId }, // Filter by system ID
            { page: 1, rows: 100 }
          );

          let lanes = [];
          let reasonTypes = [];
          let complianceStatuses = [];

          if (assignmentsResult.status === 'success') {
            console.log('System assignments loaded:', assignmentsResult.data?.length, 'items');
            if (assignmentsResult.data?.length > 0) {
              console.log('First system assignment sample:', assignmentsResult.data[0]);
            }

            // Build lanes for system-centric view:
            // - Identities (who has access to this system)
            // - Accounts (accounts on this system)
            // - Entitlements (resources on this system)
            // Note: We pass includeIdentities: true to add the Identities lane
            lanes = buildLanesFromAssignments(assignmentsResult.data, {}, { includeIdentities: true });
            reasonTypes = extractUniqueReasonTypes(assignmentsResult.data);

            // Extract compliance statuses for filtering
            const { extractUniqueComplianceStatuses } = await import('./accessLensDataService');
            complianceStatuses = extractUniqueComplianceStatuses(assignmentsResult.data);

            console.log('Built lanes for system-centric view:');
            lanes.forEach(lane => {
              console.log(`  - ${lane.laneType}: ${lane.items.length} items`);
            });
          } else {
            console.warn('Failed to load system assignments:', assignmentsResult);
          }

          return {
            focusNode: node,
            lanes,
            reasonTypes,
            complianceStatuses
          };
        }

        case 'Account': {
          // Pivoting to an Account - show related identity, system, and entitlements
          console.log('Pivoting to Account:', node.displayName);

          // For now, return the node with empty lanes
          // TODO: Implement account-centric view
          return {
            focusNode: node,
            lanes: [],
            reasonTypes: []
          };
        }

        case 'Entitlement': {
          // Pivoting to an Entitlement - show who has it, through which accounts, on which system
          console.log('Pivoting to Entitlement:', node.displayName);

          // Get the entitlement/resource ID and system ID from the node
          const resourceId = node.id || node.rawData?.id || node.metadata?.id;
          const systemId = node.metadata?.systemId || node.rawData?.system?.id || node.rawData?.systemId;

          if (!resourceId) {
            console.error('No resource ID found in node:', node);
            return { focusNode: node, lanes: [], reasonTypes: [] };
          }

          console.log('Entitlement resourceId:', resourceId);
          console.log('Entitlement systemId:', systemId);

          // Query assignments for the system that owns this entitlement
          // Then filter client-side by resourceId to get all assignments for this specific resource
          if (!systemId) {
            console.warn('No systemId available for entitlement, cannot fetch assignments');
            return { focusNode: node, lanes: [], reasonTypes: [] };
          }

          const assignmentsResult = await omadaApi.assignment.getCalculatedAssignmentsDetailed(
            null, // No identity filter
            bearerToken,
            impersonateUser,
            { systemId: systemId }, // Filter by the entitlement's system
            { page: 1, rows: 500 } // Get more results to find all identities with this entitlement
          );

          let lanes = [];
          let reasonTypes = [];
          let complianceStatuses = [];

          if (assignmentsResult.status === 'success' && assignmentsResult.data) {
            console.log('System assignments loaded:', assignmentsResult.data.length, 'items');

            // Filter assignments to only those for this specific resource/entitlement
            const filteredAssignments = assignmentsResult.data.filter(
              a => a.resource?.id === resourceId
            );

            console.log('Filtered to', filteredAssignments.length, 'assignments for this entitlement');

            if (filteredAssignments.length > 0) {
              // Build lanes for entitlement-centric view
              const { buildLanesForEntitlement, extractUniqueReasonTypes, extractUniqueComplianceStatuses } =
                await import('./accessLensDataService');

              lanes = buildLanesForEntitlement(filteredAssignments, {}, node);
              reasonTypes = extractUniqueReasonTypes(filteredAssignments);
              complianceStatuses = extractUniqueComplianceStatuses(filteredAssignments);

              console.log('Built entitlement-centric lanes:', lanes.length);
            }
          } else {
            console.warn('Failed to load system assignments:', assignmentsResult);
          }

          return {
            focusNode: node,
            lanes,
            reasonTypes,
            complianceStatuses
          };
        }

        default: {
          console.log('Unknown node type, returning node with empty lanes');
          return {
            focusNode: node,
            lanes: [],
            reasonTypes: []
          };
        }
      }
    } catch (err) {
      console.error('Error in handlePivotToNode:', err);
      return null;
    }
  }, [getBearerToken, user]);

  return (
    <div className="access-lens-page">
      <div className="access-lens-page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back
        </button>
        <h1>Access Lens</h1>
        {selectedIdentity && (
          <div className="selected-identity-info">
            <span className="identity-name">
              {selectedIdentity.DISPLAYNAME || `${selectedIdentity.FIRSTNAME || ''} ${selectedIdentity.LASTNAME || ''}`.trim()}
            </span>
            <button className="change-identity-btn" onClick={handleChangeIdentity}>
              Change
            </button>
          </div>
        )}
      </div>

      <div className="access-lens-page-content">
        {selectedIdentity ? (
          <>
            {isLoadingData && (
              <div className="data-loading-overlay">
                <div className="data-loading-spinner"></div>
                <p>Loading access data...</p>
              </div>
            )}
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
            />
          </>
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
        onClose={() => {
          console.log('AccessLensPage: onClose callback triggered');
          setShowSearchDialog(false);
        }}
        onSelectIdentity={handleIdentitySelect}
      />
    </div>
  );
};

export default AccessLensPage;
