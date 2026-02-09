# Identity360 / AccessLens — Performance & Code Review v2

**Date:** 2026-02-03
**Scope:** Full codebase re-review — React components, services, caching, CSS, build config
**Reviewer:** Claude Code (automated static analysis)
**Previous Review:** 2026-01-27 (CODE_REVIEW_PERFORMANCE.md)

---

## Executive Summary

Significant progress has been made since the initial review. Of the original **42 issues**, **19 have been resolved** and **2 are partially fixed**. However, **21 issues remain open** and **8 new issues** have been identified during this review.

**Key Improvements:**
- Bundle size reduced from 810KB to ~211KB initial load (74% reduction)
- Route-level code splitting fully implemented with React.lazy()
- Vendor chunks properly configured (react, dnd-kit, dexie, query)
- visibleLanes useMemo optimized (14 → 8 dependencies)
- handleItemClick callback stabilized (11 → 1 dependency)
- Multiple low-level optimizations (caching, localStorage, etc.)

**Remaining Critical Issues:**
1. **C-02**: ConnectorLines still has layout thrashing (querySelector in RAF loop)
2. **C-03**: IdentitiesTable filter/sort still not memoized
3. **H-03/NEW-1**: O(n×m) identity enrichment fallback lookups (CRITICAL)
4. **H-04**: No AbortControllers on API requests
5. **M-01/M-02**: LaneCard and DraggableLane still not wrapped in React.memo

**Estimated remaining improvement:** 20-30% faster interactions from addressing HIGH/CRITICAL items.

---

## Issue Status Overview

| Severity | Original | Resolved | Partial | Open | New | Total Open |
|----------|----------|----------|---------|------|-----|------------|
| CRITICAL | 3 | 1 | 1 | 1 | 1 | 3 |
| HIGH | 10 | 4 | 0 | 6 | 0 | 6 |
| MEDIUM | 17 | 9 | 1 | 7 | 4 | 11 |
| LOW | 12 | 8 | 0 | 4 | 3 | 7 |
| **Total** | **42** | **22** | **2** | **18** | **8** | **27** |

---

## CRITICAL Issues

### C-01: visibleLanes useMemo Has Too Many Dependencies
**Status: RESOLVED** ✓
- **File:** `src/components/access-lens/AccessLens.jsx` ~line 2018
- **Fix Applied:** Dependency array reduced from 14+ to 8 by consolidating selection state into a single `selections` object (lines 1667-1677). Dead legacy filtering code (~620 lines) removed.

### C-02: ConnectorLines Layout Thrashing During Drag
**Status: PARTIAL** ⚠️
- **File:** `src/components/access-lens/AccessLens.jsx` ~lines 435-510
- **Current State:** RAF is properly used, but DOM queries are NOT cached:
  - Line 438: `fulcrumRef.current.getBoundingClientRect()` — called every updateLines
  - Line 450: `document.querySelector()` — DOM query inside map loop for each lane type
  - Line 456: `targetLane.getBoundingClientRect()` — called inside forEach/map loop
- **Impact:** With 8 lanes, this is 8 DOM queries + 8 getBoundingClientRect calls per RAF frame (60fps during drag)
- **Recommendation:** Cache lane element refs in a Map. Read all positions in a single batch.

### C-03: IdentitiesTable Filter/Sort Not Memoized
**Status: OPEN** ✗
- **File:** `src/components/identities/IdentitiesTable.jsx` ~lines 241-343
- **Current State:** Both `filteredIdentities` (lines 241-320) and `sortedIdentities` (lines 323-343) run on **every render** without `useMemo`.
- **Impact:** With 1000+ identities, O(n) filtering + O(n log n) sorting on every keystroke/state change.
- **Recommendation:** Wrap both in `useMemo` with appropriate dependencies.

### NEW-1: O(n×m) Identity Enrichment Fallback (Related to H-03)
**Status: NEW — CRITICAL** ✗
- **File:** `src/components/access-lens/AccessLensPage.jsx` ~lines 507-515, 836-844, 979-987, 1510-1516
- **Problem:** Inside `lane.items.map()` loop, when direct ID lookup fails, code falls back to `Object.values(identityDetailsMap).find()` — scanning the entire map for each failed lookup.
- **Code Pattern:**
  ```javascript
  const enrichedItems = lane.items.map((item) => {  // N iterations
    let odataDetails = identityDetailsMap[identityId];
    if (!odataDetails) {
      odataDetails = Object.values(identityDetailsMap).find(d =>  // O(M) scan
        String(d.UId) === identityId || String(d.Id) === identityId
      );
    }
  });
  ```
