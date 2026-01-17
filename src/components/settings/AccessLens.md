# Access Lens - Requirements & Implementation Guide

## Build Target

Implement an Access Lens React UI widget for exploring an IGA access graph. The widget pivots around a selected node (Identity, Role, Entitlement, Policy, Account, System, Context) and shows relationships in typed lanes with progressive disclosure, plus a Reasons-aware explanation panel for entitlements effective on an Identity.

**Tech stack:** React (modern React with hooks), @dnd-kit for drag-and-drop, CSS modules

---

## Key Omada Requirement: "Reasons"

When an entitlement is effective on an Identity, Omada provides one or more Reasons (calculated). The UI must:

- Display Reasons wherever an entitlement is shown as effective for an Identity (directly in the lane item row, and in the explanation panel)
- Support multiple Reasons per entitlement (render as chips/tags with a "+N more" overflow)
- Allow drilling into a Reason to see its type, summary, and evidence path (trace)
- Allow filtering entitlements by Reason type (optional but preferred)

---

## User Stories

### Identity Explorer Stories

| ID | As a... | I want to... | So that... | Status |
|----|---------|--------------|------------|--------|
| US-001 | Security Analyst | view all access for a selected identity in one place | I can quickly assess their access footprint | Implemented |
| US-002 | Security Analyst | see which roles an identity has been assigned | I understand how they got their access | Implemented |
| US-003 | Security Analyst | see which accounts an identity owns across systems | I can identify orphaned or risky accounts | Implemented |
| US-004 | Security Analyst | see all effective entitlements for an identity | I can review what they can actually do | Implemented |
| US-005 | Security Analyst | understand WHY an identity has a specific entitlement | I can determine if access is appropriate | Implemented |
| US-006 | Security Analyst | filter entitlements by the reason they were granted | I can focus on specific access paths | Implemented |
| US-007 | Security Analyst | see identity contexts (org units, locations, etc.) | I understand the identity's organizational position | Implemented |

### Navigation Stories

| ID | As a... | I want to... | So that... | Status |
|----|---------|--------------|------------|--------|
| US-010 | User | pivot from any node to explore its relationships | I can follow access paths through the graph | Implemented |
| US-011 | User | see a breadcrumb trail of my navigation | I can understand where I am and go back | Implemented |
| US-012 | User | click a breadcrumb to return to a previous view | I can quickly navigate my exploration history | Implemented |
| US-013 | User | drag lanes to reposition them on the canvas | I can arrange the view to my preference | Implemented |
| US-014 | User | collapse/expand lanes to manage screen space | I can focus on relevant information | Implemented |

### Filtering & Search Stories

| ID | As a... | I want to... | So that... | Status |
|----|---------|--------------|------------|--------|
| US-020 | User | toggle which lane types are visible | I can focus on specific relationship types | Implemented |
| US-021 | User | filter entitlements by reason type | I can analyze specific access grant methods | Implemented |
| US-022 | User | filter to show only high-risk items | I can prioritize security review | Implemented |
| US-023 | User | click an account to filter entitlements by that account | I can see what access comes from specific accounts | Implemented |
| US-024 | User | click a system to filter entitlements by that system | I can see what access exists on specific systems | Implemented |
| US-025 | User | search for an identity when opening Access Lens | I can quickly find who I want to review | Implemented |

### Explanation Panel Stories

| ID | As a... | I want to... | So that... | Status |
|----|---------|--------------|------------|--------|
| US-030 | Security Analyst | select an entitlement and see detailed explanation | I understand how access was granted | Implemented |
| US-031 | Security Analyst | see all reasons why an entitlement is effective | I can identify all access paths | Implemented |
| US-032 | Security Analyst | drill into a specific reason to see its evidence path | I can trace the exact grant chain | Implemented |
| US-033 | Security Analyst | switch between multiple reasons without losing context | I can compare different access paths | Implemented |

### Role Explorer Stories

| ID | As a... | I want to... | So that... | Status |
|----|---------|--------------|------------|--------|
| US-040 | Role Manager | pivot to a role and see its member identities | I can review who has the role | Implemented |
| US-041 | Role Manager | see which entitlements a role provides | I understand the role's access grants | Implemented |
| US-042 | Role Manager | see policies affecting a role | I understand governance constraints | Implemented |

### Entitlement Explorer Stories

| ID | As a... | I want to... | So that... | Status |
|----|---------|--------------|------------|--------|
| US-050 | Application Owner | pivot to an entitlement and see who has it | I can review access to my application | Implemented |
| US-051 | Application Owner | see which roles grant an entitlement | I understand how access is distributed | Implemented |
| US-052 | Application Owner | see which system provides an entitlement | I understand the technical context | Implemented |

### System Explorer Stories

