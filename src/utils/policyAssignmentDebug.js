/**
 * Policy Assignment Debug Utility
 *
 * Fetches all calculated assignments for a system and analyzes
 * which identities have entitlements assigned by multiple policies.
 *
 * Usage:
 *   import { analyzeMultiplePolicyAssignments } from './utils/policyAssignmentDebug';
 *
 *   // In a component with access to omadaApi context:
 *   const results = await analyzeMultiplePolicyAssignments(
 *     '35cc1d03-a6bd-46e5-95a8-77156232bf3d',
 *     omadaApi,
 *     bearerToken,
 *     impersonateUser
 *   );
 *   console.log(results);
 */

/**
 * Fetch all pages of calculated assignments for a system
 * @param {string} systemId - System UUID
 * @param {Object} omadaApi - Omada API instance
 * @param {string} bearerToken - OAuth bearer token
 * @param {string} impersonateUser - User email for impersonation
 * @param {Function} onProgress - Optional callback for progress updates
 * @returns {Promise<Array>} All assignments
 */
export async function fetchAllPagesForSystem(systemId, omadaApi, bearerToken, impersonateUser, onProgress = null) {
  const allAssignments = [];
  const rowsPerPage = 100;
  let currentPage = 1;
  let totalPages = 1;
  let totalRecords = 0;

  console.log(`[PolicyDebug] Starting fetch for system: ${systemId}`);

  while (currentPage <= totalPages) {
    if (onProgress) {
      onProgress({ currentPage, totalPages, fetchedSoFar: allAssignments.length });
    }

    console.log(`[PolicyDebug] Fetching page ${currentPage}/${totalPages}...`);

    // Note: omadaApi.assignment contains the assignment methods
    // getCalculatedAssignmentsDetailed(identityIds, bearerToken, impersonateUser, filters, pagination)
    const result = await omadaApi.assignment.getCalculatedAssignmentsDetailed(
      null, // no identityIds - we're filtering by system
      bearerToken,
      impersonateUser,
      { systemId },
      { page: currentPage, rows: rowsPerPage }
    );

    if (result.status !== 'success') {
      console.error(`[PolicyDebug] Error fetching page ${currentPage}:`, result);
      break;
    }

    const assignments = result.data || [];
    allAssignments.push(...assignments);

    // Update pagination info from first response
    if (currentPage === 1) {
      totalPages = result.pages || 1;
      totalRecords = result.total || 0;
      console.log(`[PolicyDebug] Total pages: ${totalPages}, Total records: ${totalRecords}`);
    }

    currentPage++;
  }

  console.log(`[PolicyDebug] Fetch complete. Total assignments: ${allAssignments.length}`);
  return allAssignments;
}

/**
 * Filter assignments by reason type
 * @param {Array} assignments - Array of assignment objects
 * @param {string} reasonTypeFilter - Reason type to filter by (e.g., 'Policy', 'Direct')
 * @returns {Array} Filtered assignments
 */
export function filterByReasonType(assignments, reasonTypeFilter) {
  const filtered = assignments.filter(assignment => {
    const reasonType = assignment.reason?.reasonType || '';
    return reasonType.toLowerCase().includes(reasonTypeFilter.toLowerCase());
  });

  console.log(`[PolicyDebug] Filtered by reasonType "${reasonTypeFilter}": ${filtered.length} of ${assignments.length}`);
  return filtered;
}

/**
 * Analyze assignments to find identities with entitlements from multiple policies
 * @param {Array} assignments - Array of policy-filtered assignments
 * @returns {Object} Analysis results
 */
