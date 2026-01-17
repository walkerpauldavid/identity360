/**
 * Custom React Hooks for Omada API
 * Uses React Query (@tanstack/react-query) for data fetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { omadaApi } from '../services/omadaApi';

/**
 * Hook for getting total identity count
 * @param {string} bearerToken - OAuth token
 * @param {string} impersonateUser - User email
 * @returns {Object} Query result
 */
export const useGetIdentityCount = (bearerToken, impersonateUser) => {
  return useQuery({
    queryKey: ['identities', 'count', impersonateUser],
    queryFn: () => omadaApi.identity.searchIdentities({}, bearerToken, impersonateUser, {
      top: 1,  // Get first page only - @odata.count is in first page response
      select: null,
      skip: 0,
      orderBy: null
    }),
    enabled: !!bearerToken && !!impersonateUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => ({ total: data.total })
  });
};

/**
 * Hook for searching identities
 * @param {Object} filters - Search filters
 * @param {string} bearerToken - OAuth token
 * @param {string} impersonateUser - User email
 * @param {Object} options - Query options
 * @returns {Object} Query result
 */
export const useSearchIdentities = (filters, bearerToken, impersonateUser, options = {}) => {
  return useQuery({
    queryKey: ['identities', 'search', filters, impersonateUser],
    queryFn: () => omadaApi.identity.searchIdentities(filters, bearerToken, impersonateUser, options),
    enabled: !!bearerToken && !!impersonateUser && Object.keys(filters).length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options
  });
};

/**
 * Hook for getting identity by ID
 * @param {string} identityId - Identity ID
 * @param {string} bearerToken - OAuth token
 * @param {string} impersonateUser - User email
 * @returns {Object} Query result
 */
export const useGetIdentityById = (identityId, bearerToken, impersonateUser) => {
  return useQuery({
    queryKey: ['identity', identityId, impersonateUser],
    queryFn: () => omadaApi.identity.getIdentityById(identityId, bearerToken, impersonateUser),
    enabled: !!identityId && !!bearerToken && !!impersonateUser,
    staleTime: 10 * 60 * 1000 // 10 minutes
  });
};

/**
 * Hook for getting identity contexts
 * @param {string} identityUId - Identity UId (GUID)
 * @param {string} bearerToken - OAuth token
 * @param {string} impersonateUser - User email
 * @returns {Object} Query result
 */
export const useGetIdentityContexts = (identityUId, bearerToken, impersonateUser) => {
  return useQuery({
    queryKey: ['identity', 'contexts', identityUId, impersonateUser],
    queryFn: () => omadaApi.identity.getIdentityContexts(identityUId, bearerToken, impersonateUser),
    enabled: !!identityUId && !!bearerToken && !!impersonateUser,
    staleTime: 15 * 60 * 1000 // 15 minutes
  });
};

/**
 * Hook for getting access requests total count (summary only)
 * @param {string} bearerToken - OAuth token
 * @param {string} impersonateUser - User email
 * @returns {Object} Query result
 */
export const useGetAccessRequestsTotal = (bearerToken, impersonateUser) => {
  return useQuery({
    queryKey: ['accessRequests', 'total', impersonateUser],
    queryFn: () => omadaApi.accessRequest.getAccessRequestsTotal(bearerToken, impersonateUser),
    enabled: !!bearerToken && !!impersonateUser,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    select: (data) => ({ total: data.total })
  });
};

/**
 * Hook for getting access requests
 * @param {string} bearerToken - OAuth token
 * @param {string} impersonateUser - User email
 * @returns {Object} Query result
 */
export const useGetAccessRequests = (bearerToken, impersonateUser) => {
  return useQuery({
    queryKey: ['accessRequests', impersonateUser],
    queryFn: () => omadaApi.accessRequest.getAccessRequests(bearerToken, impersonateUser),
    enabled: !!bearerToken && !!impersonateUser,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000 // Refresh every 5 minutes
  });
};

/**
 * Hook for getting resources for beneficiary
 * @param {string} identityUId - Identity UId (GUID)
 * @param {string} bearerToken - OAuth token
 * @param {string} impersonateUser - User email
 * @param {Object} filters - Optional filters
 * @returns {Object} Query result
 */
export const useGetResourcesForBeneficiary = (identityUId, bearerToken, impersonateUser, filters = {}) => {
  return useQuery({
    queryKey: ['resources', 'beneficiary', identityUId, filters, impersonateUser],
    queryFn: () => omadaApi.accessRequest.getResourcesForBeneficiary(
      identityUId,
      bearerToken,
      impersonateUser,
      filters
    ),
    enabled: !!identityUId && !!bearerToken && !!impersonateUser,
    staleTime: 10 * 60 * 1000 // 10 minutes
  });
};

/**
 * Hook for creating access request (mutation)
 * @param {string} bearerToken - OAuth token
 * @param {string} impersonateUser - User email
 * @returns {Object} Mutation result
 */