- **Impact:** For N items with M mismatches, worst case is O(N×M) — potentially millions of comparisons.
- **Recommendation:** Pre-build reverse lookup maps before the enrichment loop:
  ```javascript
  const uIdMap = new Map(Object.values(identityDetailsMap).map(d => [String(d.UId), d]));
  const idMap = new Map(Object.values(identityDetailsMap).map(d => [String(d.Id), d]));
  ```

---

## HIGH Issues

### H-01: handleItemClick Callback Has 11 Dependencies
**Status: RESOLVED** ✓
- **File:** `src/components/access-lens/AccessLens.jsx` ~line 1169
- **Fix Applied:** Dependency array reduced from 11 to 1 (`[onFetchObjectDetails]`). Uses refs for stable callback access. Comment at line 1210 confirms fix.

### H-02: Sequential API Batch Delays (50ms Fixed Pauses)
**Status: RESOLVED** ✓
- **File:** `src/components/access-lens/AccessLensPage.jsx` ~lines 206, 267
- **Fix Applied:** Changed from `setTimeout(resolve, 50)` to `setTimeout(resolve, 0)` for UI thread yielding without artificial delay.

### H-03: Identity Enrichment O(n×m) Fallback Lookup
**Status: OPEN** ✗ (See NEW-1 above for detailed analysis)
- **File:** `src/components/access-lens/AccessLensPage.jsx` ~lines 513-515, 842-844, 1514-1516
- **Current State:** Still using `Object.values().find()` as fallback in 4 locations.

### H-04: No Abort Controllers on API Requests
**Status: OPEN** ✗
- **File:** `src/services/omadaApi.js` — all fetch calls
- **Current State:** No AbortController on any fetch call. Affected locations:
  - Line 76-80: `searchIdentities`
  - Line 130-134: `getIdentityById`
  - Line 193-197: `getIdentityCountByCategoryId`
  - Line 304-308: `getIdentitiesByCategoryId`
  - Line 980-983: `getAssignmentPolicies`
  - Line 1043-1046: `getAssignmentPolicyById`
  - Line 1109-1112: `getAssignmentPoliciesByContext`
- **Impact:** Stale responses can overwrite fresh data on rapid navigation.

### H-05: Client-Side Filtering of All Assignment Policies
**Status: OPEN** ✗
- **File:** `src/services/omadaApi.js` ~lines 1090-1153
- **Current State:** `getAssignmentPoliciesByContext` still fetches ALL policies (lines 1097-1101) then filters client-side (lines 1127-1134).
- **Recommendation:** Use OData server-side `$filter` parameter.

### H-06: No Route-Level Code Splitting
**Status: RESOLVED** ✓
- **File:** `src/App.jsx`
- **Fix Applied:** 10 page components properly lazy-loaded with `React.lazy()`:
  - Dashboard, IdentitiesList, LogViewer, Settings, MyAccess, MyTeam, AccessRequestsList, AccessLensPage, Admin, AgentChat
- **Suspense boundary** properly configured at Routes level with spinner fallback.

### H-07: No Vite Code Splitting Configuration
**Status: RESOLVED** ✓
- **File:** `vite.config.js`
- **Fix Applied:** Strategic vendor chunks configured:
  - `vendor-react`: react, react-dom, react-router-dom
  - `vendor-dnd`: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
  - `vendor-dexie`: dexie
  - `vendor-query`: @tanstack/react-query
- **Result:** Initial bundle reduced from 810KB to ~211KB (74% reduction).

### H-08: Unbounded IndexedDB Cache Growth
**Status: OPEN** ✗
- **File:** `src/services/apiCache.js`
- **Current State:** Only TTL-based cleanup (5-minute expiry, 10-minute purge with jitter). No entry count cap or LRU eviction.
- **Recommendation:** Add entry count limit with LRU eviction strategy.

---

## MEDIUM Issues

### M-01: LaneCard Not Wrapped in React.memo
**Status: OPEN** ✗
- **File:** `src/components/access-lens/LaneCard.jsx` ~line 498
- **Current State:** `export default LaneCard;` — no React.memo wrapper.
- **Impact:** 6-8 lane cards re-render unnecessarily on every parent state change.