export function analyzeMultiplePolicies(assignments) {
  // Group by identity
  const identityMap = new Map();

  assignments.forEach(assignment => {
    const identityId = assignment.identity?.id || assignment.identity?.identityId;
    const identityName = assignment.identity?.displayName ||
                         `${assignment.identity?.firstName || ''} ${assignment.identity?.lastName || ''}`.trim();

    if (!identityId) return;

    if (!identityMap.has(identityId)) {
      identityMap.set(identityId, {
        identityId,
        identityName,
        policies: new Map(),
        entitlements: [],
        assignments: []
      });
    }

    const identityData = identityMap.get(identityId);

    // Extract policy info from reason
    const policyInfo = extractPolicyInfo(assignment.reason);
    if (policyInfo) {
      if (!identityData.policies.has(policyInfo.id || policyInfo.name)) {
        identityData.policies.set(policyInfo.id || policyInfo.name, policyInfo);
      }
    }

    // Track entitlement
    const entitlement = {
      id: assignment.resource?.id,
      name: assignment.resource?.name,
      system: assignment.resource?.system?.name,
      policyName: policyInfo?.name,
      policyId: policyInfo?.id,
      complianceStatus: assignment.complianceStatus
    };
    identityData.entitlements.push(entitlement);
    identityData.assignments.push(assignment);
  });

  // Find identities with multiple policies
  const multiPolicyIdentities = [];
  const singlePolicyIdentities = [];

  identityMap.forEach((data, identityId) => {
    const policyCount = data.policies.size;
    const summary = {
      identityId,
      identityName: data.identityName,
      policyCount,
      policies: Array.from(data.policies.values()),
      entitlementCount: data.entitlements.length,
      entitlements: data.entitlements,
      // Group entitlements by policy
      entitlementsByPolicy: groupEntitlementsByPolicy(data.entitlements)
    };

    if (policyCount > 1) {
      multiPolicyIdentities.push(summary);
    } else {
      singlePolicyIdentities.push(summary);
    }
  });

  // Sort by policy count (descending)
  multiPolicyIdentities.sort((a, b) => b.policyCount - a.policyCount);

  return {
    summary: {
      totalAssignments: assignments.length,
      uniqueIdentities: identityMap.size,
      identitiesWithMultiplePolicies: multiPolicyIdentities.length,
      identitiesWithSinglePolicy: singlePolicyIdentities.length
    },
    multiPolicyIdentities,
    singlePolicyIdentities,
    // Additional analytics
    policyDistribution: calculatePolicyDistribution(identityMap)
  };
}

/**
 * Extract policy information from assignment reason
 */
function extractPolicyInfo(reason) {
  if (!reason) return null;

  const reasonType = reason.reasonType || '';
  const description = reason.description || '';

  // Check if this is a policy-based assignment
  if (!reasonType.toLowerCase().includes('policy')) {
    return null;
  }

  // Try to extract policy name from description
  // Common patterns: "Assigned by policy: PolicyName" or "Policy: PolicyName"
  let policyName = description;

  const policyPatterns = [
    /assigned by policy[:\s]+(.+)/i,
    /policy[:\s]+(.+)/i,
    /^(.+)$/i  // fallback: use entire description
  ];

  for (const pattern of policyPatterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      policyName = match[1].trim();
      break;
    }
  }

  return {
    id: reason.causeObjectKey || null,
    name: policyName,
    reasonType,
    description
  };
}

/**
 * Group entitlements by their assigning policy
 */
function groupEntitlementsByPolicy(entitlements) {
  const byPolicy = {};

  entitlements.forEach(ent => {
    const key = ent.policyName || 'Unknown Policy';
    if (!byPolicy[key]) {
      byPolicy[key] = [];
    }
    byPolicy[key].push({
      id: ent.id,
      name: ent.name,
      system: ent.system,
      complianceStatus: ent.complianceStatus
    });
  });

  return byPolicy;
}

/**
 * Calculate distribution of policies across identities
 */
