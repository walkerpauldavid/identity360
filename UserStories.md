# Identity360 - User Stories & Requirements

## Application Overview

Identity360 is a modern React-based front-end for Omada Identity Management. It provides security analysts, access reviewers, and IT administrators with tools to visualize, explore, and manage identity access across the enterprise. The application connects to the Omada IGA platform via OData and GraphQL APIs and is deployed to IIS behind OAuth 2.0 / Entra ID authentication.

### Key Capabilities

- **Access Lens** -- Interactive radial graph visualization for exploring identity access relationships across systems, accounts, entitlements, policies, and organizational contexts. Supports pivoting between Identity, System, Entitlement, and Request focus nodes with full cross-lane filtering.
- **Dashboard** -- Configurable tile-based home page with task summaries (Identities, My Team, Access Requests, Approvals, Certifications) and compliance heatmaps (status distribution and per-system overview).
- **All Identities** -- Category-based accordion view of all managed identities with lazy-loaded detail expansion and filtering by status and risk level.
- **Access Requests** -- Paginated, sortable table of access requests with column-level filtering, context menus, and status badges.
- **My Access** -- Personal access summary showing the current user's permissions, OAuth scopes, and access level.
- **My Team** -- Team member overview with role, status, access count, pending requests, and last activity tracking.
- **Administration** -- Hub page linking to Identity Management, Role Management, Policy Management, System Configuration, Workflow Management, Audit & Compliance, Reports & Analytics, and System Settings.
- **Agent Chat (RoZiBoT)** -- Global floating AI assistant available on every page with quick-action pills (Make Request, Perform Approval, Check Status, View Access, Help). Draggable, resizable, and fullscreen-capable.
- **API Log Viewer** -- Real-time log of all OData and GraphQL requests with type filtering, full-text search, expandable detail rows, and auto-refresh.
- **Settings** -- Multi-tab configuration: Token Management (override/decode JWT), User Preferences (locale, timezone, animation speed), Dashboard Layout (tile visibility and ordering), Debugging (policy analysis, API logging, verbose Identity360 logging), Identity360 (lane collapse behavior, disabled assignments), and Color Palette (customizable Identity360 colors).

---

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

## Application Features

### Dashboard

| ID | Story | Status |
|----|-------|--------|
| APP-001 | As a user, I want a configurable tile-based dashboard as my home page, so that I can see a summary of my tasks at a glance. | Implemented |
| APP-002 | As a user, I want to drag and drop dashboard tiles to reorder them, so that I can prioritize what matters to me. | Implemented |
| APP-003 | As a user, I want to collapse and expand individual dashboard tiles. | Implemented |
| APP-004 | As a user, I want compliance heatmaps on the dashboard showing status distribution and per-system compliance, so that I can spot issues quickly. | Implemented |
| APP-005 | As a user, I want to configure which tiles are visible and their ordering in Settings. | Implemented |

### All Identities

| ID | Story | Status |
|----|-------|--------|
| APP-010 | As a user, I want to see all identities grouped by category in collapsible accordion sections. | Implemented |
| APP-011 | As a user, I want identity details lazy-loaded only when I expand a category, so that the page loads quickly. | Implemented |
| APP-012 | As a user, I want to filter identities by status (Active, Inactive, Disabled, Pending) and risk level (Low, Medium, High, Critical). | Implemented |
| APP-013 | As a user, I want to see identity counts per category without loading full records (OData $count). | Implemented |

### Access Requests

| ID | Story | Status |
|----|-------|--------|
| APP-020 | As a user, I want to see all access requests in a paginated table with configurable page size. | Implemented |
| APP-021 | As a user, I want to filter by beneficiary, resource, approval status, provisioning status, and reason. | Implemented |
| APP-022 | As a user, I want sortable columns and right-click context menus on table cell values. | Implemented |
| APP-023 | As a user, I want color-coded status badges (approved=green, pending=amber, rejected=red). | Implemented |

### My Access

| ID | Story | Status |
|----|-------|--------|
| APP-030 | As a user, I want to see my email, display name, system permissions, and OAuth scopes on a personal access page. | Implemented |

### My Team

