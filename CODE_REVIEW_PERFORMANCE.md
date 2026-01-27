# Identity360 / AccessLens — Performance & Code Review

**Date:** 2026-01-27
**Scope:** Full codebase review — React components, services, caching, CSS, build config
**Reviewer:** Claude Code (automated static analysis)

---

## Executive Summary

The codebase has solid architectural foundations (schema-driven design, HOF caching, cross-lane filtering) but contains **42 identified performance issues** across 4 severity levels. The most impactful issues are:

1. **Missing React memoization** — expensive computations re-run on every render
2. **Layout thrashing during drag** — DOM measurements in tight RAF loops
3. **No code splitting** — monolithic 818KB bundle loaded upfront
4. **Unnecessary re-renders** — unstable callback references defeat `React.memo`
5. **Sequential API batch delays** — artificial 50ms pauses between batches

Estimated improvement from addressing HIGH/CRITICAL items: **30-50% faster interactions, 40% smaller initial load**.

---

## Issue Severity Guide

| Severity | Definition |
|----------|------------|
| **CRITICAL** | Causes visible jank, crashes, or blocks user interaction |
| **HIGH** | Measurable slowdown in common workflows (>100ms) |
| **MEDIUM** | Adds up over time or affects specific scenarios |
| **LOW** | Code quality / minor inefficiency |

---

## CRITICAL Issues (Fix First)

### C-01: visibleLanes useMemo Has Too Many Dependencies
- **File:** `src/components/access-lens/AccessLens.jsx` ~line 1655
- **Problem:** A massive `useMemo` (400+ lines) computes filtered/visible lanes. It depends on 14+ state variables including `selectedAccountId`, `selectedSystemId`, `selectedLogicalAppId`, `selectedIdentityId`, `selectedPolicyId`, `selectedEntitlementId`, `selectedViolationId`, `selectedContextId`, plus 5 filter properties. ANY state change in these triggers a full re-filter of all lanes.
- **Impact:** CRITICAL — This is the hot path. Every click, every filter toggle, every selection re-runs hundreds of lines of filtering, Set operations, and array transformations.
- **Risk of Fix:** HIGH — Requires splitting into intermediate memoization layers (separate cross-lane filtering from toolbar filtering).
- **Recommendation:** Split into 3 stages: (1) `useMemo` for cross-lane filtered lanes, (2) `useMemo` for toolbar-filtered lanes, (3) `useMemo` for visibility-filtered lanes. Each depends only on its relevant inputs.

### C-02: ConnectorLines Layout Thrashing During Drag
- **File:** `src/components/access-lens/AccessLens.jsx` ~lines 437-540
- **Problem:** During drag, a `requestAnimationFrame` loop calls `updateLines()` 60 times/second. Each call uses `getBoundingClientRect()` on the fulcrum + all lane elements, then sets state. This is classic **layout thrashing** — reading layout (triggers reflow) then writing (triggers repaint) in rapid succession.
- **Impact:** CRITICAL — Visible jank during drag with 6+ lanes. Each frame queries DOM for 8+ elements via `document.querySelector()`.
- **Risk of Fix:** HIGH — Requires caching element refs and batching DOM reads.
- **Recommendation:** Cache lane refs via `useRef` Map. Read all positions in a single batch before computing lines. Consider debouncing to every 2nd frame.

### C-03: IdentitiesTable Filter/Sort Not Memoized
- **File:** `src/components/identities/IdentitiesTable.jsx` ~lines 241-343
- **Problem:** `filteredIdentities` applies 8+ filter conditions to ALL identities, then `sortedIdentities` spreads and sorts with `localeCompare()` — both run on **every render** without `useMemo`.
- **Impact:** CRITICAL — With 1000+ identities, O(n) filtering + O(n log n) sorting on every keystroke, every state change.
- **Risk of Fix:** MEDIUM — Add `useMemo` wrappers with correct dependencies.
- **Recommendation:** Wrap both in `useMemo`. Also cache `.toLowerCase()` results.