| ID | As a... | I want to... | So that... | Status |
|----|---------|--------------|------------|--------|
| US-060 | System Owner | pivot to a system and see all accounts | I can review accounts on my system | Implemented |
| US-061 | System Owner | see entitlements available on a system | I understand access capabilities | Implemented |
| US-062 | System Owner | see which identities access a system | I know who uses my system | Implemented |

### Mode Stories

| ID | As a... | I want to... | So that... | Status |
|----|---------|--------------|------------|--------|
| US-070 | User | switch to Explore mode for general navigation | I can freely browse the access graph | Implemented |
| US-071 | Security Analyst | switch to Risk mode to highlight risky items | I can focus on security concerns | Implemented |
| US-072 | Certifier | switch to Review mode to see certification actions | I can perform access reviews | Implemented |

### Standalone Access Stories

| ID | As a... | I want to... | So that... | Status |
|----|---------|--------------|------------|--------|
| US-080 | User | open Access Lens from the toolbar menu | I can explore access without being on a specific page | Implemented |
| US-081 | User | search and select an identity in a dialog | I can choose who to explore | Implemented |
| US-082 | User | see the selected identity's name in the header | I know whose access I'm viewing | Implemented |
| US-083 | User | change the selected identity without leaving | I can compare different identities | Implemented |

---

## Conceptual Model

### Node Types

- Identity
- Role
- Entitlement
- Policy
- Account
- System
- Context (NEW: for identity organizational contexts)

### Relationship Lanes (examples)

**For Identity focus:**
- Roles
- Accounts
- Effective Entitlements (key lane)
- Policies Affecting Access
- Systems Accessed
- Contexts (organizational contexts)

**For Role focus:**
- Member Identities
- Included Entitlements
- Policies Affecting Role

**For Entitlement focus:**
- Identities with it
- Roles granting it
- Policies constraining it
- Systems providing it

**For System focus:**
- Accounts on system
- Entitlements on system
- Identities accessing system

---

## Data Contracts (must implement)

### Nodes

```typescript
type NodeType = "Identity" | "Role" | "Entitlement" | "Policy" | "Account" | "System" | "Context";

type Node = {
  id: string;
  type: NodeType;
  displayName: string;
  status?: "active" | "disabled" | "stale" | "pending";
  riskScore?: number; // 0-100
  badges?: string[];
  metadata?: Record<string, string | number | boolean>;
};
```

### Edges

```typescript
type EdgeType =
  | "assigned_direct"
  | "inherited"
  | "policy_driven"
  | "linked_account"
  | "member_of"
  | "provides"
  | "governs";

type Edge = {
  id: string;
  fromId: string;
  toId: string;
  type: EdgeType;
  effectiveFrom?: string; // ISO date
  effectiveTo?: string;   // ISO date
  flags?: {
    highRisk?: boolean;
    sodViolation?: boolean;
    exception?: boolean;
  };
};
```

### Reasons (Omada-specific)

Reasons are attached to Identity -> Effective Entitlement relationships.

```typescript
type ReasonType =
  | "DirectAssignment"
  | "RoleMembership"
  | "PolicyRule"
  | "AccountLink"
  | "Birthright"
  | "SoDException"
  | "Other";

type Reason = {
  id: string;
  type: ReasonType;
  title: string;          // short chip label, e.g. "Finance Role"
  description?: string;   // human readable
  confidence?: "high" | "medium" | "low";
  evidencePath?: {
    nodes: Node[];  // ordered path
    edges: Edge[];  // aligned with nodes transitions
  };
  facts?: Array<{ label: string; value: string }>;
};
```

### Lane contract

```typescript
type LaneType =
  | "Roles"
  | "Accounts"
  | "EffectiveEntitlements"
  | "DirectEntitlements"
  | "Policies"
  | "Systems"
  | "Identities"
  | "Contexts";  // NEW: For identity contexts

type LaneItem = {
  node: Node;
  edge?: Edge; // relationship from focus -> node
  reasons?: Reason[]; // Only for Identity focus + EffectiveEntitlements lane
  groupKey?: string;   // e.g. systemId
  groupLabel?: string; // e.g. "SAP ERP"
  groupCount?: number; // e.g. 43
};

type Lane = {
  laneType: LaneType;
  totalCount: number;
  items: LaneItem[];
  canLoadMore: boolean;
  isFiltered?: boolean; // Indicates if cross-lane filter is active
};
```

### Focus query contract

Implement a function (mocked or API-backed) that returns:

```typescript
type FocusResponse = {
  focusNode: Node;
  lanes: Lane[];
};
```

### Explanation contract

When user selects a lane item (especially an effective entitlement), show an explanation panel:

```typescript
type ExplanationResponse = {
  title: string; // e.g. "Why does Jane Doe have FB_ApproveInvoices?"
  summaryText?: string;

  // Main trace of how it became effective (may be derived from selected Reason):
  path?: { nodes: Node[]; edges: Edge[] };

  // Reasons are mandatory for Identity->EffectiveEntitlement selections:
  reasons?: Reason[];

  facts?: Array<{ label: string; value: string }>;
  riskNotes?: string[];
};

// Implementation stub
fetchExplanation(
  focusIdOrNode: string | Node,
  selectedItemIdOrNode: string | Node,
  selectedReasonId?: string
): Promise<ExplanationResponse>
```

---

## UI Requirements

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Top Bar: Title | Mode Switch | Filters | Search | Breadcrumbs   │
├───────────────────────────────────────────┬─────────────────────┤
│                                           │                     │
│    [Lane]          [Lane]                 │   Explanation       │
│                                           │   Panel             │
│           ╭──────────────╮                │                     │
│    [Lane] │  Focus Card  │ [Lane]         │   "Why do I have    │
│           │   (Center)   │                │    this access?"    │
│           ╰──────────────╯                │                     │
│                                           │   - Reasons         │
│    [Lane]          [Lane]                 │   - Evidence Path   │
│                                           │   - Facts           │
│         (Curved connector lines)          │                     │
└───────────────────────────────────────────┴─────────────────────┘
```

### Focus Card (Center)

Show:
- Icon by type
- displayName + type badge
- riskScore pill (if present)
- A few metadata rows (optional)

### Lanes (Progressive Disclosure)

- Each lane is a card with header: label + (count)
- Default render max 5 items per lane
- "+N more" expands (or loads next page)
- Expanding one lane must not explode the canvas (no auto-expanding others)
- Lanes are draggable to reposition
- Lanes can be collapsed to just header

### Lane Items

- Render node icon, displayName, small badges
- For EffectiveEntitlements lane under Identity:
  - Show Reason chips inline
  - Up to 2 visible chips + "+N more"
  - Clicking a chip opens a Reason detail popover (or selects that reason in right panel)

### Breadcrumbs (Mandatory)

- Track pivot history: A -> B -> C
- Clicking breadcrumb pivots back

### Explanation Panel Behavior (Reasons-aware)

When selecting an entitlement in Identity -> EffectiveEntitlements:

1. Show entitlement name + identity context in title
2. Show Reasons list (chips or accordion), ordered by priority:
   - DirectAssignment first (if present)
   - RoleMembership second
   - Then others
3. Selecting a Reason displays:
   - reason.description
   - evidencePath visualization (mini path list)
   - facts (label/value)
4. If multiple Reasons exist, allow switching between them without losing selection

### Filters (Top Bar)

Must include:
- **Dimension toggles:** Roles, Accounts, EffectiveEntitlements, Policies, Systems, Contexts
- **Effective entitlement filters:**
  - Direct vs Inherited vs Both
  - Reason type filter (multi-select) - required given Reasons
- **Risk filter:** All vs High-only (using flags/riskScore)

Filters update lanes but must not break breadcrumbs.

### Modes

Implement mode state:
- **Explore** (default) - full navigation
- **Risk** - highlights risk flags and riskScore
- **Review** - adds inline actions (stubbed): Certify / Revoke (no backend needed, just UI hooks)

---

## Implemented Features

### 1. Draggable Lanes

- Lanes can be repositioned by dragging using @dnd-kit library
- Default positions arranged around center to avoid overlap
- Positions persist during session
- Drag handle is the entire lane card (except toggle button)

**Default Lane Positions:**
```javascript
const DEFAULT_LANE_POSITIONS = {
  Roles: { x: -380, y: -220 },
  Accounts: { x: 380, y: -220 },
  EffectiveEntitlements: { x: -380, y: 80 },
  Policies: { x: 380, y: 80 },
  Systems: { x: -200, y: 300 },
  Contexts: { x: 200, y: 300 },
  Identities: { x: -380, y: -220 },
  DirectEntitlements: { x: 0, y: -300 }
};
```

### 2. Curved Connector Lines

- SVG bezier curves connect lanes to the central focus card
- Animated dots flow along the lines (slow, subtle animation)
- Lines update when lanes are moved or collapsed
- Uses cubic bezier curves for organic "tentacle-like" appearance

**Animation specs:**
- Duration: 12 seconds per cycle
- Multiple dots per line with staggered timing
- Subtle glow effect on dots
- Semi-transparent lines (#88c0d0 at 30% opacity)

### 3. Lane Collapse/Expand

- Each lane has a toggle button (triangles) to collapse/expand
- Collapsed lanes show only the header
- Connector lines update when lanes collapse
- Toggle button has event propagation stopped to prevent drag interference

### 4. Cross-Lane Filtering

- Clicking an Account filters Effective Entitlements to show only entitlements from that account
- Clicking a System filters Effective Entitlements to show only entitlements from that system
- Visual indicators show which lane is the filter source and which is filtered
- Clear filter functionality

### 5. Pivot Navigation

- Click "Focus" arrow on any lane item to pivot to that node
- Central focus card updates with the new node
- Lanes reconfigure based on new focus node type
- Breadcrumb trail maintains navigation history

### 6. Identity Search Dialog

For standalone Access Lens (invoked from toolbar):

- Modal dialog appears prompting for identity selection
- Search input with debounce (300ms)
- **OData Search Features:**
  - Searches across FIRSTNAME, LASTNAME, DISPLAYNAME, EMAIL, EMPLOYEEID using OR logic
  - Results sorted alphabetically by LASTNAME, FIRSTNAME
  - Paginated results (20 per page) with "Load More" button
  - Shows total count and remaining items
- **Display Fields:**
  - Avatar with initials
  - Full name (DISPLAYNAME or LASTNAME, FIRSTNAME)
  - Email address
  - Job title
  - Employee ID
  - Organizational unit
  - Status badge (active/disabled)
  - **UId (32-character GUID)** - displayed for verification
- Minimum 2 characters required to search
- Clear search button
- Selection confirmation flow

**CRITICAL: UId (32-character GUID) Usage**

The identity search MUST use the `UId` field (32-character GUID), NOT the `Id` or `IdentityID` fields:
- `UId`: 32-character GUID (e.g., "A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6") - **USE THIS**
- `Id`: Integer ID - DO NOT USE for API calls
- `IdentityID`: String identifier - DO NOT USE for API calls

The UId is required for:
- `getIdentityContexts(identityUId)` - Get organizational contexts
- `getCalculatedAssignmentsDetailed(identityUIds)` - Get entitlements with reasons

```javascript
// Correct usage
const result = await omadaApi.identity.getIdentityContexts(
  identity.UId,  // 32-char GUID
  bearerToken,
  impersonateUser
);