| ID | Story | Status |
|----|-------|--------|
| APP-040 | As a user, I want to see my team members in a table with name, role, status, access count, pending requests, applications, and last activity. | Implemented |
| APP-041 | As a user, I want to filter team members by All, Active, and Pending Requests. | Implemented |

### Administration

| ID | Story | Status |
|----|-------|--------|
| APP-050 | As an admin, I want a hub page with tiles linking to Identity Management, Role Management, Policy Management, System Configuration, Workflow Management, Audit & Compliance, Reports & Analytics, and System Settings. | Implemented |

### Agent Chat (RoZiBoT)

| ID | Story | Status |
|----|-------|--------|
| APP-060 | As a user, I want a floating AI assistant button available on every page. | Implemented |
| APP-061 | As a user, I want quick-action pills (Make Request, Perform Approval, Check Status, View Access, Help) for common tasks. | Implemented |
| APP-062 | As a user, I want the chat panel to be draggable, resizable, and fullscreen-capable. | Implemented |

### API Log Viewer

| ID | Story | Status |
|----|-------|--------|
| APP-070 | As a developer, I want a real-time log viewer showing all OData and GraphQL API requests and responses. | Implemented |
| APP-071 | As a developer, I want to filter logs by API type (All, GraphQL, OData) and search across endpoints, query names, and payloads. | Implemented |
| APP-072 | As a developer, I want expandable log detail rows showing headers and bearer tokens. | Implemented |
| APP-073 | As a developer, I want logs to auto-refresh every 2 seconds. | Implemented |

### Settings

| ID | Story | Status |
|----|-------|--------|
| APP-080 | As a user, I want a Token Management tab to override OAuth bearer tokens and decode JWT claims. | Implemented |
| APP-081 | As a user, I want a User Preferences tab to set locale, timezone, and welcome animation speed. | Implemented |
| APP-082 | As a user, I want a Dashboard Layout tab to configure visible tiles and their ordering. | Implemented |
| APP-083 | As a developer, I want a Debugging tab to enable policy analysis, API console logging, and Identity360 verbose logging. | Implemented |
| APP-084 | As a user, I want an Identity360 tab to control lane collapse behavior and disabled assignment visibility. | Implemented |
| APP-085 | As a user, I want a Color Palette tab to customize Identity360 colors for focus cards, lane items, selections, pills, and violations. | Implemented |

### Navigation

| ID | Story | Status |
|----|-------|--------|
| APP-090 | As a user, I want a top navigation bar with icon links to all major sections (Dashboard, My Access, Identity360, Admin, My Team, Settings, API Logs) and a logout button. | Implemented |
| APP-091 | As a user, I want the navbar to display my email and the current page title with a multi-language welcome animation. | Implemented |

### Authentication & Session Management

| ID | Story | Status |
|----|-------|--------|
| US-250 | As a user, I want the application to proactively check my token expiry every 30 seconds while I'm authenticated. | Implemented |
| US-251 | As a user, when my token expires and silent refresh fails, I want to be automatically redirected to the login screen with a session-expired message. | Implemented |
| APP-100 | As a user, I want OAuth 2.0 login via Entra ID with automatic callback handling. | Implemented |

---

## Access Lens Feature

### Overview

Access Lens is the primary visualization feature of Identity360. It renders an interactive, radial access graph centered on a **focus node** (Identity, System, Entitlement, or Request) with surrounding **lane cards** representing related access data -- accounts, systems, entitlements, policies, contexts, violations, requests, and more.

**Architecture:** Access Lens uses a schema-driven design (`LaneConfigSchema`, `FocusNodeSchema`) so that lane behavior, cross-lane filter relationships, compass positions, and display rules are defined declaratively. This makes it extensible without modifying rendering code.

**Data flow:** GraphQL APIs fetch calculated assignments and access requests. OData APIs enrich individual items (systems, identities, policies, resource folders, child resources). An IndexedDB cache layer avoids redundant fetches with visual feedback (green spinner flash on cache hits).

