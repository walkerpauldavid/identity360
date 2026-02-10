# Identity360 - User Stories & Requirements

## Core Principles

### Security & Access Control
- **SEC-001**: We adhere strictly to our security model - users can only see data they are authorized to access.
- **SEC-002**: All API calls respect the user's Omada permissions and role-based access controls.
- **SEC-003**: No sensitive data is cached client-side beyond the current session.

### Performance Requirements
- **PERF-001**: Initial page load shall complete within 2 seconds.
- **PERF-002**: Data fetching for any view transition shall complete within 2 seconds.
- **PERF-003**: UI interactions (filtering, expanding, collapsing) shall respond within 100ms.
- **PERF-004**: Large data sets shall use pagination and progressive loading.

### UX Principles
- **UX-001**: Side-panel workflows never block or replace the content of the underlying page. Users can dive deep, close the panel, and return to their approval, request, or list view.
- **UX-002**: Identity360 panel can open from any identity reference property across the application.
- **UX-003**: Nodes display correct metadata and relationships.
- **UX-004**: All navigation paths are traceable and reversible via breadcrumbs and history.

---

## Access Lens Feature

### Overview
Access Lens is an interactive identity access visualization component that provides a radial, node-based view of access relationships. It enables users to explore, filter, and understand complex access patterns across systems, accounts, entitlements, and organizational contexts.

### Core Visualization

| ID | Story | Status |
|----|-------|--------|
| US-001 | As a security analyst, I want to see an identity displayed as the central node (fulcrum), so that I can understand all access relationships radiating from that identity. | Implemented |
| US-002 | As an access reviewer, I want to see related access data organized into distinct lanes (Accounts, Systems, Entitlements, Contexts, Logical Applications), so that I can quickly identify different types of access. | Implemented |
| US-003 | As a user, I want to see loading animations while data is being fetched, so that I know the system is working. | Implemented |
| US-004 | As a user, I want lane cards positioned around the central node using compass orientations (N, NE, E, SE, S, SW, W, NW), so that the layout is predictable. | Implemented |

### Lane Card Functionality

| ID | Story | Status |
|----|-------|--------|
| US-010 | As a user, I want to collapse and expand individual lane cards, so that I can focus on specific access areas. | Implemented |
| US-011 | As a user, I want to maximize a lane card to see all items with scrolling. | Implemented |
| US-012 | As a user, I want to drag lane cards to reposition them around the central node. | Implemented |
| US-013 | As a user, I want a "Reset Layout" button that restores defaults, collapses lanes, and clears filters. | Implemented |
| US-014 | As a user, I want an "Expand All" button to expand all lanes simultaneously. | Implemented |
| US-015 | As a user, I want a right-click context menu on the canvas background with options for Expand All, Reset Layout, and Toggle Object Inspector. | Implemented |
| US-016 | As a user, when the Object Inspector opens, I want the lanes to shift left automatically so cards are not hidden behind the inspector. | Implemented |

### Cross-Lane Filtering

| ID | Story | Status |
|----|-------|--------|
| US-020 | As a user, when I click on an account, I want other lanes filtered to show only related items (entitlements for that account, system it belongs to). | Implemented |
| US-021 | As a user, when I click on a system, I want to see only entitlements on that system, accounts on that system. | Implemented |
| US-022 | As a user, when I click on a logical application, I want to see only resources belonging to that app. | Implemented |
| US-023 | As a user, I want the filter source lane to be visually prominent (blue glow effect). | Implemented |
| US-024 | As a user, I want filtered lanes to display a "Filtered" badge. | Implemented |
| US-025 | As a user, when I select an entitlement that is part of a violation, I want the Violations lane to filter to show only related violations. | Implemented |

### Entitlements Lane Features

| ID | Story | Status |
|----|-------|--------|
| US-030 | As a user, I want a search field in the Entitlements lane to find specific entitlements by name. | Implemented |
| US-031 | As a user, I want clickable resource type chips to filter entitlements by type (Role, Permission, Group). | Implemented |
| US-032 | As a user, when cross-lane filtering is active, I want resource type chips to update dynamically. | Implemented |
| US-033 | As a user, I want to select multiple resource type chips simultaneously. | Implemented |
| US-034 | As a user, I want a "Clear" button to remove all resource type filters at once. | Implemented |