### M-02: DraggableLane Not Memoized
**Status: OPEN** ✗
- **File:** `src/components/access-lens/AccessLens.jsx` ~line 376
- **Current State:** `const DraggableLane = ({ id, position, children, onPositionChange }) => {` — no React.memo.
- **Impact:** All lanes re-render during drag even when only positions change.

### M-03: LaneItemRow Custom Memo Always Fails on Callback Check
**Status: RESOLVED** ✓
- **File:** `src/components/access-lens/LaneItemRow.jsx` ~lines 385-417
- **Fix Applied:** Proper callback identity checks implemented with explicit documentation about stale closure prevention.

### M-04: ObjectInspector Deep Iteration Not Memoized
**Status: OPEN** ✗
- **File:** `src/components/access-lens/ObjectInspector.jsx` ~lines 426-556
- **Current State:** `buildMetadataDisplay()` is a regular function called on every render, not wrapped in `useMemo`.
- **Recommendation:** Extract to `useMemo` with `selectedNode` dependency.

### M-05: FocusCard Display Logic Not Memoized
**Status: OPEN** ✗
- **File:** `src/components/access-lens/FocusCard.jsx` ~lines 93-144
- **Current State:** `displayAttributes` array processing runs inline during render without memoization.
- **Recommendation:** Wrap in `useMemo` with dependencies on schema, node.metadata, node.rawData.

### M-06: FilterBar Creates Objects Inside .map() Loop
**Status: RESOLVED** ✓
- **File:** `src/components/access-lens/FilterBar.jsx` ~lines 8-14
- **Fix Applied:** `REASON_TYPE_HELP` extracted to module-level constant.

### M-07: Redundant Dynamic Imports in handlePivotToNode
**Status: RESOLVED** ✓
- **File:** `src/components/access-lens/AccessLensPage.jsx`
- **Fix Applied:** Dynamic imports consolidated to single import at function entry.

### M-08: Repeated Array.from() Conversions
**Status: RESOLVED** ✓
- **File:** `src/components/access-lens/accessLensDataService.js`
- **Fix Applied:** Convert-once pattern applied across all 5 lane builder sections with comments "M-08 fix".

### M-09: Sorting Runs on Every Filter Change
**Status: PARTIAL** ⚠️
- **File:** `src/components/access-lens/accessLensDataService.js` ~lines 673, 755, 1121, 1267, 1472
- **Current State:** Sorting occurs during lane building (every data load/pivot) but NOT on filter UI changes. Less severe than originally assessed.

### M-10: Cross-Lane Selection Triggers 7 State Updates
**Status: RESOLVED** ✓
- **File:** `src/components/access-lens/AccessLens.jsx` ~lines 1667-1677
- **Fix Applied:** Selection state consolidated into memoized `selections` object.

### M-11: currentIdentities Array Reference in useEffect
**Status: RESOLVED** ✓
- **File:** `src/components/identities/IdentitiesTable.jsx` ~lines 360, 427
- **Fix Applied:** Uses stable `currentPageIdentityKey` string instead of array reference.

### M-12: No API Response Deduplication
**Status: OPEN** ✗
- **File:** `src/services/omadaApi.js`
- **Current State:** No in-flight request deduplication. Concurrent identical requests all execute.
- **Recommendation:** Add request deduplication Map tracking pending promises.

### M-15: Excessive Console Logging Serialization
**Status: RESOLVED** ✓
- **Files:** `src/services/apiLogger.js`, `src/services/apiCache.js`
- **Fix Applied:** All console logging guarded behind `DEBUG_CONSOLE_LOGGING` and `DEBUG_CACHE_LOGGING` flags.

### M-16: LocalStorage Quota Exhaustion in API Logger
**Status: RESOLVED** ✓
- **File:** `src/services/apiLogger.js` ~lines 389-417
- **Fix Applied:** QuotaExceededError handling added. Responses capped at 2KB, max 25 entries saved.

### M-17: Promise.all Without Concurrency Limits
**Status: OPEN** ✗
- **File:** `src/services/omadaApi.js` ~lines 245-253
- **Current State:** `Promise.all(countPromises)` fires all category count requests without concurrency control.
- **Recommendation:** Add p-limit or similar concurrency wrapper.

### NEW-2: Repeated Object.keys() on Same Object
**Status: NEW — MEDIUM** ✗
- **File:** `src/components/access-lens/AccessLensPage.jsx` ~lines 495, 502, 833
- **Problem:** `Object.keys(identityDetailsMap)` called multiple times on the same object.
- **Recommendation:** Cache result in a variable.