**Key interaction patterns:**
- **Cross-lane filtering** -- Click any item in a lane to filter all related lanes. Supports field-match, array-contains, cascaded (2-level and 3-level), and name-fallback filter types.
- **Pivot navigation** -- Click a system, entitlement, or request to make it the new focus node, loading a completely new set of lanes. Full navigation history with breadcrumbs.
- **Toolbar filtering** -- Global compliance status, reason type, and multi-path filters cascade across all lanes simultaneously.
- **Object Inspector** -- Click any item to see its full properties in a collapsible right panel with schema-based field display.

### Core Visualization

| ID | Story | Status |
|----|-------|--------|
| US-001 | As a security analyst, I want to see an identity displayed as the central node (fulcrum), so that I can understand all access relationships radiating from that identity. | Implemented |
| US-002 | As an access reviewer, I want to see related access data organized into distinct lanes (Accounts, Systems, Entitlements, Contexts, Logical Applications), so that I can quickly identify different types of access. | Implemented |
| US-003 | As a user, I want to see loading animations while data is being fetched, so that I know the system is working. | Implemented |
| US-004 | As a user, I want lane cards positioned around the central node using compass orientations (N, NE, E, SE, S, SW, W, NW), so that the layout is predictable. | Implemented |
| US-060 | As a user, I want an identity search dialog to find and select any identity by name or ID. | Implemented |
| US-061 | As a user, I want to change the focus identity at any time via the search bar in the toolbar. | Implemented |

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
| US-017 | As a user, I want the right-click context menu to appear at my mouse pointer location, not offset by the canvas zoom/transform. | Implemented |

### Canvas & Zoom

| ID | Story | Status |
|----|-------|--------|
| US-260 | As a user, I want zoom controls (zoom in, zoom out, reset to 100%) on the canvas, so that I can adjust the view for dense access graphs. | Implemented |
| US-261 | As a user, I want the zoom range to be 30%--200% in 10% increments. | Implemented |
| US-262 | As a user, I want connector lines drawn between the focus card and each lane card, so that relationships are visually clear. | Implemented |
| US-263 | As a user, I want the focus card to drop behind dragged lane cards (z-index management), so that drag operations feel natural. | Implemented |
| US-264 | As a user, I want to minimize the focus card to a compact pill showing only the icon, name, and status, so that more canvas space is available for lanes. | Implemented |

### Cross-Lane Filtering

| ID | Story | Status |
|----|-------|--------|
| US-020 | As a user, when I click on an account, I want other lanes filtered to show only related items (entitlements for that account, system it belongs to). | Implemented |
| US-021 | As a user, when I click on a system, I want to see only entitlements on that system, accounts on that system. | Implemented |
| US-022 | As a user, when I click on a logical application, I want to see only resources belonging to that app. | Implemented |
| US-023 | As a user, I want the filter source lane to be visually prominent (blue glow effect). | Implemented |
| US-024 | As a user, I want filtered lanes to display a "Filtered" badge. | Implemented |
| US-025 | As a user, when I select an entitlement that is part of a violation, I want the Violations lane to filter to show only related violations. | Implemented |
| US-026 | As a user viewing an Identity, when I click a request in the Requests lane, I want the Systems, Accounts, and Entitlements lanes to filter to show only items related to that request's resource and system. | Implemented |
| US-027 | As a user, I want lanes to auto-expand when a cross-lane filter is applied, so that I can immediately see the filtered results. | Implemented |

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
| US-144 | As a user, I want to toggle the Object Inspector visibility from the toolbar and the right-click context menu. | Implemented |
| US-043 | As a user, I want the Object Inspector to use schema-based field display rules per node type, hiding technical fields and formatting dates and emails. | Implemented |

### Navigation & Pivot

| ID | Story | Status |
|----|-------|--------|
| US-050 | As a user, I want the Omada navigation toolbar always visible at the top. | Implemented |
| US-051 | As a user, I want Access Lens to expand to fill available space while keeping the toolbar visible. | Implemented |
| US-052 | As a user, I want breadcrumbs showing my navigation history when I pivot to different nodes. | Implemented |
| US-070 | As a user, I want to pivot to a System to make it the central node and see all identities/accounts with access. | Implemented |
| US-071 | As a user, I want to pivot to an Entitlement to see all identities who have that entitlement. | Implemented |
| US-072 | As a user, I want to pivot to a Request to see the requested resource, requester identity, beneficiary identity, and target system. | Implemented |
| US-073 | As a user, I want breadcrumb navigation renamed to "Navigation History" so the purpose is clearer. | Implemented |