export const useCreateAccessRequest = (bearerToken, impersonateUser) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestData) =>
      omadaApi.accessRequest.createAccessRequest(requestData, bearerToken, impersonateUser),
    onSuccess: () => {
      // Invalidate and refetch access requests
      queryClient.invalidateQueries({ queryKey: ['accessRequests'] });
    }
  });
};

/**
 * Hook for getting pending approvals
 * @param {string} bearerToken - OAuth token
 * @param {string} impersonateUser - User email
 * @param {string} workflowStep - Optional workflow step filter
 * @param {boolean} summaryMode - Summary mode flag
 * @returns {Object} Query result
 */
export const useGetPendingApprovals = (
  bearerToken,
  impersonateUser,
  workflowStep = null,
  summaryMode = true
) => {
  return useQuery({
    queryKey: ['approvals', 'pending', workflowStep, summaryMode, impersonateUser],
    queryFn: () => omadaApi.approval.getPendingApprovals(
      bearerToken,
      impersonateUser,
      workflowStep,
      summaryMode
    ),
    enabled: !!bearerToken && !!impersonateUser,
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 3 * 60 * 1000 // Refresh every 3 minutes
  });
};

/**
 * Hook for making approval decision (mutation)
 * @param {string} bearerToken - OAuth token
 * @param {string} impersonateUser - User email
 * @returns {Object} Mutation result
 */
export const useMakeApprovalDecision = (bearerToken, impersonateUser) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ surveyId, surveyObjectKey, decision }) =>
      omadaApi.approval.makeApprovalDecision(
        surveyId,
        surveyObjectKey,
        decision,
        bearerToken,
        impersonateUser
      ),
    onSuccess: () => {
      // Invalidate pending approvals to refresh the list
      queryClient.invalidateQueries({ queryKey: ['approvals', 'pending'] });
    }
  });
};

/**
 * Hook for getting calculated assignments
 * @param {string|Array} identityUIds - Identity UId(s)
 * @param {string} bearerToken - OAuth token
 * @param {string} impersonateUser - User email
 * @param {Object} filters - Optional filters
 * @param {Object} pagination - Pagination options
 * @returns {Object} Query result
 */
export const useGetCalculatedAssignments = (
  identityUIds,
  bearerToken,
  impersonateUser,
  filters = {},
  pagination = {}
) => {
  return useQuery({
    queryKey: ['assignments', 'calculated', identityUIds, filters, pagination, impersonateUser],
    queryFn: () => omadaApi.assignment.getCalculatedAssignmentsDetailed(
      identityUIds,
      bearerToken,
      impersonateUser,
      filters,
      pagination
    ),
    enabled: !!identityUIds && !!bearerToken && !!impersonateUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    keepPreviousData: true // Keep previous data while fetching new page
  });
};

/**
 * Hook for getting all identities with pagination
 * @param {string} bearerToken - OAuth token
 * @param {string} impersonateUser - User email
 * @param {number} pageSize - Number of records per page
 * @returns {Object} Query result
 */
export const useGetAllIdentities = (bearerToken, impersonateUser, pageSize = 50) => {
  return useQuery({
    queryKey: ['identities', 'all', pageSize, impersonateUser],
    queryFn: () => omadaApi.identity.searchIdentities({}, bearerToken, impersonateUser, {
      top: pageSize,
      skip: 0,
      orderBy: 'DISPLAYNAME' // Sort by name (grouping happens client-side)
    }),
    enabled: !!bearerToken && !!impersonateUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });
};

/**
 * Hook for getting identity category counts efficiently (uses OData $count with category IDs)
 * Discovers categories from a sample, then gets accurate counts by ID
 * @param {string} bearerToken - OAuth token
 * @param {string} impersonateUser - User email
 * @returns {Object} Query result
 */
export const useGetIdentityCategoryCounts = (bearerToken, impersonateUser) => {
  return useQuery({
    queryKey: ['identities', 'categoryCounts', impersonateUser],
    queryFn: () => omadaApi.identity.getIdentityCategoryCounts(bearerToken, impersonateUser),
    enabled: !!bearerToken && !!impersonateUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });
};

/**
 * Hook for getting identities by category ID (for accordion expansion)
 * @param {number} categoryId - Category ID
 * @param {string} bearerToken - OAuth token
 * @param {string} impersonateUser - User email
 * @param {boolean} enabled - Whether to fetch data
 * @returns {Object} Query result
 */
export const useGetIdentitiesByCategoryId = (categoryId, bearerToken, impersonateUser, enabled = true) => {
  return useQuery({
    queryKey: ['identities', 'byCategoryId', categoryId, impersonateUser],
    queryFn: () => omadaApi.identity.getIdentitiesByCategoryId(
      categoryId,
      bearerToken,
      impersonateUser,
      {
        top: 1000,
        skip: 0,
        orderBy: 'DISPLAYNAME'
      }
    ),
    enabled: enabled && !!bearerToken && !!impersonateUser && !!categoryId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });
};
