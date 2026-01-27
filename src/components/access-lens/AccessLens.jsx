/**
 * AccessLens Component
 * Main container for the IGA access graph exploration widget
 * Features: Identity integration, draggable lanes, connector lines
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import accessLensDataService, { buildContextsLane, buildLanesFromAssignments, extractUniqueReasonTypes, extractUniqueComplianceStatuses, extractViolationCount, enrichPoliciesWithOData } from './accessLensDataService';
import { usePreferences } from '../../contexts/PreferencesContext';
import {
  applyCrossLaneFilters,
  filterVisibleLanes,
  isLaneFiltered,
  isLaneFilterSource
} from './crossLaneFilterService';

// Feature flag to enable schema-driven cross-lane filtering
// Set to true to use the new crossLaneFilterService, false for legacy behavior
const USE_SCHEMA_DRIVEN_FILTERING = true;  // Enabled for CASCADED_THROUGH policy filtering
import FilterBar from './FilterBar';
import Breadcrumbs from './Breadcrumbs';
import FocusCard from './FocusCard';
import LaneCard from './LaneCard';
import ObjectInspector from './ObjectInspector';
import { getStringValue } from './accessLensUtils';
import './AccessLens.css';

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

// Draggable Lane Wrapper Component
// IMPORTANT: Drag listeners are only applied to the drag handle (header area),
// NOT the entire container, so clicks on lane items can pass through
const DraggableLane = ({ id, position, children, onPositionChange }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
  });

  // Calculate the total transform including:
  // 1. Centering offset (-50%, -50%) to center the lane on its position point
  // 2. Drag offset from dnd-kit during active drag
  const dragX = transform?.x || 0;
  const dragY = transform?.y || 0;

  // Use GPU-accelerated transforms for smooth dragging
  // IMPORTANT: Must include translate(-50%, -50%) for centering AND drag offset together
  const style = {
    position: 'absolute',
    left: `calc(50% + ${position.x}px)`,
    top: `calc(${CANVAS_CENTER_Y} + ${position.y}px)`,
    // Combine centering transform with drag offset using translate3d for GPU acceleration
    // The -50%, -50% centers the element on its anchor point
    // The dragX, dragY adds the drag offset during active dragging
    transform: `translate3d(calc(-50% + ${dragX}px), calc(-50% + ${dragY}px), 0)`,
    zIndex: isDragging ? 100 : 1,
    // GPU hints for smoother animation
    willChange: isDragging ? 'transform' : 'auto',
    // Disable pointer events during drag for performance
    pointerEvents: isDragging ? 'none' : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`draggable-lane ${isDragging ? 'dragging' : ''}`}
      data-lane-type={id}
      {...attributes}
    >
      {/* Drag handle overlay - covers left portion of header for dragging */}
      {/* Right side (buttons area) is left uncovered so buttons receive clicks */}
      <div
        className="drag-handle-overlay"
        {...listeners}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: '140px', // Leave space for header buttons (toggle, maximize, grid controls)
          height: '40px', // Height of the lane header
          cursor: isDragging ? 'grabbing' : 'grab',
          zIndex: 10,
          pointerEvents: 'auto',
        }}
      />
      {children}
    </div>
  );
};

