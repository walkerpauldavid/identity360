# Performance Code Review - Identity360 React Application

**Date:** February 10, 2026
**Reviewed By:** Claude Code

---

## Executive Summary

This application has excellent code splitting and lazy loading practices, but suffers from:
1. **N+1 API patterns** causing 4-20 second delays
2. **Excessive state fragmentation** (25+ useState hooks) causing cascading re-renders
3. **Missing memoization** on callbacks causing unnecessary child re-renders

---

## Critical Issues

### 1. N+1 API Calls - Identity/System Details Fetching

**File:** `src/components/access-lens/AccessLensPage.jsx`
**Lines:** 204-312

**Problem:** Multiple sequential batch API calls for identity and system details:

```javascript
const fetchAllIdentityDetails = useCallback(async (assignments, bearerToken, impersonateUser) => {
  const identityIds = Array.from(identityIdsSet);
  const batchSize = 5;

  for (let i = 0; i < identityIds.length; i += batchSize) {
    const batch = identityIds.slice(i, i + batchSize);
    const batchPromises = batch.map(id =>
      fetchIdentityDetails(id, bearerToken, impersonateUser) // Individual API calls per ID
    );
    const batchResults = await Promise.all(batchPromises);
    await new Promise(resolve => setTimeout(resolve, 0)); // Artificial yield
  }
}, [fetchIdentityDetails]);
```

**Impact:** With 100 identities at batchSize=5: 20 API roundtrips. At 200ms latency = 4 seconds vs 200ms for single batched call.

**Fix:**
```javascript
const fetchAllIdentityDetails = useCallback(async (assignments, bearerToken, impersonateUser) => {
  const identityIds = Array.from(identityIdsSet);

  // Send ALL IDs in one call with $filter using IN operator
  const result = await omadaApi.odata.query(
    'Identity',
    bearerToken,
    impersonateUser,
    {
      filter: `UId in (${identityIds.map(id => `'${id}'`).join(',')})`,
      select: 'UId,IDENTITYID,EMAIL,JOBTITLE,FIRSTNAME,LASTNAME,DISPLAYNAME,EMPLOYEEID',
      top: 5000
    }
  );

  return result.data.reduce((map, identity) => {
    map[String(identity.UId)] = identity;
    return map;
  }, {});
}, []);
```

**Status:** [ ] Not Started

---

### 2. Excessive useState Hooks (25+)

**File:** `src/components/access-lens/AccessLens.jsx`
**Lines:** 737-814

**Problem:** The component has ~25+ individual useState hooks:

```javascript
const [focusNode, setFocusNode] = useState(null);
const [lanes, setLanes] = useState([]);
const [history, setHistory] = useState([]);
const [historyIndex, setHistoryIndex] = useState(-1);
const [isLoading, setIsLoading] = useState(false);
const [lanesLoading, setLanesLoading] = useState(true);
// ... 19+ more useState calls
```

**Impact:** Every state update triggers a full component re-render, even for unrelated state changes.

**Fix:** Consolidate related states using useReducer:

```javascript
const initialState = {
  focusNode: null,
  lanes: [],
  history: [],
  historyIndex: -1,
  isLoading: false,
  lanesLoading: true,
  // ... consolidate related states
};

function accessLensReducer(state, action) {
  switch (action.type) {
    case 'SET_FOCUS_NODE':
      return { ...state, focusNode: action.payload };
    case 'SET_LANES':
      return { ...state, lanes: action.payload, lanesLoading: false };
    case 'NAVIGATE':
      return {
        ...state,
        focusNode: action.payload.node,
        history: [...state.history.slice(0, state.historyIndex + 1), action.payload.node],
        historyIndex: state.historyIndex + 1
      };
    // ... other actions
    default:
      return state;
  }
}

const [state, dispatch] = useReducer(accessLensReducer, initialState);
```

**Status:** [ ] Not Started

---

## High Priority Issues

### 3. Missing useCallback on Event Handlers

**File:** `src/components/access-lens/AccessLens.jsx`
**Lines:** 1472+

**Problem:** Event handlers passed to child components create new function references on every render:

```javascript
// Current - creates new function every render
<LaneItemRow
  item={item}
  isSelected={selectedItemId === item.id}
  onClick={(item) => handleItemClick(item, lane.laneType)} // NEW FUNCTION EVERY RENDER
  onPivot={handlePivot}
/>
```

**Impact:** LaneItemRow re-renders even when item data hasn't changed.

**Fix:**
```javascript
const handleItemClickMemo = useCallback((item, laneType) => {
  // handler code
}, [/* dependencies */]);

const handlePivotMemo = useCallback((node) => {
  // handler code
}, [/* dependencies */]);

// In render
<LaneItemRow
  item={item}
  isSelected={selectedItemId === item.id}
  onClick={handleItemClickMemo}
  onPivot={handlePivotMemo}
  laneType={lane.laneType}
/>
```

**Status:** [ ] Not Started

---

### 4. Large Batch Data Transfer (5000 rows)

**File:** `src/components/access-lens/AccessLensPage.jsx`
**Line:** 478

**Problem:** Requesting 5000 rows at once:

```javascript
const assignmentsResult = await omadaApi.assignment.getCalculatedAssignmentsDetailed(
  null,
  bearerToken,
  impersonateUser,
  { systemId: systemId, includeDisabled: includeDisabledAssignments },
  { page: 1, rows: 5000 } // Large single request
);
```

**Impact:** Large JSON responses take time to parse and allocate memory.

**Fix:** Implement progressive loading:
```javascript
const loadAssignments = async (pageNum = 1, pageSize = 500) => {
  const result = await omadaApi.assignment.getCalculatedAssignmentsDetailed(
    null, bearerToken, impersonateUser,
    { systemId },
    { page: pageNum, rows: pageSize }
  );

  setAllAssignments(prev => [...prev, ...result.data]);

  if (result.hasMore) {
    await loadAssignments(pageNum + 1, pageSize);
  }
};
```