### Object Inspector

| ID | Story | Status |
|----|-------|--------|
| US-040 | As a user, when I click on any item in a lane, I want to see detailed information in the Object Inspector panel. | Implemented |
| US-041 | As a user, when I click on the central identity node, I want to see full identity details. | Implemented |
| US-042 | As a user, I want to collapse and expand the Object Inspector panel. | Implemented |
| US-143 | As a user, when I pivot from one focus node type to another, I want the Object Inspector to be cleared automatically. | Implemented |

### Navigation & Pivot

| ID | Story | Status |
|----|-------|--------|
| US-050 | As a user, I want the Omada navigation toolbar always visible at the top. | Implemented |
| US-051 | As a user, I want Access Lens to expand to fill available space while keeping the toolbar visible. | Implemented |
| US-052 | As a user, I want breadcrumbs showing my navigation history when I pivot to different nodes. | Implemented |
| US-070 | As a user, I want to pivot to a System to make it the central node and see all identities/accounts with access. | Implemented |
| US-071 | As a user, I want to pivot to an Entitlement to see all identities who have that entitlement. | Implemented |

### Multi-View Support

| ID | Story | Status |
|----|-------|--------|
| US-080 | As a user, when viewing a System as central node, I want to see Identities, Accounts, and Entitlements lanes. | Implemented |
| US-090 | As a user, when viewing an Entitlement as central node, I want to see resource owner information. | Implemented |
| US-140 | As a user, when viewing an Entitlement, I want to see the Resource Folder it belongs to. | Implemented |
| US-142 | As a user, when viewing an Entitlement with child resources (CHILDROLES), I want to see a Child Resources lane. | Implemented |
| US-146 | As a user, when viewing child resources, I want to see full resource information (CHILD badge, system name, resource type). | Implemented |

### Toolbar Filters

| ID | Story | Status |
|----|-------|--------|
| US-100 | As a user, when I select a compliance status filter (e.g., "Not Approved"), I want ALL access cards filtered to show only related items. | Implemented |
| US-101 | As a user, when toolbar filters are active, I want to see "Filtered" badges on all affected access cards. | Implemented |
| US-102 | As a user, when I select a reason type filter, I want all access cards to cascade-filter. | Implemented |
| US-121 | As a user, I want a "Multi-Path" filter toggle to show only entitlements with multiple assignment paths. | Implemented |
| US-163 | As a user, I want Reason Types filter to show only dynamic types from the API data, not hardcoded static types. | Implemented |
| US-164 | As a user, I want compliance statuses like "Implicitly Approved" preserved correctly in the filter (not defaulted to generic "Approved"). | Implemented |
| US-165 | As a user, I want Reason Types filter to correctly handle API responses where reasons are returned as arrays. | Implemented |

### Entitlement Display Enhancements

| ID | Story | Status |
|----|-------|--------|
| US-110 | As a user, I want each entitlement to display a color-coded badge showing how access was granted (Direct, Policy, Inherited, etc.). | Implemented |
| US-112 | As a user, when an entitlement has multiple assignment reasons, I want to see ALL unique reason type badges. | Implemented |
| US-120 | As a user, I want to see a visual indicator (lightning bolt with count) on entitlements with multiple overlapping assignment paths. | Implemented |
| US-124 | As a user, when I hover over an "Inherited" reason pill, I want to see the parent resource name in the tooltip. | Implemented |
| US-125 | As a user, I want to see a validity period pill on each entitlement (e.g., "Never expires", "Until 07/26"). | Implemented |
| US-126 | As a user, I want entitlements expiring within 90 days highlighted with an amber indicator. | Implemented |

### Assignment Policy Features