// WRONG - Do not use Id or IdentityID
// const result = await omadaApi.identity.getIdentityContexts(identity.Id, ...);
```

### 7. API Integration

**OData Endpoints:**
- `searchIdentities(filters)` - Search for identities
- `getIdentityById(id)` - Get single identity details

**GraphQL Endpoints:**
- `getCalculatedAssignmentsDetailed(identityUIds)` - Get entitlements with reasons
- `getIdentityContexts(identityUId)` - Get identity contexts

**Data Service Layer:**
- Transform functions for all node types
- Mock data fallback for development
- Configurable via `configureDataService({ useMockData: boolean })`

---

## Performance Constraints

- Never render unlimited items
- Hard cap total visible lane items (e.g., 200)
- Support lane pagination via `loadMore(laneType)`
- Debounced search (300ms)
- Lazy loading for API data

---

## Color Scheme

**Node Type Colors:**
```javascript
const NODE_COLORS = {
  Identity: '#88c0d0',
  Role: '#a3be8c',
  Entitlement: '#ebcb8b',
  Policy: '#b48ead',
  Account: '#bf616a',
  System: '#d08770',
  Context: '#5e81ac'
};
```

**Reason Type Colors:**
```javascript
const REASON_COLORS = {
  DirectAssignment: '#88c0d0',
  RoleMembership: '#a3be8c',
  PolicyRule: '#b48ead',
  AccountLink: '#bf616a',
  Birthright: '#ebcb8b',
  SoDException: '#d08770',
  Other: '#4c566a'
};
```

**Status Colors:**
```javascript
const STATUS_COLORS = {
  active: '#a3be8c',
  disabled: '#bf616a',
  stale: '#ebcb8b',
  pending: '#4c566a'
};
```

---

## Component Structure

```
AccessLens
├── FilterBar
├── Breadcrumbs
├── AccessLensCanvas (DndContext)
│   ├── ConnectorLines (SVG bezier curves)
│   ├── FocusCard (center)
│   └── DraggableLane[] (positioned around center)
│       └── LaneCard
│           └── LaneItemRow[]
│               └── ReasonChips
├── ExplanationPanel
│   └── ReasonDetailPopover (or panel section)
└── IdentitySearchDialog (for standalone mode)
```

---

## File Structure

```
src/components/access-lens/
├── AccessLens.jsx           # Main container component
├── AccessLens.css           # Main styles
├── AccessLensPage.jsx       # Standalone page wrapper
├── AccessLensPage.css       # Page-specific styles
├── accessLensTypes.js       # Type definitions and helpers
├── accessLensDataService.js # API integration layer
├── mockAccessLensData.js    # Mock data for development
├── FilterBar.jsx            # Top filter controls
├── Breadcrumbs.jsx          # Navigation breadcrumbs
├── FocusCard.jsx            # Central focus node display
├── LaneCard.jsx             # Lane container
├── LaneItemRow.jsx          # Individual lane item
├── ExplanationPanel.jsx     # Right-side explanation
├── IdentitySearchDialog.jsx # Identity search modal
├── IdentitySearchDialog.css # Dialog styles
└── index.js                 # Module exports
```

---

## API Stubs

```typescript
// Fetch focus data for a node
fetchFocus(nodeId: string, filters: Filters): Promise<FocusResponse>