### NEW-3: Serial Identity Detail Fetching
**Status: NEW — MEDIUM** ✗
- **File:** `src/components/access-lens/AccessLensPage.jsx` ~lines 1177-1226
- **Problem:** Fetches identity details one-by-one in a loop with try-catch for each, instead of batch-fetching.
- **Impact:** Slower pivot operations with many unique identities.

### NEW-4: AgentChat Dual Loading Issue
**Status: NEW — MEDIUM** ✗
- **File:** `src/App.jsx` ~lines 20, 215
- **Problem:** AgentChat is defined with `React.lazy()` but also rendered conditionally in the same component tree. This causes it to be bundled with the main chunk despite the lazy definition.
- **Recommendation:** Wrap AgentChat in a separate lazy-loaded wrapper component or Suspense boundary.

### NEW-5: IdentitiesTable Missing React.memo
**Status: NEW — MEDIUM** ✗
- **File:** `src/components/identities/IdentitiesTable.jsx` ~line 89
- **Problem:** Component not wrapped in React.memo, re-renders on every parent change.

---

## LOW Issues

### L-01: Inline Arrow Functions in JSX Props
**Status: DEFERRED** (Phase 3)
- **Files:** Multiple components
- **Rationale:** Only beneficial after parent components are wrapped in React.memo.

### L-02: Inline Style Objects in JSX
**Status: DEFERRED** (Phase 3)
- **Files:** Multiple components
- **Rationale:** Many styles depend on dynamic values; best addressed alongside M-01/M-02.

### L-03: Redundant stopPropagation Handlers
**Status: OPEN** ✗
- **File:** `src/components/access-lens/LaneCard.jsx` ~lines 281-425
- **Current State:** Still has redundant handlers. Lines 281-283 have THREE handlers (onMouseDown, onPointerDown, onKeyDown) all calling stopPropagation. Line 398 already prevents propagation at container level.
- **Note:** Original fix may have been reverted or only partially applied.

### L-04: Regex Operations in ObjectInspector formatLabel
**Status: RESOLVED** ✓
- **File:** `src/components/access-lens/ObjectInspector.jsx` ~lines 66-76
- **Fix Applied:** Module-level `_formatLabelCache` Map caches regex results.

### L-05: shouldLog() Reads localStorage On Every Call
**Status: RESOLVED** ✓
- **File:** `src/components/access-lens/accessLensTypes.js`
- **Fix Applied:** Module-level cached IIFE with `refreshLogPreference()` export.

### L-06: Duplicate Code in crossLaneFilterService Selection Map
**Status: RESOLVED** ✓
- **File:** `src/components/access-lens/crossLaneFilterService.js` ~lines 481-492
- **Fix Applied:** Data-driven `for...of` loop using `selectionLaneTypes` array.

### L-08: Cache Key JSON.stringify Overhead
**Status: RESOLVED** ✓
- **File:** `src/services/apiCache.js` ~lines 64-71
- **Fix Applied:** Fast-path for string/number keys bypasses JSON.stringify.

### L-09: Cache Stats Loads Entire Table Into Memory
**Status: RESOLVED** ✓
- **File:** `src/services/apiCache.js` ~lines 234-260
- **Fix Applied:** Uses cursor-based `each()` iteration instead of `toArray()`.

### L-10: setInterval Cleanup Missing on API Logger
**Status: PARTIAL** ⚠️
- **File:** `src/services/apiLogger.js` ~lines 456-459
- **Current State:** Interval ID stored in `window.__apiLoggerAutoSaveInterval`, but no cleanup mechanism on page unload.

### L-11: Cache Cleanup Intervals Not Jittered
**Status: RESOLVED** ✓
- **File:** `src/services/apiCache.js` ~lines 212-216
- **Fix Applied:** Random jitter of 0-2 minutes added to 10-minute base interval.

### L-12: GPU Acceleration Toggled Via Inline Style
**Status: RESOLVED** ✓
- **File:** `src/components/access-lens/AccessLens.jsx` ~line 389
- **Fix Applied:** `will-change` moved to CSS `.dragging` class. Comment confirms "L-12 fix".

### L-13: Redundant State Toggle Pattern
**Status: PARTIAL** ⚠️
- **File:** `src/components/access-lens/AccessLens.jsx`
- **Current State:** Line 799 uses `requestAnimationFrame` (fixed), but lines 1622, 1630 still use `setTimeout(..., 100)` in `handleCollapseAll()` and `handleExpandAll()`.

