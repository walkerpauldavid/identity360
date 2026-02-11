/**
 * AccessLens Component
 * Main container for the IGA access graph exploration widget
 * Features: Identity integration, draggable lanes, connector lines
 */

import { useState, useEffect, useCallback, useRef, useMemo, memo, useReducer } from 'react';
import { DndContext, useDraggable, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  ViewModes,
  LaneTypes,
  NodeTypes,
  LaneSchema,
  LaneConfigSchema,
  CompassOrientation,
  getLaneDisplayConfig,
  getLanesForNodeType,
  getRequiredLanes,
  getCrossLaneFilterConfig,
  shouldLog
} from './accessLensTypes';

// Helper: get the selection value for a lane type from consolidated selections
const getSelectionForLane = (laneType, selections) => {
  const key = LaneSchema[laneType]?.selectionStateKey;
  return key ? (selections[key] || null) : null;
};
import accessLensDataService, { buildContextsLane, buildLanesFromAssignments, extractUniqueReasonTypes, extractUniqueComplianceStatuses, extractViolationCount, enrichPoliciesWithOData, enrichResourceFoldersWithOData, fetchChildResourcesForEntitlement, fetchChildResourcesFromIds } from './accessLensDataService';
import { usePreferences } from '../../contexts/PreferencesContext';
import {
  applyCrossLaneFilters,
  filterVisibleLanes,
  isLaneFiltered,
  isLaneFilterSource
} from './crossLaneFilterService';

// Feature flag to enable schema-driven cross-lane filtering
// Set to true to use the new crossLaneFilterService, false for legacy behavior
// Schema-driven filtering is now the only code path (legacy hardcoded filtering removed)
import FilterBar from './FilterBar';
import Breadcrumbs from './Breadcrumbs';
import FocusCard from './FocusCard';
import LaneCard from './LaneCard';
import ObjectInspector from './ObjectInspector';
import { getStringValue } from './accessLensUtils';
import './AccessLens.css';
import './AccessLensTheme.css';

// ============================================================================
// ACCESS LENS STATE REDUCER
// Consolidates 27 useState calls into a single reducer for better performance
// ============================================================================

const MAX_HISTORY = 15;

// Zoom constants
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

// Default filter state
const defaultFilters = {
  visibleLanes: [
    LaneTypes.ROLES,
    LaneTypes.ACCOUNTS,
    LaneTypes.EFFECTIVE_ENTITLEMENTS,
    LaneTypes.POLICIES,
    LaneTypes.ASSIGNMENT_POLICIES,
    LaneTypes.SYSTEMS,
    LaneTypes.LOGICAL_APPLICATIONS,
    LaneTypes.CONTEXTS,
    LaneTypes.IDENTITIES,
    LaneTypes.VIOLATIONS,
    LaneTypes.RESOURCE_FOLDERS
  ],
  reasonTypes: [],
  complianceStatuses: [],
  entitlementType: 'all',
  multiPathOnly: false,
  highRiskOnly: false
};

// Initial state creator - takes lanesCollapsedOnLoad prop
const createInitialState = (lanesCollapsedOnLoad) => ({
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
  lanesForceCollapsed: lanesCollapsedOnLoad,
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
  viewMode: ViewModes.EXPLORE,
  filters: defaultFilters,
  searchQuery: '',
  availableReasonTypes: [],
  availableComplianceStatuses: [],

  // Zoom
  zoomLevel: 1,

  // Per-lane expanded/collapsed state (persists across filter changes)
  laneExpandedStates: {}
});

// Reducer function - handles both direct values and functional updates
function accessLensReducer(state, action) {
  // Handle functional updates: if payload is a function, call it with current value
  const resolvePayload = (key) => {
    if (typeof action.payload === 'function') {
      return action.payload(state[key]);
    }
    return action.payload;
  };

  switch (action.type) {
    // === Simple Setters (support functional updates) ===
    case 'SET_FOCUS_NODE':
      return { ...state, focusNode: resolvePayload('focusNode') };
    case 'SET_LANES':
      return { ...state, lanes: resolvePayload('lanes') };
    case 'SET_HISTORY':
      return { ...state, history: resolvePayload('history') };
    case 'SET_HISTORY_INDEX':
      return { ...state, historyIndex: resolvePayload('historyIndex') };
    case 'SET_PENDING_NODE_TYPE':
      return { ...state, pendingNodeType: resolvePayload('pendingNodeType') };
    case 'SET_CURRENT_ASSIGNMENTS':
      return { ...state, currentAssignments: resolvePayload('currentAssignments') };
    case 'SET_IS_LOADING':
      return { ...state, isLoading: resolvePayload('isLoading') };
    case 'SET_LANES_LOADING':
      return { ...state, lanesLoading: resolvePayload('lanesLoading') };
    case 'SET_PIVOT_LOADING_STATUS':
      return { ...state, pivotLoadingStatus: resolvePayload('pivotLoadingStatus') };
    case 'SET_ERROR':
      return { ...state, error: resolvePayload('error') };
    case 'SET_EXPLANATION_LOADING':
      return { ...state, explanationLoading: resolvePayload('explanationLoading') };
    case 'SET_CENTRAL_NODE_REVEALED':
      return { ...state, centralNodeRevealed: resolvePayload('centralNodeRevealed') };
    case 'SET_REVEALED_LANES':
      return { ...state, revealedLanes: resolvePayload('revealedLanes') };
    case 'SET_LANES_FORCE_COLLAPSED':
      return { ...state, lanesForceCollapsed: resolvePayload('lanesForceCollapsed') };
    case 'SET_LANES_FORCE_EXPANDED':
      return { ...state, lanesForceExpanded: resolvePayload('lanesForceExpanded') };
    case 'SET_FOCUS_CARD_MINIMIZED':
      return { ...state, focusCardMinimized: resolvePayload('focusCardMinimized') };
    case 'SET_LANE_POSITIONS':
      return { ...state, lanePositions: resolvePayload('lanePositions') };
    case 'SET_ACTIVE_DRAG_ID':
      return { ...state, activeDragId: resolvePayload('activeDragId') };
    case 'SET_INSPECTOR_COLLAPSED':
      return { ...state, inspectorCollapsed: resolvePayload('inspectorCollapsed') };
    case 'SET_SHOW_OBJECT_INSPECTOR':
      return { ...state, showObjectInspector: resolvePayload('showObjectInspector') };
    case 'SET_SELECTED_ITEM':
      return { ...state, selectedItem: resolvePayload('selectedItem') };
    case 'SET_SELECTED_REASON_ID':
      return { ...state, selectedReasonId: resolvePayload('selectedReasonId') };
    case 'SET_EXPLANATION':
      return { ...state, explanation: resolvePayload('explanation') };
    case 'SET_LANE_SELECTIONS':
      return { ...state, laneSelections: resolvePayload('laneSelections') };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: resolvePayload('viewMode') };
    case 'SET_FILTERS':
      return { ...state, filters: resolvePayload('filters') };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: resolvePayload('searchQuery') };
    case 'SET_AVAILABLE_REASON_TYPES':
      return { ...state, availableReasonTypes: resolvePayload('availableReasonTypes') };
    case 'SET_AVAILABLE_COMPLIANCE_STATUSES':
      return { ...state, availableComplianceStatuses: resolvePayload('availableComplianceStatuses') };
    case 'SET_ZOOM_LEVEL':
      return { ...state, zoomLevel: resolvePayload('zoomLevel') };
    case 'SET_LANE_EXPANDED_STATES':
      return { ...state, laneExpandedStates: resolvePayload('laneExpandedStates') };

    default:
      console.warn('[AccessLens Reducer] Unknown action type:', action.type);
      return state;
  }
}

// Convert identity from IdentityDetail to AccessLens node format
const identityToNode = (identity) => {
  if (!identity) return null;

  const statusStr = getStringValue(identity.IDENTITYSTATUS, 'active').toLowerCase();

  // Try multiple property name variations for first/last name (OData may use different casing)
  const firstName = identity.FIRSTNAME || identity.FirstName || identity.firstName || '';
  const lastName = identity.LASTNAME || identity.LastName || identity.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();

  // Try multiple property name variations for display name
  const displayNameValue = fullName ||
    identity.DISPLAYNAME || identity.DisplayName || identity.displayName ||
    identity.NAME || identity.Name || identity.name ||
    'Unknown';

  // Build the node with rawData for schema-based attribute extraction
  return {
    id: identity.UId || identity.Id || identity.id || 'identity-current',
    type: NodeTypes.IDENTITY,
    displayName: displayNameValue,
    identityId: identity.IDENTITYID,  // Employee/Identity ID (e.g., EMP12345)
    status: statusStr === 'active' ? 'active' :
            statusStr === 'disabled' ? 'disabled' :
            statusStr === 'inactive' ? 'inactive' : statusStr,  // Pass actual status value
    riskScore: getStringValue(identity.RISKLEVEL) === 'High' ? 75 :
               getStringValue(identity.RISKLEVEL) === 'Medium' ? 50 :
               getStringValue(identity.RISKLEVEL) === 'Low' ? 25 : undefined,
    badges: [
      getStringValue(identity.IDENTITYCATEGORY),
      identity.JOBTITLE
    ].filter(Boolean),
    // Include raw API data for schema-based attribute display in FocusCard
    rawData: identity,
    // Also include metadata for backwards compatibility
    metadata: {
      email: identity.EMAIL,
      department: identity.OUREF?.DisplayName || getStringValue(identity.OUREF),
      employeeId: identity.EMPLOYEEID,
      identityId: identity.IDENTITYID,
      title: identity.JOBTITLE
    }
  };
};

// Lane and fulcrum dimensions for collision detection
// Note: Multi-column lanes (like Entitlements) can be 700px+ wide
const LANE_DIMENSIONS = {
  width: 720,   // Maximum lane width (700px for 2-column + margin)
  height: 350   // Approximate lane height (increased for expanded lanes with content)
};

const FULCRUM_DIMENSIONS = {
  width: 330,   // Fulcrum card width (308px + margin)
  height: 220   // Fulcrum card height
};

// Vertical anchor point for the canvas center (percentage of canvas height)
// 40% positions the focus node higher so it's visible without scrolling
const CANVAS_CENTER_Y = '40%';

/**
 * Compass-to-position mapping
 * Maps compass orientations (from LaneSchema) to x,y coordinates relative to central node
 * Positions are designed to avoid overlap with fulcrum and other lanes
 */
const COMPASS_POSITIONS = {
  [CompassOrientation.N]:  { x: 0, y: -380 },      // North - top center (Violations)
  [CompassOrientation.NE]: { x: 750, y: -380 },    // North-East - top right (Accounts) - pushed right to avoid N overlap
  [CompassOrientation.E]:  { x: 780, y: 80 },      // East - right center (Logical Apps - pushed further right)
  [CompassOrientation.SE]: { x: 520, y: 520 },     // South-East - bottom right (Systems - pushed down)
  [CompassOrientation.S]:  { x: 0, y: 580 },       // South - bottom center
  [CompassOrientation.SW]: { x: -520, y: 520 },    // South-West - bottom left
  [CompassOrientation.W]:  { x: -680, y: 80 },     // West - left center
  [CompassOrientation.NW]: { x: -750, y: -380 }    // North-West - top left (Entitlements) - pushed left to avoid N overlap
};

/**
 * Clockwise order of compass positions starting from NW
 * Used for staggered lane animation
 */
const CLOCKWISE_ORDER = [
  CompassOrientation.NW,  // 1. North-West (top left) - start here
  CompassOrientation.N,   // 2. North (top center)
  CompassOrientation.NE,  // 3. North-East (top right)
  CompassOrientation.E,   // 4. East (right center)
  CompassOrientation.SE,  // 5. South-East (bottom right)
  CompassOrientation.S,   // 6. South (bottom center)
  CompassOrientation.SW,  // 7. South-West (bottom left)
  CompassOrientation.W    // 8. West (left center)
];

/**
 * Get the clockwise order index for a lane based on its compass position
 * Lower index = appears earlier in animation
 */
const getClockwiseOrder = (laneType) => {
  const schema = LaneSchema[laneType];
  const compass = schema?.defaultPosition?.compass;
  if (!compass) return 99; // Unknown lanes appear last
  const index = CLOCKWISE_ORDER.indexOf(compass);
  return index >= 0 ? index : 99;
};

/**
 * Loading placeholder for a lane card
 * Shows a transparent outline with loading animation while data is being fetched
 */
const LoadingLanePlaceholder = ({ laneType, position }) => {
  const schema = LaneSchema[laneType];
  if (!schema) return null;

  const config = getLaneDisplayConfig(laneType);
  const width = config.width || 350;

  return (
    <div
      className="lane-card-placeholder"
      style={{
        position: 'absolute',
        left: '50%',
        top: CANVAS_CENTER_Y,
        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
        width: `${width}px`,
        minHeight: '120px',
        zIndex: 5
      }}
    >
      <div className="placeholder-header" style={{ borderLeftColor: config.color }}>
        <span className="placeholder-icon">{config.icon}</span>
        <span className="placeholder-title">{config.label}</span>
      </div>
      <div className="placeholder-content">
        <div className="placeholder-spinner"></div>
        <span className="placeholder-text">Loading...</span>
      </div>
    </div>
  );
};

/**
 * Get the expected lanes that should show loading placeholders
 * Based on the focus node type from the schema
 * @param {string} nodeType - The type of the focus node (Identity, Entitlement, System, etc.)
 * @returns {string[]} Array of lane types to show as placeholders
 */
const getLoadingPlaceholderLanes = (nodeType) => {
  if (!nodeType) {
    // Default to Identity-centric lanes if no node type
    return [
      LaneTypes.SYSTEMS,
      LaneTypes.ACCOUNTS,
      LaneTypes.EFFECTIVE_ENTITLEMENTS,
      LaneTypes.CONTEXTS
    ];
  }
  // Use the schema to get lanes for this node type
  return getLanesForNodeType(nodeType);
};