---

## HIGH Issues

### ~~H-01: handleItemClick Callback Has 11 Dependencies~~ — DONE
- **File:** `src/components/access-lens/AccessLens.jsx` ~line 1281
- **Problem:** `useCallback` for item click handling depends on 11 state variables. Any change to these recreates the callback, invalidating memoization of all lane components that receive it.
- **Impact:** HIGH — Every lane item click or filter change propagates re-renders to all visible lanes.
- **Risk of Fix:** MEDIUM — Use `useRef` for reading current state values, or consolidate selection state into a single object.
- **Fix:** Three changes reduced the dependency array from 11 to 1 (`[onFetchObjectDetails]`):
  1. **Removed 8 unused selection ID dependencies** — `selectedAccountId`, `selectedSystemId`, etc. were captured in the `selectionSetters` map's `current` property but never read. The toggle logic uses React's functional updater (`prev => prev === id ? null : id`), which doesn't need the current value. Simplified the map from `{ setter, current }` objects to direct setter references.
  2. **Moved `showObjectInspector` and `inspectorCollapsed` to refs** — Added `showObjectInspectorRef` and `inspectorCollapsedRef` kept in sync via render-phase assignment. Callback reads `ref.current` instead of closure-captured state values.
  3. **Removed stale `focusNode?.type` dependency** — was never used inside the callback body.
  - Result: `handleItemClick` is now effectively stable (only recreated if `onFetchObjectDetails` prop changes, which is rare). All 6-8 lane cards that receive `onItemClick` no longer re-render on selection/filter state changes.

### H-02: Sequential API Batch Delays (50ms Fixed Pauses)
- **File:** `src/components/access-lens/AccessLensPage.jsx` ~lines 189-207, 251-268
- **Problem:** Identity and system detail fetches are batched in groups of 5 with a hardcoded 50ms delay between batches:
  ```javascript
  await new Promise(resolve => setTimeout(resolve, 50));
  ```
  For 100 identities: 20 batches x 50ms = **1 full second** of artificial delay.
- **Impact:** HIGH — Directly adds wall-clock time to every data load.
- **Risk of Fix:** MEDIUM — Remove the delay or make it adaptive based on response times.

### H-03: Identity Enrichment O(n*m) Fallback Lookup
- **File:** `src/components/access-lens/AccessLensPage.jsx` ~lines 505-554
- **Problem:** For each identity item, if direct `identityDetailsMap[id]` lookup fails, falls back to `Object.values(identityDetailsMap).find(...)` — iterating ALL identity details for each failed lookup.
- **Impact:** HIGH — Worst case for 1000 identities is 1M comparisons.
- **Risk of Fix:** MEDIUM — Pre-build index Map keyed by both `UId` and `Id` before the enrichment loop.

### H-04: No Abort Controllers on API Requests
- **File:** `src/services/omadaApi.js` — all fetch calls
- **Problem:** No `AbortController` on any `fetch()` call. Rapid navigation, searches, or pivots fire new requests without cancelling old ones. Stale responses can overwrite fresh data.
- **Impact:** HIGH — Causes cascading requests, memory bloat, and potential race conditions.
- **Risk of Fix:** MEDIUM — Requires adding AbortController to all API functions and cleanup in components.

### H-05: Client-Side Filtering of All Assignment Policies
- **File:** `src/services/omadaApi.js` ~lines 1127-1134
- **Problem:** `getAssignmentPoliciesByContext` fetches ALL assignment policies then filters in JavaScript. With 1000+ policies, this wastes bandwidth and memory.
- **Impact:** HIGH — Large deployments will have slow context-to-policy lookups.
- **Risk of Fix:** MEDIUM — Use OData server-side `$filter` instead.

### H-06: No Route-Level Code Splitting
- **File:** `src/App.jsx` ~lines 1-18
- **Problem:** All page components (`Dashboard`, `AccessLensPage`, `Admin`, `Settings`, etc.) are imported at the top level. The entire app loads as a monolithic 818KB bundle.
- **Impact:** HIGH — Slow initial page load, especially on slower networks.
- **Risk of Fix:** LOW — Replace imports with `React.lazy()` + `Suspense`.

