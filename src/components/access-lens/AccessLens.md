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

### Layout Rules

**BR-026: Lane Spacing**
Lane cards shall be positioned with sufficient spacing to prevent overlap. Minimum vertical gap between adjacent lanes: 400 pixels.

**BR-027: Collision Detection**
The lane positioning algorithm shall detect and prevent overlaps between lane cards and between lane cards and the central node.

**BR-028: Drag Constraints**
Dragged lane cards shall remain within the visible canvas area.

**BR-029: Z-Index Management**
- Central node (fulcrum): z-index 10
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
const USE_SCHEMA_DRIVEN_FILTERING = false;  // Enable schema-driven cross-lane filtering

// In accessLensDataService.js
const USE_SCHEMA_DRIVEN_LANE_BUILDING = false;  // Enable schema-driven lane building
```

When disabled (default), the legacy hardcoded logic is used. When enabled, the schema-driven services handle filtering and lane building.

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