// SVG Connector Lines Component - Curved flowing tentacle-like lines
const ConnectorLines = ({ lanePositions, fulcrumRef, isDragging = false }) => {
  const [lines, setLines] = useState([]);

  useEffect(() => {
    const updateLines = () => {
      if (!fulcrumRef.current) return;

      const fulcrumRect = fulcrumRef.current.getBoundingClientRect();
      const containerRect = fulcrumRef.current.parentElement?.getBoundingClientRect();

      if (!containerRect) return;

      const fulcrumCenter = {
        x: fulcrumRect.left - containerRect.left + fulcrumRect.width / 2,
        y: fulcrumRect.top - containerRect.top + fulcrumRect.height / 2
      };

      const newLines = Object.entries(lanePositions).map(([laneType, pos]) => {
        // Find the actual lane element by data attribute
        const targetLane = document.querySelector(`[data-lane-type="${laneType}"]`);

        let laneX, laneY;

        if (targetLane) {
          // Use actual lane position and dimensions
          const laneRect = targetLane.getBoundingClientRect();
          laneX = laneRect.left - containerRect.left + laneRect.width / 2;
          laneY = laneRect.top - containerRect.top + laneRect.height / 2;
        } else {
          // Fallback to calculated position with default dimensions
          laneX = containerRect.width / 2 + pos.x + 140;
          laneY = containerRect.height / 2 + pos.y + 80;
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

    updateLines();
    window.addEventListener('resize', updateLines);

    // Use requestAnimationFrame for smooth updates during drag
    // Otherwise use a longer interval for normal state
    let rafId = null;
    let intervalId = null;

    if (isDragging) {
      // During drag, use requestAnimationFrame for smooth 60fps updates
      const animate = () => {
        updateLines();
        rafId = requestAnimationFrame(animate);
      };
      rafId = requestAnimationFrame(animate);
    } else {
      // When not dragging, update less frequently
      intervalId = setInterval(updateLines, 200);
    }

    return () => {
      window.removeEventListener('resize', updateLines);
      if (rafId) cancelAnimationFrame(rafId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [lanePositions, fulcrumRef, isDragging]);

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
  const { preferences } = usePreferences();
  const lanesCollapsedOnLoad = preferences.identity360LanesCollapsedOnLoad ?? true;
  const collapseLanesOnFocusChange = preferences.identity360CollapseLanesOnFocusChange ?? true;

  // Refs
  const fulcrumRef = useRef(null);
  const previousFocusNodeId = useRef(null);  // Track focus node changes
  const previousVisibleLanesRef = useRef([]);  // Store previous visibleLanes to preserve filtered state when lane becomes filter source

  // State
  const [focusNode, setFocusNode] = useState(null);
  const [lanes, setLanes] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);  // Current position in history (-1 means no history yet)
  const [isLoading, setIsLoading] = useState(false);  // Data is pre-loaded by AccessLensPage
  const [lanesLoading, setLanesLoading] = useState(true);  // Track when lanes are being built from data
  const [pivotLoadingStatus, setPivotLoadingStatus] = useState('');  // Loading status message during pivot
  const [error, setError] = useState(null);

  // Animation state for staggered lane reveal
  const [centralNodeRevealed, setCentralNodeRevealed] = useState(false);
  const [revealedLanes, setRevealedLanes] = useState(new Set());

  // Lane positions state (for drag and drop)
  const [lanePositions, setLanePositions] = useState({});
  const [activeDragId, setActiveDragId] = useState(null);
  const [lanesForceCollapsed, setLanesForceCollapsed] = useState(lanesCollapsedOnLoad); // Starts collapsed based on user preference
  const [lanesForceExpanded, setLanesForceExpanded] = useState(false); // Used to expand all lanes

  // Configure drag sensors for smoother experience
  // PointerSensor with activation constraint prevents accidental drags
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // Minimum drag distance before activation
    },
  });
  const sensors = useSensors(pointerSensor);

  // Selection state
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedReasonId, setSelectedReasonId] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [explanationLoading, setExplanationLoading] = useState(false);

  // Inspector panel state
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [showObjectInspector, setShowObjectInspector] = useState(false); // Hidden by default on first load

  // Cross-lane filtering state
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  const [selectedLogicalAppId, setSelectedLogicalAppId] = useState(null);  // For filtering by logical application
  const [selectedIdentityId, setSelectedIdentityId] = useState(null);  // For entitlement-centric view: filter accounts by identity
  const [selectedPolicyId, setSelectedPolicyId] = useState(null);  // For filtering entitlements by assignment policy
  const [selectedEntitlementId, setSelectedEntitlementId] = useState(null);  // For filtering identities/accounts by entitlement (System-centric view)
  const [selectedViolationId, setSelectedViolationId] = useState(null);  // For filtering by violation
  const [pendingNodeType, setPendingNodeType] = useState(null);  // Track target node type during pivot for correct loading placeholders
  const [currentAssignments, setCurrentAssignments] = useState(null);  // Track current assignments for violation count (updated on pivot)

  // Filter state
  const [viewMode, setViewMode] = useState(ViewModes.EXPLORE);
  const [filters, setFilters] = useState({
    visibleLanes: [
      LaneTypes.ROLES,
      LaneTypes.ACCOUNTS,
      LaneTypes.EFFECTIVE_ENTITLEMENTS,
      LaneTypes.POLICIES,
      LaneTypes.ASSIGNMENT_POLICIES,  // Policies extracted from assignment reasons
      LaneTypes.SYSTEMS,
      LaneTypes.LOGICAL_APPLICATIONS,  // Logical applications lane (systems with resources but no direct accounts)
      LaneTypes.CONTEXTS,
      LaneTypes.IDENTITIES,  // For system-centric view
      LaneTypes.VIOLATIONS   // Violations lane (shows when identity has violations)
    ],
    reasonTypes: [],
    complianceStatuses: [],  // Selected compliance statuses for filtering
    entitlementType: 'all',
    multiPathOnly: false,  // Filter to show only entitlements with multiple assignment paths
    highRiskOnly: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [availableReasonTypes, setAvailableReasonTypes] = useState([]);
  const [availableComplianceStatuses, setAvailableComplianceStatuses] = useState([]);

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
        setLanesForceCollapsed(true);
        // Reset the flag after a brief delay so lanes can be expanded again by user
        setTimeout(() => setLanesForceCollapsed(false), 100);
      }
    }

    // Update the ref to track the current focus node
    previousFocusNodeId.current = focusNode.id;
  }, [focusNode?.id, collapseLanesOnFocusChange]);

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
          const newHistory = [...prev.slice(0, historyIndex + 1), finalFocusNode];
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

  // Enrich Assignment Policies lane with OData details (AP_CONTEXTS for cross-lane filtering)
  // This runs after lanes are built and we have apiContext
  useEffect(() => {
    const enrichPolicies = async () => {
      if (!apiContext || !lanes || lanes.length === 0) return;

      const policiesLane = lanes.find(l => l.laneType === LaneTypes.ASSIGNMENT_POLICIES);
      if (!policiesLane || policiesLane.items.length === 0) return;

      // Check if already enriched (has contextUIds on first item)
      if (policiesLane.items[0]?.node?.metadata?.contextUIds) {
        return; // Already enriched
      }

      if (shouldLog('POLICIES')) {
        console.log('[AccessLens] Enriching assignment policies with OData details (AP_CONTEXTS)');
      }

      try {
        const enrichedLane = await enrichPoliciesWithOData(policiesLane, apiContext);

        // Update lanes with enriched policy data
        setLanes(prevLanes => {
          return prevLanes.map(lane =>
            lane.laneType === LaneTypes.ASSIGNMENT_POLICIES ? enrichedLane : lane
          );
        });

        if (shouldLog('POLICIES')) {
          console.log('[AccessLens] Policy enrichment complete');
        }
      } catch (error) {
        console.warn('[AccessLens] Failed to enrich policies with OData:', error.message);
      }
    };

    enrichPolicies();
  }, [lanes, apiContext]);

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
        x: basePosition.x + delta.x,
        y: basePosition.y + delta.y
      };

      setLanePositions(prev => ({
        ...prev,
        [laneType]: newPosition
      }));
    }
  }, [lanes, filters.visibleLanes, lanePositions]);

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

    // Track selection for cross-lane filtering
    // When clicking an item in a lane, it becomes the new master filter
    // All other lane selections are cleared so the clicked lane takes control

    // Map lane types to their selection setters
    const selectionSetters = {
      [LaneTypes.ACCOUNTS]: { setter: setSelectedAccountId, current: selectedAccountId },
      [LaneTypes.SYSTEMS]: { setter: setSelectedSystemId, current: selectedSystemId },
      [LaneTypes.LOGICAL_APPLICATIONS]: { setter: setSelectedLogicalAppId, current: selectedLogicalAppId },
      [LaneTypes.IDENTITIES]: { setter: setSelectedIdentityId, current: selectedIdentityId },
      [LaneTypes.ASSIGNMENT_POLICIES]: { setter: setSelectedPolicyId, current: selectedPolicyId },
      [LaneTypes.EFFECTIVE_ENTITLEMENTS]: { setter: setSelectedEntitlementId, current: selectedEntitlementId },
      [LaneTypes.VIOLATIONS]: { setter: setSelectedViolationId, current: selectedViolationId }
    };

    // Clear ALL other lane selections - the clicked lane becomes the master filter
    Object.entries(selectionSetters).forEach(([lane, { setter }]) => {
      if (lane !== laneType) {
        setter(null);
      }
    });

    // Set the selection for the clicked lane (toggle if clicking same item)
    if (selectionSetters[laneType]) {
      selectionSetters[laneType].setter(prev => prev === item.node.id ? null : item.node.id);
    }

    // Auto-show Object Inspector when an item is clicked
    if (!showObjectInspector) {
      setShowObjectInspector(true);
    }

    // Set reason and expand inspector
    setSelectedReasonId(item.reasons?.[0]?.id || null);
    if (inspectorCollapsed) {
      setInspectorCollapsed(false);
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
  }, [showObjectInspector, inspectorCollapsed, onFetchObjectDetails, focusNode?.type, selectedAccountId, selectedSystemId, selectedLogicalAppId, selectedIdentityId, selectedPolicyId, selectedEntitlementId]);

  // Handle central node (Identity) click - show all attributes in Object Inspector
  const handleCentralNodeClick = useCallback(() => {
    if (!focusNode) return;

    // Skip if Object Inspector is disabled
    if (!showObjectInspector) {
      return;
    }

    // Clear any lane item selection
    setSelectedAccountId(null);
    setSelectedSystemId(null);
    setSelectedLogicalAppId(null);
    setSelectedPolicyId(null);
    setSelectedEntitlementId(null);
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
    setSelectedAccountId(null);
    setSelectedSystemId(null);
    setSelectedLogicalAppId(null);
    setSelectedIdentityId(null);
    setSelectedPolicyId(null);
    setSelectedEntitlementId(null);
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
            const newHistory = [...prev, newFocusNode];
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
  const handleResetPositions = () => {
    // Clear all manually set positions so dynamic positioning takes over
    setLanePositions({});
    // Clear all selection/filter states
    setSelectedAccountId(null);
    setSelectedSystemId(null);
    setSelectedLogicalAppId(null);
    setSelectedIdentityId(null);
    setSelectedPolicyId(null);
    setSelectedEntitlementId(null);
    // Collapse all lanes
    setLanesForceCollapsed(true);
    // Reset the forceCollapsed flag after a brief delay so lanes can be expanded again
    setTimeout(() => setLanesForceCollapsed(false), 100);
  };

  // Expand all lanes
  const handleExpandAll = () => {
    // Trigger expansion of all lanes
    setLanesForceExpanded(true);
    // Reset the forceExpanded flag after a brief delay
    setTimeout(() => setLanesForceExpanded(false), 100);
  };

  // ============================================================================
  // CROSS-LANE FILTERING LOGIC (Memoized for performance)
  // The toolbar filters (Compliance, Reason Types, Entitlement Type) filter the
  // Effective Entitlements lane. Then, Accounts and Systems lanes are filtered
  // to only show items related to the filtered entitlements.
  // ============================================================================

  // Check if any cross-lane filter (lane selection) is active
  const hasActiveCrossLaneFilter = Boolean(
    selectedAccountId ||
    selectedSystemId ||
    selectedLogicalAppId ||
    selectedIdentityId ||
    selectedPolicyId ||
    selectedEntitlementId ||
    selectedViolationId
  );

  // Handler to clear all lane selections (cross-lane filters)
  const handleClearAllSelections = useCallback(() => {
    setSelectedAccountId(null);
    setSelectedSystemId(null);
    setSelectedLogicalAppId(null);
    setSelectedIdentityId(null);
    setSelectedPolicyId(null);
    setSelectedEntitlementId(null);
    setSelectedViolationId(null);
    setSelectedItem(null);
    setExplanation(null);
  }, []);

  const visibleLanes = useMemo(() => {
    // ============================================================================
    // SCHEMA-DRIVEN FILTERING PATH (when USE_SCHEMA_DRIVEN_FILTERING is enabled)
    // Uses crossLaneFilterService for generic, configuration-based filtering
    // ============================================================================
    if (USE_SCHEMA_DRIVEN_FILTERING && focusNode?.type) {

      // Build selections object from current state
      const selections = {
        identityId: selectedIdentityId,
        accountId: selectedAccountId,
        systemId: selectedSystemId,
        logicalAppId: selectedLogicalAppId,
        policyId: selectedPolicyId,
        entitlementId: selectedEntitlementId,
        violationId: selectedViolationId
      };

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
          console.log('[DEBUG] Compliance filter active:', filters.complianceStatuses);
          console.log('[DEBUG] Items before filter:', filteredItems.length);
          console.log('[DEBUG] Sample item complianceStatus:', filteredItems[0]?.node?.metadata?.complianceStatus);
          filteredItems = filteredItems.filter(item =>
            filters.complianceStatuses.includes(item.node.metadata?.complianceStatus)
          );
          console.log('[DEBUG] Items after filter:', filteredItems.length);
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
              // Other filters
              if (filterType === 'Implicit') {
                return reasons.some(r => r?.description?.toLowerCase()?.includes('implicit'));
              }
              if (filterType === 'Explicit') {
                return reasons.some(r => r?.description?.toLowerCase()?.includes('explicit'));
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

            // Clear items from lanes that depend on entitlements
            if ([LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS, LaneTypes.SYSTEMS, LaneTypes.ASSIGNMENT_POLICIES,
                 LaneTypes.LOGICAL_APPLICATIONS, LaneTypes.VIOLATIONS].includes(lane.laneType)) {
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

              // These lanes may have complianceStatus in their metadata (from assignments)
              if ([LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS].includes(lane.laneType)) {
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
    }

    // ============================================================================
    // LEGACY FILTERING PATH (original hardcoded logic)
    // ============================================================================

    // Step 1: Get the Effective Entitlements lane and apply all toolbar filters
    // NOTE: In entitlement-centric view (focusNode.type === ENTITLEMENT), there is no Entitlements lane
    // so isEntitlementsFiltered should remain false to prevent cross-lane filtering from empty data
    const entitlementsLane = lanes.find(l => l.laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS);
    const hasEntitlementsLane = entitlementsLane && entitlementsLane.items && entitlementsLane.items.length > 0;
    let filteredEntitlementItems = entitlementsLane?.items ? [...entitlementsLane.items] : [];
    let isEntitlementsFiltered = false;

  // Apply compliance status filter (only if we have an entitlements lane - not in entitlement-centric view)
  if (filters.complianceStatuses && filters.complianceStatuses.length > 0 && hasEntitlementsLane) {
    filteredEntitlementItems = filteredEntitlementItems.filter(item =>
      filters.complianceStatuses.includes(item.node.metadata?.complianceStatus)
    );
    isEntitlementsFiltered = true;
  }

  // Apply reason types filter
  if (filters.reasonTypes && filters.reasonTypes.length > 0) {
    filteredEntitlementItems = filteredEntitlementItems.filter(item => {
      // Check the reason in rawData
      const reasonType = item.rawData?.reason?.reasonType;
      const reasonDesc = item.rawData?.reason?.description?.toLowerCase() || '';

      // Match against selected reason types
      return filters.reasonTypes.some(filterType => {
        // Direct match on reasonType
        if (reasonType === filterType) return true;

        // Match based on description keywords for base types
        if (filterType === 'Direct' && (reasonType === 'DirectAssignment' || reasonDesc.includes('direct'))) return true;
        if (filterType === 'Implicit' && reasonDesc.includes('implicit')) return true;
        if (filterType === 'Explicit' && reasonDesc.includes('explicit')) return true;

        return false;
      });
    });
    if (hasEntitlementsLane) isEntitlementsFiltered = true;
  }

  // Apply entitlement type filter (direct vs inherited) - only if we have an entitlements lane
  if (filters.entitlementType && filters.entitlementType !== 'all' && hasEntitlementsLane) {
    filteredEntitlementItems = filteredEntitlementItems.filter(item => {
      const reasonType = item.rawData?.reason?.reasonType;
      const reasonDesc = item.rawData?.reason?.description?.toLowerCase() || '';

      if (filters.entitlementType === 'direct') {
        // Direct entitlements: DirectAssignment or reason contains 'direct'
        return reasonType === 'DirectAssignment' || reasonDesc.includes('direct');
      } else if (filters.entitlementType === 'inherited') {
        // Inherited: anything that's not direct (role membership, birthright, policy, etc.)
        return reasonType !== 'DirectAssignment' && !reasonDesc.includes('direct');
      }
      return true;
    });
    isEntitlementsFiltered = true;
  }

  // Apply multi-path filter (show only entitlements with multiple assignment paths)
  if (filters.multiPathOnly && hasEntitlementsLane) {
    filteredEntitlementItems = filteredEntitlementItems.filter(item => {
      const reasonArray = item.rawData?.reason;
      const pathCount = Array.isArray(reasonArray) ? reasonArray.length : (reasonArray ? 1 : 0);
      return pathCount > 1;
    });
    isEntitlementsFiltered = true;
  }

  // Variables to store selected account's system info for cross-lane filtering (Systems and Logical Apps)
  let selectedAccountSystemName = null;
  let selectedAccountSystemId = null;

  // Apply selected account filter (when user clicks an account in the Accounts lane)
  if (selectedAccountId) {
    const selectedAccountIdStr = String(selectedAccountId);
    const accountItem = lanes
      .find(l => l.laneType === LaneTypes.ACCOUNTS)?.items
      .find(item => String(item.node.id) === selectedAccountIdStr);
    const accountNode = accountItem?.node;

    if (accountNode) {
      const accountSystem = accountNode.metadata?.system;
      const accountSystemId = accountNode.metadata?.systemId;
      const accountName = accountNode.displayName;

      // Store for cross-lane filtering of Systems and Logical Apps
      selectedAccountSystemName = accountSystem;
      selectedAccountSystemId = accountSystemId ? String(accountSystemId) : null;

      // Filter entitlements that belong to this account
      // Use the same pattern as system filtering - check metadata first, then rawData
      filteredEntitlementItems = filteredEntitlementItems.filter(item => {
        // Get account info from metadata (primary) or rawData (fallback)
        const entitlementAccountName = item.node.metadata?.accountName ||
                                       item.rawData?.account?.accountName;
        const entitlementAccountId = item.node.metadata?.accountId ||
                                     item.rawData?.account?.id;

        // Use string comparison for IDs
        const entitlementAccountIdStr = entitlementAccountId ? String(entitlementAccountId) : null;

        const idMatch = entitlementAccountIdStr === selectedAccountIdStr;
        const nameMatch = accountName && entitlementAccountName === accountName;
        return idMatch || nameMatch;
      });
    }
    if (hasEntitlementsLane) isEntitlementsFiltered = true;
  }

  // Apply selected identity filter for entitlements (System-centric view)
  // When user clicks an identity in the Identities lane, filter entitlements to show only their access
  if (selectedIdentityId && focusNode?.type === NodeTypes.SYSTEM && hasEntitlementsLane) {
    const selectedIdentityIdStr = String(selectedIdentityId);

    filteredEntitlementItems = filteredEntitlementItems.filter(item => {
      // Get identity info from metadata (set in buildEntitlementsLane)
      const entitlementIdentityId = item.node.metadata?.identityId ||
                                    item.rawData?.identity?.id;
      const entitlementIdentityIdStr = entitlementIdentityId ? String(entitlementIdentityId) : null;

      return entitlementIdentityIdStr === selectedIdentityIdStr;
    });

    isEntitlementsFiltered = true;
  }

  // Apply selected system filter (when user clicks a system in the Systems lane) - only if we have an entitlements lane
  if (selectedSystemId && hasEntitlementsLane) {
    const selectedSystemIdStr = String(selectedSystemId);
    const systemNode = lanes
      .find(l => l.laneType === LaneTypes.SYSTEMS)?.items
      .find(item => String(item.node.id) === selectedSystemIdStr)?.node;

    if (systemNode) {
      const systemName = systemNode.displayName;

      filteredEntitlementItems = filteredEntitlementItems.filter(item => {
        const entitlementSystem = item.node.metadata?.system;
        const entitlementSystemId = item.node.metadata?.systemId;
        const entitlementGroupLabel = item.groupLabel;

        // Use string comparison for IDs
        const idMatch = entitlementSystemId && String(entitlementSystemId) === selectedSystemIdStr;
        const nameMatch = entitlementSystem === systemName || entitlementGroupLabel === systemName;

        return idMatch || nameMatch;
      });
    }
    if (hasEntitlementsLane) isEntitlementsFiltered = true;
  }

  // Apply selected logical application filter
  // When user clicks a logical app, filter entitlements to only show resources belonging to that app
  // Also track the underlying physical systems to filter the Systems lane
  let logicalAppUnderlyingSystemIds = [];
  let logicalAppUnderlyingSystemNames = [];

  if (selectedLogicalAppId) {
    const selectedLogicalAppIdStr = String(selectedLogicalAppId);
    const logicalAppItem = lanes
      .find(l => l.laneType === LaneTypes.LOGICAL_APPLICATIONS)?.items
      .find(item => String(item.node.id) === selectedLogicalAppIdStr);
    const logicalAppNode = logicalAppItem?.node;

    if (logicalAppNode) {
      const logicalAppName = logicalAppNode.displayName;
      const logicalAppSystemIdStr = String(logicalAppNode.id);

      // Filter entitlements that belong to this logical application (by resource's system)
      filteredEntitlementItems = filteredEntitlementItems.filter(item => {
        const entitlementSystem = item.node.metadata?.system;
        const entitlementSystemId = item.node.metadata?.systemId;
        const entitlementGroupLabel = item.groupLabel;

        // Match by system ID (using string comparison) or system name
        const idMatch = entitlementSystemId && String(entitlementSystemId) === logicalAppSystemIdStr;
        const nameMatch = entitlementSystem === logicalAppName || entitlementGroupLabel === logicalAppName;

        return idMatch || nameMatch;
      });

      // Store the underlying physical systems for filtering the Systems lane
      logicalAppUnderlyingSystemIds = (logicalAppNode.metadata?.underlyingSystemIds || []).map(id => String(id));
      logicalAppUnderlyingSystemNames = (logicalAppNode.metadata?.underlyingSystems || []).map(s => s.name);
    }
    if (hasEntitlementsLane) isEntitlementsFiltered = true;
  }

  // Apply selected assignment policy filter
  // When user clicks a policy in the Assignment Policies lane, filter entitlements to only show
  // those that were assigned by that policy (using resourceIds stored in policy metadata)
  if (selectedPolicyId && hasEntitlementsLane) {
    const selectedPolicyIdStr = String(selectedPolicyId);
    const policyItem = lanes
      .find(l => l.laneType === LaneTypes.ASSIGNMENT_POLICIES)?.items
      .find(item => String(item.node.id) === selectedPolicyIdStr);
    const policyNode = policyItem?.node;

    if (policyNode) {
      // Get the array of resource IDs this policy assigns
      const policyResourceIds = (policyNode.metadata?.resourceIds || []).map(id => String(id));

      // Filter entitlements to only show those with IDs in the policy's resourceIds array
      filteredEntitlementItems = filteredEntitlementItems.filter(item => {
        const entitlementId = item.node.id;
        const entitlementIdStr = String(entitlementId);
        // Also check the resource ID from rawData
        const rawResourceId = item.rawData?.resource?.id || item.rawData?.id;
        const rawResourceIdStr = rawResourceId ? String(rawResourceId) : null;

        return policyResourceIds.includes(entitlementIdStr) ||
               (rawResourceIdStr && policyResourceIds.includes(rawResourceIdStr));
      });
    }
    isEntitlementsFiltered = true;
  }

  // Step 2: Extract unique accounts and systems from the FILTERED entitlements
  // This allows cross-lane filtering: when entitlements are filtered, other lanes adapt
  const relatedAccountIds = new Set();
  const relatedAccountNames = new Set();
  const relatedSystemIds = new Set();
  const relatedSystemNames = new Set();

  // Get the Logical Applications lane to look up underlying physical systems
  const logicalAppsLane = lanes.find(l => l.laneType === LaneTypes.LOGICAL_APPLICATIONS);
  const logicalAppsMap = new Map();
  if (logicalAppsLane?.items) {
    logicalAppsLane.items.forEach(item => {
      logicalAppsMap.set(String(item.node.id), item.node);
      if (item.node.displayName) {
        logicalAppsMap.set(item.node.displayName, item.node);
      }
    });
  }

  filteredEntitlementItems.forEach(item => {
    // Extract account info from rawData (the original assignment)
    const account = item.rawData?.account;
    if (account) {
      // Store both original and string versions for consistent matching
      if (account.id) {
        relatedAccountIds.add(account.id);
        relatedAccountIds.add(String(account.id));
      }
      if (account.accountName) relatedAccountNames.add(account.accountName);
    }

    // Extract system info from the entitlement
    const systemId = item.rawData?.system?.id || item.node.metadata?.systemId;
    const systemName = item.node.metadata?.system || item.groupLabel;
    if (systemId) {
      // Store both original and string versions for consistent matching
      relatedSystemIds.add(systemId);
      relatedSystemIds.add(String(systemId));

      // Check if this system is a logical application - if so, add its underlying physical systems
      const logicalApp = logicalAppsMap.get(String(systemId)) || logicalAppsMap.get(systemName);
      if (logicalApp?.metadata?.underlyingSystemIds) {
        logicalApp.metadata.underlyingSystemIds.forEach(underlyingId => {
          relatedSystemIds.add(underlyingId);
          relatedSystemIds.add(String(underlyingId));
        });
      }
      if (logicalApp?.metadata?.underlyingSystems) {
        logicalApp.metadata.underlyingSystems.forEach(underlying => {
          if (underlying.id) {
            relatedSystemIds.add(underlying.id);
            relatedSystemIds.add(String(underlying.id));
          }
          if (underlying.name) relatedSystemNames.add(underlying.name);
        });
      }
    }
    if (systemName) relatedSystemNames.add(systemName);
  });

  // Step 3: Apply cross-lane filtering to all lanes
  return lanes.filter(lane =>
    filters.visibleLanes.includes(lane.laneType)
  ).map(lane => {
    // Apply filtered entitlements to the Effective Entitlements lane
    if (lane.laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS) {
      return {
        ...lane,
        items: filteredEntitlementItems,
        totalCount: filteredEntitlementItems.length,
        isFiltered: isEntitlementsFiltered
      };
    }

    // Cross-lane filter: Accounts lane
    // When a system is selected, filter accounts directly by their system
    // When an identity is selected (entitlement-centric view), filter accounts by that identity
    // Otherwise, filter based on related accounts from filtered entitlements
    // IMPORTANT: Do NOT filter Accounts lane when an Account is selected (selectedAccountId) - it should just highlight
    if (lane.laneType === LaneTypes.ACCOUNTS && !selectedAccountId) {
      let filteredAccountItems = lane.items;
      let accountsFiltered = false;

      // Identity filter: when user clicks an identity in the Identities lane (entitlement-centric view)
      // Filter accounts to show only those belonging to the selected identity
      if (selectedIdentityId) {
        const selectedIdentityIdStr = String(selectedIdentityId);

        // Also find the selected identity node to get alternative IDs (identityId field)
        const identitiesLane = lanes.find(l => l.laneType === LaneTypes.IDENTITIES);
        const selectedIdentityNode = identitiesLane?.items?.find(
          item => String(item.node.id) === selectedIdentityIdStr
        )?.node;
        const selectedIdentityIdAlt = selectedIdentityNode?.metadata?.identityId; // IDENTITYID field

        filteredAccountItems = filteredAccountItems.filter(item => {
          // Get the identity associated with this account from multiple possible paths
          // In entitlement-centric view, each account item has identity info from the calculated assignment
          const accountIdentityId = item.node.metadata?.identityId ||
                                    item.rawData?.identity?.id ||
                                    item.node.rawData?.identity?.id;
          const accountIdentityIdAlt = item.rawData?.identity?.identityId ||
                                       item.node.rawData?.identity?.identityId;
          const accountIdentityIdStr = accountIdentityId ? String(accountIdentityId) : null;
          const accountIdentityIdAltStr = accountIdentityIdAlt ? String(accountIdentityIdAlt) : null;

          // Match on either the UUID (id) or the IDENTITYID field
          const idMatch = accountIdentityIdStr === selectedIdentityIdStr;
          const altIdMatch = selectedIdentityIdAlt && accountIdentityIdAltStr === String(selectedIdentityIdAlt);
          return idMatch || altIdMatch;
        });

        accountsFiltered = true;
      }
      // Direct system filter: when user clicks a system, show only accounts on that system
      else if (selectedSystemId) {
        // Find the selected system node - use string comparison to avoid type mismatches
        const selectedSystemIdStr = String(selectedSystemId);
        const systemsLane = lanes.find(l => l.laneType === LaneTypes.SYSTEMS);

        const selectedSystemNode = systemsLane?.items
          .find(item => String(item.node.id) === selectedSystemIdStr)?.node;

        // Get the system name - use selectedSystemNode if found, otherwise try to get from accounts
        const selectedSystemName = selectedSystemNode?.displayName;

        filteredAccountItems = filteredAccountItems.filter(item => {
          // Check account's system in multiple places - use string comparison
          const accountSystemName = item.node.metadata?.system ||
                                    item.rawData?.system?.name ||
                                    item.node.rawData?.system?.name;
          const accountSystemId = item.node.metadata?.systemId ||
                                  item.rawData?.system?.id ||
                                  item.node.rawData?.system?.id;

          // Use string comparison for IDs to avoid type mismatch issues
          const accountSystemIdStr = accountSystemId ? String(accountSystemId) : null;

          const idMatch = accountSystemIdStr === selectedSystemIdStr;
          const nameMatch = selectedSystemName && accountSystemName === selectedSystemName;
          return idMatch || nameMatch;
        });

        accountsFiltered = true;
      }
      // When a Logical Application is selected, filter accounts by underlying physical systems
      else if (selectedLogicalAppId && (logicalAppUnderlyingSystemIds.length > 0 || logicalAppUnderlyingSystemNames.length > 0)) {
        filteredAccountItems = filteredAccountItems.filter(item => {
          // Get account's system info
          const accountSystemName = item.node.metadata?.system ||
                                    item.rawData?.system?.name ||
                                    item.node.rawData?.system?.name;
          const accountSystemId = item.node.metadata?.systemId ||
                                  item.rawData?.system?.id ||
                                  item.node.rawData?.system?.id;
          const accountSystemIdStr = accountSystemId ? String(accountSystemId) : null;

          // Check if account's system is one of the underlying physical systems
          const idMatch = accountSystemIdStr && logicalAppUnderlyingSystemIds.includes(accountSystemIdStr);
          const nameMatch = accountSystemName && logicalAppUnderlyingSystemNames.includes(accountSystemName);
          return idMatch || nameMatch;
        });

        accountsFiltered = true;
      }
      // Cross-lane filter from entitlements (when entitlements are filtered by other criteria)
      else if (isEntitlementsFiltered) {
        filteredAccountItems = filteredAccountItems.filter(item => {
          const accountId = item.node.id;
          const accountName = item.node.displayName;
          // Match by ID or by name
          return relatedAccountIds.has(accountId) ||
                 relatedAccountNames.has(accountId) ||
                 relatedAccountNames.has(accountName);
        });
        accountsFiltered = true;
      }

      if (accountsFiltered) {
        return {
          ...lane,
          items: filteredAccountItems,
          totalCount: filteredAccountItems.length,
          isFiltered: true
        };
      }
    }

    // Cross-lane filter: Systems lane - only show systems related to filtered entitlements
    // When a logical application is selected, also show its underlying physical systems
    // When an account is selected, show only the system that account belongs to
    // IMPORTANT: Do NOT filter Systems lane when a System is selected (selectedSystemId) - it should just highlight
    if (lane.laneType === LaneTypes.SYSTEMS && (isEntitlementsFiltered || selectedAccountId) && !selectedSystemId) {
      const filteredSystemItems = lane.items.filter(item => {
        const systemId = item.node.id;
        const systemIdStr = String(systemId);
        const systemName = item.node.displayName;

        // If an account is selected, filter to show only its system
        if (selectedAccountId && (selectedAccountSystemName || selectedAccountSystemId)) {
          const idMatch = selectedAccountSystemId && systemIdStr === selectedAccountSystemId;
          const nameMatch = selectedAccountSystemName && systemName === selectedAccountSystemName;
          return idMatch || nameMatch;
        }

        // If a logical app is selected, filter to show only its underlying physical systems
        if (selectedLogicalAppId && (logicalAppUnderlyingSystemIds.length > 0 || logicalAppUnderlyingSystemNames.length > 0)) {
          // Use string comparison for IDs
          return logicalAppUnderlyingSystemIds.includes(systemIdStr) ||
                 logicalAppUnderlyingSystemNames.includes(systemName);
        }

        // Otherwise, match by ID or by name from filtered entitlements
        // Convert to string for comparison
        return relatedSystemIds.has(systemId) ||
               relatedSystemIds.has(systemIdStr) ||
               relatedSystemNames.has(systemId) ||
               relatedSystemNames.has(systemName);
      });

      return {
        ...lane,
        items: filteredSystemItems,
        totalCount: filteredSystemItems.length,
        isFiltered: true
      };
    }

    // Cross-lane filter: Logical Applications lane
    // When a System is selected, show only Logical Apps whose underlying systems include the selected system
    // When entitlements are filtered, show only Logical Apps whose resources are in the filtered entitlements
    if (lane.laneType === LaneTypes.LOGICAL_APPLICATIONS) {
      let filteredLogicalAppItems = lane.items;
      let logicalAppsFiltered = false;

      // When a physical System is selected, filter to Logical Apps that use this system
      if (selectedSystemId) {
        const selectedSystemIdStr = String(selectedSystemId);

        // Find the selected system's name for name-based matching
        const selectedSystemNode = lanes
          .find(l => l.laneType === LaneTypes.SYSTEMS)?.items
          .find(item => String(item.node.id) === selectedSystemIdStr)?.node;
        const selectedSystemName = selectedSystemNode?.displayName;

        filteredLogicalAppItems = filteredLogicalAppItems.filter(item => {
          // A Logical App is related to a System if:
          // 1. The System is in the Logical App's underlyingSystemIds
          // 2. The System is in the Logical App's underlyingSystems names
          const underlyingSystemIds = (item.node.metadata?.underlyingSystemIds || []).map(id => String(id));
          const underlyingSystemNames = (item.node.metadata?.underlyingSystems || []).map(s => s.name);

          const idMatch = underlyingSystemIds.includes(selectedSystemIdStr);
          const nameMatch = selectedSystemName && underlyingSystemNames.includes(selectedSystemName);
          return idMatch || nameMatch;
        });

        logicalAppsFiltered = true;
      }
      // When an Account is selected, filter to Logical Apps whose underlying systems include the account's system
      else if (selectedAccountId && (selectedAccountSystemName || selectedAccountSystemId)) {
        filteredLogicalAppItems = filteredLogicalAppItems.filter(item => {
          // A Logical App is related to the account's system if:
          // 1. The account's system is in the Logical App's underlyingSystemIds
          // 2. The account's system is in the Logical App's underlyingSystems names
          const underlyingSystemIds = (item.node.metadata?.underlyingSystemIds || []).map(id => String(id));
          const underlyingSystemNames = (item.node.metadata?.underlyingSystems || []).map(s => s.name);

          const idMatch = selectedAccountSystemId && underlyingSystemIds.includes(selectedAccountSystemId);
          const nameMatch = selectedAccountSystemName && underlyingSystemNames.includes(selectedAccountSystemName);
          return idMatch || nameMatch;
        });

        logicalAppsFiltered = true;
      }
      // When entitlements are filtered (by other criteria), show Logical Apps whose resources are in the filtered entitlements
      else if (isEntitlementsFiltered && !selectedLogicalAppId) {
        // Extract unique Logical App system IDs from the filtered entitlements
        // (entitlements that belong to logical apps, not physical systems)
        const logicalAppSystemIds = new Set();

        filteredEntitlementItems.forEach(item => {
          const entitlementSystemId = item.node.metadata?.systemId;
          if (entitlementSystemId) {
            logicalAppSystemIds.add(String(entitlementSystemId));
          }
        });

        filteredLogicalAppItems = filteredLogicalAppItems.filter(item => {
          const logicalAppId = String(item.node.id);
          return logicalAppSystemIds.has(logicalAppId);
        });

        logicalAppsFiltered = true;
      }

      if (logicalAppsFiltered) {
        return {
          ...lane,
          items: filteredLogicalAppItems,
          totalCount: filteredLogicalAppItems.length,
          isFiltered: true
        };
      }
    }

    // Cross-lane filter: Identities lane (for entitlement-centric and system-centric views)
    // When an Account is selected, filter identities to show only the account's owner
    // When the focus node is an Entitlement, filter identities by compliance status
    // IMPORTANT: Do NOT filter Identities lane when an Identity is selected - it should just highlight
    if (lane.laneType === LaneTypes.IDENTITIES && !selectedIdentityId) {
      let filteredIdentityItems = lane.items;
      let identitiesFiltered = false;

      // Account filter: when user clicks an account in the Accounts lane
      // Works for both Entitlement-centric and System-centric views
      // Filter identities to show only the identity that owns the selected account
      if (selectedAccountId && (focusNode?.type === NodeTypes.ENTITLEMENT || focusNode?.type === NodeTypes.SYSTEM)) {
        const selectedAccountIdStr = String(selectedAccountId);

        // Find the selected account to get its identity
        const accountsLane = lanes.find(l => l.laneType === LaneTypes.ACCOUNTS);
        const selectedAccountItem = accountsLane?.items?.find(
          item => String(item.node.id) === selectedAccountIdStr
        );

        if (selectedAccountItem) {
          // Get the identity ID(s) from the account
          // In System-centric view, an account may be associated with multiple identities (identityIds array)
          const accountIdentityIds = selectedAccountItem.node.metadata?.identityIds ||
                                     selectedAccountItem.rawData?.identityIds || [];
          const accountIdentityId = selectedAccountItem.node.metadata?.identityId ||
                                    selectedAccountItem.rawData?.identity?.id ||
                                    selectedAccountItem.node.rawData?.identity?.id;

          // Build a set of all identity IDs associated with this account
          const identityIdsSet = new Set(
            accountIdentityIds.map(id => String(id)).filter(Boolean)
          );
          if (accountIdentityId) {
            identityIdsSet.add(String(accountIdentityId));
          }

          if (identityIdsSet.size > 0) {
            filteredIdentityItems = filteredIdentityItems.filter(item => {
              const identityId = String(item.node.id);
              return identityIdsSet.has(identityId);
            });

            identitiesFiltered = true;
          }
        }
      }
      // Apply compliance status filter to identities in entitlement-centric view
      // Each identity has a complianceStatus from their relationship with the central entitlement
      else if (filters.complianceStatuses && filters.complianceStatuses.length > 0 && focusNode?.type === NodeTypes.ENTITLEMENT) {
        filteredIdentityItems = filteredIdentityItems.filter(item => {
          // Get compliance status from node metadata or rawData
          const complianceStatus = item.node.metadata?.complianceStatus ||
                                   item.rawData?.complianceStatus ||
                                   item.node.rawData?.complianceStatus;

          return filters.complianceStatuses.includes(complianceStatus);
        });

        identitiesFiltered = true;
      }

      if (identitiesFiltered) {
        return {
          ...lane,
          items: filteredIdentityItems,
          totalCount: filteredIdentityItems.length,
          isFiltered: true
        };
      }
    }

    return lane;
  }).filter(lane => {
    // Always show lanes that have data
    if (lane.items && lane.items.length > 0) return true;

    // For System focus node, always show required lanes even if empty (they may populate after filtering)
    // This ensures Identities, Accounts, Entitlements, and Logical Applications lanes are always visible
    if (focusNode?.type === NodeTypes.SYSTEM) {
      const requiredLanesForSystem = [LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS, LaneTypes.EFFECTIVE_ENTITLEMENTS, LaneTypes.LOGICAL_APPLICATIONS];
      if (requiredLanesForSystem.includes(lane.laneType)) {
        return true;
      }
    }

    // For Entitlement focus node, always show Identities and Accounts lanes
    if (focusNode?.type === NodeTypes.ENTITLEMENT) {
      const requiredLanesForEntitlement = [LaneTypes.IDENTITIES, LaneTypes.ACCOUNTS];
      if (requiredLanesForEntitlement.includes(lane.laneType)) {
        return true;
      }
    }

    return false; // Hide other empty lanes
  });
  }, [
    lanes,
    filters.complianceStatuses,
    filters.reasonTypes,
    filters.entitlementType,
    filters.visibleLanes,
    selectedAccountId,
    selectedSystemId,
    selectedLogicalAppId,
    selectedIdentityId,
    selectedPolicyId,
    selectedEntitlementId,
    selectedViolationId,
    focusNode
  ]);

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
    visibleLanes.forEach(lane => {
      // If user has manually positioned the lane, use that position
      // Otherwise use the dynamically calculated position
      if (lanePositions[lane.laneType]) {
        positions[lane.laneType] = lanePositions[lane.laneType];
      } else if (dynamicPositions[lane.laneType]) {
        positions[lane.laneType] = dynamicPositions[lane.laneType];
      } else {
        // Fallback to default position
        positions[lane.laneType] = DEFAULT_LANE_POSITIONS[lane.laneType] || { x: 0, y: 0 };
      }
    });
    return positions;
  }, [visibleLanes, lanePositions, dynamicPositions]);

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
    if (selectedIdentityId) {
      selectedIdentity = identitiesLane.items?.find(
        item => String(item.node.id) === String(selectedIdentityId)
      );
    }
    // Case 2: Account is selected - derive the identity from the account
    else if (selectedAccountId) {
      const accountsLane = lanes.find(l => l.laneType === LaneTypes.ACCOUNTS);
      const selectedAccount = accountsLane?.items?.find(
        item => String(item.node.id) === String(selectedAccountId)
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
  }, [selectedIdentityId, selectedAccountId, focusNode?.type, lanes]);

  // Render loading state
  if (isLoading && !focusNode) {
    return (
      <div className={`access-lens ${isFullscreen ? 'fullscreen' : ''}`}>
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
      <div className={`access-lens ${isFullscreen ? 'fullscreen' : ''}`}>
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
    <div className={`access-lens ${isFullscreen ? 'fullscreen' : ''}`}>
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
        breadcrumbs={
          <Breadcrumbs
            history={history}
            currentIndex={historyIndex}
            onNavigate={handleBreadcrumbNavigate}
            onRemove={handleRemoveBreadcrumb}
          />
        }
      />

      {/* Main Content */}
      <div className="access-lens-content">
        {/* Pivot Loading Overlay - shows when changing central node */}
        {isLoading && focusNode && (
          <div className="pivot-loading-overlay">
            <div className="pivot-loading-spinner"></div>
            <h3 className="pivot-loading-title">Updating Identity360</h3>
            <p className="pivot-loading-status">{pivotLoadingStatus || 'Loading...'}</p>
          </div>
        )}

        {/* Canvas with draggable lanes */}
        <div className="access-lens-canvas">
          {/* Connector Lines SVG - only show for revealed lanes */}
          <ConnectorLines
            lanePositions={Object.fromEntries(
              Object.entries(visibleLanePositions).filter(([laneType]) => revealedLanes.has(laneType))
            )}
            fulcrumRef={fulcrumRef}
            isDragging={activeDragId !== null}
          />

          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
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

            {/* Draggable Lanes - appear in clockwise order after central node */}
            {visibleLanes
              .filter(lane => revealedLanes.has(lane.laneType))
              .map((lane) => (
              <DraggableLane
                key={lane.laneType}
                id={lane.laneType}
                position={visibleLanePositions[lane.laneType] || { x: 0, y: 0 }}
              >
                <LaneCard
                  lane={lane}
                  focusNodeType={focusNode?.type}
                  selectedItemId={selectedItem?.node?.id}
                  selectedReasonId={selectedReasonId}
                  onItemClick={(item) => handleItemClick(item, lane.laneType)}
                  onPivot={handlePivot}
                  onReasonClick={handleReasonClick}
                  onLoadMore={handleLoadMore}
                  viewMode={viewMode}
                  isFilterActive={lane.laneType === LaneTypes.ACCOUNTS ? selectedAccountId !== null :
                                  lane.laneType === LaneTypes.SYSTEMS ? selectedSystemId !== null :
                                  lane.laneType === LaneTypes.LOGICAL_APPLICATIONS ? selectedLogicalAppId !== null :
                                  lane.laneType === LaneTypes.IDENTITIES ? selectedIdentityId !== null :
                                  lane.laneType === LaneTypes.ASSIGNMENT_POLICIES ? selectedPolicyId !== null :
                                  lane.laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS ? selectedEntitlementId !== null :
                                  lane.laneType === LaneTypes.VIOLATIONS ? selectedViolationId !== null :
                                  lane.isFiltered}
                  activeFilterId={lane.laneType === LaneTypes.ACCOUNTS ? selectedAccountId :
                                  lane.laneType === LaneTypes.SYSTEMS ? selectedSystemId :
                                  lane.laneType === LaneTypes.LOGICAL_APPLICATIONS ? selectedLogicalAppId :
                                  lane.laneType === LaneTypes.IDENTITIES ? selectedIdentityId :
                                  lane.laneType === LaneTypes.ASSIGNMENT_POLICIES ? selectedPolicyId :
                                  lane.laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS ? selectedEntitlementId :
                                  lane.laneType === LaneTypes.VIOLATIONS ? selectedViolationId : null}
                  forceCollapsed={lanesForceCollapsed}
                  forceExpanded={lanesForceExpanded}
                  isFilterSource={
                    // A lane is the "filter source" (shows "Filtering") if user clicked an item in it
                    // Having a selection makes this lane the master filter
                    (lane.laneType === LaneTypes.ACCOUNTS && selectedAccountId !== null) ||
                    (lane.laneType === LaneTypes.SYSTEMS && selectedSystemId !== null) ||
                    (lane.laneType === LaneTypes.LOGICAL_APPLICATIONS && selectedLogicalAppId !== null) ||
                    (lane.laneType === LaneTypes.IDENTITIES && selectedIdentityId !== null) ||
                    (lane.laneType === LaneTypes.ASSIGNMENT_POLICIES && selectedPolicyId !== null) ||
                    (lane.laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS && selectedEntitlementId !== null) ||
                    (lane.laneType === LaneTypes.VIOLATIONS && selectedViolationId !== null)
                  }
                  isFiltered={
                    // A lane is "filtered" (shows "Filtered") if it's being filtered BY another lane
                    // AND it does NOT have its own selection (selection = master filter takes precedence)
                    lane.isFiltered && !(
                      (lane.laneType === LaneTypes.ACCOUNTS && selectedAccountId !== null) ||
                      (lane.laneType === LaneTypes.SYSTEMS && selectedSystemId !== null) ||
                      (lane.laneType === LaneTypes.LOGICAL_APPLICATIONS && selectedLogicalAppId !== null) ||
                      (lane.laneType === LaneTypes.IDENTITIES && selectedIdentityId !== null) ||
                      (lane.laneType === LaneTypes.ASSIGNMENT_POLICIES && selectedPolicyId !== null) ||
                      (lane.laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS && selectedEntitlementId !== null) ||
                      (lane.laneType === LaneTypes.VIOLATIONS && selectedViolationId !== null)
                    )
                  }
                />
              </DraggableLane>
            ))}

            {/* Center - Focus Card (Fulcrum) - appears first in animation */}
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
              />
            </div>
          </DndContext>
        </div>

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