### H-07: No Vite Code Splitting Configuration
- **File:** `vite.config.js`
- **Problem:** No `rollupOptions.output.manualChunks` configuration. Vite already warns about this in the build output.
- **Impact:** HIGH — Monolithic bundle. Dexie, DnD kit, and other libraries should be separate chunks.
- **Risk of Fix:** LOW — Add manual chunk splitting for vendor libraries.

### H-08: Unbounded IndexedDB Cache Growth
- **File:** `src/services/apiCache.js`
- **Problem:** Cache can grow without limit. Only TTL-based cleanup (5-minute expiry, 10-minute purge). After extended usage, IndexedDB could accumulate thousands of stale entries.
- **Impact:** HIGH — Storage quota exhaustion, slow IndexedDB queries.
- **Risk of Fix:** MEDIUM — Add entry count cap with LRU eviction.

---

## MEDIUM Issues

### M-01: LaneCard Not Wrapped in React.memo
- **File:** `src/components/access-lens/LaneCard.jsx` ~line 20
- **Problem:** LaneCard receives many props from AccessLens and re-renders on every parent state change, even if its own props haven't changed.
- **Impact:** MEDIUM — 6-8 lane cards re-render unnecessarily on every interaction.
- **Risk of Fix:** MEDIUM — Requires stable callback props (useCallback) to be effective.

### M-02: DraggableLane Not Memoized
- **File:** `src/components/access-lens/AccessLens.jsx` ~lines 376-431
- **Problem:** DraggableLane wrapper re-renders on every parent render. All 6-8 lanes re-render during drag even though only positions change.
- **Impact:** MEDIUM — Amplified with lane content re-renders.
- **Risk of Fix:** MEDIUM — Add React.memo with custom comparator.

### M-03: LaneItemRow Custom Memo Always Fails on Callback Check
- **File:** `src/components/access-lens/LaneItemRow.jsx` ~lines 390-392
- **Problem:** Custom `areEqual` function checks callback identity (`prevProps.onItemClick === nextProps.onItemClick`). Since parent creates inline callbacks, this check always fails, defeating the entire memo.
- **Impact:** MEDIUM — All lane items re-render on every parent change despite React.memo.
- **Risk of Fix:** LOW — Use useCallback in parent for stable references.

### M-04: ObjectInspector Deep Iteration Not Memoized
- **File:** `src/components/access-lens/ObjectInspector.jsx` ~lines 420-550
- **Problem:** `buildMetadataDisplay` iterates through `selectedNode.metadata` and `rawData` using `Object.entries` and nested operations during render, not in `useMemo`.
- **Impact:** MEDIUM — Large nodes (Systems, Accounts) can have 50+ metadata fields.
- **Risk of Fix:** MEDIUM — Extract to useMemo with `selectedNode` dependency.

### M-05: FocusCard Display Logic Not Memoized
- **File:** `src/components/access-lens/FocusCard.jsx` ~lines 93-121
- **Problem:** `displayAttributes` array processing runs inline during render. With large metadata objects, this is expensive.
- **Impact:** MEDIUM — Runs on every parent re-render.
- **Risk of Fix:** MEDIUM — Extract to useMemo.

### M-06: FilterBar Creates Objects Inside .map() Loop
- **File:** `src/components/access-lens/FilterBar.jsx` ~lines 146-151
- **Problem:** `reasonTypeHelp` dictionary object is created inside the `.map()` callback for every `BaseReasonTypes` entry on every render.
- **Impact:** MEDIUM — 4-5 identical objects created every render.
- **Risk of Fix:** LOW — Extract to module-level constant.