### L-14: Enum Objects Not Frozen
**Status: RESOLVED** ✓
- **File:** `src/components/access-lens/schemas/baseEnums.js`
- **Fix Applied:** All 11 exported enum/config objects wrapped with `Object.freeze()`.

### NEW-6: LoadingLanePlaceholder Not Memoized
**Status: NEW — LOW** ✗
- **File:** `src/components/access-lens/AccessLens.jsx` ~line 152
- **Problem:** Placeholder component used in rendering loop (line 2226) without React.memo.

### NEW-7: String Conversion Redundancy in Filter Loops
**Status: NEW — LOW** ✗
- **File:** `src/components/access-lens/crossLaneFilterService.js` ~lines 44, 46, 57, 62, 64-65, 70, 88
- **Problem:** Repeated `String()` conversions inside filter loops where source could be converted once.

### NEW-8: Breadcrumbs Eagerly Loaded
**Status: NEW — LOW** ✗
- **File:** `src/App.jsx`
- **Problem:** Breadcrumbs (64 lines) is eagerly loaded even though it's only used on protected routes.
- **Recommendation:** Consider lazy loading or inlining.

---

## Impact Analysis Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| React Rendering | 2 | 0 | 5 | 3 | 10 |
| Data Processing | 1 | 1 | 2 | 1 | 5 |
| API/Network | 0 | 4 | 2 | 0 | 6 |
| Caching | 0 | 1 | 0 | 1 | 2 |
| Build/Bundle | 0 | 0 | 1 | 1 | 2 |
| Code Quality | 0 | 0 | 1 | 1 | 2 |
| **Total Open** | **3** | **6** | **11** | **7** | **27** |

---

## Recommended Fix Order (Updated)

### Phase 2A: Critical Data Processing (Highest Impact)
1. **NEW-1/H-03:** Pre-build identity lookup index before enrichment loops
   - Risk: MEDIUM — Requires adding Map construction before each enrichment
   - Impact: Eliminates O(n×m) worst case, potentially saves seconds on large datasets

2. **C-03:** Add useMemo to IdentitiesTable filter/sort
   - Risk: LOW — Straightforward useMemo wrappers
   - Impact: Eliminates expensive recalculations on every render

### Phase 2B: Memoization Pass (High Impact)
3. **M-01 + M-02:** Add React.memo to LaneCard and DraggableLane
   - Risk: MEDIUM — Need to ensure stable callback props first
   - Impact: Prevents 6-8 lane re-renders on every interaction

4. **M-04 + M-05:** Memoize ObjectInspector and FocusCard display logic
   - Risk: LOW — Straightforward useMemo extraction
   - Impact: Reduces work for large metadata objects

5. **NEW-5:** Add React.memo to IdentitiesTable
   - Risk: LOW — Simple wrapper addition

### Phase 3: Architecture Improvements (Higher Risk)
6. **C-02:** Cache lane refs and batch DOM reads in ConnectorLines
   - Risk: HIGH — Complex RAF timing and ref management
   - Impact: Eliminates layout thrashing during drag

7. **H-04:** Add AbortController to all API calls
   - Risk: MEDIUM — Requires changes to all API functions and component cleanup

8. **H-05:** Move client-side policy filtering to server-side OData
   - Risk: MEDIUM — Depends on API capabilities

9. **H-08:** Add LRU eviction to IndexedDB cache
   - Risk: MEDIUM — Need to decide eviction strategy and limits

10. **M-12:** Add API response deduplication
    - Risk: MEDIUM — Requires tracking in-flight promises

### Phase 4: Polish
11. Address remaining MEDIUM issues (M-17 concurrency, NEW-2/NEW-3 optimizations)
12. Complete L-13 fixes (remaining setTimeout patterns)
13. Clean up L-03 redundant handlers
14. Consider L-01/L-02 inline function/style extraction

---

## Verification Checklist

Before marking issues as resolved in future reviews, verify:

- [ ] Code changes are in the expected file and line range
- [ ] No regressions introduced (run test suite)
- [ ] Performance improvement is measurable (React DevTools Profiler, Network tab)
- [ ] Bundle size impact checked (`npm run build`)

---

## Notes

- Line numbers are approximate and may shift with code changes
- Performance estimates assume typical dataset sizes (500-2000 assignments, 6-8 lanes, 50-200 items per lane)
- Some issues marked "DONE" in original review may need re-verification as code evolves
- The AgentChat dual-loading issue (NEW-4) may explain larger-than-expected initial bundle despite lazy loading
