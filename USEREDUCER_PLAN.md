# useReducer Refactor Plan - AccessLens.jsx

## Rollback Command
```bash
git checkout pre-useReducer-refactor -- src/components/access-lens/AccessLens.jsx
```

---

## Current State: 27 useState Calls

### Group 1: Core Navigation (6 states)
| Line | State | Setter |
|------|-------|--------|
| 737 | focusNode | setFocusNode |
| 738 | lanes | setLanes |
| 740 | history | setHistory |
| 741 | historyIndex | setHistoryIndex |
| 787 | pendingNodeType | setPendingNodeType |
| 788 | currentAssignments | setCurrentAssignments |

### Group 2: Loading (5 states)
| Line | State | Setter |
|------|-------|--------|
| 742 | isLoading | setIsLoading |
| 743 | lanesLoading | setLanesLoading |
| 744 | pivotLoadingStatus | setPivotLoadingStatus |
| 745 | error | setError |
| 773 | explanationLoading | setExplanationLoading |

### Group 3: Animation (4 states)
| Line | State | Setter |
|------|-------|--------|
| 751 | centralNodeRevealed | setCentralNodeRevealed |
| 752 | revealedLanes | setRevealedLanes |
| 757 | lanesForceCollapsed | setLanesForceCollapsed |
| 758 | lanesForceExpanded | setLanesForceExpanded |

### Group 4: UI/Layout (5 states)
| Line | State | Setter |
|------|-------|--------|
| 748 | focusCardMinimized | setFocusCardMinimized |
| 755 | lanePositions | setLanePositions |
| 756 | activeDragId | setActiveDragId |
| 776 | inspectorCollapsed | setInspectorCollapsed |
| 777 | showObjectInspector | setShowObjectInspector |

### Group 5: Selection (4 states)
| Line | State | Setter |
|------|-------|--------|
| 770 | selectedItem | setSelectedItem |
| 771 | selectedReasonId | setSelectedReasonId |
| 772 | explanation | setExplanation |
| 786 | laneSelections | setLaneSelections |

### Group 6: Filters/View (5 states)
| Line | State | Setter |
|------|-------|--------|
| 791 | viewMode | setViewMode |
| 792 | filters | setFilters |
| 812 | searchQuery | setSearchQuery |
| 813 | availableReasonTypes | setAvailableReasonTypes |
| 814 | availableComplianceStatuses | setAvailableComplianceStatuses |

---

## Implementation Plan

### Step 1: Define Initial State Object
```javascript
const initialState = {
  // Core Navigation
  focusNode: null,
  lanes: [],
  history: [],
  historyIndex: -1,
  pendingNodeType: null,
  currentAssignments: null,

  // Loading
  isLoading: false,
  lanesLoading: true,
  pivotLoadingStatus: '',
  error: null,
  explanationLoading: false,

  // Animation
  centralNodeRevealed: false,
  revealedLanes: new Set(),
  lanesForceCollapsed: true, // from prop
  lanesForceExpanded: false,

  // UI/Layout
  focusCardMinimized: false,
  lanePositions: {},
  activeDragId: null,
  inspectorCollapsed: false,
  showObjectInspector: false,

  // Selection
  selectedItem: null,
  selectedReasonId: null,
  explanation: null,
  laneSelections: {},

  // Filters/View
  viewMode: 'explore',
  filters: { complianceStatuses: [], reasonTypes: [], ... },
  searchQuery: '',
  availableReasonTypes: [],
  availableComplianceStatuses: []
};
```

### Step 2: Define Action Types
```javascript
const ActionTypes = {
  // Simple setters
  SET_FOCUS_NODE: 'SET_FOCUS_NODE',
  SET_LANES: 'SET_LANES',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  // ... one per state

  // Compound actions (multiple states at once)
  NAVIGATE_TO_NODE: 'NAVIGATE_TO_NODE',      // focusNode + history + clear selection
  START_PIVOT: 'START_PIVOT',                 // isLoading + pendingNodeType + clear states
  COMPLETE_PIVOT: 'COMPLETE_PIVOT',           // focusNode + lanes + loading=false
  RESET_VIEW: 'RESET_VIEW',                   // positions + selections + collapsed
  SELECT_ITEM: 'SELECT_ITEM',                 // selectedItem + explanation
  CLEAR_SELECTION: 'CLEAR_SELECTION',         // selectedItem + selectedReasonId + explanation
};
```

### Step 3: Define Reducer Function
```javascript
function accessLensReducer(state, action) {
  switch (action.type) {
    case 'SET_FOCUS_NODE':
      return { ...state, focusNode: action.payload };

    case 'NAVIGATE_TO_NODE':
      return {
        ...state,
        focusNode: action.payload.node,
        history: [...state.history.slice(0, state.historyIndex + 1), action.payload.node],
        historyIndex: state.historyIndex + 1,
        selectedItem: null,
        explanation: null,
        selectedReasonId: null
      };

    case 'START_PIVOT':
      return {
        ...state,
        isLoading: true,
        lanesLoading: true,
        pendingNodeType: action.payload.nodeType,
        pivotLoadingStatus: action.payload.status || '',
        laneSelections: {},
        selectedItem: null,
        explanation: null
      };

    // ... more cases

    default:
      return state;
  }
}
```

### Step 4: Replace useState Calls
Replace:
```javascript
const [focusNode, setFocusNode] = useState(null);
const [lanes, setLanes] = useState([]);
// ... 25 more
```

With:
```javascript
const [state, dispatch] = useReducer(accessLensReducer, initialState);
```

### Step 5: Update All Setter Calls
Replace throughout the file:
- `setFocusNode(x)` → `dispatch({ type: 'SET_FOCUS_NODE', payload: x })`
- Complex operations → compound actions

### Step 6: Update All State Reads
Replace:
- `focusNode` → `state.focusNode`
- `lanes` → `state.lanes`
- etc.

### Step 7: Update Dependency Arrays
All useEffect/useCallback/useMemo that reference state need updating.

---

## Risk Mitigation

1. **Incremental approach**: Start with one group, test, then next group
2. **Keep setters available**: Create helper functions that wrap dispatch
3. **Test after each group**: Don't do all 27 at once

---

## Estimated Setter Call Counts (to update)

| Setter | Approx Uses |
|--------|-------------|
| setFocusNode | 5 |
| setLanes | 8 |
| setIsLoading | 6 |
| setLanesLoading | 4 |
| setSelectedItem | 8 |
| setExplanation | 6 |
| setLaneSelections | 5 |
| setFilters | 3 |
| Others | 3-5 each |

**Total: ~80-100 setter calls to update**

---

## Go/No-Go Checklist

- [x] Rollback point created (git tag)
- [x] Initial state defined
- [x] Reducer function created
- [x] useState calls replaced
- [x] Setters updated (wrapper functions with useCallback)
- [x] State reads updated (via destructuring)
- [x] Build passes
- [ ] Local testing passes