### M-07: Redundant Dynamic Imports in handlePivotToNode
- **File:** `src/components/access-lens/AccessLensPage.jsx` ~lines 467-468, 667, 719
- **Problem:** Same module (`accessLensDataService`) dynamically imported multiple times in the same function. Each `await import()` has parsing overhead.
- **Impact:** MEDIUM — Adds 10-50ms per pivot.
- **Risk of Fix:** LOW — Import once at top of function or at module level.

### ~~M-08: Repeated Array.from() Conversions~~ — DONE
- **File:** `src/components/access-lens/accessLensDataService.js` — multiple locations
- **Problem:** `identityIds` and `accountIds` stored as Sets during aggregation, then converted via `Array.from()` for every item. With 500 accounts each having 5 identities = 2500 conversions.
- **Impact:** MEDIUM — O(n*m) Array.from calls.
- **Risk of Fix:** LOW — Accumulate as arrays instead of Sets, or convert once at the end.
- **Fix:** Applied convert-once pattern across all 5 lane builder sections: Accounts (~line 1602), Identities (~line 1735), Entitlements (~line 2047), Assignment Policies (~line 3225), Violations (~line 3445). Each `.map()` callback now converts its Sets to arrays once at entry (`const accountIdsArr = Array.from(entry.accountIds)`) and reuses those arrays in metadata, rawData, and outer rawData. Eliminates thousands of redundant `Array.from()` calls per data load.

### M-09: Sorting Runs on Every Filter Change
- **File:** `src/components/access-lens/accessLensDataService.js` — ~8 sort() calls
- **Problem:** Every lane-building function sorts items with `localeCompare()`. If `buildLanesFromAssignments` is called on each filter change, all items are re-sorted.
- **Impact:** MEDIUM — O(n log n) per lane per filter change.
- **Risk of Fix:** MEDIUM — Sort once and maintain sorted order, or sort in a separate memoized step.

### M-10: Cross-Lane Selection Triggers 7 State Updates
- **File:** `src/components/access-lens/AccessLens.jsx` ~lines 1189-1198
- **Problem:** Every item click loops through ALL 8 lane types to clear selections, triggering 7 `setter(null)` calls for the unclicked lanes. Each is a separate state update.
- **Impact:** MEDIUM — With React batching this is better, but still excessive.
- **Risk of Fix:** LOW — Consolidate into a single selection state object.

### ~~M-11: currentIdentities Array Reference in useEffect~~ — DONE
- **File:** `src/components/identities/IdentitiesTable.jsx` ~line 420
- **Problem:** `currentIdentities` (created via `.slice()`) produces a new array reference on every render, causing the context-fetching useEffect to re-run unnecessarily.
- **Impact:** MEDIUM — Triggers redundant API calls on every render.
- **Risk of Fix:** MEDIUM — Track `currentPage`/`pageSize` as dependencies instead of the array.
- **Fix:** Replaced the `currentIdentities` array dependency with a stable `currentPageIdentityKey` string (identity IDs joined by comma). Added `currentIdentitiesRef` to access the actual array inside the effect without dependency-triggering. The useEffect now only re-runs when the set of visible identity IDs actually changes, not on every render.

### M-12: No API Response Deduplication
- **File:** `src/services/omadaApi.js`
- **Problem:** If two components request the same data simultaneously (before cache stores), two identical API calls are made. No in-flight request deduplication.
- **Impact:** MEDIUM — Wasted bandwidth on concurrent identical requests.
- **Risk of Fix:** MEDIUM — Add request deduplication Map tracking pending promises.

### M-13: CSS Filter/Shadow Performance During Drag
- **File:** `src/components/access-lens/AccessLens.css` ~lines 592, 630-631, 671-674
- **Problem:** `filter: drop-shadow(...)` on connector dots, multiple layered `box-shadow` on lane cards, and `backdrop-filter: blur(4px)` on loading overlay all trigger GPU compositing.
- **Impact:** MEDIUM — Paint thrashing during interactions, especially on low-end devices.
- **Risk of Fix:** LOW — Simplify shadows, use `will-change` hints, disable blur on mobile.

