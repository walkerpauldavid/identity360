/**
 * Access Lens Page
 * Standalone fullscreen page for the Access Lens component
 * Prompts for identity selection when opened from toolbar
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { omadaApi } from '../../services/omadaApi';
import Navbar from '../layout/Navbar';
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
  const [loadingStatus, setLoadingStatus] = useState(''); // Current loading step description
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
    setLoadingStatus('Retrieving identity profile...');

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

      // Update status for assignments fetch
      setLoadingStatus('Calculating effective access assignments...');

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
        const assignmentCount = assignmentsResult.data?.length || 0;
        setCalculatedAssignments(assignmentsResult.data);
        console.log('Loaded calculated assignments:', assignmentCount, 'items');
        if (assignmentsResult.data?.length > 0) {
          console.log('First assignment sample:', assignmentsResult.data[0]);
        }

        // Update status for system details fetch
        setLoadingStatus(`Enriching system metadata for ${assignmentCount} assignments...`);

        // Fetch system details for all unique systems in the assignments
        console.log('[System OData] Starting system details fetch...');
        const systemDetails = await fetchAllSystemDetails(
          assignmentsResult.data,
          bearerToken,
          impersonateUser
        );
        const systemCount = Object.keys(systemDetails).length;
        console.log('[System OData] Setting systemDetailsMap with', systemCount, 'systems');
        setSystemDetailsMap(systemDetails);

        // Update status for final processing
        setLoadingStatus('Building access relationship graph...');
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
      setLoadingStatus('');
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
   * @param {object} filters - Optional filters to apply (e.g., { complianceStatus: 'Not Approved' })
   * @returns {Promise<object>} The pivot result with focusNode and lanes
   */
  const handlePivotToNode = useCallback(async (node, filters = {}) => {
    console.log('=== handlePivotToNode called ===');
    console.log('Node:', node);
    console.log('Node type:', node?.type);
    console.log('Filters:', filters);

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
          console.log('=== ENTITLEMENT PIVOT START ===');
          console.log('Pivoting to Entitlement:', node.displayName);
          console.log('Full node object:', JSON.stringify(node, null, 2));

          // Get the entitlement/resource ID, name, and system ID from the node
          // Debug: Log all possible ID sources to find the correct resource UUID
          console.log('=== Extracting resource identifiers ===');
          console.log('node:', node);
          console.log('node.id:', node.id, '- type:', typeof node.id);
          console.log('node.rawData?.id:', node.rawData?.id);
          console.log('node.metadata?.id:', node.metadata?.id);
          console.log('node.rawData?.resource?.id:', node.rawData?.resource?.id);

          // The resource ID should be a UUID like "9968085c-aa3b-4238-a334-0330a0188bc4"
          // Check each possible source
          const possibleIds = {
            'node.id': node.id,
            'node.rawData?.id': node.rawData?.id,
            'node.rawData?.resource?.id': node.rawData?.resource?.id,
            'node.metadata?.id': node.metadata?.id
          };
          console.log('Possible resource IDs:', possibleIds);

          // Use the first valid UUID we find
          const resourceId = node.id || node.rawData?.id || node.rawData?.resource?.id || node.metadata?.id;
          const resourceName = node.displayName || node.rawData?.name || node.metadata?.name;
          const systemId = node.metadata?.systemId || node.rawData?.system?.id || node.rawData?.systemId;

          // Validate that we have the resource ID (should be a UUID)
          if (!resourceId) {
            console.error('No resource ID found in node. Full node object:', JSON.stringify(node, null, 2));
            return { focusNode: node, lanes: [], reasonTypes: [] };
          }

          // Warn if resourceId doesn't look like a UUID
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidPattern.test(resourceId)) {
            console.warn('resourceId does not appear to be a UUID:', resourceId);
            console.warn('This may cause the API call to fail. Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
          }

          console.log('Entitlement resourceId:', resourceId);
          console.log('Entitlement resourceName:', resourceName);
          console.log('Entitlement systemId:', systemId);

          // Extract complianceStatus from filters if provided
          const complianceStatus = filters.complianceStatus || null;
          console.log('Entitlement complianceStatus filter:', complianceStatus);

          // Use the dedicated API to fetch identities having this resource
          console.log('Calling getIdentitiesHavingResource API...');
          let assignmentsResult;
          try {
            assignmentsResult = await omadaApi.assignment.getIdentitiesHavingResource(
              resourceId,
              resourceName,
              bearerToken,
              impersonateUser,
              { page: 1, rows: 100 },
              systemId,
              complianceStatus  // Pass the compliance filter to the API
            );
            console.log('API call completed. Result:', assignmentsResult);
          } catch (apiError) {
            console.error('API call failed with error:', apiError);
            return { focusNode: node, lanes: [], reasonTypes: [] };
          }

          let lanes = [];
          let reasonTypes = [];
          let complianceStatuses = [];

          if (assignmentsResult.status === 'success' && assignmentsResult.data) {
            console.log('Identities having resource loaded:', assignmentsResult.data.length, 'items');

            if (assignmentsResult.data.length > 0) {
              console.log('First assignment sample:', JSON.stringify(assignmentsResult.data[0], null, 2));

              // Extract unique identity UUIDs for OData enrichment (use UUID, not identityId code)
              const uniqueIdentityUIds = [...new Set(
                assignmentsResult.data
                  .map(a => a.identity?.id)  // Use UUID (id) not identityId code
                  .filter(Boolean)
              )];
              console.log('Unique identity UUIDs for OData enrichment:', uniqueIdentityUIds);

              // Also log the identity codes for debugging
              const identityIdCodes = [...new Set(
                assignmentsResult.data
                  .map(a => a.identity?.identityId)
                  .filter(Boolean)
              )];
              console.log('Identity ID codes (for reference):', identityIdCodes);

              // Fetch additional identity details via OData (email, title, etc.)
              // Batch requests to avoid URL length limits (max ~50 UUIDs per request)
              let identityDetailsMap = {};
              // Fetch identity details one at a time to avoid URL length/batch issues
              // Limit to first 50 identities to avoid too many requests
              const MAX_IDENTITIES_TO_ENRICH = 50;
              const identitiesToFetch = uniqueIdentityUIds.slice(0, MAX_IDENTITIES_TO_ENRICH);
              console.log(`uniqueIdentityUIds.length: ${uniqueIdentityUIds.length}, fetching first ${identitiesToFetch.length}`);

              if (identitiesToFetch.length > 0) {
                console.log('Entering OData enrichment block...');
                try {
                  console.log(`Fetching identity details via OData (${identitiesToFetch.length} identities, one at a time)...`);

                  // Process one at a time
                  let successCount = 0;
                  let errorCount = 0;

                  for (let i = 0; i < identitiesToFetch.length; i++) {
                    const uid = identitiesToFetch[i];

                    // Log progress every 10 identities
                    if (i % 10 === 0) {
                      console.log(`OData identity fetch progress: ${i}/${identitiesToFetch.length}`);
                    }

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
                        if (i === 0) {
                          console.log('First OData identity sample:', ident);
                        }
                        identityDetailsMap[ident.UId] = {
                          email: ident.EMAIL,
                          title: ident.JOBTITLE,
                          employeeId: ident.EMPLOYEEID || ident.IDENTITYID,
                          firstName: ident.FIRSTNAME,
                          lastName: ident.LASTNAME,
                          displayName: ident.DISPLAYNAME
                        };
                        successCount++;
                      } else {
                        errorCount++;
                        if (errorCount <= 3) {
                          console.warn(`OData identity fetch failed for ${uid}:`, odataResult);
                        }
                      }
                    } catch (singleError) {
                      errorCount++;
                      if (errorCount <= 3) {
                        console.warn(`OData identity fetch error for ${uid}:`, singleError.message);
                      }
                    }
                  }

                  console.log(`Identity enrichment complete: ${successCount} success, ${errorCount} errors`);
                  console.log('Identity details map total keys:', Object.keys(identityDetailsMap).length);
                  if (Object.keys(identityDetailsMap).length > 0) {
                    console.log('Sample identity from map:', Object.values(identityDetailsMap)[0]);
                  }
                } catch (odataError) {
                  console.warn('Failed to fetch identity details via OData:', odataError);
                  // Continue without enrichment - not critical
                }
              }

              // Enrich assignments with OData details before building lanes
              const enrichedAssignments = assignmentsResult.data.map(assignment => {
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

              // Build lanes for entitlement-centric view
              const { buildLanesForEntitlement, extractUniqueReasonTypes, extractUniqueComplianceStatuses } =
                await import('./accessLensDataService');

              console.log('Building lanes for entitlement-centric view...');
              lanes = buildLanesForEntitlement(enrichedAssignments, {}, node);
              reasonTypes = extractUniqueReasonTypes(enrichedAssignments);
              complianceStatuses = extractUniqueComplianceStatuses(enrichedAssignments);

              console.log('Built entitlement-centric lanes:', lanes.length);
              lanes.forEach(lane => {
                console.log(`  - ${lane.laneType}: ${lane.items.length} items`);
              });
            } else {
              console.warn('API returned success but no assignments found for this resource');
            }
          } else {
            console.error('API call failed or returned no data');
            console.error('assignmentsResult.status:', assignmentsResult?.status);
            console.error('assignmentsResult.error:', assignmentsResult?.error);
            console.error('Full result:', assignmentsResult);
          }

          console.log('=== ENTITLEMENT PIVOT END ===');
          console.log('Returning lanes:', lanes.length);

          // Fetch Resource details from OData to get owner information
          let resourceOwners = null;
          try {
            console.log('Fetching Resource details via OData for owner info...');
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
              const resourceData = resourceOdataResult.data[0];
              console.log('Resource OData details:', resourceData);

              // Extract owner information
              // OWNERREF and EXPLICITOWNER are typically arrays of identity references
              const ownerRef = resourceData.OWNERREF;
              const explicitOwner = resourceData.EXPLICITOWNER;

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

              console.log('Parsed resource owners:', resourceOwners);
            }
          } catch (ownerError) {
            console.warn('Failed to fetch Resource owner details via OData:', ownerError);
            // Continue without owner info - not critical
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
              description: node.metadata?.description || node.rawData?.description,
              // Owner information from OData
              owners: resourceOwners?.owners || [],
              explicitOwners: resourceOwners?.explicitOwners || [],
              allOwners: resourceOwners?.allOwners || []
            },
            // Clean rawData - only entitlement properties, no relationship data
            rawData: {
              id: resourceId,
              name: resourceName,
              description: node.rawData?.description || node.rawData?.resource?.description,
              system: node.rawData?.system || node.rawData?.resource?.system,
              resourceType: node.rawData?.resourceType || node.rawData?.resource?.resourceType,
              resourceCategory: node.rawData?.resourceCategory || node.rawData?.resource?.resourceCategory,
              resourceFolder: node.rawData?.resourceFolder || node.rawData?.resource?.resourceFolder,
              maxValidity: node.rawData?.maxValidity || node.rawData?.resource?.maxValidity,
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

          console.log('Clean entitlement node (no relationship data):', cleanEntitlementNode);

          return {
            focusNode: cleanEntitlementNode,
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
      {/* Omada Top Banner */}
      <Navbar title="Access Lens" />

      <div className="access-lens-page-content">
        {selectedIdentity ? (
          <>
            {/* Show loading overlay while fetching data - don't render AccessLens until we have full identity data */}
            {isLoadingData ? (
              <div className="data-loading-overlay">
                <div className="data-loading-spinner"></div>
                <h3 className="loading-title">Populating Access Lens</h3>
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
                />
              </>
            )}
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