function calculatePolicyDistribution(identityMap) {
  const allPolicies = new Map();

  identityMap.forEach((data) => {
    data.policies.forEach((policy, policyKey) => {
      if (!allPolicies.has(policyKey)) {
        allPolicies.set(policyKey, {
          ...policy,
          identityCount: 0,
          entitlementCount: 0
        });
      }
      const policyData = allPolicies.get(policyKey);
      policyData.identityCount++;
      policyData.entitlementCount += data.entitlements.filter(e =>
        (e.policyId === policyKey) || (e.policyName === policyKey)
      ).length;
    });
  });

  return Array.from(allPolicies.values()).sort((a, b) => b.identityCount - a.identityCount);
}

/**
 * Main analysis function - fetches all data and performs analysis
 * @param {string} systemId - System UUID
 * @param {Object} omadaApi - Omada API instance
 * @param {string} bearerToken - OAuth bearer token
 * @param {string} impersonateUser - User email for impersonation
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise<Object>} Complete analysis results
 */
export async function analyzeMultiplePolicyAssignments(
  systemId,
  omadaApi,
  bearerToken,
  impersonateUser,
  onProgress = null
) {
  console.log('='.repeat(60));
  console.log('[PolicyDebug] Starting Multi-Policy Assignment Analysis');
  console.log(`[PolicyDebug] System ID: ${systemId}`);
  console.log('='.repeat(60));

  // Step 1: Fetch all pages
  const allAssignments = await fetchAllPagesForSystem(
    systemId,
    omadaApi,
    bearerToken,
    impersonateUser,
    onProgress
  );

  // Step 2: Filter by reason type = Policy
  const policyAssignments = filterByReasonType(allAssignments, 'Policy');

  // Step 3: Analyze for multiple policies
  const analysis = analyzeMultiplePolicies(policyAssignments);

  // Step 4: Log results
  console.log('='.repeat(60));
  console.log('[PolicyDebug] ANALYSIS RESULTS');
  console.log('='.repeat(60));
  console.log(`Total assignments fetched: ${allAssignments.length}`);
  console.log(`Policy-based assignments: ${policyAssignments.length}`);
  console.log(`Unique identities: ${analysis.summary.uniqueIdentities}`);
  console.log(`Identities with MULTIPLE policies: ${analysis.summary.identitiesWithMultiplePolicies}`);
  console.log(`Identities with single policy: ${analysis.summary.identitiesWithSinglePolicy}`);
  console.log('');

  if (analysis.multiPolicyIdentities.length > 0) {
    console.log('='.repeat(60));
    console.log('[PolicyDebug] IDENTITIES WITH MULTIPLE POLICIES:');
    console.log('='.repeat(60));

    analysis.multiPolicyIdentities.forEach((identity, index) => {
      console.log(`\n${index + 1}. ${identity.identityName} (${identity.identityId})`);
      console.log(`   Policies (${identity.policyCount}):`);
      identity.policies.forEach(policy => {
        console.log(`   - ${policy.name} (${policy.id || 'no ID'})`);
      });
      console.log(`   Total entitlements: ${identity.entitlementCount}`);
      console.log('   Entitlements by policy:');
      Object.entries(identity.entitlementsByPolicy).forEach(([policyName, ents]) => {
        console.log(`   [${policyName}]: ${ents.length} entitlements`);
        ents.slice(0, 3).forEach(e => {
          console.log(`     - ${e.name} (${e.system})`);
        });
        if (ents.length > 3) {
          console.log(`     ... and ${ents.length - 3} more`);
        }
      });
    });
  } else {
    console.log('[PolicyDebug] No identities found with multiple policies.');
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('[PolicyDebug] POLICY DISTRIBUTION:');
  console.log('='.repeat(60));
  analysis.policyDistribution.forEach(policy => {
    console.log(`- ${policy.name}: ${policy.identityCount} identities, ${policy.entitlementCount} entitlements`);
  });

  return {
    systemId,
    rawData: {
      allAssignments,
      policyAssignments
    },
    analysis
  };
}

/**
 * Quick check function - just returns summary without full data
 */
export async function quickCheckMultiplePolicies(
  systemId,
  omadaApi,
  bearerToken,
  impersonateUser
) {
  const result = await analyzeMultiplePolicyAssignments(
    systemId,
    omadaApi,
    bearerToken,
    impersonateUser
  );

  // Return just the summary and multi-policy identities (without raw data)
  return {
    systemId,
    summary: result.analysis.summary,
    multiPolicyIdentities: result.analysis.multiPolicyIdentities,
    policyDistribution: result.analysis.policyDistribution
  };
}

/**
 * Save data to a downloadable JSON file
 * @param {Object} data - Data to save
 * @param {string} filename - Filename (without extension)
 */
export function saveToJsonFile(data, filename = 'policy-analysis') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fullFilename = `${filename}-${timestamp}.json`;

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fullFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log(`[PolicyDebug] Saved to file: ${fullFilename}`);
  return fullFilename;
}