/**
 * Get default position for a lane type based on its compass orientation from LaneSchema
 * Falls back to calculated position if no compass defined
 */
const getDefaultPositionForLane = (laneType) => {
  const schema = LaneSchema[laneType];
  if (schema?.defaultPosition?.compass) {
    return COMPASS_POSITIONS[schema.defaultPosition.compass] || { x: 0, y: 0 };
  }
  // Fallback positions for any lane types without compass defined
  return { x: 0, y: 0 };
};

// Predefined slot positions around the fulcrum - fallback positions when compass positions overlap
// Used by dynamic positioning when default positions are taken
const LANE_SLOTS = [
  COMPASS_POSITIONS[CompassOrientation.NW],   // North-West
  COMPASS_POSITIONS[CompassOrientation.NE],   // North-East
  COMPASS_POSITIONS[CompassOrientation.W],    // West
  COMPASS_POSITIONS[CompassOrientation.E],    // East
  COMPASS_POSITIONS[CompassOrientation.SW],   // South-West
  COMPASS_POSITIONS[CompassOrientation.SE],   // South-East
  COMPASS_POSITIONS[CompassOrientation.N],    // North
  COMPASS_POSITIONS[CompassOrientation.S],    // South
];

/**
 * Build DEFAULT_LANE_POSITIONS dynamically from LaneSchema compass orientations
 * This ensures the schema is the single source of truth for lane positioning
 */
const DEFAULT_LANE_POSITIONS = Object.keys(LaneTypes).reduce((positions, key) => {
  const laneType = LaneTypes[key];
  positions[laneType] = getDefaultPositionForLane(laneType);
  return positions;
}, {});

/**
 * Check if two rectangles overlap
 * @param {Object} rect1 - { x, y, width, height } - center position
 * @param {Object} rect2 - { x, y, width, height } - center position
 * @returns {boolean} true if rectangles overlap
 */
const rectanglesOverlap = (rect1, rect2) => {
  // Convert center positions to corner positions
  const r1Left = rect1.x - rect1.width / 2;
  const r1Right = rect1.x + rect1.width / 2;
  const r1Top = rect1.y - rect1.height / 2;
  const r1Bottom = rect1.y + rect1.height / 2;

  const r2Left = rect2.x - rect2.width / 2;
  const r2Right = rect2.x + rect2.width / 2;
  const r2Top = rect2.y - rect2.height / 2;
  const r2Bottom = rect2.y + rect2.height / 2;

  // Check for overlap
  return !(r1Right < r2Left || r1Left > r2Right || r1Bottom < r2Top || r1Top > r2Bottom);
};

/**
 * Check if a lane position overlaps with the fulcrum
 * @param {Object} pos - { x, y } position relative to center
 * @returns {boolean} true if overlaps with fulcrum
 */
const overlapsWithFulcrum = (pos) => {
  const laneRect = { x: pos.x, y: pos.y, ...LANE_DIMENSIONS };
  const fulcrumRect = { x: 0, y: 0, ...FULCRUM_DIMENSIONS };
  return rectanglesOverlap(laneRect, fulcrumRect);
};

/**
 * Check if a lane position overlaps with any existing positions
 * @param {Object} pos - { x, y } position to check
 * @param {Array} existingPositions - Array of { x, y } positions already placed
 * @returns {boolean} true if overlaps with any existing position
 */
const overlapsWithExisting = (pos, existingPositions) => {
  const laneRect = { x: pos.x, y: pos.y, ...LANE_DIMENSIONS };

  for (const existing of existingPositions) {
    const existingRect = { x: existing.x, y: existing.y, ...LANE_DIMENSIONS };
    if (rectanglesOverlap(laneRect, existingRect)) {
      return true;
    }
  }
  return false;
};

/**
 * Get the priority for a lane type from its schema
 * Lower number = higher priority (processed first, gets preferred position)
 */
const getLanePriority = (laneType) => {
  const schema = LaneSchema[laneType];
  return schema?.defaultPosition?.priority ?? 99;
};

/**
 * Calculate dynamic lane positions based on the number of visible lanes with data.
 * Uses predefined slots to ensure no overlap between lanes or with the fulcrum.
 * Processes lanes by priority (lower priority number = processed first).
 * @param {Array} lanesWithData - Array of lane objects that have items
 * @returns {Object} Position map { laneType: { x, y } }
 */
const calculateDynamicLanePositions = (lanesWithData) => {
  const positions = {};
  const laneCount = lanesWithData.length;

  if (laneCount === 0) return positions;

  // Sort lanes by priority (lower number = higher priority = processed first)
  // This ensures high-priority lanes like Violations get their preferred position
  const sortedLanes = [...lanesWithData].sort((a, b) => {
    const priorityA = getLanePriority(a.laneType);
    const priorityB = getLanePriority(b.laneType);
    return priorityA - priorityB;
  });

  // Use predefined slots to guarantee no overlap
  const usedSlots = [];

  sortedLanes.forEach((lane, index) => {
    // First try to use the default position for this lane type
    const defaultPos = DEFAULT_LANE_POSITIONS[lane.laneType];

    if (defaultPos && !overlapsWithFulcrum(defaultPos) && !overlapsWithExisting(defaultPos, usedSlots)) {
      positions[lane.laneType] = { ...defaultPos };
      usedSlots.push(defaultPos);
      return;
    }

    // Find the next available slot
    for (const slot of LANE_SLOTS) {
      if (!overlapsWithFulcrum(slot) && !overlapsWithExisting(slot, usedSlots)) {
        positions[lane.laneType] = { ...slot };
        usedSlots.push(slot);
        return;
      }
    }

    // Fallback: calculate a position that doesn't overlap (expand outward)
    const angle = (index / laneCount) * 2 * Math.PI - Math.PI / 2;
    let radius = 400;
    let attempts = 0;

    while (attempts < 10) {
      const x = Math.round(Math.cos(angle) * radius);
      const y = Math.round(Math.sin(angle) * radius);
      const pos = { x, y };

      if (!overlapsWithFulcrum(pos) && !overlapsWithExisting(pos, usedSlots)) {
        positions[lane.laneType] = pos;
        usedSlots.push(pos);
        return;
      }

      radius += 100;
      attempts++;
    }

    // Ultimate fallback - just place it far out
    const fallbackX = Math.round(Math.cos(angle) * 500);
    const fallbackY = Math.round(Math.sin(angle) * 500);
    positions[lane.laneType] = { x: fallbackX, y: fallbackY };
    usedSlots.push({ x: fallbackX, y: fallbackY });
  });

  return positions;
};

// Draggable Lane Wrapper Component (M-02 fix: wrapped in React.memo)
// IMPORTANT: Drag listeners are only applied to the drag handle (header area),
// NOT the entire container, so clicks on lane items can pass through
const DraggableLane = memo(({ id, position, children, onPositionChange, onRefChange }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
  });

  // C-02 fix: Combine dnd-kit ref with our ref callback for caching
  // This avoids querySelector in ConnectorLines
  const combinedRef = useCallback((node) => {
    setNodeRef(node);
    if (onRefChange) {
      onRefChange(id, node);
    }
  }, [setNodeRef, onRefChange, id]);

  // Calculate the total transform including:
  // 1. Centering offset (-50%, -50%) to center the lane on its position point
  // 2. Drag offset from dnd-kit during active drag
  const dragX = transform?.x || 0;
  const dragY = transform?.y || 0;

  // Use GPU-accelerated transforms for smooth dragging
  // IMPORTANT: Must include translate(-50%, -50%) for centering AND drag offset together
  // willChange and pointerEvents are now handled via CSS .dragging class (L-12 fix)
  const style = {
    position: 'absolute',
    left: `calc(50% + ${position.x}px)`,
    top: `calc(${CANVAS_CENTER_Y} + ${position.y}px)`,
    // Combine centering transform with drag offset using translate3d for GPU acceleration
    // The -50%, -50% centers the element on its anchor point
    // The dragX, dragY adds the drag offset during active dragging
    transform: `translate3d(calc(-50% + ${dragX}px), calc(-50% + ${dragY}px), 0)`,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div
      ref={combinedRef}
      style={style}
      className={`draggable-lane ${isDragging ? 'dragging' : ''}`}
      data-lane-type={id}
      {...attributes}
    >
      {/* Drag handle overlay - covers icon and title area for dragging */}
      {/* Uses fixed width to leave search input and buttons uncovered */}
      <div
        className="drag-handle-overlay"
        {...listeners}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '160px', // Fixed width covering icon + title area only
          height: '40px', // Height of the lane header
          cursor: isDragging ? 'grabbing' : 'grab',
          zIndex: 10,
          pointerEvents: 'auto',
        }}
      />
      {children}
    </div>
  );
});

// SVG Connector Lines Component - Curved flowing tentacle-like lines
// C-02 fix: Accepts laneRefs Map to avoid querySelector, batches DOM reads, throttles during drag
const ConnectorLines = ({ lanePositions, fulcrumRef, isDragging = false, laneRefs, zoomLevel = 1 }) => {
  const [lines, setLines] = useState([]);
  const frameSkipRef = useRef(0); // C-02 fix: Track frames for throttling

  useEffect(() => {
    const updateLines = (skipThrottle = false) => {
      if (!fulcrumRef.current) return;

      // C-02 fix: Throttle to every 2nd frame during drag (30fps is visually smooth)
      if (isDragging && !skipThrottle) {
        frameSkipRef.current++;
        if (frameSkipRef.current % 2 !== 0) return; // Skip odd frames
      }

      // C-02 fix: BATCH ALL DOM READS FIRST (prevents layout thrashing)
      // Read all getBoundingClientRect() calls before any calculations
      const fulcrumRect = fulcrumRef.current.getBoundingClientRect();
      const containerRect = fulcrumRef.current.parentElement?.getBoundingClientRect();

      if (!containerRect) return;

      // C-02 fix: Batch read all lane rects using cached refs (no querySelector)
      const laneTypes = Object.keys(lanePositions);
      const laneRects = new Map();
      for (const laneType of laneTypes) {
        const laneElement = laneRefs?.get(laneType);
        if (laneElement) {
          laneRects.set(laneType, laneElement.getBoundingClientRect());
        }
      }
      // END OF DOM READS - now safe to do calculations and state updates

      // When the canvas is CSS-scaled, getBoundingClientRect() returns screen-space
      // values. Divide by zoomLevel to convert back to canvas-space for the SVG.
      const z = zoomLevel;
      const fulcrumCenter = {
        x: (fulcrumRect.left - containerRect.left + fulcrumRect.width / 2) / z,
        y: (fulcrumRect.top - containerRect.top + fulcrumRect.height / 2) / z
      };

      const newLines = laneTypes.map((laneType) => {
        const pos = lanePositions[laneType];
        const laneRect = laneRects.get(laneType);

        let laneX, laneY;

        if (laneRect) {
          // Use actual lane position and dimensions from cached rect
          laneX = (laneRect.left - containerRect.left + laneRect.width / 2) / z;
          laneY = (laneRect.top - containerRect.top + laneRect.height / 2) / z;
        } else {
          // Fallback to calculated position with default dimensions
          laneX = (containerRect.width / 2) / z + pos.x + 140;
          laneY = (containerRect.height / 2) / z + pos.y + 80;
        }

        // Calculate control points for bezier curve (flowing tentacle effect)
        const dx = laneX - fulcrumCenter.x;
        const dy = laneY - fulcrumCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Avoid division by zero
        if (distance === 0) {
          return {
            id: laneType,
            x1: fulcrumCenter.x,
            y1: fulcrumCenter.y,
            x2: laneX,
            y2: laneY,
            path: `M${fulcrumCenter.x},${fulcrumCenter.y} L${laneX},${laneY}`
          };
        }

        // Create organic curve by offsetting control points perpendicular to the line
        const perpX = -dy / distance;
        const perpY = dx / distance;
        const curveStrength = distance * 0.25; // Slightly gentler curve

        // Control point 1 (closer to fulcrum)
        const cp1x = fulcrumCenter.x + dx * 0.3 + perpX * curveStrength * 0.5;
        const cp1y = fulcrumCenter.y + dy * 0.3 + perpY * curveStrength * 0.5;

        // Control point 2 (closer to lane)
        const cp2x = fulcrumCenter.x + dx * 0.7 - perpX * curveStrength * 0.3;
        const cp2y = fulcrumCenter.y + dy * 0.7 - perpY * curveStrength * 0.3;

        // Create the bezier path
        const path = `M${fulcrumCenter.x},${fulcrumCenter.y} C${cp1x},${cp1y} ${cp2x},${cp2y} ${laneX},${laneY}`;

        return {
          id: laneType,
          x1: fulcrumCenter.x,
          y1: fulcrumCenter.y,
          x2: laneX,
          y2: laneY,
          cp1x, cp1y, cp2x, cp2y,
          path
        };
      });

      setLines(newLines);
    };

    // Initial update (skip throttle for first render)
    updateLines(true);
    window.addEventListener('resize', () => updateLines(true));

    // Use requestAnimationFrame for smooth updates during drag
    // Otherwise use a longer interval for normal state
    let rafId = null;
    let intervalId = null;

    if (isDragging) {
      // C-02 fix: During drag, use rAF but throttle internally to 30fps
      frameSkipRef.current = 0;
      const animate = () => {
        updateLines();
        rafId = requestAnimationFrame(animate);
      };
      rafId = requestAnimationFrame(animate);
    } else {
      // When not dragging, update less frequently
      intervalId = setInterval(() => updateLines(true), 200);
    }

    return () => {
      window.removeEventListener('resize', () => updateLines(true));
      if (rafId) cancelAnimationFrame(rafId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [lanePositions, fulcrumRef, isDragging, laneRefs, zoomLevel]);

  return (
    <svg className="connector-lines-svg">
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#88c0d0" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#a3be8c" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#88c0d0" stopOpacity="0.3" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      {lines.map((line) => (
        <g key={line.id}>
          {/* Outer glow effect */}
          <path
            d={line.path}
            fill="none"
            stroke="#88c0d0"
            strokeWidth="8"
            strokeOpacity="0.1"
            filter="url(#softGlow)"
          />
          {/* Middle glow */}
          <path
            d={line.path}
            fill="none"
            stroke="#88c0d0"
            strokeWidth="4"
            strokeOpacity="0.2"
            filter="url(#glow)"
          />
          {/* Main curved line */}
          <path
            d={line.path}
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="connector-line"
          />
          {/* Animated dot traveling along the curve - slow and subtle */}
          <circle r="3" fill="#88c0d0" className="connector-dot" opacity="0.6">
            <animateMotion
              dur="12s"
              repeatCount="indefinite"
              path={line.path}
            />
          </circle>
          {/* Second dot for gentle flow effect */}
          <circle r="2" fill="#a3be8c" className="connector-dot" opacity="0.4">
            <animateMotion
              dur="12s"
              repeatCount="indefinite"
              begin="6s"
              path={line.path}
            />
          </circle>
        </g>
      ))}
    </svg>
  );
};