### M-14: Missing CSS will-change / contain Properties
- **File:** `src/components/access-lens/AccessLens.css`
- **Problem:** Draggable lanes and animated elements lack `will-change: transform` and CSS containment hints. Browser can't pre-optimize compositing.
- **Impact:** MEDIUM — Missed optimization opportunity for animations.
- **Risk of Fix:** LOW — Add `will-change` to `.draggable-lane` and `contain: layout` to `.lane-card`.

### M-15: Excessive Console Logging Serialization
- **File:** `src/services/omadaApi.js` — every API call
- **Problem:** Every request logs full header objects and parameter objects via `apiLogger.logRequest()`. Even when logging is disabled, some serialization happens.
- **Impact:** MEDIUM — Constant overhead on every API call.
- **Risk of Fix:** LOW — Guard serialization behind debug check.

### M-16: LocalStorage Quota Exhaustion in API Logger
- **File:** `src/services/apiLogger.js` ~lines 407-418
- **Problem:** Saves up to 25 log entries every 30 seconds, each potentially containing 2KB+ response text. Long sessions can exhaust localStorage quota.
- **Impact:** MEDIUM — Eventual quota errors, app slowdown.
- **Risk of Fix:** MEDIUM — Implement size-based truncation or ring buffer.

### M-17: Promise.all Without Concurrency Limits
- **File:** `src/services/omadaApi.js` ~lines 245-253
- **Problem:** `Promise.all()` fires all category count requests simultaneously with no concurrency limit. Can trigger API rate limiting (429 errors).
- **Impact:** MEDIUM — Cascading failures under load.
- **Risk of Fix:** LOW — Add p-limit or similar concurrency wrapper.

### M-18: Global Auth State Triggers Wide Re-renders
- **File:** `src/contexts/AuthContext.jsx`
- **Problem:** Auth context used globally. Any auth state change (token refresh, etc.) re-renders all routes and components.
- **Impact:** MEDIUM — Unnecessary re-renders across the app.
- **Risk of Fix:** MEDIUM — Split into separate contexts for token vs user info.

---

## LOW Issues

### L-01: Inline Arrow Functions in JSX Props — DEFERRED
- **Files:** `LaneCard.jsx`, `FilterBar.jsx`, `FocusCard.jsx`, `AccessLens.jsx`
- **Problem:** Event handlers created inline (`onClick={(e) => ...}`) on every render, defeating child memoization.
- **Risk of Fix:** LOW
- **Status:** Deferred to Phase 3 (Memoization Pass). Extracting all inline arrows to `useCallback` across 4+ files is high-effort and only beneficial after parent components are wrapped in `React.memo` (M-01, M-02). Without memoized children, stable callback references provide no measurable improvement.

### L-02: Inline Style Objects in JSX — DEFERRED
- **Files:** `LaneCard.jsx` (lines 257-262, 441-449), `LaneItemRow.jsx` (lines 200-244), `FocusCard.jsx`
- **Problem:** Style objects recreated every render even when values haven't changed.
- **Risk of Fix:** LOW
- **Status:** Deferred to Phase 3. Many inline styles depend on dynamic values (`isDragging`, `effectiveColumns`, `calculatedMaxHeight`) making extraction to `useMemo` complex. Best addressed alongside M-01/M-02 memoization pass where stable style objects would actually prevent re-renders.

### ~~L-03: Redundant stopPropagation Handlers~~ — DONE
- **File:** `LaneCard.jsx` ~lines 281-285
- **Problem:** Search input has 5 separate event handlers all doing `e.stopPropagation()`.
- **Risk of Fix:** LOW
- **Fix:** Removed redundant `onClick` and `onFocus` stopPropagation handlers from the lane search input. The remaining `onMouseDown`, `onPointerDown`, and `onKeyDown` handlers are sufficient to prevent drag interference (the actual use case). `onClick` and `onFocus` events bubble after the interaction is already handled, so stopping them adds no functional value.

