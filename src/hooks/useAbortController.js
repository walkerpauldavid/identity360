/**
 * useAbortController Hook
 * H-04 Fix: Provides AbortController management for React components
 * Automatically cancels pending requests on unmount or when dependencies change
 */

import { useRef, useEffect, useCallback } from 'react';
import { createAbortController, clearAbortController, cancelRequestsByPrefix } from '../services/omadaApi';

/**
 * Hook to manage abort controllers for API requests
 * @param {string} prefix - Prefix for request keys (e.g., 'identity360')
 * @returns {Object} { getSignal, cancelAll }
 */
export const useAbortController = (prefix = 'default') => {
  const activeKeys = useRef(new Set());

  /**
   * Get an abort signal for a specific request
   * Cancels any previous request with the same key
   * @param {string} key - Unique key for this request type
   * @returns {AbortSignal} Signal to pass to fetch/API calls
   */
  const getSignal = useCallback((key) => {
    const fullKey = `${prefix}:${key}`;
    activeKeys.current.add(fullKey);
    const controller = createAbortController(fullKey);
    return controller.signal;
  }, [prefix]);

  /**
   * Clear a specific request (call after request completes successfully)
   * @param {string} key - Key of the completed request
   */
  const clearRequest = useCallback((key) => {
    const fullKey = `${prefix}:${key}`;
    activeKeys.current.delete(fullKey);
    clearAbortController(fullKey);
  }, [prefix]);

  /**
   * Cancel all requests with this prefix
   */
  const cancelAll = useCallback(() => {
    cancelRequestsByPrefix(`${prefix}:`);
    activeKeys.current.clear();
  }, [prefix]);

  // Cancel all pending requests on unmount
  useEffect(() => {
    return () => {
      cancelAll();
    };
  }, [cancelAll]);

  return { getSignal, clearRequest, cancelAll };
};

/**
 * Hook to create a single abort controller that resets on dependency changes
 * Simpler alternative when you only have one request type
 * @param {Array} deps - Dependencies that should trigger cancellation when changed
 * @returns {AbortSignal} Signal to pass to fetch/API calls
 */
export const useAbortSignal = (deps = []) => {
  const controllerRef = useRef(null);

  useEffect(() => {
    // Create new controller
    controllerRef.current = new AbortController();

    // Cleanup: abort on unmount or dependency change
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return controllerRef.current?.signal;
};

export default useAbortController;