// Fetch explanation for why identity has entitlement
fetchExplanation(
  focusIdOrNode: string | Node,
  selectedItemIdOrNode: string | Node,
  selectedReasonId?: string
): Promise<ExplanationResponse>

// Search identities (OData)
omadaApi.identity.searchIdentities(
  filters: string,
  bearerToken: string,
  impersonateUser: string,
  options: { page: number, rows: number }
): Promise<SearchResult>

// Get calculated assignments (GraphQL)
omadaApi.assignment.getCalculatedAssignmentsDetailed(
  identityUIds: string | string[],
  bearerToken: string,
  impersonateUser: string,
  filters: object,
  pagination: { page: number, rows: number }
): Promise<AssignmentsResult>

// Get identity contexts (GraphQL)
omadaApi.identity.getIdentityContexts(
  identityUId: string,
  bearerToken: string,
  impersonateUser: string
): Promise<ContextsResult>
```

---

## Usage Examples

### Embedded in Identity Detail
```jsx
<AccessLens
  identity={selectedIdentity}
  isFullscreen={false}
  onClose={() => setShowLens(false)}
/>
```

### Standalone Page (from toolbar)
```jsx
// Route: /access-lens
<AccessLensPage />
// Shows identity search dialog, then loads lens with selected identity
```

### With Pre-loaded API Data
```jsx
<AccessLens
  identity={selectedIdentity}
  isFullscreen={true}
  onClose={handleClose}
  calculatedAssignments={assignmentsData}
  identityContexts={contextsData}
/>
```

---

## Implementation Details

### Component Props

```typescript
// AccessLens.jsx - Main component
interface AccessLensProps {
  initialNodeId?: string;           // Default: 'identity-1'
  identity?: OmadaIdentity | null;  // Identity object from Omada API
  isFullscreen?: boolean;           // Default: false
  onClose?: () => void;             // Callback when closing
  calculatedAssignments?: any[];    // Pre-loaded assignments from API
  identityContexts?: any[];         // Pre-loaded contexts from API
}

// LaneCard.jsx
interface LaneCardProps {
  lane: Lane;
  focusNodeType: NodeType;
  selectedItemId: string | null;
  selectedReasonId: string | null;
  onItemClick: (item: LaneItem) => void;
  onPivot: (node: Node) => void;
  onReasonClick: (reasonId: string) => void;
  onLoadMore: (laneType: LaneType) => void;
  viewMode: ViewMode;
  isVisible: boolean;
  isFilterActive: boolean;
  activeFilterId: string | null;
}

// LaneItemRow.jsx
interface LaneItemRowProps {
  item: LaneItem;
  isSelected: boolean;
  isActiveFilter: boolean;
  onClick: (item: LaneItem) => void;
  onPivot: (node: Node) => void;
  onReasonClick: (reasonId: string) => void;
  selectedReasonId: string | null;
  showReasons: boolean;
  viewMode: ViewMode;
}

// FocusCard.jsx
interface FocusCardProps {
  node: Node;
  onClose?: () => void;
  isFullscreen: boolean;
}

// ExplanationPanel.jsx
interface ExplanationPanelProps {
  explanation: ExplanationResponse | null;
  isLoading: boolean;
  selectedReasonId: string | null;
  onReasonSelect: (reasonId: string) => void;
}

// FilterBar.jsx
interface FilterBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

// IdentitySearchDialog.jsx
interface IdentitySearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIdentity: (identity: OmadaIdentity) => void;
}
```

### State Management

```typescript
// Main AccessLens state
interface AccessLensState {
  // Core data
  focusNode: Node | null;
  lanes: Lane[];
  history: Node[];                    // Breadcrumb trail

  // Loading/error
  isLoading: boolean;
  error: string | null;

  // Lane positions (drag and drop)
  lanePositions: Record<LaneType, { x: number; y: number }>;
  activeDragId: string | null;

  // Selection
  selectedItem: LaneItem | null;
  selectedReasonId: string | null;
  explanation: ExplanationResponse | null;
  explanationLoading: boolean;

  // Cross-lane filtering
  selectedAccountId: string | null;
  selectedSystemId: string | null;

  // Filters
  viewMode: ViewMode;
  filters: Filters;
  searchQuery: string;
}

// Filters structure
interface Filters {
  visibleLanes: LaneType[];
  reasonTypes: ReasonType[];
  entitlementType: 'all' | 'direct' | 'inherited';
  highRiskOnly: boolean;
}