/**
 * Main analysis function with automatic file save
 * @param {string} systemId - System UUID
 * @param {Object} omadaApi - Omada API instance
 * @param {string} bearerToken - OAuth bearer token
 * @param {string} impersonateUser - User email for impersonation
 * @param {Object} options - Options
 * @param {boolean} options.saveToFile - Whether to save results to file (default: true)
 * @param {boolean} options.saveRawData - Whether to include raw data in file (default: false, saves space)
 * @param {Function} options.onProgress - Optional progress callback
 * @returns {Promise<Object>} Complete analysis results
 */
export async function analyzeAndSave(
  systemId,
  omadaApi,
  bearerToken,
  impersonateUser,
  options = {}
) {
  const {
    saveToFile = true,
    saveRawData = false,
    onProgress = null
  } = options;

  const result = await analyzeMultiplePolicyAssignments(
    systemId,
    omadaApi,
    bearerToken,
    impersonateUser,
    onProgress
  );

  if (saveToFile && result) {
    // Prepare data for file - optionally exclude raw data to reduce file size
    const fileData = saveRawData ? result : {
      systemId: result.systemId,
      generatedAt: new Date().toISOString(),
      analysis: result.analysis
    };

    saveToJsonFile(fileData, `policy-analysis-${systemId.slice(0, 8)}`);
  }

  return result;
}

/**
 * Save just the raw assignments to a file (for custom analysis)
 */
export async function fetchAndSaveRaw(
  systemId,
  omadaApi,
  bearerToken,
  impersonateUser,
  onProgress = null
) {
  const assignments = await fetchAllPagesForSystem(
    systemId,
    omadaApi,
    bearerToken,
    impersonateUser,
    onProgress
  );

  const fileData = {
    systemId,
    generatedAt: new Date().toISOString(),
    totalAssignments: assignments.length,
    assignments
  };

  saveToJsonFile(fileData, `raw-assignments-${systemId.slice(0, 8)}`);
  return assignments;
}

/**
 * Save policy-filtered assignments to a file
 */
export async function fetchPolicyAssignmentsAndSave(
  systemId,
  omadaApi,
  bearerToken,
  impersonateUser,
  onProgress = null
) {
  const allAssignments = await fetchAllPagesForSystem(
    systemId,
    omadaApi,
    bearerToken,
    impersonateUser,
    onProgress
  );

  const policyAssignments = filterByReasonType(allAssignments, 'Policy');

  const fileData = {
    systemId,
    generatedAt: new Date().toISOString(),
    filter: 'reasonType contains Policy',
    totalRaw: allAssignments.length,
    totalFiltered: policyAssignments.length,
    assignments: policyAssignments
  };

  saveToJsonFile(fileData, `policy-assignments-${systemId.slice(0, 8)}`);
  return policyAssignments;
}

// Export a helper to run from browser console
export function createConsoleHelper(omadaApi, bearerToken, impersonateUser) {
  return {
    analyze: (systemId) => analyzeMultiplePolicyAssignments(
      systemId, omadaApi, bearerToken, impersonateUser
    ),
    quickCheck: (systemId) => quickCheckMultiplePolicies(
      systemId, omadaApi, bearerToken, impersonateUser
    )
  };
}