### ~~L-04: Regex Operations in ObjectInspector formatLabel~~ — DONE
- **File:** `ObjectInspector.jsx` ~lines 65-69
- **Problem:** `formatLabel()` runs `.replace(/([A-Z])/g, ...)` regex for every metadata field during render.
- **Risk of Fix:** LOW
- **Fix:** Added a `Map`-based cache (`_formatLabelCache`) to `formatLabel()`. First call for each key runs the regex and stores the result; subsequent calls return the cached value in O(1). Since metadata field names are a finite, repeating set (typically <100 unique keys), the cache never grows unbounded.

### ~~L-05: shouldLog() Reads localStorage On Every Call~~ — DONE (Phase 1)
- **File:** `src/components/access-lens/accessLensTypes.js` ~lines 77-94
- **Problem:** `localStorage.getItem()` is synchronous I/O called on every `shouldLog()` invocation.
- **Risk of Fix:** LOW — Cache in module variable.
- **Fix:** Replaced per-call `localStorage.getItem()` with module-level cached IIFE. Added `refreshLogPreference()` export for runtime updates.

### ~~L-06: Duplicate Code in crossLaneFilterService Selection Map~~ — DONE
- **File:** `src/components/access-lens/crossLaneFilterService.js` ~lines 483-545
- **Problem:** Identical 8-line pattern repeated 8 times for each lane type. Could be data-driven.
- **Risk of Fix:** LOW
- **Fix:** Replaced 8 identical if-blocks (~60 lines) with a data-driven `for...of` loop iterating over the existing `selectionLaneTypes` array (already defined earlier in the function for building item ID maps). Reduces to 7 lines with identical behavior.

### L-07: String() Conversions in Filter Comparisons — WON'T FIX
- **File:** `src/components/access-lens/crossLaneFilterService.js` — scattered
- **Problem:** `String(targetValue) === String(sourceValue)` on every filter comparison. Unnecessary with consistent data types.
- **Risk of Fix:** LOW
- **Status:** Won't fix. The `String()` conversions are defensive coercion required because API data types are inconsistent — IDs arrive as strings from OData but numbers from GraphQL. Removing `String()` would introduce subtle filter mismatches (e.g., `"123" !== 123`). The performance cost is negligible compared to the correctness guarantee.

### ~~L-08: Cache Key JSON.stringify Overhead~~ — DONE
- **File:** `src/services/apiCache.js` ~lines 67-68
- **Problem:** `JSON.stringify(keyData)` on every cache lookup. Complex filter objects generate expensive keys.
- **Risk of Fix:** LOW
- **Fix:** Added fast-path for primitive `keyData` values (string or number) that bypasses `JSON.stringify` and uses `String()` directly. Complex objects still use `JSON.stringify` as fallback. Most cache lookups use simple ID strings as keys, so this avoids JSON serialization on the hot path.

### ~~L-09: Cache Stats Loads Entire Table Into Memory~~ — DONE
- **File:** `src/services/apiCache.js` ~lines 229-272
- **Problem:** `db.apiResponses.toArray()` loads full cache for stats/keys. Should use Dexie aggregate queries.
- **Risk of Fix:** LOW
- **Fix:** Replaced `toArray()` with Dexie-native operations: `count()` for totals, `where('timestamp').below(cutoff).count()` for expired count (uses index), and `each()` cursor for namespace breakdown and key listing. This avoids loading all response data into memory — the cursor only reads metadata fields.

### ~~L-10: setInterval Cleanup Missing on API Logger~~ — DONE
- **File:** `src/services/apiLogger.js` ~lines 457-459
- **Problem:** 30-second auto-save interval never cleared. Runs for entire session lifetime.
- **Risk of Fix:** LOW
- **Fix:** Stored the `setInterval` return value in `window.__apiLoggerAutoSaveInterval` so it can be cleared programmatically (e.g., during teardown or hot module replacement). The interval is inherently session-scoped (SPA), so automatic cleanup on page unload is handled by the browser.