// Default filters
const DEFAULT_FILTERS: Filters = {
  visibleLanes: [
    'Roles', 'Accounts', 'EffectiveEntitlements',
    'Policies', 'Systems', 'Contexts'
  ],
  reasonTypes: [],
  entitlementType: 'all',
  highRiskOnly: false
};
```

### Mock Data Example

```javascript
// Example mock identity node
const mockIdentityNode = {
  id: 'identity-1',
  type: 'Identity',
  displayName: 'Jane Doe',
  status: 'active',
  riskScore: 45,
  badges: ['Employee', 'Finance'],
  metadata: {
    email: 'jane.doe@company.com',
    department: 'Finance',
    employeeId: 'EMP001',
    title: 'Senior Accountant'
  }
};

// Example mock entitlement with reasons
const mockEntitlementItem = {
  node: {
    id: 'ent-1',
    type: 'Entitlement',
    displayName: 'FB_ApproveInvoices',
    status: 'active',
    riskScore: 65,
    badges: ['SAP', 'Finance'],
    metadata: {
      system: 'SAP ERP',
      systemId: 'sys-sap',
      type: 'Transaction'
    }
  },
  reasons: [
    {
      id: 'reason-1',
      type: 'RoleMembership',
      title: 'Finance Manager Role',
      description: 'Granted through membership in the Finance Manager role',
      confidence: 'high',
      evidencePath: {
        nodes: [
          { id: 'identity-1', type: 'Identity', displayName: 'Jane Doe' },
          { id: 'role-1', type: 'Role', displayName: 'Finance Manager' },
          { id: 'ent-1', type: 'Entitlement', displayName: 'FB_ApproveInvoices' }
        ],
        edges: [
          { id: 'e1', fromId: 'identity-1', toId: 'role-1', type: 'member_of' },
          { id: 'e2', fromId: 'role-1', toId: 'ent-1', type: 'provides' }
        ]
      },
      facts: [
        { label: 'Role Assigned', value: '2024-01-15' },
        { label: 'Approved By', value: 'Manager John Smith' }
      ]
    },
    {
      id: 'reason-2',
      type: 'DirectAssignment',
      title: 'Direct Grant',
      description: 'Directly assigned via access request AR-2024-001',
      confidence: 'high'
    }
  ],
  groupKey: 'sys-sap',
  groupLabel: 'SAP ERP'
};

// Example FocusResponse
const mockFocusResponse = {
  focusNode: mockIdentityNode,
  lanes: [
    {
      laneType: 'Roles',
      totalCount: 3,
      items: [/* role items */],
      canLoadMore: false
    },
    {
      laneType: 'EffectiveEntitlements',
      totalCount: 25,
      items: [mockEntitlementItem, /* more items */],
      canLoadMore: true
    }
    // ... more lanes
  ]
};
```

### Connector Lines Algorithm

```javascript
// SVG Bezier curve calculation for connector lines
const ConnectorLines = ({ lanePositions, fulcrumRef }) => {
  const calculatePath = (startX, startY, endX, endY) => {
    // Calculate control points for smooth S-curve
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;

    // Offset control points perpendicular to the line
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.sqrt(dx * dx + dy * dy);

    // Control point offset (creates the curve)
    const offset = len * 0.3;

    // Create cubic bezier path
    const cp1x = startX + dx * 0.25;
    const cp1y = startY + dy * 0.1;
    const cp2x = endX - dx * 0.25;
    const cp2y = endY - dy * 0.1;

    return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
  };

  // Find lane center point
  const getLaneCenter = (laneType) => {
    const laneElement = document.querySelector(`[data-lane-type="${laneType}"]`);
    if (!laneElement) return null;

    const rect = laneElement.getBoundingClientRect();
    const containerRect = fulcrumRef.current.parentElement.getBoundingClientRect();

    return {
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top + rect.height / 2 - containerRect.top
    };
  };

  // Render SVG with animated dots
  return (
    <svg className="connector-lines">
      {Object.keys(lanePositions).map(laneType => {
        const laneCenter = getLaneCenter(laneType);
        const fulcrumCenter = getFulcrumCenter();
        if (!laneCenter || !fulcrumCenter) return null;

        const path = calculatePath(
          fulcrumCenter.x, fulcrumCenter.y,
          laneCenter.x, laneCenter.y
        );

        return (
          <g key={laneType}>
            <path d={path} className="connector-line" />
            {/* Animated dots */}
            <circle r="3" className="connector-dot">
              <animateMotion dur="12s" repeatCount="indefinite" path={path} />
            </circle>
          </g>
        );
      })}
    </svg>
  );
};
```

### Data Transformation Functions

```javascript
// Transform Omada Identity to AccessLens Node
export const transformIdentityToNode = (identity) => {
  if (!identity) return null;

  return {
    id: identity.UId || identity.Id,
    type: 'Identity',
    displayName: identity.DISPLAYNAME ||
      `${identity.FIRSTNAME || ''} ${identity.LASTNAME || ''}`.trim() ||
      'Unknown',
    status: mapStatus(identity.IDENTITYSTATUS),
    riskScore: mapRiskLevel(identity.RISKLEVEL),
    badges: [identity.IDENTITYCATEGORY, identity.JOBTITLE].filter(Boolean),
    metadata: {
      email: identity.EMAIL,
      department: identity.OUREF?.DisplayName,
      employeeId: identity.EMPLOYEEID,
      title: identity.JOBTITLE,
      _raw: identity  // Keep raw data for debugging
    }
  };
};