**Status:** [ ] Not Started

---

### 5. Single Suspense Boundary for Entire App

**File:** `src/App.jsx`
**Line:** 64

**Problem:** Single Suspense boundary wraps all routes:

```javascript
<Suspense fallback={<div className="loading-container">...</div>}>
  <Routes>
    {/* ALL ROUTES */}
  </Routes>
</Suspense>
```

**Impact:** If any lazy-loaded component fails, entire routing fails.

**Fix:** Add per-route Suspense boundaries:
```javascript
<Route
  path="/identity360"
  element={
    <Suspense fallback={<LoadingSpinner />}>
      <AccessLensPage />
    </Suspense>
  }
/>
<Route
  path="/dashboard"
  element={
    <Suspense fallback={<LoadingSpinner />}>
      <Dashboard />
    </Suspense>
  }
/>
```

**Status:** [ ] Not Started

---

## Medium Priority Issues

### 6. Monolithic AccessLens Component (2681 lines)

**File:** `src/components/access-lens/AccessLens.jsx`

**Problem:** Single file with 2681 lines containing multiple concerns.

**Fix:** Split into sub-components with lazy loading:
- `AccessLensCore.jsx` - Main layout and state management
- `ConnectorLines.jsx` - SVG visualization
- `FilterBar.jsx` - Filter controls
- `ControlPanel.jsx` - Buttons and actions
- `LanesRenderer.jsx` - Lane rendering logic

```javascript
const ConnectorLines = lazy(() => import('./ConnectorLines'));
const FilterBar = lazy(() => import('./FilterBar'));
```

**Status:** [ ] Not Started

---

### 7. No Data Caching for API Responses

**File:** `src/components/access-lens/AccessLensPage.jsx`

**Problem:** Identity and system details fetched fresh every time, even if previously loaded.

**Fix:** Implement cache layer:
```javascript
const [identityCache, setIdentityCache] = useState({});

const fetchIdentityDetails = useCallback(async (identityUId) => {
  // Return cached if available
  if (identityCache[identityUId]) {
    return identityCache[identityUId];
  }

  const result = await omadaApi.identity.searchIdentities(...);

  // Cache the result
  setIdentityCache(prev => ({
    ...prev,
    [identityUId]: result.data[0]
  }));

  return result.data[0];
}, [identityCache]);
```

**Status:** [ ] Not Started

---

### 8. Fragmented Loading States

**File:** `src/components/access-lens/AccessLensPage.jsx`
**Lines:** 73-85

**Problem:** Multiple useState for loading:
```javascript
const [isLoadingData, setIsLoadingData] = useState(true);
const [loadingStatus, setLoadingStatus] = useState('Initializing...');
const [loadError, setLoadError] = useState(null);
const [initialLoadDone, setInitialLoadDone] = useState(false);
```

**Fix:** Consolidate into single state:
```javascript
const [loadingState, setLoadingState] = useState({
  isLoading: true,
  status: 'Initializing...',
  error: null,
  initialDone: false
});

const updateLoading = useCallback((updates) => {
  setLoadingState(prev => ({ ...prev, ...updates }));
}, []);
```

**Status:** [ ] Not Started

---

## Low Priority Issues

### 9. Console.log in Production

**Files:** Throughout codebase

**Problem:** Debug console.log statements remain in code.

**Fix:** Use environment check:
```javascript
const IS_DEV = import.meta.env.DEV;

if (IS_DEV && shouldLog('INIT')) {
  console.log('Debug info...');
}
```

**Status:** [ ] Not Started

---

## What's Already Good

| Feature | Location | Notes |
|---------|----------|-------|
| Code Splitting | `App.jsx:11-21` | All routes use `lazy()` imports |
| GPU Acceleration | `AccessLens.jsx:406-415` | Uses `translate3d` for dragging |
| DOM Read Batching | `AccessLens.jsx:462-478` | Reads batched before writes |
| Effect Cleanup | Throughout | useEffect cleanups present for timers/listeners |
| Custom Comparison | `LaneItemRow.jsx:446` | React.memo with custom areEqual |

---

## Priority Matrix

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| CRITICAL | N+1 API Calls | 2-3 hrs | 4-20s faster loads |
| CRITICAL | 25+ useState Hooks | 2-3 hrs | Reduced re-renders |
| HIGH | Missing useCallback | 1 hr | Reduced child re-renders |
| HIGH | Large batch (5000 rows) | 1-2 hrs | Better memory usage |
| HIGH | Single Suspense boundary | 30 min | Better error isolation |
| MEDIUM | Monolithic component | 3-4 hrs | Better maintainability |
| MEDIUM | No data caching | 2 hrs | Fewer API calls |
| MEDIUM | Fragmented loading states | 30 min | Cleaner code |
| LOW | Console.log in production | 15 min | Minor CPU savings |

---

## Quick Wins (< 30 min each)

- [ ] Add per-route Suspense boundaries
- [ ] Consolidate loading states into single object
- [ ] Strip console.log in production builds

## Implementation Order

1. **Week 1:** Fix N+1 API calls (biggest performance gain)
2. **Week 1:** Add useCallback to event handlers
3. **Week 2:** Convert AccessLens useState to useReducer
4. **Week 2:** Add data caching layer
5. **Week 3:** Split AccessLens into sub-components
6. **Week 3:** Implement progressive loading for large datasets

---

## Notes

- Test performance improvements with React DevTools Profiler
- Measure API call times before/after batch optimization
- Consider React Query or SWR for data fetching/caching