| ID | Story | Status |
|----|-------|--------|
| US-128 | As a user, when I select an Assignment Policy, I want the Contexts lane to show only contexts that trigger that policy. | Implemented |
| US-129 | As a user, I want Assignment Policies to automatically fetch and display context associations (AP_CONTEXTS). | Implemented |
| US-130 | As a user, when I hover over an Assignment Policy, I want to see which contexts are associated with it. | Implemented |

### Disabled Assignments

| ID | Story | Status |
|----|-------|--------|
| US-150 | As a user, I want disabled assignments to be visually distinct (red border, strikethrough text, disabled icon). | Implemented |
| US-151 | As a user, I want an option to include/exclude disabled assignments from the view. | Implemented |

### Violations Display

| ID | Story | Status |
|----|-------|--------|
| US-160 | As a user, I want entitlements with violations to be visually highlighted. | Implemented |
| US-161 | As a user, I want to see a Violations lane when the identity has SoD conflicts or compliance issues. | Implemented |
| US-162 | As a user, I want violation indicators consistently displayed across all views. | Implemented |

### Performance & Stability

| ID | Story | Status |
|----|-------|--------|
| US-170 | As a user, I want optimized React rendering with useReducer for consolidated state management. | Implemented |
| US-171 | As a user, I want stable function references via useCallback to prevent unnecessary re-renders. | Implemented |
| US-172 | As a user, I want per-route Suspense boundaries so that errors in one route don't crash the entire application. | Implemented |

---

## Business Rules Summary

### Data Display
- **BR-001**: Lanes only display if they contain items, except required lanes per focus node type.
- **BR-002**: Lane headers show item counts; when filtered, format is "filtered/total".
- **BR-003**: Account-type resources are excluded from Effective Entitlements lane.
- **BR-005**: Identity names display as "DISPLAYNAME (IDENTITYID)".

### Filtering
- **BR-010**: Only one lane can be the active filter source at a time.
- **BR-011**: Clicking the currently selected item clears all cross-lane filters.
- **BR-012**: Reset Layout clears all selections, positions, and filters.

### Reason Types
- **BR-026**: Each entitlement displays a reason type badge showing assignment source.
- **BR-028**: Reason types are color-coded (Direct=Blue, Policy=Purple, Inherited=Light Blue, etc.).
- **BR-029**: Multiple unique reason types display as separate pills.

### Validity Periods
- **BR-039**: Year 1999 means "no start date"; Year 9999 means "never expires".
- **BR-040**: Display logic handles all combinations of start/end dates appropriately.
- **BR-041**: Assignments expiring within 90 days show amber indicator with pulse animation.

### Performance
- **BR-058a**: Child resource enrichment limited to 50 items to prevent excessive API calls.
- **BR-059**: Enrichment loops prevented via refs tracking enrichment status per focus node.

---

## Detailed Specifications

For complete technical specifications, business rules, and implementation details, see:
- [`src/components/access-lens/AccessLens.md`](src/components/access-lens/AccessLens.md) - Full Access Lens requirements document

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01 | Initial Access Lens implementation |
| 1.5 | 2025-01 | System-centric and Entitlement-centric views |
| 1.10 | 2025-01 | Reason type badges and multi-path visualization |
| 1.13 | 2025-01 | Validity period display |
| 1.18 | 2025-01 | Unified toolbar, canvas positioning improvements |
| 1.20 | 2026-02 | Entitlement focus node enhancements (Resource Folders, Child Resources) |
| 1.21 | 2026-02 | Child resource OData enrichment with full details |
| 1.22 | 2026-02-10 | Performance: useReducer refactor, useCallback optimizations, per-route Suspense boundaries |
| 1.23 | 2026-02-10 | Filter fixes: Reason Types array handling, compliance status preservation, dynamic filter types |
| 1.24 | 2026-02-10 | UX: Right-click context menu, lane auto-shift on inspector open, Entitlement→Violations cross-filter |

---

## Future Considerations

- **TBD**: Integration with existing Omada forms - can Identity360 supplement or replace existing detail forms?
- **TBD**: Visual indicator on identity reference links to open graph view directly
- Path tracing validation against Assignment Explorer logic
- Enhanced SoD conflict visualization