// Transform Omada Assignment to LaneItem with Reasons
export const transformAssignmentToLaneItem = (assignment, index) => {
  const entitlementNode = {
    id: assignment.resource?.id || `ent-${index}`,
    type: 'Entitlement',
    displayName: assignment.resource?.name || 'Unknown',
    status: 'active',
    badges: [
      assignment.resource?.system?.name,
      assignment.resource?.resourceType?.name
    ].filter(Boolean),
    metadata: {
      system: assignment.resource?.system?.name,
      systemId: assignment.resource?.system?.id,
      type: assignment.resource?.resourceType?.name,
      complianceStatus: assignment.complianceStatus
    }
  };

  // Transform reasons
  const reasons = (assignment.reasons || []).map((r, i) => ({
    id: r.id || `reason-${index}-${i}`,
    type: mapReasonType(r.type),
    title: r.title || r.displayName || getReasonTypeLabel(r.type),
    description: r.description || r.summary,
    confidence: r.confidence || 'high',
    evidencePath: r.evidencePath,
    facts: r.facts || []
  }));

  return {
    node: entitlementNode,
    reasons: reasons.length > 0 ? reasons : [{
      id: `reason-${index}-default`,
      type: 'Other',
      title: 'Assignment',
      description: `Assigned via ${assignment.assignmentType || 'unknown method'}`,
      confidence: 'high'
    }],
    groupKey: assignment.resource?.system?.id,
    groupLabel: assignment.resource?.system?.name
  };
};

// Build Contexts Lane from API response
export const buildContextsLane = (contexts, filters = {}) => {
  if (!contexts || !Array.isArray(contexts)) {
    return { laneType: 'Contexts', totalCount: 0, items: [], canLoadMore: false };
  }

  const items = contexts.map((context, index) => ({
    node: {
      id: context.id || context.UId,
      type: 'Context',
      displayName: context.name || context.DisplayName || 'Unknown Context',
      status: 'active',
      badges: [context.type, context.category].filter(Boolean),
      metadata: { type: context.type, description: context.description }
    },
    reasons: [],
    groupKey: context.type || 'default',
    groupLabel: context.type || 'Context'
  }));

  return {
    laneType: 'Contexts',
    totalCount: items.length,
    items: filters.showAll ? items : items.slice(0, 10),
    canLoadMore: items.length > 10
  };
};

// Helper functions
const mapStatus = (status) => {
  if (!status) return 'active';
  const s = status.toLowerCase();
  if (s === 'active' || s === 'enabled') return 'active';
  if (s === 'disabled' || s === 'inactive') return 'disabled';
  if (s === 'pending') return 'pending';
  return 'active';
};

const mapRiskLevel = (level) => {
  if (!level) return undefined;
  if (typeof level === 'number') return level;
  const l = level.toLowerCase();
  if (l === 'high' || l === 'critical') return 75;
  if (l === 'medium') return 50;
  if (l === 'low') return 25;
  return undefined;
};

const mapReasonType = (type) => {
  if (!type) return 'Other';
  const t = type.toLowerCase();
  if (t.includes('role')) return 'RoleMembership';
  if (t.includes('birthright') || t.includes('automatic')) return 'Birthright';
  if (t.includes('direct') || t.includes('manual')) return 'DirectAssignment';
  if (t.includes('policy') || t.includes('rule')) return 'PolicyRule';
  if (t.includes('account')) return 'AccountLink';
  if (t.includes('sod') || t.includes('exception')) return 'SoDException';
  return 'Other';
};
```

### CSS Class Structure

```css
/* Main container */
.access-lens { }
.access-lens.fullscreen { }

/* Top bar */
.access-lens-header { }
.access-lens-title { }
.filter-bar { }
.breadcrumbs { }

/* Canvas area */
.access-lens-canvas { }
.connector-lines { }
.connector-line { }
.connector-dot { }

/* Focus card (center) */
.focus-card { }
.focus-card-icon { }
.focus-card-name { }
.focus-card-type { }
.focus-card-risk { }
.focus-card-metadata { }

/* Draggable lanes */
.draggable-lane { }
.draggable-lane.dragging { }