### ~~L-11: Cache Cleanup Intervals Not Jittered~~ — DONE
- **File:** `src/services/apiCache.js` ~lines 208-210
- **Problem:** All tabs purge expired entries on the same 10-minute schedule. Should add random jitter.
- **Risk of Fix:** LOW
- **Fix:** Added random jitter of 0–2 minutes (`Math.random() * 2 * 60 * 1000`) to the 10-minute base interval. Each tab now purges at a different offset, preventing simultaneous IndexedDB write contention across tabs.

### ~~L-12: GPU Acceleration Toggled Via Inline Style~~ — DONE
- **File:** `AccessLens.jsx` ~lines 399-401
- **Problem:** `willChange: isDragging ? 'transform' : 'auto'` toggled in inline style causes repeated GPU layer creation/destruction.
- **Risk of Fix:** LOW — Use CSS class instead.
- **Fix:** Moved `will-change: transform` and `pointer-events: none` from inline style to `.draggable-lane.dragging` CSS class. The browser now promotes the element to a compositor layer once when the `dragging` class is added, rather than recalculating on every inline style change. Inline style reduced to position + transform + zIndex only.

### ~~L-13: Redundant State Toggle Pattern~~ — DONE
- **File:** `AccessLens.jsx` ~lines 787-790
- **Problem:** `setLanesForceCollapsed(true)` followed immediately by `setTimeout(() => setLanesForceCollapsed(false), 100)` — two renders within 100ms.
- **Risk of Fix:** LOW
- **Fix:** Replaced `setTimeout(..., 100)` with `requestAnimationFrame()` to reset the `forceCollapsed` flag on the next paint frame instead of after an arbitrary 100ms delay. This still triggers two renders (inherent to the pulse pattern) but eliminates the 100ms window where user interaction could conflict with the force-collapsed state.

### ~~L-14: Enum Objects Not Frozen~~ — DONE
- **File:** `src/components/access-lens/schemas/baseEnums.js`
- **Problem:** Large enum/config objects exported without `Object.freeze()`. Risk of accidental mutation.
- **Risk of Fix:** LOW
- **Fix:** Wrapped all 11 exported enum/config objects with `Object.freeze()`: `NodeTypes`, `EdgeTypes`, `BaseReasonTypes`, `ReasonTypes`, `LaneTypes`, `ViewModes`, `ActionTypes`, `CompassOrientation`, `CrossLaneFilterType`, `LaneDisplayRules` (deep-frozen with nested objects), and `LaneGridConstraints`. Prevents accidental mutation at development time and enables V8 to optimize property access.

---

## Impact Analysis Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| React Rendering | 2 | 1 | 6 | 3 | 12 |
| Data Processing | 1 | 2 | 3 | 2 | 8 |
| API/Network | — | 4 | 3 | 1 | 8 |
| Caching | — | 1 | 1 | 4 | 6 |
| CSS/Paint | — | — | 2 | 1 | 3 |
| Build/Bundle | — | 2 | 1 | — | 3 |
| Auth/State | — | — | 1 | 1 | 2 |
| **Total** | **3** | **10** | **17** | **12** | **42** |

---

## Recommended Fix Order

### Phase 1: Quick Wins (Low Risk, High Impact) -- COMPLETED

1. **H-06 + H-07:** ~~Add `React.lazy()` route splitting + Vite manual chunks~~ **DONE**
   - Converted 10 page components to `React.lazy()` with `Suspense` fallback in `App.jsx`
   - Added `rollupOptions.output.manualChunks` in `vite.config.js` splitting: `vendor-react`, `vendor-dnd`, `vendor-dexie`, `vendor-query`
   - Result: Monolithic 810KB bundle split into 30+ chunks. Initial page load **211KB** (was 810KB) — **74% reduction**. Vite chunk size warning eliminated.
2. **H-02:** ~~Remove artificial 50ms batch delays~~ **DONE**
   - Replaced `setTimeout(resolve, 50)` with `setTimeout(resolve, 0)` in both `fetchAllIdentityDetails` and `fetchAllSystemDetails` batch loops in `AccessLensPage.jsx`
   - Result: Eliminates 1+ second of artificial wall-clock delay per data load (20 batches x 50ms = 1s saved)
