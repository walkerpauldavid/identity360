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

---

## Business Rules

### Data Display Rules

**BR-001: Lane Visibility**
Lanes shall only be displayed if they contain at least one item. Empty lanes shall be hidden.

**BR-002: Item Counts**
Each lane header shall display the total count of items. When filtered, the count shall show "filtered/total" format (e.g., "5/25").

**BR-003: Entitlement Exclusion**
Account-type resources shall be excluded from the Effective Entitlements lane. Only non-account resources (Roles, Permissions, Groups, etc.) shall be displayed.

**BR-004: System Classification**
Systems shall be classified as either Physical Systems or Logical Applications based on whether they have direct accounts. Logical Applications have resources but no direct account associations.

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

### Layout Rules

**BR-020: Lane Spacing**
Lane cards shall be positioned with sufficient spacing to prevent overlap. Minimum vertical gap between adjacent lanes: 400 pixels.

**BR-021: Collision Detection**
The lane positioning algorithm shall detect and prevent overlaps between lane cards and between lane cards and the central node.

**BR-022: Drag Constraints**
Dragged lane cards shall remain within the visible canvas area.

**BR-023: Z-Index Management**
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

## Glossary

| Term | Definition |
|------|------------|
| Access Lens | The visualization component showing identity access relationships |
| Central Node / Fulcrum | The main focus point displaying the currently selected identity or object |
| Lane | A card displaying a category of related access data (Accounts, Systems, etc.) |
| Cross-Lane Filtering | Filtering multiple lanes based on selection in one lane |
| Pivot | Changing the central node to a different object type |
| Logical Application | A system that has resources/entitlements but no direct accounts |
| Physical System | A system that has direct account associations |
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