### Multi-View Support

| ID | Story | Status |
|----|-------|--------|
| US-080 | As a user, when viewing a System as central node, I want to see Identities, Accounts, and Entitlements lanes. | Implemented |
| US-090 | As a user, when viewing an Entitlement as central node, I want to see resource owner information. | Implemented |
| US-140 | As a user, when viewing an Entitlement, I want to see the Resource Folder it belongs to. | Implemented |
| US-141 | As a user, when viewing an Entitlement, I want the Resource Folder lane item to display the folder's Approval status as a badge. | Implemented |
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

### CSV Export

| ID | Story | Status |
|----|-------|--------|
| US-154 | As a user, I want to export the current Access Lens view to a CSV file for analysis in Excel or compliance reporting. | Implemented |
| US-155 | As a user, when I export to CSV, I want all currently visible lane data included. | Implemented |
| US-156 | As a user, I want each CSV row to include focus node info, lane name, item name, type, ID, system, compliance status, reason types, and validity dates. | Implemented |

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

### Request Pivot View

| ID | Story | Status |
|----|-------|--------|
| US-200 | As a user, when I click a Request item in the Requests lane, I want to pivot to a Request-centric view showing the requested resource, requester, beneficiary, and system as access cards. | Implemented |
| US-201 | As a user, when viewing a Request as the central node, I want to see a Resource (Entitlement) access card showing the requested entitlement and its child assignments. | Implemented |
| US-202 | As a user, when viewing a Request as the central node, I want to see a Requester Identity access card with OData-enriched details (username, name). | Implemented |
| US-203 | As a user, when viewing a Request as the central node, I want to see a Beneficiary Identity access card with OData-enriched details (username, name). | Implemented |
| US-204 | As a user, when viewing a Request as the central node, I want to see a System access card derived from the resource's system and child assignment systems (deduplicated). | Implemented |
| US-205 | As a user, I want to click the Resource card in a Request view to pivot to an Entitlement-centric view. | Implemented |
| US-206 | As a user, I want to click either identity card in a Request view to pivot to an Identity-centric view. | Implemented |
| US-207 | As a user, when viewing a Request, I want child assignments displayed as additional entitlement lane items with a "Child Entitlement" badge. | Implemented |
| US-208 | As a user, when viewing a Request, I want the FilterBar to show only Resource, System, Requester, and Beneficiary toggle buttons. | Implemented |
| US-209 | As a user, I want the request date (requestedTime) formatted as dd/MM/YYYY with 24-hour clock in Request lane items. | Implemented |
| US-210 | As a user, I want the requestedBy identity displayed as a pill (displayName + userName) in Request lane items. | Implemented |

### Identity Requests Lane

| ID | Story | Status |
|----|-------|--------|
| US-220 | As a user, when viewing an Identity as the central node, I want to see an Access Requests lane showing requests where this identity is the beneficiary. | Implemented |
| US-221 | As a user, I want the Requests lane fetched via GraphQL `getAccessRequestsForBeneficiary` query filtered by the focus identity's display name. | Implemented |
| US-222 | As a user, I want the Requests lane to show approval status, request date, and requester identity for each request. | Implemented |
| US-223 | As a user, I want a toolbar toggle button to show/hide the Requests access card when Identity, Entitlement, or System is the focus node. | Implemented |

### Per-Focus-Node-Type Positioning

| ID | Story | Status |
|----|-------|--------|
| US-230 | As a user, I want access card positions optimized per focus node type so cards never render off-screen. | Implemented |
| US-231 | As a user, I want tighter compass positions across all views to keep cards within the visible viewport area. | Implemented |
| US-232 | As a user, when viewing an Identity, I want the Contexts access card positioned north (above center) for better visibility. | Implemented |
| US-233 | As a user, when viewing an Identity, I want the Requests access card positioned in the West (left) area. | Implemented |

### Loading & API Activity