/* Lane card */
.lane-card { }
.lane-card.expanded { }
.lane-card.collapsed { }
.lane-card.filter-source { }
.lane-card.filtered { }
.lane-header { }
.lane-icon { }
.lane-title { }
.lane-count { }
.lane-toggle-btn { }
.lane-content { }
.lane-empty { }
.lane-load-more { }

/* Lane item row */
.lane-item { }
.lane-item.selected { }
.lane-item.active-filter { }
.lane-item-icon { }
.lane-item-name { }
.lane-item-badges { }
.lane-item-actions { }
.pivot-btn { }
.filter-btn { }

/* Reason chips */
.reason-chips { }
.reason-chip { }
.reason-chip.selected { }
.reason-chip-more { }

/* Explanation panel */
.explanation-panel { }
.explanation-header { }
.explanation-title { }
.explanation-content { }
.explanation-reasons { }
.reason-detail { }
.evidence-path { }
.evidence-node { }
.evidence-edge { }
.fact-list { }
.fact-item { }

/* Identity search dialog */
.identity-search-dialog-overlay { }
.identity-search-dialog { }
.dialog-header { }
.dialog-search { }
.search-input-wrapper { }
.dialog-results { }
.result-item { }
.result-item.selected { }
.result-avatar { }
.result-info { }
.dialog-footer { }
```

### Icons by Node Type

```javascript
const NODE_ICONS = {
  Identity: '👤',
  Role: '👥',
  Entitlement: '🔑',
  Policy: '📋',
  Account: '💻',
  System: '🖥️',
  Context: '🏷️'
};

const LANE_ICONS = {
  Roles: '👥',
  Accounts: '💻',
  EffectiveEntitlements: '🔑',
  DirectEntitlements: '🔑',
  Policies: '📋',
  Systems: '🖥️',
  Identities: '👤',
  Contexts: '🏷️'
};

const LANE_LABELS = {
  Roles: 'Roles',
  Accounts: 'Accounts',
  EffectiveEntitlements: 'Effective Entitlements',
  DirectEntitlements: 'Direct Entitlements',
  Policies: 'Assignment Policy',
  Systems: 'Systems',
  Identities: 'Identities',
  Contexts: 'Contexts'
};
```

### Event Flow

```
User Action                    Handler                          State Change
─────────────────────────────────────────────────────────────────────────────
Click lane item        →  handleItemClick(item)        →  setSelectedItem, loadExplanation
Click pivot button     →  handlePivot(node)            →  loadFocus, setHistory
Click breadcrumb       →  handleBreadcrumbClick(node)  →  loadFocus, truncate history
Click reason chip      →  handleReasonClick(reasonId)  →  setSelectedReasonId
Drag lane              →  handleDragEnd(event)         →  setLanePositions
Toggle lane collapse   →  setIsExpanded(!isExpanded)   →  (local lane state)
Click account filter   →  setSelectedAccountId(id)     →  filter EffectiveEntitlements
Click system filter    →  setSelectedSystemId(id)      →  filter EffectiveEntitlements
Change view mode       →  setViewMode(mode)            →  re-render with mode styles
Change filters         →  setFilters(newFilters)       →  reload lanes
Search identity        →  searchIdentities(query)      →  setSearchResults
Select identity        →  handleIdentitySelect(id)     →  loadIdentityData, close dialog
```

### Cross-Lane Filtering Logic

```javascript
// In AccessLens.jsx - filter entitlements based on account/system selection
const getFilteredLanes = useCallback(() => {
  if (!selectedAccountId && !selectedSystemId) {
    return lanes;
  }

  return lanes.map(lane => {
    if (lane.laneType !== 'EffectiveEntitlements') {
      return lane;
    }

    const filteredItems = lane.items.filter(item => {
      if (selectedAccountId) {
        // Filter by account - check if entitlement's account matches
        return item.node.metadata?.accountId === selectedAccountId;
      }
      if (selectedSystemId) {
        // Filter by system - check if entitlement's system matches
        return item.node.metadata?.systemId === selectedSystemId;
      }
      return true;
    });

    return {
      ...lane,
      items: filteredItems,
      totalCount: filteredItems.length,
      isFiltered: true
    };
  });
}, [lanes, selectedAccountId, selectedSystemId]);
```

### Dependencies

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "react-router-dom": "^6.x",
    "@dnd-kit/core": "^6.x",
    "@dnd-kit/utilities": "^3.x"
  }
}
```

---

## Future Enhancements

- [ ] Persist lane positions to user preferences
- [ ] Graph visualization mode (force-directed)
- [ ] Export access report
- [ ] Batch certification actions
- [ ] SoD violation highlighting
- [ ] Time-travel view (access at point in time)
- [ ] Comparison mode (two identities side-by-side)
- [ ] Keyboard navigation support
- [ ] Accessibility improvements (ARIA labels)
- [ ] Print/PDF export of access view
