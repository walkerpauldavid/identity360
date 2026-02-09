# Access Lens - User Requirements Document

## Overview

Access Lens is an interactive identity access visualization component for Omada Identity Cloud. It provides a radial, node-based view of an identity's access relationships, enabling users to explore, filter, and understand complex access patterns across systems, accounts, entitlements, and organizational contexts.

---

## User Stories

### Core Visualization

**US-001: Central Identity Focus**
As a security analyst, I want to see an identity displayed as the central node (fulcrum) of the access lens, so that I can understand all access relationships radiating from that identity.

**US-002: Lane-Based Organization**
As an access reviewer, I want to see related access data organized into distinct lanes (Accounts, Systems, Entitlements, Contexts, Logical Applications), so that I can quickly identify different types of access.

**US-003: Loading States**
As a user, I want to see loading animations on the central node and lane cards while data is being fetched, so that I know the system is working and can anticipate when data will be available.

**US-004: Compass-Based Positioning**
As a user, I want lane cards to be positioned around the central node using compass orientations (N, NE, E, SE, S, SW, W, NW), so that the layout is predictable and organized.

### Lane Card Functionality

**US-010: Collapsible Lanes**
As a user, I want to collapse and expand individual lane cards, so that I can focus on specific access areas and reduce visual clutter.

**US-011: Maximize Lane View**
As a user, I want to maximize a lane card to see all items when there are more items than initially displayed, so that I can review the complete list without pagination.

**US-012: Lane Card Dragging**
As a user, I want to drag lane cards to reposition them around the central node, so that I can customize the layout to my preference.

**US-013: Reset Layout**
As a user, I want a "Reset Layout" button that restores all lane cards to their default positions, collapses all lanes, and clears all filters, so that I can start fresh.

**US-014: Expand All Lanes**
As a user, I want an "Expand All" button that expands all collapsed lane cards simultaneously, so that I can quickly see all access data at once.

### Cross-Lane Filtering

**US-020: Account-Based Filtering**
As a user, when I click on an account in the Accounts lane, I want to see:
- The Effective Entitlements lane filtered to show only entitlements for that account
- The Systems lane filtered to show only the system that account belongs to
- The Logical Applications lane filtered to show only apps whose underlying systems include the account's system

**US-021: System-Based Filtering**
As a user, when I click on a system in the Systems lane, I want to see:
- The Effective Entitlements lane filtered to show only entitlements on that system
- The Accounts lane filtered to show only accounts on that system
- The Logical Applications lane filtered to show only apps that use that system

**US-022: Logical Application Filtering**
As a user, when I click on a logical application in the Logical Applications lane, I want to see:
- The Effective Entitlements lane filtered to show only resources belonging to that logical app
- The Systems lane filtered to show only the underlying physical systems
- The Accounts lane filtered to show only accounts on those underlying systems

**US-023: Filter Source Visibility**
As a user, I want the lane card that is the source of filtering to be visually prominent (blue glow effect), so that I can easily identify which lane is driving the current filter state.

**US-024: Filtered Lane Indicator**
As a user, I want lanes that are being filtered to display a "Filtered" badge, so that I know the data is a subset of the total.

### Entitlements Lane Features

**US-030: Search Within Entitlements**
As a user, I want a search field in the Effective Entitlements lane header, so that I can quickly find specific entitlements by name.

**US-031: Resource Type Filter Chips**
As a user, I want clickable resource type chips below the Entitlements lane header, so that I can filter entitlements by their resource type (e.g., Role, Permission, Group).

**US-032: Dynamic Resource Type Chips**
As a user, when the Entitlements lane is filtered by cross-lane filtering, I want the resource type chips to update to show only the types present in the filtered data, so that I only see relevant filter options.

**US-033: Multi-Select Resource Types**
As a user, I want to select multiple resource type chips to filter by multiple types simultaneously, so that I can view a combination of resource types.

**US-034: Clear Resource Type Filters**
As a user, I want a "Clear" button to remove all selected resource type filters at once, so that I can quickly reset the type filter.

### Object Inspector

**US-040: Item Selection**
As a user, when I click on any item in a lane, I want to see detailed information about that item in the Object Inspector panel, so that I can examine its properties.

**US-041: Central Node Inspection**
As a user, when I click on the central identity node, I want to see the full identity details in the Object Inspector panel, so that I can review identity attributes.

**US-042: Collapsible Inspector**
As a user, I want to collapse and expand the Object Inspector panel, so that I can maximize the visualization area when not reviewing details.

### Navigation and Context

**US-050: Omada Toolbar Visibility**
As a user, I want the Omada navigation toolbar (with logo and icons) to always be visible at the top of the Access Lens page, so that I can navigate to other areas of the application.

**US-051: Fullscreen Mode**
As a user, I want the Access Lens to expand to fill available space while keeping the Omada toolbar visible, so that I have maximum visualization area without losing navigation.

**US-052: Breadcrumb Navigation**
As a user, I want to see breadcrumbs showing my navigation history when I pivot to different nodes, so that I can track and return to previous views.

### Identity Selection

**US-060: Identity Search**
As a user, I want to search for and select an identity to view in the Access Lens, so that I can analyze any identity's access.

**US-061: Change Identity**
As a user, I want to change the currently viewed identity without leaving the Access Lens, so that I can compare access across different identities.

**US-062: Identity Display**
As a user, I want to see the identity's display name and IDENTITYID in the central node, so that I can confirm which identity I'm analyzing.

### Pivot Functionality

**US-070: Pivot to System**
As a user, I want to click a pivot button on a system to make it the central node, so that I can see all identities and accounts with access to that system.

**US-071: Pivot to Entitlement**
As a user, I want to click a pivot button on an entitlement to make it the central node, so that I can see all identities who have that entitlement.

### System-Centric View

**US-080: System as Central Node**
As a user, when I pivot to a System, I want to see three lanes: Identities (users with access), Accounts (accounts on this system), and Entitlements (resources on this system), so that I can understand all access to this system.

**US-081: System-Centric Identity Filtering**
As a user, when viewing a System as the central node and I click on an identity in the Identities lane, I want to see:
- The Accounts lane filtered to show only accounts belonging to that identity
- The Entitlements lane filtered to show only entitlements assigned to that identity

**US-082: System-Centric Account Filtering**
As a user, when viewing a System as the central node and I click on an account in the Accounts lane, I want to see:
- The Identities lane filtered to show only the identity that owns that account
- The Entitlements lane filtered to show only entitlements assigned through that account

**US-083: Loading Overlay During Pivot**
As a user, when pivoting to a different central node (System, Entitlement, Identity), I want to see a loading overlay with status messages (e.g., "Fetching access data for [name]..."), so that I know the system is loading new data.

### Logical Applications Lane

**US-080L: Logical Application Display**
As a user, I want to see a Logical Applications lane that groups resources by their parent application/system, so that I can understand access from a business application perspective rather than just individual entitlements.

**US-081L: Logical Application Derivation**
As a user, I want Logical Applications to be derived automatically from my effective entitlements (by grouping resources that share the same parent system), so that I don't need to manually configure application groupings.