| ID | Story | Status |
|----|-------|--------|
| US-240 | As a user, I want the loading spinner to display the number of OData and GraphQL API calls made during a pivot. | Implemented |
| US-241 | As a user, I want the loading spinner animation speed to accelerate when API calls are in-flight and decelerate when idle. | Implemented |
| US-242 | As a user, I want an amber "in-flight" indicator when API requests are pending during a pivot. | Implemented |
| US-243 | As a user, I want a green flash on the spinner when data is served from the IndexedDB cache, so that I know a cache hit occurred. | Implemented |

### Performance & Stability

| ID | Story | Status |
|----|-------|--------|
| US-170 | As a user, I want optimized React rendering with useReducer for consolidated state management. | Implemented |
| US-171 | As a user, I want stable function references via useCallback to prevent unnecessary re-renders. | Implemented |
| US-172 | As a user, I want per-route Suspense boundaries so that errors in one route don't crash the entire application. | Implemented |
| US-173 | As a user, I want IndexedDB caching of assignment data so that repeated views load faster. | Implemented |
| US-174 | As a user, I want stale API requests automatically cancelled when I navigate to a new focus node (AbortController management). | Implemented |
| US-175 | As a user, I want pre-computed identity lookup maps (O(1) by UId/Id) instead of linear scans for fast enrichment. | Implemented |

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

### Request Pivot
- **BR-070**: Request pivot shows 4 access cards: Resource (top), System (bottom), Requester (left), Beneficiary (right).
- **BR-071**: If requester and beneficiary are the same identity, OData enrichment is fetched once and reused.
- **BR-072**: Child assignments from the request are included as additional entitlement lane items with "Child Entitlement" badge.
- **BR-073**: Systems from child assignments are deduplicated by system ID before display.
- **BR-074**: Request date (requestedTime) is formatted as dd/MM/YYYY HH:mm (24-hour clock).
- **BR-075**: OData identity enrichment safely handles fields that return objects (`{Id, UId, Value}`) via `safeStr()` helper.

### Identity Requests
- **BR-080**: The Requests lane for Identity focus is fetched via GraphQL `getAccessRequestsForBeneficiary` filtered by the identity's display name.
- **BR-081**: Request lane items show approval status as a grey status pill (not duplicated as a blue badge).

### Session Management
- **BR-090**: Token expiry is proactively checked every 30 seconds while the user is authenticated.
- **BR-091**: If `ensureValidToken()` returns null or throws, the user is logged out and shown a session-expired message.

### CSV Export
- **BR-068**: CSV export includes columns: Focus Node, Focus Node Type, Lane, Item Name, Item Type, Item ID, System, Compliance Status, Reason Types, Valid From, Valid To, Is Filtered, Additional Metadata.
- **BR-069**: CSV values containing commas, quotes, or newlines are escaped per RFC 4180.
- **BR-070b**: CSV filename format: `access-lens-export-{focus-node-name}-{timestamp}.csv`.

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
| 1.25 | 2026-02-11 | Request pivot: 4 access cards (Resource, System, Requester, Beneficiary) with OData enrichment |
| 1.26 | 2026-02-11 | Identity Requests lane via GraphQL getAccessRequestsForBeneficiary |
| 1.27 | 2026-02-11 | Child assignments in Resource card, deduplicated systems in System card |
| 1.28 | 2026-02-11 | API activity spinner (OData/GraphQL counters, dynamic animation speed, in-flight indicator) |
| 1.29 | 2026-02-11 | Per-focus-node-type compass positions, tighter viewport layout, context menu positioning fix |
| 1.30 | 2026-02-11 | Proactive token expiry check (30s timer) with automatic redirect to login on session expiry |
| 1.31 | 2026-02-11 | UX: Navigation History rename, OUREF safe rendering, duplicate pill fixes |
| 1.32 | 2026-02-12 | Cross-lane filtering from Requests lane (Identity focus): filters Systems, Accounts, Entitlements |

---

## Future Considerations

- **TBD**: Integration with existing Omada forms - can Identity360 supplement or replace existing detail forms?
- **TBD**: Visual indicator on identity reference links to open graph view directly
- **TBD**: Object Inspector should not shift the canvas/page to the left when opened
- **TBD**: Show formatted requestedTime in the Request focus node card itself
- Path tracing validation against Assignment Explorer logic
- Enhanced SoD conflict visualization