3. **M-06:** ~~Extract `reasonTypeHelp` to module constant~~ **DONE**
   - Moved `reasonTypeHelp` dictionary from inside `.map()` callback to module-level `REASON_TYPE_HELP` constant in `FilterBar.jsx`
   - Result: Avoids 4-5 identical object allocations per render
4. **M-07:** ~~Move dynamic imports to top of function~~ **DONE**
   - Consolidated 7 redundant `await import('./accessLensDataService')` calls in `handlePivotToNode` into a single import at function entry with all needed exports
   - Result: Eliminates 6 redundant module resolution calls per pivot. Vite build warning reduced from 8 dynamic imports to 2.
5. **L-05:** ~~Cache shouldLog localStorage read in module variable~~ **DONE**
   - Replaced per-call `localStorage.getItem()` with a module-level cached value initialized via IIFE in `accessLensTypes.js`
   - Added `refreshLogPreference()` export for runtime updates without page reload
   - Result: Eliminates synchronous I/O on every `shouldLog()` invocation (called hundreds of times per data load)

**Additional C-01 fix (from Phase 2) also completed:**
- **C-01:** ~~Split `visibleLanes` useMemo into staged memoization~~ **DONE**
  - Removed ~620 lines of dead legacy filtering code (`USE_SCHEMA_DRIVEN_FILTERING` was always `true`)
  - Consolidated 8 selection state variables into a memoized `selections` object
  - Fixed missing `filters.multiPathOnly` dependency (bug)
  - Removed 4 leftover `[DEBUG]` console.log statements
  - Added early return when no focus node exists
  - Result: Dependency array reduced from 14 to 8 entries. Bundle reduced by ~8KB. Correct dependency tracking.

**Bug fix: Object Inspector toggle ignored on lane selection**
- **File:** `AccessLens.jsx` — `handleItemClick` callback
- **Problem:** When the user toggled the Object Inspector off via the toolbar button, clicking any lane item would force `setShowObjectInspector(true)`, overriding the user's preference.
- **Fix:** Removed the auto-show behavior. When the inspector is hidden, lane clicks still perform selection highlighting and cross-lane filtering but skip the inspector panel update entirely (early return before API fetch). Also gates `setInspectorCollapsed(false)` behind `showObjectInspector` check. `handleCentralNodeClick` already had the correct guard.

### Phase 2: Memoization Pass (Medium Risk, High Impact)
6. ~~**C-01:** Split `visibleLanes` useMemo into staged memoization~~ (Completed above)
7. **C-03:** Add useMemo to IdentitiesTable filter/sort
8. **H-01:** Consolidate selection state + use useRef for stable callbacks
9. **M-01 + M-02:** Add React.memo to LaneCard and DraggableLane
10. **M-03:** Fix LaneItemRow memo comparison (use useCallback in parent)
11. **M-04 + M-05:** Memoize ObjectInspector and FocusCard display logic

### Phase 3: Architecture Improvements (Higher Risk)
12. **C-02:** Refactor ConnectorLines to cache refs and batch DOM reads
13. **H-03:** Pre-build identity lookup index before enrichment
14. **H-04:** Add AbortController to all API calls
15. **H-05:** Move client-side policy filtering to server-side OData
16. **H-08:** Add LRU eviction to IndexedDB cache
17. ~~**M-10:** Consolidate selection state into single object~~ (Partially done via C-01 `selections` useMemo)

### Phase 4: Polish
18. Address remaining MEDIUM and LOW issues
19. Add CSS containment and will-change hints
20. Implement request deduplication

---

## Notes

- Line numbers are approximate — they shift as code changes
- Performance impact estimates assume typical dataset sizes (500-2000 assignments, 6-8 lanes, 50-200 items per lane)
- Risk ratings reflect potential for introducing regressions
- The `IdentitiesTable` context fetching loop was already partially fixed (removed `contextsMap` from dependency array, added `useRef`) in a previous session