**US-082L: Logical Application Metadata**
As a user, I want each Logical Application to display:
- The application name (derived from the system's DISPLAYNAME)
- A count of resources within that application
- A count of underlying accounts (if any)
- System classification and owner information when available

**US-083L: Bidirectional Filtering with Systems**
As a user, when I click on a Logical Application, I want to see the Systems lane filtered to show the underlying physical systems, AND when I click on a System, I want to see the Logical Applications lane filtered to show only apps that use that system.

**US-084L: Logical vs Physical System Distinction**
As a user, I want Logical Applications to be visually distinct from Physical Systems (different icon styling), so that I can differentiate between abstract application groupings and concrete system access.

### Entitlement-Centric View

**US-090: Entitlement Resource Owner**
As a user, when viewing an Entitlement as the central node, I want to see the resource owner information (from OWNERREF field in OData), so that I know who is responsible for managing this entitlement.

**US-091: Entitlement-Centric Identity Filtering**
As a user, when viewing an Entitlement as the central node and I click on an identity in the Identities lane, I want to see the Accounts lane filtered to show only accounts belonging to that identity.

**US-092: Entitlement-Centric Account Filtering**
As a user, when viewing an Entitlement as the central node and I click on an account in the Accounts lane, I want to see the Identities lane filtered to show only the identity that owns that account.

### Toolbar Filter Cascading

**US-100: Compliance Filter Cascading**
As a user, when I select a compliance status filter (e.g., "Not Approved") from the toolbar dropdown, I want ALL access cards to be filtered to show only items related to entitlements with that compliance status, so that I can focus on specific compliance issues across all access relationships.

**US-101: Cascaded Filter Visual Indicator**
As a user, when toolbar filters are active, I want to see the "Filtered" badge appear on ALL access cards that have been cascaded-filtered, so that I know the data shown is a subset based on the compliance filter.

**US-102: Reason Type Filter Cascading**
As a user, when I select a reason type filter from the toolbar, I want all access cards to cascade-filter to show only items related to entitlements with that assignment reason, so that I can analyze access by how it was granted.

**US-103: Empty Filter Results**
As a user, when a toolbar filter results in zero matching entitlements, I want all related access cards to show empty (with "Filtered" badge), so that I understand no data matches the current filter criteria.

### Entitlement Reason Type Display

**US-110: Reason Type Badge on Entitlements**
As a user, I want each entitlement lane item to display a color-coded badge showing how the access was granted (Direct, Policy, Inherited, etc.), so that I can quickly understand the assignment source without clicking into details.

**US-111: Reason Type Visual Distinction**
As a user, I want different reason types to have distinct colors, so that I can visually scan the entitlements lane and identify patterns (e.g., many policy-based vs direct assignments).

**US-112: Multiple Reasons Display**
As a user, when an entitlement has multiple assignment reasons, I want to see ALL unique reason type badges displayed as pills, so that I understand all the sources of that access (e.g., both "Direct" and "Policy" if applicable).

### Multi-Path Assignment Visualization

**US-120: Multi-Path Indicator on Entitlements**
As a user, I want to see a visual indicator (⚡ badge with count) on entitlements that have multiple overlapping assignment paths (e.g., granted by both Direct assignment AND Policy), so that I can identify potential over-provisioning.

**US-121: Multi-Path Filter Toggle**
As a user, I want a "Multi-Path" filter toggle in the toolbar that shows only entitlements with multiple assignment paths, so that I can focus on analyzing potentially over-provisioned access.

**US-122: Multi-Path Cascaded Filtering**
As a user, when I enable the Multi-Path filter, I want all related lanes (Identities, Accounts, Systems, etc.) to cascade-filter to show only items related to the multi-path entitlements, so that I can understand the full context.

**US-123: Multi-Path in Compliance Heatmap** *(Removed in v1.18)*
~~As a user, I want to see multi-path assignment counts in the System Compliance Heatmap, including:~~
~~- A "Multi-Path" count in the header stats showing total across all systems~~
~~- A "Multi-Path" row in each system tile showing count and percentage~~
~~- A "Show only multi-path systems" filter toggle~~
~~So that I can identify which systems have the most overlapping access assignments.~~

*Note: Multi-path capability was removed from the Compliance Heatmap in v1.18. Multi-path filtering remains available in the toolbar for the main Access Lens view.*

### Inherited Resource Display

**US-124: Inherited Reason Parent Resource Tooltip**
As a user, when I hover over an "Inherited" reason pill on an entitlement, I want to see the parent resource name in the tooltip (e.g., "Inherited from: AD Security Group - Admins"), so that I understand which parent resource grants this inherited access.

### Assignment Validity Period Display

**US-125: Validity Period on Entitlements**
As a user, I want to see a validity period pill on each entitlement showing when the assignment is valid (e.g., "Never expires", "Until 07/26", "From 01/25", or "01/25 → 07/26"), so that I can understand the time constraints on each access assignment.

**US-126: Expiring Soon Indicator**
As a user, I want entitlements expiring within 90 days to be visually highlighted with an amber indicator, so that I can proactively identify and review soon-to-expire access before it lapses.

**US-127: Permanent vs Time-Limited Distinction**
As a user, I want permanent assignments ("Never expires") to be visually distinct from time-limited assignments, so that I can quickly identify which entitlements have expiration dates that may need attention.

### Unified Toolbar

**US-131: Consolidated Toolbar**
As a user, I want all toolbar actions (Expand All, Reset Layout, lane toggles, filters, search, breadcrumbs) consolidated into a single toolbar row, so that the UI is compact and I have more vertical space for the visualization canvas.

**US-132: Toolbar Layout Actions**
As a user, I want the "Expand All" and "Reset Layout" buttons grouped together on the left side of the toolbar with adequate spacing, so that layout actions are visually distinct from filter actions.

**US-133: Compact Filter Buttons**
As a user, I want the Multi-Path, Reason Types, and Compliance filter buttons tightly spaced together, so that related filter controls are grouped as a cohesive unit without excessive whitespace.

**US-134: Search and Breadcrumbs Group**
As a user, I want the search input and breadcrumb navigation grouped together at the end of the toolbar, so that navigation and search are co-located.

### Lane Card Sizing

**US-135: Single-Column Lane Card Sizing**
As a user, I want single-column lane cards (Accounts, Systems, Assignment Policies, Roles, Identities, Contexts, Violations, Logical Applications) to display 4 visible items with a vertical scroll bar for overflow, so that I can see a consistent number of items at a glance while retaining access to the full list.

### Canvas Positioning

**US-136: Canvas Vertical Position**
As a user, I want the focus node and surrounding lanes to appear near the top of the visible viewport without requiring scrolling, so that I can immediately see the access graph when loading the page.

### Drag Z-Index Behavior

**US-137: Focus Node Behind Dragged Lane**
As a user, when I drag an access card over the focus node, I want the focus node to appear behind the dragged card, so that I can freely reposition lanes without the focus node visually obstructing them.

### Assignment Policy to Context Cross-Lane Filtering

**US-128: Policy Context Filtering**
As a user, when I select an Assignment Policy in the Assignment Policies lane, I want the Contexts lane to filter and show only the organizational contexts that trigger that policy (via AP_CONTEXTS), so that I can understand which contexts cause identities to receive entitlements through that policy.

**US-129: Policy Context Enrichment**
As a user, I want the Assignment Policies lane to automatically fetch and display context association data (AP_CONTEXTS) from the OData API, so that I can see the relationship between policies and organizational contexts without manual lookup.

**US-130: Policy Context Tooltip**
As a user, when I hover over an Assignment Policy lane item, I want to see which contexts are associated with it, so that I can quickly understand the policy's scope.

### Entitlement Focus Node Enhancements

**US-140: Resource Folder Lane for Entitlement**
As a user, when I pivot to an Entitlement as the focus node, I want to see a Resource Folder lane showing the folder that contains this entitlement (if it has one), so that I can understand the organizational grouping of the entitlement.

**US-141: Resource Folder Approval Display**
As a user, I want the Resource Folder lane item to display the folder's Approval status as a badge (e.g., "Approval: Manager"), so that I can understand what approval is required for resources in that folder.

**US-142: Child Resources Lane for Entitlement**
As a user, when I pivot to an Entitlement that has child resources (CHILDROLES), I want to see a Child Resources lane showing all child entitlements, so that I can understand the hierarchical structure of the entitlement.

**US-146: Child Resource Enriched Display**
As a user, when viewing child resources in the Child Resources lane, I want to see full resource information including:
- A "CHILD" badge indicating this is a child resource
- The system name badge (e.g., "SharePoint", "Active Directory")
- The resource type badge (e.g., "Role", "Group", "Permission")
- Description in the tooltip when hovering

so that I can understand what type of resource each child is and which system it belongs to, rather than just seeing the resource name.

**US-143: Object Inspector State Reset on Pivot**
As a user, when I pivot from one focus node type to another (e.g., Identity to Entitlement), I want the Object Inspector to be cleared automatically, so that I don't see stale data from the previous node type.

**US-144: Never Expires Pill for Missing ValidTo**
As a user, when an entitlement assignment has no expiry date (validTo is null/undefined), I want to see a "Never expires" pill, so that I understand the assignment is permanent.

**US-145: Never Expires with Start Date Display**
As a user, when an entitlement assignment has a start date but no expiry date, I want to see "From MM/YY · Never expires" as the validity display, so that I can see both the start date and the permanent nature of the assignment.

### Three-Level Cascade Filtering

**US-150: Context Filtering of Accounts**
As a user, when I select a Context in the Contexts lane, I want the Accounts lane to be filtered to show only accounts that have entitlements assigned through Assignment Policies triggered by that context, so that I can understand which accounts are affected by context-based policies.

**US-151: Context Filtering of Systems**
As a user, when I select a Context in the Contexts lane, I want the Systems lane to be filtered to show only systems that have entitlements assigned through Assignment Policies triggered by that context, so that I can understand which systems are affected by context-based policies.

**US-152: Context Filtering of Logical Applications**
As a user, when I select a Context in the Contexts lane, I want the Logical Applications lane to be filtered to show only logical applications that have entitlements assigned through Assignment Policies triggered by that context, so that I can understand which applications are affected by context-based policies.

**US-153: Three-Level Cascade Filter Flow**
As a user, I want the Context→Accounts/Systems/Logical Applications filtering to work through a 3-level cascade (Context → Assignment Policies → Entitlements → Target lanes), so that the filtering accurately reflects the relationship between contexts, policies, and access assignments.

### CSV Export

**US-154: Export Current View to CSV**
As a user, I want to export the current Access Lens view to a CSV file, so that I can analyze the data in Excel or other tools, share it with colleagues, or use it for compliance reporting.

**US-155: CSV Export Includes All Visible Lanes**
As a user, when I export to CSV, I want all currently visible lane data to be included, so that I get a comprehensive snapshot of the access view.

**US-156: CSV Export Includes Metadata**
As a user, when I export to CSV, I want each row to include focus node info, lane name, item name, type, ID, system, compliance status, reason types, validity dates, and additional metadata, so that I have all relevant information for analysis.

### UI Enhancements

**US-157: Professional Focus Card Color**
As a user, I want the focus card to use the Omada Primary Blue (#005EB8) color instead of a brighter blue, so that the interface looks professional and aligns with Omada brand guidelines.

**US-158: Orange "Never Expires" for Direct Assignments**
As a user, when an entitlement with only DIRECT assignment reasons has a "Never expires" validity, I want the pill to display in orange color, so that I can quickly identify permanent direct access that may need review. Inherited and policy-assigned entitlements should retain the default color.

---

## Business Rules

### Data Display Rules

**BR-001: Lane Visibility**
Lanes shall only be displayed if they contain at least one item, EXCEPT for required lanes per focus node type which shall always be visible.

**BR-001a: Required Lanes by Focus Node Type**
- **Identity Focus**: Systems, Accounts, Effective Entitlements, Contexts, Logical Applications (as available)
- **System Focus**: Identities, Accounts, Effective Entitlements (always visible even if empty)
- **Entitlement Focus**: Identities, Accounts (always visible even if empty)

**BR-002: Item Counts**
Each lane header shall display the total count of items. When filtered, the count shall show "filtered/total" format (e.g., "5/25").

**BR-003: Entitlement Exclusion**
Account-type resources shall be excluded from the Effective Entitlements lane. Only non-account resources (Roles, Permissions, Groups, etc.) shall be displayed.

**BR-004: System Classification**
Systems shall be classified as either Physical Systems or Logical Applications based on whether they have direct accounts. Logical Applications have resources but no direct account associations.

**BR-004a: Logical Application Derivation**
Logical Applications shall be derived from the identity's calculated assignments by:
1. Extracting unique system references from all effective entitlements
2. Grouping resources by their parent system (using ABORESSION or systemRef)
3. Creating a logical application node for each unique system grouping
4. Setting `metadata.isLogical = true` for systems without direct accounts

**BR-004b: Logical Application Resource Tracking**
Each Logical Application shall track:
- `resourceCount`: Number of unique resources/entitlements within the application
- `accountCount`: Number of accounts on underlying systems (may be 0 for logical-only apps)
- `underlyingSystems`: Array of physical system IDs that comprise this logical application
- `resourceIds`: Array of resource IDs belonging to this application (for filtering)

**BR-004c: Logical Application Display Priority**
When both Physical Systems and Logical Applications exist for the same underlying system, both shall be displayed in their respective lanes to provide different perspectives on access.

**BR-005: Identity Display Format**
Identity names shall be displayed as DISPLAYNAME with IDENTITYID in parentheses when available (e.g., "John Smith (EMP12345)").

### Filtering Rules

**BR-010: Single Filter Source**
Only one lane can be the active filter source at a time. Clicking an item in a different lane clears the previous filter and applies the new one.

**BR-011: Filter Clearing**
Clicking the currently selected (filtering) item again shall deselect it and clear all cross-lane filters.

**BR-012: Reset Behavior**
The "Reset Layout" action shall:
- Clear all cross-lane filter selections
- Reset all lane positions to defaults
- Collapse all lane cards
- Clear the search query and resource type filters

**BR-013: Resource Type Filter Persistence**
Selected resource type filters shall be automatically cleared if they are no longer valid after cross-lane filtering changes the available types.

### Logical Application Filtering Rules

**BR-014: Logical Application -> Entitlements Filtering**
When a Logical Application is selected, the Effective Entitlements lane shall filter to show only entitlements whose ABORESSION or systemRef matches the logical application's underlying system(s).

**BR-015: Logical Application -> Systems Filtering**
When a Logical Application is selected, the Systems lane shall filter to show only the physical systems that underlie the selected logical application.

**BR-016: Logical Application -> Accounts Filtering (Cascaded)**
When a Logical Application is selected, the Accounts lane shall filter using cascaded filtering:
1. First, determine the underlying system IDs from the logical application
2. Then, filter accounts to show only those whose systemRef matches any underlying system
This is a cascaded filter relationship, not a direct field match.

**BR-017: Systems -> Logical Applications Filtering**
When a System is selected, the Logical Applications lane shall filter to show only logical applications that include the selected system in their underlyingSystems array.

**BR-018: Accounts -> Logical Applications Filtering (Cascaded)**
When an Account is selected, the Logical Applications lane shall filter using cascaded filtering:
1. First, extract the systemRef from the selected account
2. Then, filter logical applications to show only those whose underlyingSystems include that systemRef

### Toolbar Filter Cascading Rules

**BR-019: Compliance Filter Cascading**
When a compliance status filter is selected from the toolbar:
1. The Effective Entitlements lane shall filter to show only entitlements with the selected compliance status(es)
2. All other lanes shall cascade-filter based on their relationships to the filtered entitlements

**BR-020: Cascaded Filter ID Extraction**
When cascading toolbar filters, the following IDs shall be extracted from filtered entitlements:
- `relatedEntitlementIds`: All entitlement (resource) IDs from filtered items - used for policy filtering
- `relatedAccountIds`: From `metadata.accountIds` array and `rawData.account.id`
- `relatedIdentityIds`: From `metadata.identityIds` array and `rawData.identity.id`
- `relatedSystemIds`: From both `rawData.account.system.id` and `metadata.systemId`

**BR-021: Assignment Policies Cascaded Filtering**
Assignment Policies shall be filtered by checking if their `metadata.resourceIds` array contains any of the filtered entitlement IDs. This approach is used because:
- Entitlement items may have multiple assignment reasons (from different policies)
- Due to entitlement deduplication, only the first assignment's reason is preserved in `rawData`
- Policies store the complete list of entitlement IDs they granted in `metadata.resourceIds`

**BR-022: Logical Applications Cascaded Filtering**
Logical Applications shall be filtered by:
1. Checking if the logical app ID matches any filtered entitlement's system ID
2. Checking if the logical app ID is in the `relatedLogicalAppIds` set
3. Checking if any of the logical app's `metadata.underlyingSystemIds` match the filtered system IDs

**BR-023: Violations Cascaded Filtering**
Violations shall be filtered by extracting violation IDs from filtered entitlements' `rawData.violations` or `node.metadata.violations` arrays, then filtering to show only violations with matching IDs.

**BR-024: Empty Entitlements Cascade**
When toolbar filters result in zero matching entitlements:
- All related lanes (Identities, Accounts, Systems, Assignment Policies, Logical Applications, Violations) shall be cleared
- Each cleared lane shall display the "Filtered" indicator with zero items

**BR-025: Entitlement-Centric Compliance Filtering**
In entitlement-centric view (where there is no Entitlements lane):
- Identities and Accounts lanes shall be filtered directly by their own `metadata.complianceStatus`
- This is because these items store their compliance relationship with the central entitlement

### Reason Type Display Rules

**BR-026: Reason Type Badge Display**
Each entitlement lane item shall display a reason type badge derived from the API `reason` array. The badge shows how/why the access was granted.

**BR-027: Reason Type API Structure**
The API returns `reason` as an array of objects, each containing:
- `description`: Human-readable explanation of the assignment
- `reasonType`: Machine-readable type identifier

**BR-028: Reason Type Mapping**
API reason types shall be mapped to user-friendly display labels:

| API reasonType | Display Label | Color | Description |
|----------------|---------------|-------|-------------|
| `ActualDirect` | Direct | Blue (#5e81ac) | Actual assignment in the system |
| `Direct` | Direct | Blue (#5e81ac) | Direct/manual assignment request |
| `Policy` | Policy | Purple (#b48ead) | Policy-based automatic assignment |
| `UnconfirmedActual` | Pending | Amber (#d79921) | Provisioning claim queued/in progress |
| `ChildResource` | Inherited | Light Blue (#81a1c1) | Inherited from parent resource |
| `AutoAccount` | Auto | Teal (#458588) | Automatic account creation |
| `RoleMembership` | Role | Green (#689d6a) | Assigned via role membership |
| `Birthright` | Birthright | Orange (#d08770) | Birthright/joiner assignment |
| `AccountLink` | Account | Amber (#d79921) | Account link assignment |
| `SoDException` | Exception | Red (#bf616a) | SoD exception granted |

All badges use white text for readability.

**BR-029: Multiple Reason Type Display**
When an entitlement has multiple reasons, ALL unique reason types shall be displayed as separate pills. Duplicate reason types (same type appearing multiple times) shall be deduplicated and shown only once.

**BR-030: Reason Type Fallback**
If the API returns an unmapped reasonType, the raw value shall be displayed as-is. If no reasonType is available, no badge shall be shown.

**BR-031: Reason Type Styling**
All reason type badges shall use white text for readability. Each reason type has a distinct background color as defined in BR-028.

**BR-031a: Multiple Reason Pills Display**
When an entitlement has multiple assignment paths with different reason types, each unique reason type shall be displayed as a separate pill. The following table shows example API responses and their corresponding pill display:

| API Response (reason array) | Pills Displayed |
|-----------------------------|-----------------|
| `[{reasonType: "Direct"}]` | Direct |
| `[{reasonType: "Direct"}, {reasonType: "Policy"}]` | Direct, Policy |
| `[{reasonType: "Policy"}, {reasonType: "ChildResource"}]` | Policy, Inherited |
| `[{reasonType: "ActualDirect"}, {reasonType: "RoleMembership"}]` | Direct, Role |
| `[{reasonType: "Direct"}, {reasonType: "Direct"}]` | Direct (deduplicated) |

**BR-031b: Inherited Reason Tooltip Enhancement**
When hovering over an "Inherited" reason pill (ChildResource type), the tooltip shall display the parent resource name if available from the API response. Format: "Inherited from: [parentResource.name]". If parentResource is not available, the default description is shown.

### Assignment Validity Period Rules

**BR-037: Validity Period Display**
Each entitlement lane item shall display a validity period pill showing the assignment's time period. The `validFrom` and `validTo` fields are at the assignment data level in the API response.

**BR-038: Validity Date Formatting**
Validity dates shall be displayed in MM/YY format (e.g., "07/26" for July 2026). Time components shall not be displayed.

**BR-039: Default Date Handling**
- If `validFrom` year is 1999: Do not display the start date (this is the Omada default for "no start date")
- If `validTo` year is 9999: Display "Never expires" (this is the Omada default for "no end date")

**BR-040: Validity Period Display Logic**

| validFrom Year | validTo Year | Display |
|----------------|--------------|---------|
| 1999 | 9999 | "Never expires" (green pill) |
| 1999 | Real date | "Until MM/YY" (blue pill) |
| Real date | 9999 | "From MM/YY" (green pill) |
| Real date | Real date | "MM/YY → MM/YY" (blue pill) |

**BR-041: Expiring Soon Indicator**
Assignments expiring within 90 days shall display an amber pill with a subtle pulse animation to draw attention to soon-to-expire access.

### Assignment Policy to Context Filtering Rules

**BR-042: Policy Context Data Source**
Assignment Policy context associations shall be fetched from the Omada OData API endpoint `/OData/DataObjects/Assignmentpolicy/{policyId}`. The `AP_CONTEXTS` array in the response contains the organizational contexts that trigger the policy.

**BR-043: Policy OData Enrichment**
When Assignment Policies are built from calculated assignments, the system shall asynchronously enrich each policy with OData details:
1. Extract the policy ID from `reason.causeObjectKey`
2. Fetch policy details from OData using the policy ID
3. Store `AP_CONTEXTS` array in `metadata.apContexts`
4. Extract context UIds into `metadata.contextUIds` for cross-lane filtering

**BR-044: Policy to Context Cross-Lane Filter**
When an Assignment Policy is selected:
1. The filter type shall be `ARRAY_CONTAINS`
2. The source field shall be `metadata.contextUIds` (array of context UIds from AP_CONTEXTS)
3. The target field shall be `metadata.uId` on Context lane items
4. Only contexts whose UId appears in the policy's AP_CONTEXTS shall be displayed

**BR-045: Context UId Storage**
Context lane items shall store the context UId in `metadata.uId` to enable cross-lane filtering with Assignment Policies. The UId is extracted from:
- GraphQL response: `context.id` or `context.UId`
- OData response: `context.UId` or `context.Id`

**BR-046: AP_CONTEXTS Array Structure**
The AP_CONTEXTS array from OData contains context objects with the following structure:
```json
{
  "Id": 1003843,
  "UId": "5d00d8a7-fa5d-46fe-a00b-6392a5fd12f4",
  "KeyValue": null,
  "KeyProperty": null,
  "DisplayName": "Global Banking Group [GBG]"
}
```
The `UId` field is used for cross-lane filtering matches.

### Multi-Path Assignment Rules

**BR-032: Multi-Path Detection**
An entitlement shall be considered "multi-path" when its `reason` array contains more than one entry, indicating it is granted through multiple overlapping sources (e.g., both Direct and Policy).

**BR-033: Multi-Path Badge Display**
Entitlements with multiple assignment paths shall display an ⚡ badge with the path count (e.g., "⚡2" for two paths). The badge uses an orange gradient background (#d08770 to #ebcb8b) with white text.

**BR-034: Multi-Path Row Styling**
Lane item rows for multi-path entitlements shall have an orange left border (3px solid #d08770) to provide additional visual distinction.

**BR-035: Multi-Path Filter Cascading**
When the Multi-Path toolbar filter is active:
1. The Entitlements lane shall filter to show only items where `reason` array length > 1
2. All other lanes shall cascade-filter based on their relationships to the filtered multi-path entitlements
3. The filter cascading follows the same rules as compliance filter cascading (BR-019 through BR-025)

**BR-036: Multi-Path Heatmap Integration** *(Removed in v1.18)*
~~The Compliance Heatmap shall track and display multi-path statistics:~~
~~- `multiPath.multiPathCount`: Number of assignments with multiple paths per system~~
~~- `multiPath.multiPathRate`: Percentage of multi-path assignments per system~~
~~- Systems shall be filterable by "Show only multi-path systems" toggle~~
~~- When multi-path filter is active and non-compliant filter is not, tiles shall be sized by multi-path count~~

*Note: Multi-path capability was removed from the Compliance Heatmap in v1.18. The heatmap now focuses solely on compliance status.*

### Unified Toolbar Rules

**BR-047: Consolidated Toolbar Layout**
The FilterBar component shall combine all toolbar elements into a single row:
1. Layout actions (Expand All, Reset Layout) - left side with 0.75rem gap
2. Filter divider
3. Lane toggles (Roles, Accounts, Entitlements, Policies, Systems, Identities, Object Inspector)
4. Filter divider
5. Multi-Path toggle, Reason Types dropdown, Compliance dropdown - tightly spaced (2px gap)
6. Search input and Breadcrumbs - grouped at end

**BR-048: Entitlement Type Dropdown Removed**
The "All Entitlements" dropdown filter (entitlement type: all/direct/inherited) has been removed from the toolbar. Entitlement filtering is now handled exclusively through Reason Type and Compliance filters.

### Single-Column Lane Card Rules

**BR-049: Single-Column Visible Items**
Single-column lane cards shall display a maximum visible height of 4 items (272px max-height). All items are rendered in the DOM, with overflow handled by `overflow-y: auto` scrolling. The "Show all X items" button is hidden for single-column lanes since scrolling provides access to all items.

**BR-050: Single-Column Display Configuration**
The `LaneDisplayRules.SINGLE_COLUMN` configuration shall be: `{ columns: 1, rows: 4, width: 350, maxVisibleItems: 4 }`.

### Canvas Positioning Rules

**BR-051: Canvas Vertical Anchor**
The canvas center point (focus node, lane positions, loading placeholders) shall use `top: 40%` instead of `top: 50%` to position content within the initial viewport without requiring vertical scrolling. The canvas minimum height is 1600px, placing the center at approximately 640px.

**BR-052: Consistent Canvas Center**
A shared constant `CANVAS_CENTER_Y = '40%'` shall be used by all positioned elements (fulcrum-wrapper CSS, DraggableLane inline style, LoadingLanePlaceholder inline style) to ensure consistent vertical alignment.

### Drag Z-Index Rules

**BR-053: Focus Node Z-Index During Drag**
When any lane card is being dragged (`activeDragId !== null`), the focus node (fulcrum-wrapper) z-index shall drop from 10 to 1, ensuring the dragged lane card (z-index: 100) always renders above the focus node. When no drag is active, the focus node returns to z-index: 10.

### Loading Bug Fix Rules

**BR-054: Lane Loading State Cleanup**
The `lanesLoading` state must be cleared in both success and error paths. Specifically, `setLanesLoading(false)` must be called in the `finally` block of the `handlePivot` function, as well as in any fallback path where `handlePivotToNode` returns null or is not called. Failure to clear this state causes permanent loading spinners and prevents lane reveal animations.

### Entitlement Focus Node Rules

**BR-055: Resource Folder Lane Building**
When an Entitlement is the focus node, the `buildLanesForEntitlement()` function shall check for a resource folder in `entitlementNode.rawData.resourceFolder`, `entitlementNode.metadata.resourceFolder`, or `entitlementNode.rawData.ROLEFOLDER` (OData format) and build a RESOURCE_FOLDERS lane if found.

**BR-056: Resource Folder Lane Visibility**
The RESOURCE_FOLDERS lane type must be included in the default `visibleLanes` filter array to ensure it displays when built.

**BR-057: Resource Folder Approval Badge**
Resource Folder lane items shall display an "Approval: {value}" badge when the folder has approval information from OData enrichment (extracted from the `APPROVAL` field).

**BR-058: Child Resources Lane Building**
When an Entitlement is the focus node, the `buildLanesForEntitlement()` function shall check for child resources in `entitlementNode.rawData.CHILDROLES` and build an EFFECTIVE_ENTITLEMENTS lane (titled "Child Resources") if child roles exist.

**BR-058a: Child Resource OData Enrichment**
When CHILDROLES are extracted from the parent resource OData query, each child resource reference shall be enriched with full resource details by making additional OData queries to `/OData/DataObjects/Resource?$filter=Uid eq {childUId}`. This enrichment shall extract:
- `RESOURCETYPE` (resource type display name)
- `SYSTEMNAME` or `SYSTEMDISPLAYNAME` (system display name)
- `DESCRIPTION` (resource description)

A maximum of 50 child resources shall be enriched to avoid excessive API calls.

**BR-058b: Child Resource Badge Display**
Child resource lane items shall display badges in this order:
1. "CHILD" badge (always present, indicating this is a child resource)
2. System name badge (if available from OData enrichment)
3. Resource type badge (if available from OData enrichment)

These badges shall be populated by the `buildChildResourcesLaneForEntitlement()` function from the enriched CHILDROLES data.

**BR-059: Enrichment Loop Prevention**
Enrichment useEffects (for policies and resource folders) must use refs (`policiesEnrichedRef`, `foldersEnrichedRef`) to track enrichment status per focus node. These refs must be reset when `focusNode.id` changes. The ref must be set to `true` before the async enrichment call to prevent duplicate calls.

**BR-060: Object Inspector State Reset**
When `focusNode.type` changes (indicating a pivot to a different node type), the Object Inspector state (`selectedItem`, `explanation`, `selectedReasonId`) must be cleared to prevent displaying stale data from the previous focus node.

**BR-061: Never Expires for Missing ValidTo**
The validity display function shall treat a null/undefined `validTo` the same as year 9999, displaying "Never expires" in both cases.

**BR-062: Validity Display with Start Date**
When an entitlement has a valid start date (not null and not year 1999) but no end date (null or year 9999), the validity display shall show "From MM/YY · Never expires" to indicate both the start date and permanent nature.

### Three-Level Cascade Filtering Rules

**BR-063: Context to Target Lanes Filter Path**
When a Context is selected, the filter shall cascade through three levels:
1. Context → Assignment Policies (by contextIds or contextNames)
2. Assignment Policies → Effective Entitlements (by resourceIds)
3. Effective Entitlements → Target lanes (Accounts by accountIds, Systems by systemId, Logical Applications by systemId)

**BR-064: Name Fallback for Context Matching**
When matching Contexts to Assignment Policies, the system shall first attempt ID-based matching (`metadata.contextIds`), then fall back to name-based matching (`metadata.contextNames`) to handle UUID mismatches between GraphQL and OData data sources.

**BR-065: Target Lane FilteredByLanes Configuration**
Systems, Accounts, and Logical Applications lanes shall include `LaneTypes.CONTEXTS` in their `filteredByLanes` arrays to enable filtering when a Context is selected.

**BR-066: Cascaded Filter Type**
The `TRIPLE_CASCADED_WITH_NAME_FALLBACK` filter type shall be used for Context→Target lane filtering, supporting the 3-level cascade with name fallback on the first level.

**BR-067: Auto-Expand Filtered Lanes**
Lanes that transition from unfiltered to filtered state shall automatically expand if they were collapsed, ensuring filtered results are immediately visible.

### CSV Export Rules

**BR-068: CSV Export Data Columns**
CSV export shall include the following columns: Focus Node, Focus Node Type, Lane, Item Name, Item Type, Item ID, System, Compliance Status, Reason Types, Valid From, Valid To, Is Filtered, Additional Metadata.

**BR-069: CSV Value Escaping**
CSV values containing commas, quotes, or newlines shall be properly escaped according to RFC 4180 (quoted with internal quotes doubled).

**BR-070: CSV Filename Format**
CSV export filename shall follow the format: `access-lens-export-{focus-node-name}-{timestamp}.csv` where timestamp is ISO 8601 format with colons and periods replaced by hyphens.

### UI Enhancement Rules

**BR-071: Focus Card Color**
The focus card in light theme shall use Omada Primary Blue (#005EB8) as the background color with matching box-shadow.

**BR-072: Violations Lane Item Styling**
Violations lane items shall use standard white background and blue border styling (matching other lanes) while the lane card header retains the red error color.

**BR-073: Canvas Concentric Rings**
The light theme canvas background shall display subtle concentric rings emanating from the focus node center using a repeating radial gradient with Omada Primary Blue (#005EB8) at 3% opacity.

**BR-074: Direct Never Expires Orange Styling**
Entitlements with ONLY Direct/DirectAssignment/ActualDirect reason types that have "Never expires" validity shall display the validity pill in orange (#D97706 text, #FEF3C7 background) to flag permanent direct access requiring review. Entitlements with any inherited or policy-based reasons shall retain default styling.

### Layout Rules

**BR-026: Lane Spacing**
Lane cards shall be positioned with sufficient spacing to prevent overlap. Minimum vertical gap between adjacent lanes: 400 pixels.

**BR-027: Collision Detection**
The lane positioning algorithm shall detect and prevent overlaps between lane cards and between lane cards and the central node.

**BR-028: Drag Constraints**
Dragged lane cards shall remain within the visible canvas area.

**BR-029: Z-Index Management**
- Central node (fulcrum): z-index 10 (drops to 1 during any lane drag - see BR-053)
- Lane cards (normal): z-index 1
- Lane cards (hovered): z-index 50
- Lane cards (dragging): z-index 100
- Maximized lane cards: z-index 50

### Visual Styling Rules

**BR-030: Filter Source Styling**
The lane card that is the active filter source shall display:
- 3px solid blue border (#81a1c1)
- Blue glow effect (box-shadow with 20px, 40px, 60px spread)
- "Filtering" badge with solid blue background

**BR-031: Filtered Lane Styling**
Lanes that are being filtered (not the source) shall display:
- Yellow/amber border (#ebcb8b)
- "Filtered" badge

**BR-032: Loading State Styling**
Loading placeholders shall display:
- Dashed border with pulsing animation
- Spinner icon
- "Loading..." text

### Performance Rules

**BR-040: Initial Load Limit**
Lane cards shall initially display items with scrolling for overflow. The maximize feature provides access to all items.

**BR-041: Debounced Search**
Search input shall filter as the user types without requiring explicit submission.

---

## Technical Architecture

### Schema-Driven Design

Access Lens uses a schema-driven architecture to define lane configurations, cross-lane filtering relationships, and field mappings. This approach enables:

- **Configuration over code**: Lane behavior is defined in schema objects rather than hardcoded logic
- **Consistent filtering**: Cross-lane filter relationships are declaratively defined
- **Easier extensibility**: Adding new node types or lanes requires schema updates, not code changes

### Key Schema Definitions (accessLensTypes.js)

**LaneConfigSchema**: Defines which lanes appear for each focus node type
```javascript
LaneConfigSchema[NodeTypes.IDENTITY] = {
  lanes: [
    {
      laneType: LaneTypes.SYSTEMS,
      title: 'Systems',
      required: false,
      crossLaneFilters: { ... }
    },
    // ... more lanes
  ]
}
```

**CrossLaneFilterType**: Enum defining filter relationship types
- `FIELD_MATCH`: Direct field equality comparison
- `ARRAY_CONTAINS`: Check if value exists in array
- `MULTI_FIELD_MATCH`: Match any of multiple source fields to any of multiple target fields

**FocusNodeSchema**: Defines attributes and field mappings for each node type

### Service Layer

**crossLaneFilterService.js**: Provides schema-driven cross-lane filtering
- `applyCrossLaneFilters(lanes, focusNodeType, selections, additionalFilters)` - Main filtering function
- `filterVisibleLanes(lanes, focusNodeType, visibleLanes)` - Handles required lanes visibility
- `isLaneFiltered(laneType, focusNodeType, selections)` - Check if lane is being filtered
- `isLaneFilterSource(laneType, selections)` - Check if lane is the filter source

**laneBuilderService.js**: Provides generic lane building from assignments
- `buildLane(laneType, assignments, extractType, options)` - Generic lane builder
- `buildLanesForFocusNode(focusNodeType, assignments, options)` - Orchestrates lane building
- `extractUniqueItems(assignments, extractType, options)` - Generic item extraction with cross-reference tracking

**accessLensDataService.js**: Main data service with specialized lane builders
- `buildLanesFromAssignments(assignments, filters, options)` - Builds lanes from API data
- `buildLanesForEntitlement(assignments, filters, entitlementNode)` - Entitlement-centric lane building

### Feature Flags

Two feature flags control the transition to schema-driven architecture:

```javascript
// In AccessLens.jsx
const USE_SCHEMA_DRIVEN_FILTERING = true;  // Enabled for CASCADED_THROUGH policy filtering

// In accessLensDataService.js
const USE_SCHEMA_DRIVEN_LANE_BUILDING = false;  // Enable schema-driven lane building
```

Schema-driven filtering is now enabled (`true`) for cross-lane filtering, including CASCADED_THROUGH policy filtering. Schema-driven lane building remains disabled pending migration.

### Logical Applications Architecture

The Logical Applications lane provides a business-centric view of access by grouping entitlements by their parent system/application.

#### Data Flow

```
calculatedAssignments (from Identity API)
        ↓
    extractorRegistry['logicalApps']
        ↓
    buildLogicalApplicationsLane()
        ↓
    Logical Applications Lane Items
```

#### Building Logical Applications

The `buildLogicalApplicationsLane` function in `accessLensDataService.js`:

1. **Extracts system references** from each calculated assignment using ABORESSION or resource.systemRef
2. **Groups resources** by their parent system ID
3. **Creates logical application nodes** with metadata:
   ```javascript
   {
     node: {
       id: systemRef,
       type: 'System',
       displayName: systemDisplayName,
       metadata: {
         isLogical: true,
         resourceCount: count,
         accountCount: 0,  // Logical apps have no direct accounts
         underlyingSystems: [systemRef],
         resourceIds: [...] // For filtering entitlements
       }
     }
   }
   ```

#### Cross-Lane Filter Schema

Logical Applications cross-lane filtering is defined in `LaneConfigSchema`:

```javascript
// Logical Applications filtering other lanes
{
  laneType: LaneTypes.LOGICAL_APPLICATIONS,
  crossLaneFilters: {
    [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
      filterType: CrossLaneFilterType.ARRAY_CONTAINS,
      sourceField: 'node.metadata.resourceIds',
      targetField: 'node.id'
    },
    [LaneTypes.SYSTEMS]: {
      filterType: CrossLaneFilterType.MULTI_FIELD_MATCH,
      sourceFields: ['node.metadata.underlyingSystems', 'node.id'],
      targetFields: ['node.id', 'rawData.ABORESSION']
    },
    [LaneTypes.ACCOUNTS]: {
      filterType: CrossLaneFilterType.CASCADED_THROUGH,
      intermediateTarget: LaneTypes.SYSTEMS,
      intermediateExtractFields: ['node.metadata.underlyingSystems', 'node.id'],
      targetFields: ['rawData.systemRef', 'rawData.ABORESSION']
    }
  }
}

// Systems filtering Logical Applications
{
  laneType: LaneTypes.SYSTEMS,
  crossLaneFilters: {
    [LaneTypes.LOGICAL_APPLICATIONS]: {
      filterType: CrossLaneFilterType.MULTI_FIELD_MATCH,
      sourceFields: ['node.id', 'rawData.ABORESSION'],
      targetFields: ['node.metadata.underlyingSystems', 'node.id']
    }
  }
}
```

#### Cascaded Filtering

For filtering relationships that require an intermediate step (e.g., Account -> Logical Apps), the system uses `CASCADED_THROUGH`:

1. Extract values from source item using `intermediateExtractFields`
2. Use those values to match against `targetFields` on the target lane items
3. This allows Account -> System -> Logical App filtering without storing redundant data

### Toolbar Filter Cascading Architecture

When toolbar filters (Compliance, Reason Type, Entitlement Type) are applied, the system cascades these filters to all access cards, not just the Entitlements lane.

#### Data Flow

```
User selects "Not Approved" from Compliance dropdown
        ↓
Step 1: Filter Entitlements lane by complianceStatus
        ↓
Step 2: Extract related IDs from filtered entitlements:
        - relatedEntitlementIds (resource IDs)
        - relatedAccountIds (from metadata.accountIds)
        - relatedIdentityIds (from metadata.identityIds)
        - relatedSystemIds (from account/resource systems)
        ↓
Step 3: Cascade filter to other lanes:
        - Identities: filter by relatedIdentityIds
        - Accounts: filter by relatedAccountIds
        - Systems: filter by relatedSystemIds
        - Assignment Policies: filter by resourceIds intersection
        - Logical Apps: filter by system ID matching
        - Violations: filter by violation IDs from filtered entitlements
```

#### Implementation Details

The cascaded filtering is implemented in `AccessLens.jsx` within the `visibleLanes` useMemo:

```javascript
// Step 2b: Cascade compliance/toolbar filters to all other lanes
const hasToolbarFilters = filters.complianceStatuses?.length > 0 ||
                          filters.reasonTypes?.length > 0 ||
                          (filters.entitlementType && filters.entitlementType !== 'all');

if (hasToolbarFilters) {
  const filteredEntitlementsLane = filteredLanes.find(
    l => l.laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS
  );

  if (filteredEntitlementsLane?.items?.length > 0) {
    // Extract IDs from filtered entitlements
    const relatedEntitlementIds = new Set();
    const relatedAccountIds = new Set();
    // ... more ID sets

    filteredEntitlementsLane.items.forEach(item => {
      // Extract entitlement ID for policy filtering
      relatedEntitlementIds.add(String(item.node?.id));

      // Extract account IDs (including aggregated array)
      const accountIds = item.node?.metadata?.accountIds || [];
      accountIds.forEach(id => relatedAccountIds.add(String(id)));
      // ... more extraction
    });

    // Apply cascaded filters to each lane type
    filteredLanes = filteredLanes.map(lane => {
      switch (lane.laneType) {
        case LaneTypes.ASSIGNMENT_POLICIES:
          // Filter by resourceIds intersection
          filteredItems = filteredItems.filter(item => {
            const policyResourceIds = item.node?.metadata?.resourceIds || [];
            return policyResourceIds.some(rid =>
              relatedEntitlementIds.has(String(rid))
            );
          });
          break;
        // ... other lane types
      }
    });
  }
}
```

#### Key Design Decisions

**1. Policy Filtering via resourceIds Intersection**

Assignment Policies cannot be reliably filtered by extracting policy IDs from entitlement reasons because:
- Entitlements are deduplicated by resource ID, keeping only the first assignment's reason
- If an entitlement has multiple assignments (some from policies, some direct), only one reason is preserved

Instead, policies are filtered by checking if their `metadata.resourceIds` array contains any of the filtered entitlement IDs. This works because policies store the complete list of entitlement IDs they granted.

**2. Aggregated ID Arrays**

Entitlement items store aggregated arrays of related IDs to support proper cascading:
- `metadata.accountIds`: All account IDs associated with this entitlement
- `metadata.identityIds`: All identity IDs associated with this entitlement

This is necessary because entitlement deduplication aggregates multiple assignments into one item.

**3. Empty Results Handling**

When toolbar filters result in zero matching entitlements, all related lanes are cleared:
```javascript
if ([LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS, LaneTypes.SYSTEMS,
     LaneTypes.ASSIGNMENT_POLICIES, LaneTypes.LOGICAL_APPLICATIONS,
     LaneTypes.VIOLATIONS].includes(lane.laneType)) {
  return { ...lane, items: [], totalCount: 0, isFiltered: true };
}
```

**4. Entitlement-Centric View Special Case**

In entitlement-centric view (where the central node IS an entitlement and there's no Entitlements lane), compliance filtering works differently:
- Identities and Accounts lanes have `complianceStatus` in their metadata
- These represent the compliance relationship between that identity/account and the central entitlement
- Filter directly by `item.node?.metadata?.complianceStatus`

---

## Data Loading Architecture

### API Layer

Access Lens fetches data from Omada Identity Cloud using two API types:

**GraphQL API (Primary)**
- Used for fetching calculated assignments, identities having resources
- Endpoint: `/api/graphql/v3.2`
- Supports filtering, sorting, and pagination

**OData API (Enrichment)**
- Used for fetching detailed entity attributes (Identity, System, Resource details)
- Endpoint: `/OData/DataObjects/{EntityType}`
- Used to enrich nodes with additional metadata not available in GraphQL

### Pagination Configuration

All GraphQL calls use configurable pagination defined in `queryBuilder.js`:

```javascript
export const GRAPHQL_PAGINATION = {
  DEFAULT_ROWS: 10,        // Default page size
  MAX_ROWS: 5000,          // Maximum rows per request
  DEFAULT_PAGE: 1,         // Starting page

  // Query-specific defaults
  CALCULATED_ASSIGNMENTS: { DEFAULT_ROWS: 10, MAX_ROWS: 5000 },
  IDENTITIES_HAVING_RESOURCE: { DEFAULT_ROWS: 10, MAX_ROWS: 2000 },
  CONTEXTS: { DEFAULT_ROWS: 10, MAX_ROWS: 500 }
};
```

### Data Flow by Focus Node Type

**Identity-Centric View (Default)**
```
1. User selects Identity
   ↓
2. API: getCalculatedAssignmentsDetailed(identityId)
   → Returns all assignments for this identity
   ↓
3. API: getIdentityContexts(identityId)
   → Returns organizational contexts
   ↓
4. Parallel OData enrichment:
   - fetchAllSystemDetails() → System metadata
   - fetchAllIdentityDetails() → Identity metadata
   ↓
5. buildLanesFromAssignments()
   → Builds: Systems, Accounts, Entitlements, Logical Apps lanes
   ↓
6. Render lanes around central Identity node
```

**System-Centric View**
```
1. User pivots to System
   ↓
2. API: odata.query('System', filter: UId eq systemId)
   → Fetches system details for focus node
   ↓
3. API: getCalculatedAssignmentsDetailed(null, {systemId})
   → Returns all assignments where resource is on this system
   ↓
4. buildLanesFromAssignments({includeIdentities: true, focusSystemId})
   → Builds: Identities, Accounts, Entitlements, Logical Apps lanes
   ↓
5. Render lanes around central System node
```

**Entitlement-Centric View**
```
1. User pivots to Entitlement
   ↓
2. API: odata.query('Resource', filter: UId eq resourceId)
   → Fetches resource details including OWNERREF
   ↓
3. API: getIdentitiesHavingResource(resourceId)
   → Returns all identities assigned this resource
   ↓
4. buildSystemLanesForEntitlement()
   → Determines if resource is on Logical App or Physical System
   ↓
5. buildLanesForEntitlement()
   → Builds: Identities, Accounts, Systems/Logical Apps lanes
   ↓
6. Render lanes around central Entitlement node
```

### Lane Building Process

The lane building process follows these steps:

1. **Extract unique items** from assignments based on lane type
2. **Enrich with OData** metadata when available
3. **Build node objects** with standardized structure
4. **Apply exclusion rules** (e.g., filter out "personal account" resources)
5. **Sort items** according to schema configuration
6. **Return lane object** with items, counts, and metadata

**Lane Object Structure:**
```javascript
{
  laneType: 'Accounts',           // Lane type identifier
  totalCount: 25,                 // Total items before filtering
  items: [...],                   // Array of lane items
  allItemsData: [...],            // Full data for filtering
  canLoadMore: false              // Pagination indicator
}
```

**Lane Item Structure:**
```javascript
{
  node: {
    id: 'uuid',                   // Unique identifier
    type: 'Account',              // Node type
    displayName: 'jsmith',        // Display name
    status: 'active',             // Status indicator
    badges: ['AD', 'Service'],    // Visual badges
    metadata: { ... },            // Additional attributes
    rawData: { ... }              // Original API response
  },
  reasons: [...],                 // Assignment reasons
  groupKey: 'system-id',          // For grouping
  groupLabel: 'Active Directory'  // Group display name
}
```

### Schema-Driven Lane Configuration

Lanes are configured via `LaneSchema` in `accessLensTypes.js`:

```javascript
export const LaneSchema = {
  [LaneTypes.ACCOUNTS]: {
    extractType: 'accounts',           // Extractor function key
    nodeType: NodeTypes.ACCOUNT,       // Node type for items
    title: 'Accounts',
    icon: '👤',
    color: '#a3be8c',
    defaultPosition: {
      compass: CompassOrientation.NE
    },
    defaultSort: {
      field: 'displayName',
      order: 'asc'
    },
    displayRules: {
      showBadges: true,
      maxBadges: 2,
      showReasons: false
    }
  }
  // ... more lane definitions
};
```

### Focus Node Schema

Each focus node type has a schema defining its display attributes:

```javascript
export const FocusNodeSchema = {
  [NodeTypes.IDENTITY]: {
    icon: '👤',
    color: '#88c0d0',
    attributes: [
      { field: 'EMAIL', label: 'Email', type: 'email' },
      { field: 'OUREF.DisplayName|OUREF', label: 'Department', type: 'text' },
      { field: 'JOBTITLE', label: 'Job Title', type: 'text' },
      { field: 'EMPLOYEEID', label: 'Employee ID', type: 'text' }
    ],
    inspectorConfig: {
      hideAttributes: ['UId', 'Id', 'CreatedDate']
    }
  }
  // ... more node type definitions
};
```

### Cross-Lane Filter Configuration

Cross-lane filtering relationships are defined in `LaneConfigSchema`:

```javascript
LaneConfigSchema[NodeTypes.IDENTITY] = {
  lanes: [
    {
      laneType: LaneTypes.ACCOUNTS,
      crossLaneFilters: {
        [LaneTypes.EFFECTIVE_ENTITLEMENTS]: {
          filterType: CrossLaneFilterType.FIELD_MATCH,
          sourceField: 'node.id',
          targetField: 'node.metadata.accountId'
        },
        [LaneTypes.SYSTEMS]: {
          filterType: CrossLaneFilterType.FIELD_MATCH,
          sourceField: 'node.metadata.systemId',
          targetField: 'node.id'
        }
      }
    }
    // ... more lane configurations
  ]
};
```

### Extractor Registry

The extractor registry maps lane types to data extraction functions:

```javascript
const extractorRegistry = {
  'accounts': (sourceData, focusNode, filters, context) => {
    const lane = buildAccountsLane(sourceData, filters);
    return lane.items || [];
  },
  'systems': (sourceData, focusNode, filters, context) => {
    const lane = buildSystemsLane(sourceData, filters, context?.systemDetailsMap);
    return lane.items || [];
  },
  'logicalApps': (sourceData, focusNode, filters, context) => {
    const lane = buildLogicalApplicationsLane(sourceData, filters, context?.systemDetailsMap);
    return lane.items || [];
  }
  // ... more extractors
};
```

### API Logging

All API calls are logged via `apiLogger.js` for debugging:

```javascript
// Enable/disable console logging
const DEBUG_CONSOLE_LOGGING = true;

// Functions excluded from console logging
const EXCLUDE_FROM_CONSOLE = ['getIdentityContexts'];
```

API logs show:
- Request: Blue badge `[API GraphQL REQUEST]`
- Success: Green badge `[API GraphQL RESPONSE]`
- Error: Red badge `[API GraphQL ERROR]`

---

## Glossary

| Term | Definition |
|------|------------|
| Access Lens | The visualization component showing identity access relationships |
| Central Node / Fulcrum | The main focus point displaying the currently selected identity or object |
| Lane | A card displaying a category of related access data (Accounts, Systems, etc.) |
| Cross-Lane Filtering | Filtering multiple lanes based on selection in one lane |
| Pivot | Changing the central node to a different object type |
| Logical Application | A business-centric grouping of resources derived from a parent system, representing application-level access without direct accounts |
| Physical System | A system that has direct account associations; represents concrete infrastructure access |
| Cascaded Filter | A cross-lane filter that requires an intermediate step to resolve (e.g., Account -> System -> Logical App) |
| ABORESSION | The OData field containing the system/application reference for a resource or account |
| Effective Entitlements | All resources/permissions assigned to an identity through any means |
| Object Inspector | The detail panel showing properties of the selected item |
| Reason Type | The source/method by which an entitlement was assigned (Direct, Policy, Inherited, etc.) |
| ActualDirect | API reasonType indicating the assignment physically exists in the target system |
| UnconfirmedActual | API reasonType indicating a provisioning operation is queued or in progress |
| ChildResource | API reasonType indicating access is inherited from a parent resource |
| Multi-Path Assignment | An entitlement that is granted through multiple overlapping sources (e.g., both Direct assignment AND Policy), indicated by a `reason` array with more than one entry |
| Over-Provisioning | When an identity has access through redundant paths; multi-path assignments may indicate potential over-provisioning that should be reviewed |
| validFrom | API field indicating when an assignment becomes effective. Year 1999 indicates "no start date" (Omada default) |
| validTo | API field indicating when an assignment expires. Year 9999 indicates "never expires" (Omada default) |
| Parent Resource | The parent resource from which an entitlement is inherited (ChildResource reasonType). Available in API response as `parentResource` block |
| Assignment Validity Period | The time window during which an entitlement assignment is active, defined by validFrom and validTo dates |
| AP_CONTEXTS | OData field on Assignment Policy containing an array of organizational contexts that trigger the policy. Each entry has Id, UId, and DisplayName. |
| causeObjectKey | Field in the reason object containing the policy ID when reasonType is "Policy". Used to fetch full policy details from OData. |
| Policy Enrichment | The async process of fetching Assignment Policy details from OData to get AP_CONTEXTS for cross-lane filtering with Contexts. |
| Context UId | The unique identifier (UUID) of an organizational context, used for matching between AP_CONTEXTS and Context lane items. |
| CANVAS_CENTER_Y | JavaScript constant ('40%') used as the vertical anchor point for the focus node and all lane positions, ensuring consistent vertical alignment across components. |
| Unified Toolbar | The consolidated FilterBar component combining layout actions, lane toggles, filters, search, and breadcrumbs into a single toolbar row (introduced v1.18). |
| lanesLoading | React state controlling lane loading animation. Must be cleared in both success and error paths to prevent permanent loading spinners. |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01 | Initial Access Lens implementation |
| 1.1 | 2024-01 | Added cross-lane filtering for Systems, Accounts, Logical Applications |
| 1.2 | 2024-01 | Added search and resource type filters to Entitlements lane |
| 1.3 | 2024-01 | Added Expand All button, loading placeholders, filter source glow |
| 1.4 | 2024-01 | Added Omada Navbar, dynamic resource type chips, IDENTITYID display |
| 1.5 | 2025-01 | Added System-centric view with cross-lane filtering (Identity<->Account<->Entitlement), pivot loading overlay, required lanes per focus node type, resource owner display for Entitlement-centric view |
| 1.6 | 2025-01 | Added schema-driven architecture: crossLaneFilterService.js for generic filtering, laneBuilderService.js for generic lane building, LaneConfigSchema with crossLaneFilters configuration, feature flags for gradual migration |
| 1.7 | 2025-01 | Enhanced Logical Applications documentation: added user stories (US-080L through US-084L), business rules (BR-004a through BR-018), technical architecture for derivation, data flow, and cascaded filtering |
| 1.8 | 2025-01 | Added comprehensive Data Loading Architecture documentation: API layer details, pagination configuration, data flow diagrams by focus node type, lane building process, schema configurations, extractor registry, and API logging |
| 1.9 | 2025-01 | Added Toolbar Filter Cascading: compliance/reason/entitlement type filters now cascade to ALL access cards (US-100 through US-103, BR-019 through BR-025). Assignment Policies filtering uses resourceIds intersection instead of reason extraction due to entitlement deduplication. Added aggregated ID arrays (accountIds, identityIds) to entitlement metadata for proper cascading. |
| 1.10 | 2025-01 | Added Reason Type Badge Display: entitlement lane items now show color-coded badges indicating assignment source (US-110 through US-112, BR-026 through BR-031). Supports API reasonTypes: ActualDirect, Direct, Policy, UnconfirmedActual, ChildResource, AutoAccount, RoleMembership, Birthright, AccountLink, SoDException. API returns `reason` as an array; all unique reason types are displayed as separate pills with white text. |
| 1.11 | 2025-01 | Added Multi-Path Assignment Visualization (US-120 through US-123, BR-032 through BR-036): Entitlements with multiple overlapping assignment paths (e.g., granted by both Direct and Policy) now show ⚡ badge with path count and orange left border. Added "Multi-Path" filter toggle in toolbar that cascades to all lanes. Integrated multi-path tracking into Compliance Heatmap with per-system counts, header totals, and filter toggle. |
| 1.12 | 2025-01 | Enhanced GraphQL queries: Added parentResource block, resource.childResourceIds, resource.riskLevel, resource.accountTypes to both getCalculatedAssignmentsDetailed and getIdentitiesHavingResource queries. Added identity.accounts and identity.contexts to getIdentitiesHavingResource. |
| 1.13 | 2025-01 | Added Assignment Validity Period Display (US-125 through US-127, BR-037 through BR-041): Entitlements now show validity period pills with smart date formatting (MM/YY). Handles Omada default dates (1999 = no start, 9999 = never expires). Shows "Never expires" (green), "Until MM/YY" (blue), "From MM/YY" (green), or "MM/YY → MM/YY" (blue). Assignments expiring within 90 days show amber pill with pulse animation. |
| 1.14 | 2025-01 | Enhanced Inherited Reason Display (US-124, BR-031b): "Inherited" reason pills now show parent resource name in tooltip (e.g., "Inherited from: AD Security Group"). Multiple reason type pills now display for each unique reasonType in the API response (BR-031a) - e.g., an entitlement with both Direct and Policy reasons shows both pills. |
| 1.15 | 2025-01 | Added Assignment Policy to Context Cross-Lane Filtering (US-128 through US-130, BR-042 through BR-046): Selecting an Assignment Policy now filters the Contexts lane to show only contexts that trigger that policy. Policy data is enriched via OData API call to `/OData/DataObjects/Assignmentpolicy/{policyId}` which returns `AP_CONTEXTS` array. Context UIds are stored in `metadata.contextUIds` for ARRAY_CONTAINS filtering against context `metadata.uId`. |
| 1.16 | 2025-01 | Fixed violation count mismatch: `extractViolationCount` now deduplicates violations by description (matching `buildViolationsLane` logic) to prevent duplicate counting when same violation appears on multiple assignments. Added default ascending sort by resource name to Effective Entitlements lane in both `accessLensDataService.js` and `laneBuilderService.js`. |
| 1.17 | 2025-01 | UI cleanup: Removed exit button and view mode buttons from Access Lens. Replaced identity inspector panel with direct Access Lens navigation on identity table click. |
| 1.18 | 2025-01 | **Toolbar consolidation & UI improvements** (US-131 through US-137, BR-047 through BR-054): Merged two-row header (topbar + filter bar) into single unified toolbar (FilterBar). Removed "All Entitlements" dropdown filter (BR-048). Removed multi-path capability from ComplianceHeatmap (BR-036 deprecated). Repositioned canvas from `top: 50%` to `top: 40%` with `CANVAS_CENTER_Y` constant and reduced canvas height from 1800px to 1600px (BR-051, BR-052). Single-column lane cards now show 4 visible items with vertical scroll, hiding "Show all" button (BR-049, BR-050). Tightened toolbar spacing: layout actions at 0.75rem gap, filter buttons at 2px gap. Focus node z-index drops from 10 to 1 during lane drag so dragged cards render above it (BR-053). Fixed entitlement focus node infinite loading spinner by clearing `lanesLoading` in `finally` block (BR-054). |
| 1.19 | 2025-01 | **Schema audit & cleanup**: Added `LaneGridConstraints` to `schemas/index.js` re-exports. Updated `getLanesForNodeType` fallback switch-case to match `LaneConfigSchema` definitions (added missing Violations, Assignment Policies, Logical Applications for Identity/System/Account views). Removed `.env.production` and `.env.development` from git tracking (contained Azure AD credentials); added `.gitignore` entries and `.env.*.template` files with placeholder values; purged sensitive files from entire git history. |
| 1.20 | 2026-02 | **Entitlement Focus Node Enhancements** (US-140 through US-145, BR-055 through BR-062): Added Resource Folder and Child Resources (CHILDROLES) lanes when Entitlement is focus node. Resource Folder lane shows folder with Approval badge from OData enrichment. Child Resources lane uses EFFECTIVE_ENTITLEMENTS type to display child entitlements. Fixed infinite loop in enrichment useEffects by adding refs (`policiesEnrichedRef`, `foldersEnrichedRef`) to track enrichment status per focus node. Added `RESOURCE_FOLDERS` to default `visibleLanes` filter. Added useEffect to clear Object Inspector state (`selectedItem`, `explanation`, `selectedReasonId`) when `focusNode.type` changes to prevent stale data display during pivot. Fixed "Never expires" pill: now displays when `validTo` is null/undefined OR year 9999. Shows "From MM/YY · Never expires" when there's a start date but no end date. Moved enrichment debug logs behind `shouldLog('POLICIES')` flag. |
| 1.21 | 2026-02 | **Child Resource Enrichment** (US-146, BR-058a, BR-058b): Fixed regression where child resources in the Child Resources lane only showed the resource name. Added OData enrichment for CHILDROLES: each child resource is now queried via `/OData/DataObjects/Resource` to fetch full details including RESOURCETYPE, SYSTEMNAME, and DESCRIPTION. Child resource lane items now display three badges: "CHILD" (always), system name (if available), and resource type (if available). Updated `buildChildResourcesLaneForEntitlement()` and `childResources` extractor in `accessLensDataService.js` to populate badges and metadata from enriched data. Added enrichment limit of 50 child resources to prevent excessive API calls. |
| 1.22 | 2026-02 | **3-Level Cascade Filtering for Contexts** (US-150 through US-153, BR-063 through BR-068): Added 3-level cascaded filtering so selecting a Context in the Contexts lane now filters Accounts, Systems, and Logical Applications lanes. Filter path: Context → Assignment Policies (by contextIds/contextNames) → Effective Entitlements (by resourceIds) → Target lanes (by accountIds/systemId). Added `TRIPLE_CASCADED_WITH_NAME_FALLBACK` filter type to `CrossLaneFilterType` enum. Implemented `applyTripleCascadedWithNameFallback()` in `crossLaneFilterService.js`. Added `LaneTypes.CONTEXTS` to `filteredByLanes` arrays for Systems, Accounts, and Logical Applications. Filtered lanes auto-expand when cross-lane filter is applied. |
| 1.23 | 2026-02 | **CSV Export & UI Enhancements** (US-154 through US-158, BR-069 through BR-074): Added "Export CSV" button to toolbar that exports all visible lane data including focus node info, lane names, item details, compliance status, reason types, validity dates, and metadata. Updated focus card color from #2563EB to Omada Primary Blue #005EB8 for professional appearance. Fixed Violations lane items to match standard styling (white background, blue border) while keeping red border on card header. Added subtle concentric rings to light theme canvas background. "Never expires" validity pill now shows in orange (#D97706) for DIRECT-only entitlements to flag permanent direct access; inherited and policy-assigned entitlements retain default styling. |