const AccessLens = ({
  identity = null,
  isFullscreen = false,
  onClose,
  calculatedAssignments = null,
  identityContexts = null,
  systemDetailsMap = {},  // Map of systemId -> system OData details (SYSTEMTYPE, DESCRIPTION, OWNERREF, CLT_TAGS)
  onFetchObjectDetails = null,  // Callback to fetch full object details when lane item is clicked
  onPivotToNode = null,  // Callback when user pivots to a different node (changes central focus)
  // Props for direct initialization (e.g., from heatmap navigation with system focus)
  initialFocusNode = null,
  initialLanes = null,
  initialReasonTypes = null,
  initialComplianceStatuses = null,
  apiContext = null  // API context for OData calls: { omadaApi, bearerToken, impersonateUser }
}) => {
  // User preferences for Identity360 display behavior
  const { preferences, setPreference } = usePreferences();
  const lanesCollapsedOnLoad = preferences.identity360LanesCollapsedOnLoad ?? true;
  const collapseLanesOnFocusChange = preferences.identity360CollapseLanesOnFocusChange ?? true;
  const currentTheme = preferences.theme || 'light';
  const colorPalette = preferences.colorPalette || {};

  // Build CSS variables from color palette for light theme
  const colorPaletteStyle = useMemo(() => {
    if (currentTheme !== 'light' || !colorPalette) return {};
    return {
      '--cp-focus-card-bg': colorPalette.focusCardBackground,
      '--cp-focus-card-text': colorPalette.focusCardText,
      '--cp-card-header-bg': colorPalette.cardHeaderBackground,
      '--cp-card-header-text': colorPalette.cardHeaderText,
      '--cp-card-border': colorPalette.cardBorder,
      '--cp-card-content-bg': colorPalette.cardContentBackground,
      '--cp-lane-item-bg': colorPalette.laneItemBackground,
      '--cp-lane-item-bg-hover': colorPalette.laneItemBackgroundHover,
      '--cp-lane-item-title': colorPalette.laneItemTitle,
      '--cp-lane-item-text': colorPalette.laneItemText,
      '--cp-lane-item-selected-bg': colorPalette.laneItemSelectedBackground,
      '--cp-lane-item-selected-border': colorPalette.laneItemSelectedBorder,
      '--cp-pill-bg': colorPalette.pillBackground,
      '--cp-pill-text': colorPalette.pillText,
      '--cp-filter-source-bg': colorPalette.filterSourceBackground,
      '--cp-filter-source-glow': colorPalette.filterSourceGlow,
      '--cp-filtered-bg': colorPalette.filteredBackground,
      '--cp-violations-bg': colorPalette.violationsBackground,
      '--cp-violations-text': colorPalette.violationsText,
      '--cp-count-badge': colorPalette.countBadgeColor,
      // Status colors
      '--cp-status-approved': colorPalette.statusApproved,
      '--cp-status-not-approved': colorPalette.statusNotApproved,
      '--cp-status-pending': colorPalette.statusPending,
      '--cp-status-inherited': colorPalette.statusInherited,
      // Neutral grays
      '--cp-light-gray': colorPalette.lightGray,
      '--cp-medium-gray': colorPalette.mediumGray,
      '--cp-border-gray': colorPalette.borderGray,
      '--cp-dark-neutral': colorPalette.darkNeutral
    };
  }, [currentTheme, colorPalette]);

  // Theme toggle handler
  const handleThemeChange = useCallback((newTheme) => {
    setPreference('theme', newTheme);
  }, [setPreference]);

  // Refs
  const scrollContainerRef = useRef(null);
  const fulcrumRef = useRef(null);
  const previousFocusNodeId = useRef(null);  // Track focus node changes
  const previousVisibleLanesRef = useRef([]);  // Store previous visibleLanes to preserve filtered state when lane becomes filter source
  const laneRefsMap = useRef(new Map());  // C-02 fix: Cache lane element refs to avoid querySelector in ConnectorLines

  // C-02 fix: Callback for DraggableLane to register its ref
  const handleLaneRefChange = useCallback((laneType, node) => {
    if (node) {
      laneRefsMap.current.set(laneType, node);
    } else {
      laneRefsMap.current.delete(laneType);
    }
  }, []);

  // Refs for stable callback access (H-01 fix: avoid recreating handleItemClick on every state change)
  const showObjectInspectorRef = useRef(false);
  const inspectorCollapsedRef = useRef(false);

  // ============================================================================
  // CONSOLIDATED STATE (useReducer)
  // All 27 state variables consolidated into a single reducer for better performance
  // ============================================================================
  const [state, dispatch] = useReducer(accessLensReducer, lanesCollapsedOnLoad, createInitialState);

  // Destructure state for backwards compatibility with existing code
  const {
    focusNode,
    lanes,
    history,
    historyIndex,
    isLoading,
    lanesLoading,
    pivotLoadingStatus,
    error,
    focusCardMinimized,
    centralNodeRevealed,
    revealedLanes,
    lanePositions,
    activeDragId,
    lanesForceCollapsed,
    lanesForceExpanded,
    selectedItem,
    selectedReasonId,
    explanation,
    explanationLoading,
    inspectorCollapsed,
    showObjectInspector,
    laneSelections,
    pendingNodeType,
    currentAssignments,
    viewMode,
    filters,
    searchQuery,
    availableReasonTypes,
    availableComplianceStatuses,
    zoomLevel,
    laneExpandedStates
  } = state;

  // Setter wrapper functions - maintain same API as useState for backwards compatibility
  // These support both direct values and functional updates: setFocusNode(value) or setFocusNode(prev => newValue)
  const setFocusNode = useCallback((value) => dispatch({ type: 'SET_FOCUS_NODE', payload: value }), []);
  const setLanes = useCallback((value) => dispatch({ type: 'SET_LANES', payload: value }), []);
  const setHistory = useCallback((value) => dispatch({ type: 'SET_HISTORY', payload: value }), []);
  const setHistoryIndex = useCallback((value) => dispatch({ type: 'SET_HISTORY_INDEX', payload: value }), []);
  const setIsLoading = useCallback((value) => dispatch({ type: 'SET_IS_LOADING', payload: value }), []);
  const setLanesLoading = useCallback((value) => dispatch({ type: 'SET_LANES_LOADING', payload: value }), []);
  const setPivotLoadingStatus = useCallback((value) => dispatch({ type: 'SET_PIVOT_LOADING_STATUS', payload: value }), []);
  const setError = useCallback((value) => dispatch({ type: 'SET_ERROR', payload: value }), []);
  const setFocusCardMinimized = useCallback((value) => dispatch({ type: 'SET_FOCUS_CARD_MINIMIZED', payload: value }), []);
  const setCentralNodeRevealed = useCallback((value) => dispatch({ type: 'SET_CENTRAL_NODE_REVEALED', payload: value }), []);
  const setRevealedLanes = useCallback((value) => dispatch({ type: 'SET_REVEALED_LANES', payload: value }), []);
  const setLanePositions = useCallback((value) => dispatch({ type: 'SET_LANE_POSITIONS', payload: value }), []);
  const setActiveDragId = useCallback((value) => dispatch({ type: 'SET_ACTIVE_DRAG_ID', payload: value }), []);
  const setLanesForceCollapsed = useCallback((value) => dispatch({ type: 'SET_LANES_FORCE_COLLAPSED', payload: value }), []);
  const setLanesForceExpanded = useCallback((value) => dispatch({ type: 'SET_LANES_FORCE_EXPANDED', payload: value }), []);
  const setSelectedItem = useCallback((value) => dispatch({ type: 'SET_SELECTED_ITEM', payload: value }), []);
  const setSelectedReasonId = useCallback((value) => dispatch({ type: 'SET_SELECTED_REASON_ID', payload: value }), []);
  const setExplanation = useCallback((value) => dispatch({ type: 'SET_EXPLANATION', payload: value }), []);
  const setExplanationLoading = useCallback((value) => dispatch({ type: 'SET_EXPLANATION_LOADING', payload: value }), []);
  const setInspectorCollapsed = useCallback((value) => dispatch({ type: 'SET_INSPECTOR_COLLAPSED', payload: value }), []);
  const setShowObjectInspector = useCallback((value) => dispatch({ type: 'SET_SHOW_OBJECT_INSPECTOR', payload: value }), []);
  const setLaneSelections = useCallback((value) => dispatch({ type: 'SET_LANE_SELECTIONS', payload: value }), []);
  const setPendingNodeType = useCallback((value) => dispatch({ type: 'SET_PENDING_NODE_TYPE', payload: value }), []);
  const setCurrentAssignments = useCallback((value) => dispatch({ type: 'SET_CURRENT_ASSIGNMENTS', payload: value }), []);
  const setViewMode = useCallback((value) => dispatch({ type: 'SET_VIEW_MODE', payload: value }), []);
  const setFilters = useCallback((value) => dispatch({ type: 'SET_FILTERS', payload: value }), []);
  const setSearchQuery = useCallback((value) => dispatch({ type: 'SET_SEARCH_QUERY', payload: value }), []);
  const setAvailableReasonTypes = useCallback((value) => dispatch({ type: 'SET_AVAILABLE_REASON_TYPES', payload: value }), []);
  const setAvailableComplianceStatuses = useCallback((value) => dispatch({ type: 'SET_AVAILABLE_COMPLIANCE_STATUSES', payload: value }), []);
  const setZoomLevel = useCallback((value) => dispatch({ type: 'SET_ZOOM_LEVEL', payload: value }), []);
  const setLaneExpandedStates = useCallback((value) => dispatch({ type: 'SET_LANE_EXPANDED_STATES', payload: value }), []);

  // Callback for LaneCard to report its expanded state back to parent
  const handleLaneExpandedChange = useCallback((laneType, expanded) => {
    setLaneExpandedStates(prev => ({ ...prev, [laneType]: expanded }));
  }, [setLaneExpandedStates]);

  // Configure drag sensors for smoother experience
  // PointerSensor with activation constraint prevents accidental drags
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // Minimum drag distance before activation
    },
  });
  const sensors = useSensors(pointerSensor);

  // Ctrl+Wheel zoom handler — zooms the canvas without affecting toolbar/inspector
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return; // Only zoom on Ctrl/Cmd+wheel
      e.preventDefault();

      setZoomLevel(prev => {
        const direction = e.deltaY < 0 ? 1 : -1;
        const next = Math.round((prev + direction * ZOOM_STEP) * 10) / 10;
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [setZoomLevel]);

  // Keep refs in sync for stable callback access (H-01 fix)
  showObjectInspectorRef.current = showObjectInspector;
  inspectorCollapsedRef.current = inspectorCollapsed;

  // Initialize lane positions when lanes change - only persist user-dragged positions
  // Dynamic positioning is calculated at render time for lanes without manual positions
  useEffect(() => {
    // Only keep positions for lanes that exist and were manually positioned
    const validPositions = {};
    lanes.forEach((lane) => {
      if (lanePositions[lane.laneType]) {
        validPositions[lane.laneType] = lanePositions[lane.laneType];
      }
    });
    // Only update if there are changes (to avoid infinite loop)
    if (Object.keys(validPositions).length !== Object.keys(lanePositions).length) {
      setLanePositions(validPositions);
    }
  }, [lanes]);

  // Staggered animation: reveal central node first, then lanes in clockwise order
  useEffect(() => {
    // Reset animation state when loading starts
    if (lanesLoading || isLoading) {
      setCentralNodeRevealed(false);
      setRevealedLanes(new Set());
      return;
    }

    // When loading completes and we have a focus node, start the animation sequence
    if (!lanesLoading && !isLoading && focusNode) {
      // Step 1: Reveal the central node first
      const centralNodeTimer = setTimeout(() => {
        setCentralNodeRevealed(true);
      }, 100);

      // Step 2: Sort lanes by clockwise order and reveal them one by one
      // For System focus node, include required lanes even if empty (they are shown in visibleLanes)
      const requiredLanesForSystem = [LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.LOGICAL_APPLICATIONS];
      const lanesWithData = lanes.filter(lane => {
        const isVisible = filters.visibleLanes.includes(lane.laneType);
        const hasData = lane.items && lane.items.length > 0;
        const isRequiredForSystem = focusNode?.type === NodeTypes.SYSTEM && requiredLanesForSystem.includes(lane.laneType);
        return isVisible && (hasData || isRequiredForSystem);
      });

      const sortedLanes = [...lanesWithData].sort((a, b) =>
        getClockwiseOrder(a.laneType) - getClockwiseOrder(b.laneType)
      );

      // Reveal each lane with a staggered delay (starting after central node)
      const laneTimers = sortedLanes.map((lane, index) => {
        return setTimeout(() => {
          setRevealedLanes(prev => new Set([...prev, lane.laneType]));
        }, 300 + (index * 150)); // Start 300ms after central node, 150ms between each lane
      });

      return () => {
        clearTimeout(centralNodeTimer);
        laneTimers.forEach(timer => clearTimeout(timer));
      };
    }
  }, [lanesLoading, isLoading, focusNode, lanes, filters.visibleLanes]);

  // Collapse lanes when focus node changes (based on user preference)
  useEffect(() => {
    if (!focusNode?.id) return;

    // Check if focus node has actually changed (not just initial load)
    if (previousFocusNodeId.current !== null && previousFocusNodeId.current !== focusNode.id) {
      // Focus node changed - collapse lanes if preference is enabled
      if (collapseLanesOnFocusChange) {
        // Clear expanded states — all lanes fall back to collapsed default
        setLaneExpandedStates({});
      }
    }

    // Update the ref to track the current focus node
    previousFocusNodeId.current = focusNode.id;
  }, [focusNode?.id, collapseLanesOnFocusChange, setLaneExpandedStates]);

  // Track previous focus node type for detecting type changes
  const previousFocusNodeTypeRef = useRef(null);

  // Clear inspector state when focus node type changes
  // This prevents stale data from being shown when pivoting between different node types
  // (e.g., from Identity to Entitlement)
  useEffect(() => {
    if (!focusNode?.type) return;

    // Check if focus node type has actually changed (not just initial load)
    if (previousFocusNodeTypeRef.current !== null && previousFocusNodeTypeRef.current !== focusNode.type) {
      // Focus node type changed - clear inspector state to prevent showing stale data
      setSelectedItem(null);
      setExplanation(null);
      setSelectedReasonId(null);
    }

    // Update the ref to track the current focus node type
    previousFocusNodeTypeRef.current = focusNode.type;
  }, [focusNode?.type]);

  // Load focus data - sets the central focus node (identity)
  // Lanes are populated separately via calculatedAssignments and identityContexts props
  const loadFocus = useCallback(async (nodeIdOrNode, addToHistory = true) => {
    // Don't set isLoading here - data is pre-loaded by AccessLensPage
    // Only clear selection state
    setError(null);
    setSelectedItem(null);
    setExplanation(null);

    try {
      // Determine if we received a full node object or just an ID
      let nodeObject = null;
      let nodeId = nodeIdOrNode;

      if (typeof nodeIdOrNode === 'object' && nodeIdOrNode !== null) {
        nodeObject = nodeIdOrNode;
        nodeId = nodeIdOrNode.id;
      }

      // Use the provided node object as the focus node
      // Lanes will be populated by the useEffect hooks that process calculatedAssignments and identityContexts
      const finalFocusNode = nodeObject;

      if (!finalFocusNode) {
        throw new Error('No focus node provided');
      }

      setFocusNode(finalFocusNode);
      // Initialize with empty lanes - they will be populated by API data
      setLanes([]);

      // Reset lane positions when focus changes to a different node type
      if (finalFocusNode?.type !== focusNode?.type) {
        setLanePositions({});
      }

      if (addToHistory) {
        setHistory(prev => {
          const existingIndex = prev.findIndex(n => n.id === finalFocusNode.id);
          if (existingIndex >= 0) {
            // Node already in history - UPDATE it with new data (e.g., displayName may have changed)
            // This handles the case where identity loads with just UId first, then full details later
            const updatedHistory = [...prev.slice(0, existingIndex), finalFocusNode, ...prev.slice(existingIndex + 1)];
            setHistoryIndex(existingIndex);
            return updatedHistory.slice(0, existingIndex + 1);
          }
          // New node, add to history after current position (trimming any "forward" history)
          let newHistory = [...prev.slice(0, historyIndex + 1), finalFocusNode];
          // Cap at MAX_HISTORY — drop oldest entries
          if (newHistory.length > MAX_HISTORY) {
            const overflow = newHistory.length - MAX_HISTORY;
            newHistory = newHistory.slice(overflow);
          }
          setHistoryIndex(newHistory.length - 1);
          return newHistory;
        });
      }
    } catch (err) {
      setError(err.message);
    }
  }, [filters, focusNode?.type]);

  // Initial load - use identity from props (only for identity-centric view)
  // Skip if initialFocusNode is provided (system-centric view takes precedence)
  useEffect(() => {
    if (identity && !initialFocusNode) {
      if (shouldLog('INIT')) {
        console.log('=== AccessLens: Creating node from identity ===');
        console.log('Identity prop received:', identity);
      }

      const identityNode = identityToNode(identity);
      if (shouldLog('INIT')) {
        console.log('Created identity node:', identityNode);
      }

      loadFocus(identityNode);
    }
    // No fallback to mock data - identity prop is required for identity-centric view
  }, [identity, initialFocusNode]);

  // Direct initialization from props (e.g., system-centric view from heatmap)
  useEffect(() => {
    if (initialFocusNode && initialLanes) {
      if (shouldLog('INIT')) {
        console.log('');
        console.log('='.repeat(70));
        console.log('=== AccessLens: Direct initialization from props ===');
        console.log('='.repeat(70));
        console.log('Initial focus node:', initialFocusNode);
        console.log('Initial lanes count:', initialLanes.length);

        // Log each lane in detail
        initialLanes.forEach(lane => {
          console.log(`  Lane "${lane.laneType}": ${lane.items?.length || 0} items`);
          if (lane.laneType === 'EffectiveEntitlements') {
            console.log('    [EffectiveEntitlements] First 3 items:');
            (lane.items || []).slice(0, 3).forEach((item, i) => {
              console.log(`      ${i + 1}. "${item.node?.displayName}" [type: "${item.node?.metadata?.type}"]`);
            });
          }
        });
      }

      setFocusNode(initialFocusNode);
      setLanes(initialLanes);

      if (initialReasonTypes) {
        setAvailableReasonTypes(initialReasonTypes);
      }
      if (initialComplianceStatuses) {
        setAvailableComplianceStatuses(initialComplianceStatuses);
      }

      // Add to history
      setHistory([initialFocusNode]);
      setHistoryIndex(0);

      // Mark as loaded
      setLanesLoading(false);
      setIsLoading(false);
    }
  }, [initialFocusNode, initialLanes, initialReasonTypes, initialComplianceStatuses]);

  // Reload when filters change (only for identity-centric view)
  // For system-centric view (initialFocusNode), filtering is done at render level without reloading
  useEffect(() => {
    if (focusNode && !initialFocusNode) {
      loadFocus(focusNode, false);
    }
  }, [filters, initialFocusNode]);

  // Update lanes when calculatedAssignments API data is provided (from AccessLensPage)
  useEffect(() => {
    if (shouldLog('LANES')) {
      console.log('=== AccessLens useEffect triggered ===');
      console.log('  calculatedAssignments:', calculatedAssignments?.length || 0);
      console.log('  systemDetailsMap entries:', Object.keys(systemDetailsMap).length);
    }

    if (calculatedAssignments && Array.isArray(calculatedAssignments) && calculatedAssignments.length > 0) {
      // Mark lanes as loading while we process the data
      setLanesLoading(true);

      if (shouldLog('LANES')) {
        console.log('=== AccessLens: Processing calculatedAssignments ===');
        console.log('Raw calculatedAssignments count:', calculatedAssignments.length);
      }

      // Build Systems, Accounts, and Entitlements lanes from assignments data
      // Pass systemDetailsMap for enriching Systems and Logical Applications lanes
      const assignmentLanes = buildLanesFromAssignments(calculatedAssignments, filters, {
        systemDetailsMap: systemDetailsMap
      });

      if (shouldLog('LANES')) {
        console.log('Built lanes from assignments:');
        assignmentLanes.forEach(lane => {
          console.log(`  - ${lane.laneType}: ${lane.items.length} items`);
        });
      }

      // Extract unique reason types for the filter dropdown
      const reasonTypes = extractUniqueReasonTypes(calculatedAssignments);
      setAvailableReasonTypes(reasonTypes);

      // Extract unique compliance statuses for the filter dropdown
      const complianceStatuses = extractUniqueComplianceStatuses(calculatedAssignments);
      setAvailableComplianceStatuses(complianceStatuses);

      setLanes(prevLanes => {
        // Keep the contexts lane if it exists, replace others
        const contextsLane = prevLanes.find(l => l.laneType === LaneTypes.CONTEXTS);
        const newLanes = contextsLane ? [...assignmentLanes, contextsLane] : assignmentLanes;
        return newLanes;
      });

      // Mark lanes as loaded after a brief delay to allow render
      setTimeout(() => {
        setLanesLoading(false);
      }, 100);
    }
  }, [calculatedAssignments, filters, systemDetailsMap]);

  // Update contexts lane when identityContexts API data is provided
  useEffect(() => {
    if (identityContexts && Array.isArray(identityContexts)) {
      // Build contexts lane from API data
      const contextsLane = buildContextsLane(identityContexts, filters);

      if (shouldLog('LANES')) {
        console.log('Built contexts lane:', contextsLane.items.length, 'items');
      }

      setLanes(prevLanes => {
        // Remove existing contexts lane if any
        const otherLanes = prevLanes.filter(l => l.laneType !== LaneTypes.CONTEXTS);
        // Add the new contexts lane
        return [...otherLanes, contextsLane];
      });
    }
  }, [identityContexts, filters]);

  // Track enrichment status to prevent infinite loops
  const policiesEnrichedRef = useRef(false);
  const foldersEnrichedRef = useRef(false);
  const childResourcesEnrichedRef = useRef(false);

  // Reset enrichment flags when focus node changes
  useEffect(() => {
    policiesEnrichedRef.current = false;
    foldersEnrichedRef.current = false;
    childResourcesEnrichedRef.current = false;
  }, [focusNode?.id]);

  // Enrich Assignment Policies lane with OData details (AP_CONTEXTS for cross-lane filtering)
  // This runs after lanes are built and we have apiContext
  useEffect(() => {
    const enrichPolicies = async () => {
      // Skip if already enriched for this focus node
      if (policiesEnrichedRef.current) return;

      if (!apiContext || !lanes || lanes.length === 0) {
        return;
      }

      const policiesLane = lanes.find(l => l.laneType === LaneTypes.ASSIGNMENT_POLICIES);

      if (!policiesLane || policiesLane.items.length === 0) return;

      // Check if already enriched (has contextIds array with items on first item)
      const existingContextIds = policiesLane.items[0]?.node?.metadata?.contextIds;

      if (existingContextIds && existingContextIds.length > 0) {
        policiesEnrichedRef.current = true;
        return; // Already enriched
      }

      // Mark as enriched before async call to prevent duplicate calls
      policiesEnrichedRef.current = true;

      try {
        const enrichedLane = await enrichPoliciesWithOData(policiesLane, apiContext);

        // Update lanes with enriched policy data
        setLanes(prevLanes => {
          return prevLanes.map(lane =>
            lane.laneType === LaneTypes.ASSIGNMENT_POLICIES ? enrichedLane : lane
          );
        });
      } catch (error) {
        console.warn('[AccessLens] Failed to enrich policies with OData:', error.message);
        // Reset flag so it can retry on next render
        policiesEnrichedRef.current = false;
      }
    };

    enrichPolicies();
  }, [lanes, apiContext]);

  // Enrich Resource Folders lane with OData details (OWNERREF, CLT_TAGS, APPROVAL, RESOURCECONTEXTS)
  // This runs after lanes are built and we have apiContext
  useEffect(() => {
    const enrichFolders = async () => {
      // Skip if already enriched for this focus node
      if (foldersEnrichedRef.current) return;

      if (!apiContext || !lanes || lanes.length === 0) return;

      const foldersLane = lanes.find(l => l.laneType === LaneTypes.RESOURCE_FOLDERS);
      if (!foldersLane || foldersLane.items.length === 0) return;

      // Check if already enriched (has owner or contextIds)
      const firstItem = foldersLane.items[0]?.node?.metadata;
      if (firstItem?.owner || (firstItem?.contextIds && firstItem.contextIds.length > 0)) {
        foldersEnrichedRef.current = true;
        return; // Already enriched
      }

      // Mark as enriched before async call to prevent duplicate calls
      foldersEnrichedRef.current = true;

      try {
        await enrichResourceFoldersWithOData(foldersLane, apiContext);

        // Update lanes with enriched folder data
        setLanes(prevLanes => {
          return prevLanes.map(lane =>
            lane.laneType === LaneTypes.RESOURCE_FOLDERS ? { ...foldersLane } : lane
          );
        });
      } catch (error) {
        console.warn('[AccessLens] Failed to enrich resource folders with OData:', error.message);
        // Reset flag so it can retry on next render
        foldersEnrichedRef.current = false;
      }
    };

    enrichFolders();
  }, [lanes, apiContext]);

  // Fetch child resources for Entitlement focus node using GraphQL API (reasonType: CHILD_RESOURCE)
  // This runs after lanes are built and we have apiContext, only for Entitlement focus nodes
  // Approach: Query identities from Identities lane with reasonType: CHILD_RESOURCE, then filter by parent ID
  useEffect(() => {
    const fetchChildResources = async () => {
      console.log('[DEBUG:ChildResources] === useEffect triggered ===');
      console.log('[DEBUG:ChildResources] childResourcesEnrichedRef.current:', childResourcesEnrichedRef.current);
      console.log('[DEBUG:ChildResources] focusNode:', focusNode?.type, focusNode?.id, focusNode?.displayName);
      console.log('[DEBUG:ChildResources] apiContext available:', !!apiContext);
      console.log('[DEBUG:ChildResources] lanes count:', lanes?.length);

      // Skip if already fetched for this focus node
      if (childResourcesEnrichedRef.current) {
        console.log('[DEBUG:ChildResources] SKIP: Already enriched for this focus node');
        return;
      }

      // Only fetch for Entitlement focus nodes
      if (!focusNode || (focusNode.type !== NodeTypes.ENTITLEMENT && focusNode.type !== 'Entitlement')) {
        console.log('[DEBUG:ChildResources] SKIP: Focus node is not Entitlement, type:', focusNode?.type);
        return;
      }

      if (!apiContext || !lanes || lanes.length === 0) {
        console.log('[DEBUG:ChildResources] SKIP: No apiContext or lanes');
        return;
      }

      // Log all available lanes
      console.log('[DEBUG:ChildResources] Available lanes:', lanes.map(l => `${l.laneType}(${l.items?.length || 0})`).join(', '));

      // Check if we already have child resources lane with API data
      const existingChildLane = lanes.find(l => l.laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS);
      console.log('[DEBUG:ChildResources] Existing EFFECTIVE_ENTITLEMENTS lane:', existingChildLane ? `items=${existingChildLane.items?.length}, apiSource=${existingChildLane.apiSource}` : 'none');

      if (existingChildLane?.apiSource === 'GraphQL:getChildResourcesForIdentities') {
        childResourcesEnrichedRef.current = true;
        console.log('[DEBUG:ChildResources] SKIP: Already fetched from API');
        return;
      }

      // Get identity IDs from the Identities lane
      const identitiesLane = lanes.find(l => l.laneType === LaneTypes.IDENTITIES);
      console.log('[DEBUG:ChildResources] Identities lane:', identitiesLane ? `items=${identitiesLane.items?.length}` : 'NOT FOUND');

      if (!identitiesLane || !identitiesLane.items || identitiesLane.items.length === 0) {
        console.log('[DEBUG:ChildResources] SKIP: No identities in Identities lane');
        return;
      }

      // NEW APPROACH: Check if focusNode has childResourceIds from API response
      // This is more reliable than the identity-based approach
      const childResourceIds = focusNode.rawData?.childResourceIds ||
                               focusNode.metadata?.childResourceIds ||
                               focusNode.rawData?.resource?.childResourceIds ||
                               [];

      console.log('[DEBUG:ChildResources] childResourceIds from focusNode:', childResourceIds?.length || 0);

      // Mark as enriched before async call to prevent duplicate calls
      childResourcesEnrichedRef.current = true;

      let childResourcesLane;

      try {
        if (childResourceIds.length > 0) {
          // NEW SIMPLER APPROACH: Use childResourceIds directly
          console.log(`[DEBUG:ChildResources] Using NEW approach with ${childResourceIds.length} childResourceIds`);
          childResourcesLane = await fetchChildResourcesFromIds(childResourceIds, apiContext);
        } else {
          // FALLBACK: Use old identity-based approach if no childResourceIds
          console.log('[DEBUG:ChildResources] No childResourceIds, falling back to identity-based approach');

          // Get identity IDs from the Identities lane
          const identitiesLane = lanes.find(l => l.laneType === LaneTypes.IDENTITIES);

          if (!identitiesLane || !identitiesLane.items || identitiesLane.items.length === 0) {
            console.log('[DEBUG:ChildResources] SKIP: No identities for fallback approach');
            childResourcesEnrichedRef.current = false;
            return;
          }

          const identityIds = identitiesLane.items
            .map(item => item.node?.id)
            .filter(id => id != null);

          if (identityIds.length === 0) {
            console.log('[DEBUG:ChildResources] SKIP: No valid identity IDs found');
            childResourcesEnrichedRef.current = false;
            return;
          }

          console.log(`[DEBUG:ChildResources] CALLING fetchChildResourcesForEntitlement with ${identityIds.length} identities`);
          childResourcesLane = await fetchChildResourcesForEntitlement(focusNode, identityIds, apiContext);
        }

        console.log('[DEBUG:ChildResources] API response:', {
          laneType: childResourcesLane?.laneType,
          totalCount: childResourcesLane?.totalCount,
          itemsLength: childResourcesLane?.items?.length,
          apiSource: childResourcesLane?.apiSource
        });

        if (childResourcesLane && childResourcesLane.items && childResourcesLane.items.length > 0) {
          console.log('[DEBUG:ChildResources] SUCCESS: Updating lanes with', childResourcesLane.items.length, 'child resources');
          // Update lanes with fetched child resources
          setLanes(prevLanes => {
            // Check if EFFECTIVE_ENTITLEMENTS lane exists
            const hasChildLane = prevLanes.some(l => l.laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS);

            if (hasChildLane) {
              // Replace existing lane
              return prevLanes.map(lane =>
                lane.laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS ? childResourcesLane : lane
              );
            } else {
              // Add new lane
              return [...prevLanes, childResourcesLane];
            }
          });
          console.log(`[AccessLens] Fetched ${childResourcesLane.items.length} child resources for Entitlement focus node`);
        } else {
          console.log('[DEBUG:ChildResources] NO child resources returned from API');
        }
      } catch (error) {
        console.error('[DEBUG:ChildResources] ERROR:', error);
        console.warn('[AccessLens] Failed to fetch child resources:', error.message);
        // Reset flag so it can retry on next render
        childResourcesEnrichedRef.current = false;
      }
    };

    fetchChildResources();
  }, [lanes, apiContext, focusNode]);

  // Sync currentAssignments with prop when prop changes (initial load or external update)
  useEffect(() => {
    if (calculatedAssignments && Array.isArray(calculatedAssignments)) {
      setCurrentAssignments(calculatedAssignments);
    }
  }, [calculatedAssignments]);

  // Calculate violation count from currentAssignments for the FocusCard indicator
  // Uses currentAssignments which is updated both from prop and from pivot results
  const violationCount = useMemo(() => {
    if (!currentAssignments || !Array.isArray(currentAssignments)) return 0;
    return extractViolationCount(currentAssignments);
  }, [currentAssignments]);

  // Track previous compliance filter to detect changes
  const prevComplianceFilterRef = useRef(null);

  // Effect to refetch data when compliance filter changes in entitlement-centric view
  useEffect(() => {
    const currentFilter = filters.complianceStatuses;
    const prevFilter = prevComplianceFilterRef.current;

    // Update ref for next comparison
    prevComplianceFilterRef.current = currentFilter;

    // Only refetch if:
    // 1. We're in entitlement-centric view
    // 2. The filter actually changed (not initial mount)
    // 3. We have a pivot callback
    if (
      focusNode?.type === NodeTypes.ENTITLEMENT &&
      onPivotToNode &&
      prevFilter !== null &&  // Not initial mount
      JSON.stringify(prevFilter) !== JSON.stringify(currentFilter)  // Actually changed
    ) {
      if (shouldLog('FILTERS')) {
        console.log('=== Compliance Filter Changed - Refetching ===');
      }

      // Get the first selected compliance status (API takes single value)
      const complianceStatus = currentFilter?.length > 0 ? currentFilter[0] : null;

      setIsLoading(true);

      // Refetch with the new compliance filter
      onPivotToNode(focusNode, { complianceStatus })
        .then(result => {
          if (result) {
            // Don't update focusNode (same entitlement)
            if (result.lanes) setLanes(result.lanes);
            if (result.reasonTypes) setAvailableReasonTypes(result.reasonTypes);
            // Don't update available compliance statuses - keep the original list for selection
          }
        })
        .catch(err => {
          console.error('Error refetching with compliance filter:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [filters.complianceStatuses, focusNode, onPivotToNode]);

  // Handle drag end - update lane position
  // IMPORTANT: Must use the actual rendered position as base, not just lanePositions
  // because lanes may be using dynamicPositions or DEFAULT_LANE_POSITIONS if not yet dragged
  const handleDragEnd = useCallback((event) => {
    const { active, delta } = event;
    const laneType = active.id;
    setActiveDragId(null);

    if (delta.x !== 0 || delta.y !== 0) {
      // Calculate the base position the same way render does
      // Priority: lanePositions > dynamicPositions > DEFAULT_LANE_POSITIONS
      // Use 'lanes' state which is always available (visibleLanes is derived from it)
      const currentLanes = lanes.filter(lane =>
        filters.visibleLanes.includes(lane.laneType) && lane.items && lane.items.length > 0
      );
      const dynamicPositions = calculateDynamicLanePositions(currentLanes);

      let basePosition;
      if (lanePositions[laneType]) {
        basePosition = lanePositions[laneType];
      } else if (dynamicPositions[laneType]) {
        basePosition = dynamicPositions[laneType];
      } else {
        basePosition = DEFAULT_LANE_POSITIONS[laneType] || { x: 0, y: 0 };
      }

      const newPosition = {
        x: basePosition.x + delta.x / zoomLevel,
        y: basePosition.y + delta.y / zoomLevel
      };

      setLanePositions(prev => ({
        ...prev,
        [laneType]: newPosition
      }));
    }
  }, [lanes, filters.visibleLanes, lanePositions, zoomLevel]);

  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
  };

  // Build explanation from item data
  const buildExplanation = useCallback((item) => {
    if (!focusNode || !item) return null;

    return {
      title: `${item.node?.displayName || 'Selected Item'}`,
      summaryText: item.node?.description || null,
      reasons: item.reasons || [],
      facts: [],
      selectedNode: item.node,
      rawData: item.rawData || item.node?.rawData || null
    };
  }, [focusNode]);

  // Handle item selection - fetch full object details from OData and show in Object Inspector
  const handleItemClick = useCallback(async (item, laneType) => {
    if (shouldLog('CLICKS')) {
      console.log('=== handleItemClick ===', item?.node?.displayName, 'laneType:', laneType);
    }

    if (!item || !item.node) {
      return;
    }

    // Set the selected item for visual feedback (used for highlighting)
    setSelectedItem(item);

    // Track selection for cross-lane filtering (schema-driven)
    // When clicking an item in a lane, it becomes the new master filter
    // All other lane selections are cleared so the clicked lane takes control
    const selectionKey = LaneSchema[laneType]?.selectionStateKey;
    if (selectionKey) {
      console.warn(`[AccessLens] Item clicked in ${laneType} lane, item.node.id:`, item.node.id);
      setLaneSelections(prev => {
        // Toggle: if clicking the same item, deselect (clear all)
        if (prev[selectionKey] === item.node.id) return {};
        // Select new item, clearing all other selections
        return { [selectionKey]: item.node.id };
      });
    }

    // Set reason and expand inspector (only if inspector is visible)
    // Read from refs for stable callback identity (H-01 fix)
    setSelectedReasonId(item.reasons?.[0]?.id || null);
    if (showObjectInspectorRef.current && inspectorCollapsedRef.current) {
      setInspectorCollapsed(false);
    }

    // Skip Object Inspector update when it's hidden — selection/filtering still works
    if (!showObjectInspectorRef.current) {
      setExplanationLoading(false);
      return;
    }

    // Show loading state in Object Inspector
    setExplanationLoading(true);

    // Immediately show basic item info while fetching full details
    const basicExplanation = {
      title: item.node?.displayName || 'Loading...',
      summaryText: 'Fetching details from API...',
      selectedNode: item.node,
      reasons: item.reasons || [],
      facts: [],
      rawData: item.rawData || item.node?.rawData || item.node?.metadata || null,
      laneType
    };
    setExplanation(basicExplanation);

    // Fetch full object details from OData if callback is provided
    if (onFetchObjectDetails) {
      try {
        const result = await onFetchObjectDetails(laneType, item);

        if (result?.data) {
          setExplanation({
            title: item.node?.displayName || 'Selected Item',
            summaryText: result.data.Description || result.data.DESCRIPTION || item.node?.description || null,
            selectedNode: item.node,
            reasons: item.reasons || [],
            facts: [],
            rawData: result.data,
            inspectorConfig: result.inspectorConfig,
            objectType: result.objectType,
            laneType: result.laneType
          });
        } else {
          // Update explanation with item data (no API data available)
          setExplanation({
            title: item.node?.displayName || 'Selected Item',
            summaryText: item.node?.description || 'No additional details available from API',
            selectedNode: item.node,
            reasons: item.reasons || [],
            facts: [],
            rawData: item.rawData || item.node?.rawData || item.node?.metadata || null,
            laneType
          });
        }
      } catch (err) {
        // Show item data on error
        setExplanation({
          title: item.node?.displayName || 'Selected Item',
          summaryText: `Error loading details: ${err.message}`,
          selectedNode: item.node,
          reasons: item.reasons || [],
          facts: [],
          rawData: item.rawData || item.node?.rawData || item.node?.metadata || null,
          laneType
        });
      }
    } else {
      // No fetch callback, show item data directly
      setExplanation({
        title: item.node?.displayName || 'Selected Item',
        summaryText: item.node?.description || 'Select an item to view its details',
        selectedNode: item.node,
        reasons: item.reasons || [],
        facts: [],
        rawData: item.rawData || item.node?.rawData || item.node?.metadata || null,
        laneType
      });
    }

    setExplanationLoading(false);
  }, [onFetchObjectDetails]);

  // Handle central node (Identity) click - show all attributes in Object Inspector
  const handleCentralNodeClick = useCallback(() => {
    if (!focusNode) return;

    // Skip if Object Inspector is disabled
    if (!showObjectInspector) {
      return;
    }

    // Clear all lane selections and reason
    setLaneSelections({});
    setSelectedReasonId(null);

    // Build the explanation from the identity data
    // The identity prop contains the full OData response
    const identityData = identity || focusNode.rawData || {};

    // Set the explanation with all identity attributes
    setExplanation({
      title: focusNode.displayName || 'Identity Details',
      summaryText: identityData.DESCRIPTION || null,
      selectedNode: focusNode,
      reasons: [],
      facts: [],
      // Pass all identity data as rawData for the inspector to display
      rawData: identityData
    });

    // Mark this as the selected item (the central node)
    setSelectedItem({
      node: focusNode,
      rawData: identityData
    });

    // Expand the inspector panel if it's collapsed
    if (inspectorCollapsed) {
      setInspectorCollapsed(false);
    }
  }, [focusNode, identity, inspectorCollapsed, showObjectInspector]);

  // Handle reason selection
  const handleReasonClick = useCallback((reason) => {
    setSelectedReasonId(reason.id);
    // Update explanation with the selected reason
    if (selectedItem) {
      const explanation = buildExplanation(selectedItem);
      if (explanation) {
        setExplanation(explanation);
      }
    }
  }, [selectedItem, buildExplanation]);

  // Handle pivot to new focus - change central node to the selected item
  const handlePivot = useCallback(async (node) => {
    if (shouldLog('PIVOT')) {
      console.log('=== Pivot to:', node?.displayName, 'type:', node?.type);
    }

    if (!node) return;

    // Set pending node type IMMEDIATELY so loading placeholders show correct lanes
    setPendingNodeType(node.type);

    // Clear cross-lane filter selections when pivoting
    setLaneSelections({});
    setSelectedItem(null);
    setExplanation(null);

    // Show loading state and reset animation
    setIsLoading(true);
    setLanesLoading(true);
    setLanes([]);
    setPivotLoadingStatus(`Loading ${node.type || 'node'} details...`);

    // If callback is provided, use it to fetch data for the new node
    if (onPivotToNode) {
      try {
        setPivotLoadingStatus(`Fetching access data for ${node.displayName || node.type}...`);
        const pivotResult = await onPivotToNode(node);

        if (pivotResult) {
          setPivotLoadingStatus('Building access relationship graph...');

          // Update focus node with full details if available
          const newFocusNode = pivotResult.focusNode || node;
          setFocusNode(newFocusNode);

          // Clear pending node type now that focusNode is updated
          setPendingNodeType(null);

          // Update history and historyIndex
          setHistory(prev => {
            const existingIndex = prev.findIndex(n => n.id === newFocusNode.id);
            if (existingIndex >= 0) {
              // Node already in history - go back to that position
              setHistoryIndex(existingIndex);
              return prev.slice(0, existingIndex + 1);
            }
            // New node - add to end and update index
            let newHistory = [...prev, newFocusNode];
            // Cap at MAX_HISTORY — drop oldest entries
            if (newHistory.length > MAX_HISTORY) {
              const overflow = newHistory.length - MAX_HISTORY;
              newHistory = newHistory.slice(overflow);
            }
            setHistoryIndex(newHistory.length - 1);
            return newHistory;
          });

          // Set lanes from the pivot result
          if (pivotResult.lanes && pivotResult.lanes.length > 0) {
            setLanes(pivotResult.lanes);
            // Mark lanes loading as complete to trigger reveal animation
            setLanesLoading(false);
          } else {
            // Even with no lanes, mark loading as complete
            setLanesLoading(false);
          }

          // Update available reason types if provided
          if (pivotResult.reasonTypes) {
            setAvailableReasonTypes(pivotResult.reasonTypes);
          }

          // Update available compliance statuses if provided
          if (pivotResult.complianceStatuses) {
            setAvailableComplianceStatuses(pivotResult.complianceStatuses);
          }

          // Update current assignments for violation count (Identity pivots return this)
          if (pivotResult.assignments) {
            setCurrentAssignments(pivotResult.assignments);
          } else if (newFocusNode?.type !== NodeTypes.IDENTITY) {
            // Clear assignments when pivoting to non-Identity (System, etc.) to reset violation count
            setCurrentAssignments(null);
          }

          // Reset lane positions for new node type
          if (newFocusNode?.type !== focusNode?.type) {
            setLanePositions({});
          }
        } else {
          // Fallback: just set the node as focus without new lane data
          loadFocus(node);
        }
      } catch (err) {
        setError(`Failed to pivot to ${node.displayName}: ${err.message}`);
        setPendingNodeType(null);  // Clear pending type on error
      } finally {
        setIsLoading(false);
        setLanesLoading(false);
        setPivotLoadingStatus('');
      }
    } else {
      // No callback, just change the focus node (lanes may be empty)
      setLanesLoading(false);
      loadFocus(node);
    }
  }, [loadFocus, onPivotToNode, focusNode?.type]);

  // Handle breadcrumb navigation - re-fetch data for the selected node
  const handleBreadcrumbNavigate = useCallback(async (node, index) => {
    setHistoryIndex(index);
    setIsLoading(true);
    setPivotLoadingStatus(`Navigating to ${node.displayName || node.type}...`);

    // Re-fetch lanes for the selected node via onPivotToNode
    if (onPivotToNode && node) {
      try {
        const result = await onPivotToNode(node);
        if (result) {
          const newNode = result.focusNode || node;
          setFocusNode(newNode);
          if (result.lanes) setLanes(result.lanes);
          if (result.reasonTypes) setAvailableReasonTypes(result.reasonTypes);
          if (result.complianceStatuses) setAvailableComplianceStatuses(result.complianceStatuses);
          // Update assignments for violation count
          if (result.assignments) {
            setCurrentAssignments(result.assignments);
          } else if (newNode?.type !== NodeTypes.IDENTITY) {
            setCurrentAssignments(null);
          }
        } else {
          // Fallback - just set the focus node
          setFocusNode(node);
        }
      } catch (err) {
        console.error('Error navigating to node:', err);
        setFocusNode(node);
      }
    } else {
      setFocusNode(node);
    }

    setIsLoading(false);
    setPivotLoadingStatus('');
  }, [onPivotToNode]);

  // Navigation: Go back in history
  const handleNavigateBack = useCallback(async () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const prevNode = history[newIndex];
      setHistoryIndex(newIndex);
      setIsLoading(true);
      setPivotLoadingStatus(`Going back to ${prevNode.displayName || prevNode.type}...`);

      // Re-fetch lanes for the previous node via onPivotToNode
      if (onPivotToNode && prevNode) {
        try {
          const result = await onPivotToNode(prevNode);
          if (result) {
            const newNode = result.focusNode || prevNode;
            setFocusNode(newNode);
            if (result.lanes) setLanes(result.lanes);
            if (result.reasonTypes) setAvailableReasonTypes(result.reasonTypes);
            if (result.complianceStatuses) setAvailableComplianceStatuses(result.complianceStatuses);
            // Update assignments for violation count
            if (result.assignments) {
              setCurrentAssignments(result.assignments);
            } else if (newNode?.type !== NodeTypes.IDENTITY) {
              setCurrentAssignments(null);
            }
          }
        } catch (err) {
          console.error('Error navigating back:', err);
          setFocusNode(prevNode);
        }
      } else {
        setFocusNode(prevNode);
      }

      setIsLoading(false);
      setPivotLoadingStatus('');
    }
  }, [historyIndex, history, onPivotToNode]);

  // Navigation: Go forward in history
  const handleNavigateForward = useCallback(async () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextNode = history[newIndex];
      setHistoryIndex(newIndex);
      setIsLoading(true);
      setPivotLoadingStatus(`Going forward to ${nextNode.displayName || nextNode.type}...`);

      // Re-fetch lanes for the next node via onPivotToNode
      if (onPivotToNode && nextNode) {
        try {
          const result = await onPivotToNode(nextNode);
          if (result) {
            const newNode = result.focusNode || nextNode;
            setFocusNode(newNode);
            if (result.lanes) setLanes(result.lanes);
            if (result.reasonTypes) setAvailableReasonTypes(result.reasonTypes);
            if (result.complianceStatuses) setAvailableComplianceStatuses(result.complianceStatuses);
            // Update assignments for violation count
            if (result.assignments) {
              setCurrentAssignments(result.assignments);
            } else if (newNode?.type !== NodeTypes.IDENTITY) {
              setCurrentAssignments(null);
            }
          }
        } catch (err) {
          console.error('Error navigating forward:', err);
          setFocusNode(nextNode);
        }
      } else {
        setFocusNode(nextNode);
      }

      setIsLoading(false);
      setPivotLoadingStatus('');
    }
  }, [historyIndex, history, onPivotToNode]);

  // Check if back/forward navigation is available
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  // Handle removing a breadcrumb from history
  const handleRemoveBreadcrumb = useCallback((indexToRemove) => {
    // Don't allow removing the current item
    if (indexToRemove === historyIndex) {
      return;
    }

    // Create new history array without the removed item
    const newHistory = history.filter((_, index) => index !== indexToRemove);
    setHistory(newHistory);

    // Adjust historyIndex if needed
    if (indexToRemove < historyIndex) {
      // Removed item was before current - shift index back
      setHistoryIndex(historyIndex - 1);
    }
    // If removed item was after current, index stays the same
  }, [history, historyIndex]);

  // Handle load more for a lane
  // TODO: Implement pagination via API when needed
  const handleLoadMore = useCallback(async (laneType) => {
    // Pagination would be implemented here by calling the appropriate API
  }, []);

  // Reset lane positions - recalculate dynamic positions, collapse all lanes, and clear filters
  const handleResetPositions = useCallback(() => {
    // Clear all manually set positions so dynamic positioning takes over
    setLanePositions({});
    // Clear all selection/filter states
    setLaneSelections({});
    // Clear persisted expanded states — all lanes fall back to collapsed default
    setLaneExpandedStates({});
  }, []);

  // Expand all lanes by setting all known lane types to expanded
  const handleExpandAll = useCallback(() => {
    setLaneExpandedStates(prev => {
      const next = { ...prev };
      // Expand all lane types that have data
      lanes.forEach(l => {
        if (filters.visibleLanes.includes(l.laneType)) {
          next[l.laneType] = true;
        }
      });
      return next;
    });
  }, [lanes, filters.visibleLanes, setLaneExpandedStates]);

  // ============================================================================
  // CANVAS CONTEXT MENU
  // Right-click menu for quick access to common actions
  // ============================================================================
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });

  const handleCanvasContextMenu = useCallback((e) => {
    // Only show context menu if clicking on the canvas background, not on lanes or other elements
    if (e.target.closest('.lane-card') || e.target.closest('.fulcrum-wrapper') || e.target.closest('.focus-card')) {
      return; // Don't show context menu when clicking on lanes or focus card
    }
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  }, []);

  const handleContextMenuAction = useCallback((action) => {
    setContextMenu({ visible: false, x: 0, y: 0 });
    switch (action) {
      case 'expandAll':
        handleExpandAll();
        break;
      case 'resetLayout':
        handleResetPositions();
        break;
      case 'toggleInspector':
        setShowObjectInspector(prev => !prev);
        break;
      default:
        break;
    }
  }, [handleExpandAll, handleResetPositions]);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible]);

  // ============================================================================
  // CROSS-LANE FILTERING LOGIC (Memoized for performance)
  // The toolbar filters (Compliance, Reason Types, Entitlement Type) filter the
  // Effective Entitlements lane. Then, Accounts and Systems lanes are filtered
  // to only show items related to the filtered entitlements.
  // ============================================================================

  // Check if any cross-lane filter (lane selection) is active (schema-driven)
  const hasActiveCrossLaneFilter = Object.keys(laneSelections).length > 0;

  // Handler to clear all lane selections (cross-lane filters)
  const handleClearAllSelections = useCallback(() => {
    setLaneSelections({});
    setSelectedItem(null);
    setExplanation(null);
  }, []);

  // Selections object for cross-lane filter service — just use laneSelections directly
  const selections = laneSelections;

  const visibleLanes = useMemo(() => {
    // Early exit — no focus node means no lanes to filter
    if (!focusNode?.type) return [];

    // ============================================================================
    // SCHEMA-DRIVEN FILTERING
    // Uses crossLaneFilterService for generic, configuration-based filtering
    // ============================================================================

      // Additional filters from toolbar
      const additionalFilters = {
        complianceStatuses: filters.complianceStatuses,
        reasonTypes: filters.reasonTypes,
        entitlementType: filters.entitlementType
      };

      // Step 1: Apply cross-lane filters using schema configuration
      // Pass previousVisibleLanesRef.current to preserve filtered state when a lane becomes filter source
      let filteredLanes = applyCrossLaneFilters(
        lanes,
        focusNode.type,
        selections,
        additionalFilters,
        previousVisibleLanesRef.current
      );

      // Step 2: Apply toolbar filters to Entitlements lane (these are independent of cross-lane filtering)
      // IMPORTANT: When a lane is the "filter source" (user selected an item within it),
      // do NOT re-filter that lane to avoid refreshing its contents
      filteredLanes = filteredLanes.map(lane => {
        if (lane.laneType !== LaneTypes.EFFECTIVE_ENTITLEMENTS) return lane;

        // If this lane is the filter source (has a selection),
        // preserve the lane contents to avoid visual refresh
        if (isLaneFilterSource(lane.laneType, selections)) {
          return lane;
        }

        let filteredItems = [...lane.items];
        let isFiltered = lane.isFiltered || false;

        // Apply compliance status filter
        if (filters.complianceStatuses?.length > 0) {
          filteredItems = filteredItems.filter(item =>
            filters.complianceStatuses.includes(item.node.metadata?.complianceStatus)
          );
          isFiltered = true;
        }

        // Apply reason types filter
        if (filters.reasonTypes?.length > 0) {
          filteredItems = filteredItems.filter(item => {
            const reasonArray = item.rawData?.reason;
            const reasons = Array.isArray(reasonArray) ? reasonArray : (reasonArray ? [reasonArray] : []);
            const reasonTypes = reasons.map(r => r?.reasonType).filter(Boolean);
            const uniqueReasonTypes = new Set(reasonTypes);

            // Check if this is an "External" item (only ActualDirect, no other reasons)
            const isExternalOnly = uniqueReasonTypes.size === 1 && uniqueReasonTypes.has('ActualDirect');

            return filters.reasonTypes.some(filterType => {
              // External filter: match items with ONLY ActualDirect
              if (filterType === 'External') {
                return isExternalOnly;
              }
              // Direct filter: match Direct or DirectAssignment, but NOT items with only ActualDirect
              if (filterType === 'Direct') {
                if (isExternalOnly) return false; // Don't match External items with Direct filter
                return uniqueReasonTypes.has('Direct') || uniqueReasonTypes.has('DirectAssignment');
              }
              // Implicit filter: check reason descriptions OR complianceStatus containing "implicit"
              if (filterType === 'Implicit') {
                const complianceStatus = item.node?.metadata?.complianceStatus || item.rawData?.complianceStatus || '';
                return reasons.some(r => r?.description?.toLowerCase()?.includes('implicit')) ||
                       complianceStatus.toLowerCase().includes('implicit');
              }
              // Explicit filter: check reason descriptions OR complianceStatus containing "explicit"
              if (filterType === 'Explicit') {
                const complianceStatus = item.node?.metadata?.complianceStatus || item.rawData?.complianceStatus || '';
                return reasons.some(r => r?.description?.toLowerCase()?.includes('explicit')) ||
                       complianceStatus.toLowerCase().includes('explicit');
              }
              // Direct match on reason type
              return uniqueReasonTypes.has(filterType);
            });
          });
          isFiltered = true;
        }

        // Apply entitlement type filter
        if (filters.entitlementType && filters.entitlementType !== 'all') {
          filteredItems = filteredItems.filter(item => {
            const reasonType = item.rawData?.reason?.reasonType;
            const reasonDesc = item.rawData?.reason?.description?.toLowerCase() || '';
            if (filters.entitlementType === 'direct') {
              return reasonType === 'DirectAssignment' || reasonDesc.includes('direct');
            } else if (filters.entitlementType === 'inherited') {
              return reasonType !== 'DirectAssignment' && !reasonDesc.includes('direct');
            }
            return true;
          });
          isFiltered = true;
        }

        // Apply multi-path filter (show only entitlements with multiple assignment paths)
        if (filters.multiPathOnly) {
          filteredItems = filteredItems.filter(item => {
            const reasonArray = item.rawData?.reason;
            const pathCount = Array.isArray(reasonArray) ? reasonArray.length : (reasonArray ? 1 : 0);
            return pathCount > 1;
          });
          isFiltered = true;
        }

        return {
          ...lane,
          items: filteredItems,
          totalCount: filteredItems.length,
          isFiltered
        };
      });

      // Step 2b: Cascade compliance/toolbar filters to all other lanes
      // When compliance filter is active, other lanes should only show items related to filtered entitlements
      const hasToolbarFilters = filters.complianceStatuses?.length > 0 ||
                                filters.reasonTypes?.length > 0 ||
                                (filters.entitlementType && filters.entitlementType !== 'all') ||
                                filters.multiPathOnly;

      if (hasToolbarFilters) {
        // Get the filtered entitlements lane to extract related IDs
        const filteredEntitlementsLane = filteredLanes.find(l => l.laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS);

        if (filteredEntitlementsLane?.items?.length > 0) {
          // Extract all related IDs from filtered entitlements
          const relatedAccountIds = new Set();
          const relatedSystemIds = new Set();
          const relatedEntitlementIds = new Set(); // For policy filtering by resourceIds
          const relatedLogicalAppIds = new Set();
          const relatedIdentityIds = new Set();

          filteredEntitlementsLane.items.forEach(item => {
            // Extract entitlement ID (resource ID) - used for policy filtering
            const entitlementId = item.node?.id;
            if (entitlementId) relatedEntitlementIds.add(String(entitlementId));

            // Extract account ID
            const accountId = item.rawData?.account?.id || item.node?.metadata?.accountId;
            if (accountId) relatedAccountIds.add(String(accountId));
            // Also extract all account IDs if multiple
            const accountIds = item.node?.metadata?.accountIds || [];
            accountIds.forEach(id => relatedAccountIds.add(String(id)));

            // Extract identity ID (for system-centric or entitlement-centric views)
            const identityId = item.rawData?.identity?.id ||
                               item.node?.metadata?.identityId ||
                               item.rawData?.account?.identity?.id;
            if (identityId) relatedIdentityIds.add(String(identityId));
            // Also extract all identity IDs if multiple
            const identityIds = item.node?.metadata?.identityIds || [];
            identityIds.forEach(id => relatedIdentityIds.add(String(id)));

            // Extract system ID (from both account and resource)
            const accountSystemId = item.rawData?.account?.system?.id;
            const resourceSystemId = item.rawData?.resource?.system?.id ||
                                     item.node?.metadata?.systemId;
            if (accountSystemId) relatedSystemIds.add(String(accountSystemId));
            if (resourceSystemId) relatedSystemIds.add(String(resourceSystemId));

            // Extract logical application ID if the resource's system is a logical app
            const logicalAppId = item.node?.metadata?.logicalApplicationId;
            if (logicalAppId) relatedLogicalAppIds.add(String(logicalAppId));
          });

          // Apply cascaded filter to other lanes
          filteredLanes = filteredLanes.map(lane => {
            // Skip entitlements lane (already filtered)
            if (lane.laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS) return lane;

            // Skip if lane is filter source
            if (isLaneFilterSource(lane.laneType, selections)) return lane;

            let filteredItems = [...lane.items];
            let isFiltered = lane.isFiltered || false;

            switch (lane.laneType) {
              case LaneTypes.IDENTITIES:
                if (relatedIdentityIds.size > 0) {
                  filteredItems = filteredItems.filter(item =>
                    relatedIdentityIds.has(String(item.node?.id))
                  );
                  isFiltered = true;
                }
                break;

              case LaneTypes.ACCOUNTS:
                if (relatedAccountIds.size > 0) {
                  filteredItems = filteredItems.filter(item =>
                    relatedAccountIds.has(String(item.node?.id))
                  );
                  isFiltered = true;
                }
                break;

              case LaneTypes.SYSTEMS:
                if (relatedSystemIds.size > 0) {
                  filteredItems = filteredItems.filter(item =>
                    relatedSystemIds.has(String(item.node?.id))
                  );
                  isFiltered = true;
                }
                break;

              case LaneTypes.ASSIGNMENT_POLICIES:
                // Filter policies by checking if their resourceIds contain any filtered entitlements
                // Policy items store the entitlement IDs they granted in metadata.resourceIds
                if (relatedEntitlementIds.size > 0) {
                  filteredItems = filteredItems.filter(item => {
                    const policyResourceIds = item.node?.metadata?.resourceIds || [];
                    // Check if any of the policy's resourceIds match the filtered entitlements
                    return policyResourceIds.some(rid => relatedEntitlementIds.has(String(rid)));
                  });
                  isFiltered = true;
                }
                break;

              case LaneTypes.LOGICAL_APPLICATIONS:
                if (relatedSystemIds.size > 0 || relatedLogicalAppIds.size > 0) {
                  // Logical apps are matched by their ID or their underlying system IDs
                  filteredItems = filteredItems.filter(item => {
                    const appId = String(item.node?.id);
                    const underlyingSystemIds = item.node?.metadata?.underlyingSystemIds || [];

                    // Check if logical app ID matches
                    if (relatedLogicalAppIds.has(appId)) return true;

                    // Check if any of the entitlement's system IDs match this logical app
                    if (relatedSystemIds.has(appId)) return true;

                    // Check if any underlying system matches
                    return underlyingSystemIds.some(sysId => relatedSystemIds.has(String(sysId)));
                  });
                  isFiltered = true;
                }
                break;

              case LaneTypes.VIOLATIONS:
                // Violations are linked to entitlements - filter based on violation IDs in filtered entitlements
                {
                  const relatedViolationIds = new Set();
                  filteredEntitlementsLane.items.forEach(item => {
                    const violations = item.rawData?.violations || item.node?.metadata?.violations || [];
                    violations.forEach(v => {
                      if (v.id) relatedViolationIds.add(String(v.id));
                    });
                  });
                  if (relatedViolationIds.size > 0) {
                    filteredItems = filteredItems.filter(item =>
                      relatedViolationIds.has(String(item.node?.id))
                    );
                    isFiltered = true;
                  } else {
                    // No violations in filtered entitlements means no violations should show
                    filteredItems = [];
                    isFiltered = true;
                  }
                }
                break;

              case LaneTypes.CONTEXTS:
                // Filter contexts based on which policies grant the filtered entitlements
                // First, get the filtered policies lane to extract context IDs
                {
                  const filteredPoliciesLane = filteredLanes.find(l => l.laneType === LaneTypes.ASSIGNMENT_POLICIES);
                  if (filteredPoliciesLane?.items?.length > 0) {
                    const relatedContextIds = new Set();
                    const relatedContextNames = new Set();

                    // Extract context IDs and names from filtered policies
                    filteredPoliciesLane.items.forEach(policyItem => {
                      const contextIds = policyItem.node?.metadata?.contextIds || policyItem.node?.metadata?.contextUIds || [];
                      const contextNames = policyItem.node?.metadata?.contextNames || [];

                      contextIds.forEach(id => relatedContextIds.add(String(id)));
                      contextNames.forEach(name => relatedContextNames.add(String(name).toLowerCase()));
                    });

                    if (relatedContextIds.size > 0 || relatedContextNames.size > 0) {
                      filteredItems = filteredItems.filter(item => {
                        const contextId = String(item.node?.id || '');
                        const contextUId = String(item.node?.metadata?.uId || '');
                        const contextName = String(item.node?.displayName || item.node?.name || '').toLowerCase();

                        // Match by ID, UId, or name
                        return relatedContextIds.has(contextId) ||
                               relatedContextIds.has(contextUId) ||
                               relatedContextNames.has(contextName);
                      });
                      isFiltered = true;
                    }
                  }
                }
                break;

              default:
                // Other lanes pass through unchanged
                break;
            }

            if (isFiltered) {
              return {
                ...lane,
                items: filteredItems,
                totalCount: filteredItems.length,
                isFiltered: true
              };
            }
            return lane;
          });
        } else if (filteredEntitlementsLane) {
          // Entitlements lane exists but is empty after filtering
          // All other related lanes should also be empty
          filteredLanes = filteredLanes.map(lane => {
            if (lane.laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS) return lane;
            if (isLaneFilterSource(lane.laneType, selections)) return lane;

            // Clear items from lanes that depend on entitlements (schema-driven)
            if (LaneSchema[lane.laneType]?.dependsOnEntitlements) {
              return {
                ...lane,
                items: [],
                totalCount: 0,
                isFiltered: true
              };
            }
            return lane;
          });
        } else {
          // No Entitlements lane (e.g., entitlement-centric view)
          // Filter other lanes by their own complianceStatus metadata
          if (filters.complianceStatuses?.length > 0) {
            filteredLanes = filteredLanes.map(lane => {
              if (isLaneFilterSource(lane.laneType, selections)) return lane;

              // Schema-driven: lanes that support compliance status filtering
              if (LaneSchema[lane.laneType]?.supportsComplianceFiltering) {
                const filteredItems = lane.items.filter(item => {
                  const complianceStatus = item.node?.metadata?.complianceStatus ||
                                           item.rawData?.complianceStatus ||
                                           item.node?.rawData?.complianceStatus;
                  return filters.complianceStatuses.includes(complianceStatus);
                });

                return {
                  ...lane,
                  items: filteredItems,
                  totalCount: filteredItems.length,
                  isFiltered: true
                };
              }
              return lane;
            });
          }
        }
      }

      // Step 3: Filter to visible lanes only and apply required lanes logic
      const result = filterVisibleLanes(
        filteredLanes,
        focusNode.type,
        filters.visibleLanes
      );

      // Store the current filtered state for next render
      // This allows us to preserve the filtered items when a lane becomes filter source
      previousVisibleLanesRef.current = result;

      return result;
  }, [
    lanes,
    selections,
    filters.complianceStatuses,
    filters.reasonTypes,
    filters.entitlementType,
    filters.visibleLanes,
    filters.multiPathOnly,
    focusNode
  ]);

  // Memoized item click handlers per lane type - avoids creating new function refs on each render
  const itemClickHandlers = useMemo(() => {
    const handlers = {};
    if (visibleLanes) {
      visibleLanes.forEach(lane => {
        handlers[lane.laneType] = (item) => handleItemClick(item, lane.laneType);
      });
    }
    return handlers;
  }, [visibleLanes, handleItemClick]);

  // Export current view to CSV - must be defined after visibleLanes
  // Format: Focus node info at top, then grouped by access card with headers
  const handleExportCSV = useCallback(() => {
    if (!focusNode || !visibleLanes || visibleLanes.length === 0) {
      console.warn('[Export] No data to export');
      return;
    }

    // Helper to escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV content
    const rows = [];

    // Focus node info at the start
    const focusName = focusNode.displayName || focusNode.name || 'Unknown';
    const focusType = focusNode.type || 'Unknown';

    rows.push('FOCUS NODE');
    rows.push('Type,Name,ID');
    rows.push([escapeCSV(focusType), escapeCSV(focusName), escapeCSV(focusNode.id || '')].join(','));
    rows.push(''); // Empty line separator

    // Export timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    rows.push(`Export Date,${new Date().toLocaleString()}`);
    rows.push(''); // Empty line separator

    // Iterate through each visible lane (access card) as a separate section
    visibleLanes.forEach(lane => {
      const laneName = lane.title || lane.laneType;
      const items = lane.items || [];
      const itemCount = items.length;
      const totalCount = lane.totalCount || itemCount;
      const isFiltered = lane.isFiltered;

      // Section header for this access card
      rows.push(`=== ${laneName.toUpperCase()} ===`);
      rows.push(`Items: ${itemCount}${isFiltered ? ` (filtered from ${totalCount})` : ''}`);

      if (items.length === 0) {
        rows.push('No items');
        rows.push(''); // Empty line separator
        return;
      }

      // Column headers for this lane's data
      rows.push('Name,Type,ID,System,Compliance Status,Reason Types,Valid From,Valid To,Description');

      // Data rows for each item in this lane
      items.forEach(item => {
        const node = item.node || {};
        const rawData = item.rawData || {};
        const metadata = node.metadata || {};

        // Extract reason types
        const reasons = rawData.reason || [];
        const reasonTypes = Array.isArray(reasons)
          ? reasons.map(r => r?.reasonType).filter(Boolean).join('; ')
          : (reasons?.reasonType || '');

        // Get description
        const description = node.description || metadata.description || rawData.description || '';

        rows.push([
          escapeCSV(node.displayName || node.name),
          escapeCSV(node.type),
          escapeCSV(node.id),
          escapeCSV(metadata.system || metadata.systemId || rawData.system || ''),
          escapeCSV(metadata.complianceStatus || rawData.complianceStatus || ''),
          escapeCSV(reasonTypes),
          escapeCSV(rawData.validFrom || metadata.validFrom || ''),
          escapeCSV(rawData.validTo || metadata.validTo || ''),
          escapeCSV(description)
        ].join(','));
      });

      rows.push(''); // Empty line separator between sections
    });

    // Create and download file
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `access-lens-export-${focusName.replace(/[^a-zA-Z0-9]/g, '_')}-${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [focusNode, visibleLanes]);

  // Get positions for visible lanes only - use dynamic positioning for lanes with data
  // This ensures lanes don't overlap when only some lanes have data
  // Memoized based on which lane types are visible (not the items themselves)
  const dynamicPositions = useMemo(() => {
    return calculateDynamicLanePositions(visibleLanes);
  }, [visibleLanes.map(l => l.laneType).join(',')]);

  // Debug: Log lane positioning (disabled to reduce console noise)
  // console.log('=== Lane Positioning Debug ===');
  // console.log('Visible lanes:', visibleLanes.map(l => `${l.laneType}(${l.items?.length || 0} items)`));
  // console.log('Dynamic positions:', dynamicPositions);

  // Memoize the final position map to avoid recalculating on every render
  const visibleLanePositions = useMemo(() => {
    const positions = {};
    // Calculate offset to shift lanes left when Object Inspector is open (not collapsed)
    // Inspector is 552px wide, so shift lanes ~280px left to keep right-side lanes visible
    const inspectorOffset = (showObjectInspector && !inspectorCollapsed) ? -280 : 0;

    visibleLanes.forEach(lane => {
      let basePosition;
      // If user has manually positioned the lane, use that position
      // Otherwise use the dynamically calculated position
      if (lanePositions[lane.laneType]) {
        basePosition = lanePositions[lane.laneType];
      } else if (dynamicPositions[lane.laneType]) {
        basePosition = dynamicPositions[lane.laneType];
      } else {
        // Fallback to default position
        basePosition = DEFAULT_LANE_POSITIONS[lane.laneType] || { x: 0, y: 0 };
      }

      // Apply inspector offset to x position
      positions[lane.laneType] = {
        ...basePosition,
        x: basePosition.x + inspectorOffset
      };
    });
    return positions;
  }, [visibleLanes, lanePositions, dynamicPositions, showObjectInspector, inspectorCollapsed]);

  // console.log('Final positions used:', visibleLanePositions);

  // Get the selected identity's compliance status (for entitlement-centric view)
  // This is relevant when an Entitlement is the central node and either:
  // 1. An Identity is directly selected, OR
  // 2. An Account is selected (derive the identity from the account)
  const selectedIdentityComplianceStatus = useMemo(() => {
    if (focusNode?.type !== NodeTypes.ENTITLEMENT) {
      return null;
    }

    // Find the identity - either directly selected or derived from selected account
    const identitiesLane = lanes.find(l => l.laneType === LaneTypes.IDENTITIES);
    if (!identitiesLane) return null;

    let selectedIdentity = null;

    // Case 1: Identity is directly selected
    if (laneSelections.identityId) {
      selectedIdentity = identitiesLane.items?.find(
        item => String(item.node.id) === String(laneSelections.identityId)
      );
    }
    // Case 2: Account is selected - derive the identity from the account
    else if (laneSelections.accountId) {
      const accountsLane = lanes.find(l => l.laneType === LaneTypes.ACCOUNTS);
      const selectedAccount = accountsLane?.items?.find(
        item => String(item.node.id) === String(laneSelections.accountId)
      );

      if (selectedAccount) {
        // Get the identity ID from the account
        const accountIdentityId = selectedAccount.node.metadata?.identityId ||
                                  selectedAccount.rawData?.identity?.id ||
                                  selectedAccount.node.rawData?.identity?.id;

        if (accountIdentityId) {
          selectedIdentity = identitiesLane.items?.find(
            item => String(item.node.id) === String(accountIdentityId)
          );
        }
      }
    }

    if (!selectedIdentity) return null;

    // Get the compliance status from the identity's metadata or rawData
    const complianceStatus = selectedIdentity.node.metadata?.complianceStatus ||
                             selectedIdentity.rawData?.complianceStatus;

    return {
      identityName: selectedIdentity.node.displayName,
      complianceStatus: complianceStatus
    };
  }, [laneSelections, focusNode?.type, lanes]);

  // Render loading state
  if (isLoading && !focusNode) {
    return (
      <div className={`access-lens theme-${currentTheme} ${isFullscreen ? 'fullscreen' : ''}`} style={colorPaletteStyle}>
        <div className="access-lens-loading">
          <div className="loading-spinner"></div>
          <p>Loading access graph...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`access-lens theme-${currentTheme} ${isFullscreen ? 'fullscreen' : ''}`} style={colorPaletteStyle}>
        <div className="access-lens-error">
          <span className="error-icon">⚠️</span>
          <p>Error: {error}</p>
          {identity && (
            <button onClick={() => loadFocus(identityToNode(identity))}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`access-lens theme-${currentTheme} ${isFullscreen ? 'fullscreen' : ''}`} style={colorPaletteStyle}>
      {/* Unified Toolbar */}
      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        availableReasonTypes={availableReasonTypes}
        availableComplianceStatuses={availableComplianceStatuses}
        showObjectInspector={showObjectInspector}
        onToggleObjectInspector={() => setShowObjectInspector(!showObjectInspector)}
        hasActiveCrossLaneFilter={hasActiveCrossLaneFilter}
        onClearAllSelections={handleClearAllSelections}
        onExpandAll={handleExpandAll}
        onResetLayout={handleResetPositions}
        onExportCSV={handleExportCSV}
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
        focusNodeType={focusNode?.type}
      />

      {/* Breadcrumb Bar — dedicated row beneath filters, left-aligned */}
      {history.length > 0 && (
        <div className="breadcrumb-bar">
          <Breadcrumbs
            history={history}
            currentIndex={historyIndex}
            onNavigate={handleBreadcrumbNavigate}
            onRemove={handleRemoveBreadcrumb}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="access-lens-content">
        {/* Scrollable canvas area — scrolls independently so Object Inspector stays pinned right */}
        <div className="canvas-scroll-container" ref={scrollContainerRef}>
          {/* Pivot Loading Overlay - shows when changing central node */}
          {isLoading && focusNode && (
            <div className="pivot-loading-overlay">
              <div className="pivot-loading-spinner"></div>
              <h3 className="pivot-loading-title">Updating Identity360</h3>
              <p className="pivot-loading-status">{pivotLoadingStatus || 'Loading...'}</p>
            </div>
          )}

          {/* Scaled canvas wrapper — sets the scrollable footprint to match zoomed size */}
          <div style={{ minWidth: `${2400 * zoomLevel}px`, minHeight: `${1600 * zoomLevel}px` }}>
          {/* Canvas with draggable lanes */}
          <div
            className="access-lens-canvas"
            onContextMenu={handleCanvasContextMenu}
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: '50% 40%'
            }}
          >
          {/* Context Menu */}
          {contextMenu.visible && (
            <div
              className="canvas-context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="context-menu-item" onClick={() => handleContextMenuAction('expandAll')}>
                <span className="context-menu-icon">⬇️</span>
                Expand All Cards
              </button>
              <button className="context-menu-item" onClick={() => handleContextMenuAction('resetLayout')}>
                <span className="context-menu-icon">🔄</span>
                Reset Layout
              </button>
              <div className="context-menu-divider"></div>
              <button className="context-menu-item" onClick={() => handleContextMenuAction('toggleInspector')}>
                <span className="context-menu-icon">{showObjectInspector ? '👁️' : '👁️‍🗨️'}</span>
                {showObjectInspector ? 'Hide Object Inspector' : 'Show Object Inspector'}
              </button>
            </div>
          )}
          {/* Connector Lines SVG - only show for revealed lanes */}
          {/* C-02 fix: Pass laneRefs to avoid querySelector and enable batched DOM reads */}
          <ConnectorLines
            lanePositions={Object.fromEntries(
              Object.entries(visibleLanePositions).filter(([laneType]) => revealedLanes.has(laneType))
            )}
            fulcrumRef={fulcrumRef}
            isDragging={activeDragId !== null}
            laneRefs={laneRefsMap.current}
            zoomLevel={zoomLevel}
          />

          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Center - Focus Card (Fulcrum) - rendered FIRST so lanes paint on top when dragged */}
            <div
              className={`fulcrum-wrapper ${centralNodeRevealed ? 'revealed' : 'hidden'}`}
              ref={fulcrumRef}
              onClick={handleCentralNodeClick}
              style={{ cursor: 'pointer', zIndex: activeDragId ? 1 : 10 }}
              title="Click to inspect identity details"
            >
              <FocusCard
                node={focusNode}
                isLoading={isLoading || lanesLoading}
                onNavigateBack={() => history.length > 1 && handleBreadcrumbNavigate(history[history.length - 2], history.length - 2)}
                selectedIdentityCompliance={selectedIdentityComplianceStatus}
                violationCount={violationCount}
                isMinimized={focusCardMinimized}
                onToggleMinimize={(e) => { e.stopPropagation(); setFocusCardMinimized(prev => !prev); }}
              />
            </div>

            {/* Loading Placeholders - shown while lanes are being loaded or waiting for data */}
            {/* Uses pendingNodeType during pivot, otherwise focusNode.type */}
            {(lanesLoading || (!calculatedAssignments && lanes.length === 0)) && visibleLanes.length === 0 &&
              getLoadingPlaceholderLanes(pendingNodeType || focusNode?.type).map((laneType) => {
                const position = getDefaultPositionForLane(laneType);
                return (
                  <LoadingLanePlaceholder
                    key={`loading-${laneType}`}
                    laneType={laneType}
                    position={position}
                  />
                );
              })
            }

            {/* Draggable Lanes - rendered AFTER fulcrum so they paint on top when dragged over it */}
            {visibleLanes
              .filter(lane => revealedLanes.has(lane.laneType))
              .map((lane) => (
              <DraggableLane
                key={lane.laneType}
                id={lane.laneType}
                position={visibleLanePositions[lane.laneType] || { x: 0, y: 0 }}
                onRefChange={handleLaneRefChange}
              >
                <LaneCard
                  lane={lane}
                  focusNodeType={focusNode?.type}
                  selectedItemId={selectedItem?.node?.id}
                  selectedReasonId={selectedReasonId}
                  onItemClick={itemClickHandlers[lane.laneType]}
                  onPivot={handlePivot}
                  onReasonClick={handleReasonClick}
                  onLoadMore={handleLoadMore}
                  viewMode={viewMode}
                  isFilterActive={getSelectionForLane(lane.laneType, laneSelections) !== null || lane.isFiltered}
                  activeFilterId={getSelectionForLane(lane.laneType, laneSelections)}
                  isFilterSource={getSelectionForLane(lane.laneType, laneSelections) !== null}
                  isFiltered={lane.isFiltered && getSelectionForLane(lane.laneType, laneSelections) === null}
                  parentExpanded={laneExpandedStates[lane.laneType] ?? !lanesForceCollapsed}
                  onExpandedChange={handleLaneExpandedChange}
                />
              </DraggableLane>
            ))}
          </DndContext>
        </div>
        </div>{/* end scaled canvas wrapper */}

          {/* Floating Zoom Controls — sticky to bottom-left of scroll container */}
          <div className="zoom-controls">
            <button
              className="zoom-btn"
              onClick={() => setZoomLevel(prev => Math.max(MIN_ZOOM, Math.round((prev - ZOOM_STEP) * 10) / 10))}
              disabled={zoomLevel <= MIN_ZOOM}
              title="Zoom out (Ctrl+Scroll down)"
            >−</button>
            <button
              className="zoom-label"
              onClick={() => setZoomLevel(1)}
              title="Reset to 100%"
            >{Math.round(zoomLevel * 100)}%</button>
            <button
              className="zoom-btn"
              onClick={() => setZoomLevel(prev => Math.min(MAX_ZOOM, Math.round((prev + ZOOM_STEP) * 10) / 10))}
              disabled={zoomLevel >= MAX_ZOOM}
              title="Zoom in (Ctrl+Scroll up)"
            >+</button>
          </div>
        </div>{/* end canvas-scroll-container */}

        {/* Object Inspector Panel - only render when enabled */}
        {showObjectInspector && (
          <div className={`access-lens-explanation ${inspectorCollapsed ? 'collapsed' : ''}`}>
            <ObjectInspector
              explanation={explanation}
              selectedReasonId={selectedReasonId}
              onReasonSelect={setSelectedReasonId}
              onClose={() => {
                setSelectedItem(null);
                setExplanation(null);
              }}
              isLoading={explanationLoading}
              isCollapsed={inspectorCollapsed}
              onToggleCollapse={() => setInspectorCollapsed(!inspectorCollapsed)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AccessLens;
