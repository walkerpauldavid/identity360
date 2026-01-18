/**
 * AccessLens Component
 * Main container for the IGA access graph exploration widget
 * Features: Identity integration, draggable lanes, connector lines
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { DndContext, useDraggable, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ViewModes, LaneTypes, NodeTypes, LaneSchema, CompassOrientation, getLaneDisplayConfig } from './accessLensTypes';
import accessLensDataService, { buildContextsLane, buildLanesFromAssignments, extractUniqueReasonTypes, extractUniqueComplianceStatuses } from './accessLensDataService';
import FilterBar from './FilterBar';
import Breadcrumbs from './Breadcrumbs';
import FocusCard from './FocusCard';
import LaneCard from './LaneCard';
import ExplanationPanel from './ExplanationPanel';
import './AccessLens.css';

// Safely extract string value from a field that might be string or object
const getStringValue = (value, defaultValue = '') => {
  if (!value) return defaultValue;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value.DisplayName || value.Name || value.Value || defaultValue;
  }
  return String(value);
};

// Convert identity from IdentityDetail to AccessLens node format
const identityToNode = (identity) => {
  if (!identity) return null;

  const statusStr = getStringValue(identity.IDENTITYSTATUS, 'active').toLowerCase();

  // Build the node with rawData for schema-based attribute extraction
  return {
    id: identity.UId || identity.Id || 'identity-current',
    type: NodeTypes.IDENTITY,
    displayName: `${identity.FIRSTNAME || ''} ${identity.LASTNAME || ''}`.trim() || identity.DISPLAYNAME || 'Unknown',
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
  height: 250   // Approximate lane height (varies, use conservative estimate)
};

const FULCRUM_DIMENSIONS = {
  width: 330,   // Fulcrum card width (308px + margin)
  height: 220   // Fulcrum card height
};

/**
 * Compass-to-position mapping
 * Maps compass orientations (from LaneSchema) to x,y coordinates relative to central node
 * Positions are designed to avoid overlap with fulcrum and other lanes
 */
const COMPASS_POSITIONS = {
  [CompassOrientation.N]:  { x: 0, y: -400 },      // North - top center
  [CompassOrientation.NE]: { x: 450, y: -320 },    // North-East - top right
  [CompassOrientation.E]:  { x: 580, y: 50 },      // East - right center
  [CompassOrientation.SE]: { x: 450, y: 380 },     // South-East - bottom right
  [CompassOrientation.S]:  { x: 0, y: 480 },       // South - bottom center
  [CompassOrientation.SW]: { x: -450, y: 380 },    // South-West - bottom left
  [CompassOrientation.W]:  { x: -580, y: 50 },     // West - left center
  [CompassOrientation.NW]: { x: -580, y: -280 }    // North-West - top left (wider for entitlements)
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
        top: '50%',
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
 * Based on the default visible lanes configuration
 */
const LOADING_PLACEHOLDER_LANES = [
  LaneTypes.SYSTEMS,
  LaneTypes.ACCOUNTS,
  LaneTypes.EFFECTIVE_ENTITLEMENTS,
  LaneTypes.CONTEXTS
];

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
 * Calculate dynamic lane positions based on the number of visible lanes with data.
 * Uses predefined slots to ensure no overlap between lanes or with the fulcrum.
 * @param {Array} lanesWithData - Array of lane objects that have items
 * @returns {Object} Position map { laneType: { x, y } }
 */
const calculateDynamicLanePositions = (lanesWithData) => {
  const positions = {};
  const laneCount = lanesWithData.length;

  if (laneCount === 0) return positions;

  // Use predefined slots to guarantee no overlap
  const usedSlots = [];

  lanesWithData.forEach((lane, index) => {
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
    top: `calc(50% + ${position.y}px)`,
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
      {/* Drag handle overlay - covers the header area for dragging */}
      <div
        className="drag-handle-overlay"
        {...listeners}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '40px', // Height of the lane header
          cursor: isDragging ? 'grabbing' : 'grab',
          zIndex: 10,
          // Re-enable pointer events on the handle during drag
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
  onPivotToNode = null  // Callback when user pivots to a different node (changes central focus)
}) => {
  // Refs
  const fulcrumRef = useRef(null);

  // State
  const [focusNode, setFocusNode] = useState(null);
  const [lanes, setLanes] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);  // Current position in history (-1 means no history yet)
  const [isLoading, setIsLoading] = useState(true);
  const [lanesLoading, setLanesLoading] = useState(true);  // Track when lanes are being built from data
  const [error, setError] = useState(null);

  // Lane positions state (for drag and drop)
  const [lanePositions, setLanePositions] = useState({});
  const [activeDragId, setActiveDragId] = useState(null);
  const [lanesForceCollapsed, setLanesForceCollapsed] = useState(false); // Used to collapse all lanes on Reset Layout

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

  // Cross-lane filtering state
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  const [selectedLogicalAppId, setSelectedLogicalAppId] = useState(null);  // For filtering by logical application

  // Filter state
  const [viewMode, setViewMode] = useState(ViewModes.EXPLORE);
  const [filters, setFilters] = useState({
    visibleLanes: [
      LaneTypes.ROLES,
      LaneTypes.ACCOUNTS,
      LaneTypes.EFFECTIVE_ENTITLEMENTS,
      LaneTypes.POLICIES,
      LaneTypes.SYSTEMS,
      LaneTypes.LOGICAL_APPLICATIONS,  // Logical applications lane (systems with resources but no direct accounts)
      LaneTypes.CONTEXTS,
      LaneTypes.IDENTITIES  // For system-centric view
    ],
    reasonTypes: [],
    complianceStatuses: [],  // Selected compliance statuses for filtering
    entitlementType: 'all',
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

  // Load focus data - sets the central focus node (identity)
  // Lanes are populated separately via calculatedAssignments and identityContexts props
  const loadFocus = useCallback(async (nodeIdOrNode, addToHistory = true) => {
    setIsLoading(true);
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
            // Node already in history, trim future history and set index
            setHistoryIndex(existingIndex);
            return prev.slice(0, existingIndex + 1);
          }
          // New node, add to history after current position (trimming any "forward" history)
          const newHistory = [...prev.slice(0, historyIndex + 1), finalFocusNode];
          setHistoryIndex(newHistory.length - 1);
          return newHistory;
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [filters, focusNode?.type]);

  // Initial load - use identity from props
  useEffect(() => {
    if (identity) {
      console.log('=== AccessLens: Creating node from identity ===');
      console.log('Identity prop received:', identity);

      const identityNode = identityToNode(identity);
      console.log('Created identity node:', identityNode);

      loadFocus(identityNode);
    }
    // No fallback to mock data - identity prop is required
  }, [identity]);

  // Reload when filters change
  useEffect(() => {
    if (focusNode) {
      loadFocus(focusNode, false);
    }
  }, [filters]);

  // Update lanes when calculatedAssignments API data is provided (from AccessLensPage)
  useEffect(() => {
    console.log('=== AccessLens useEffect triggered ===');
    console.log('  calculatedAssignments:', calculatedAssignments?.length || 0);
    console.log('  systemDetailsMap entries:', Object.keys(systemDetailsMap).length);
    console.log('  systemDetailsMap keys:', Object.keys(systemDetailsMap));

    if (calculatedAssignments && Array.isArray(calculatedAssignments) && calculatedAssignments.length > 0) {
      // Mark lanes as loading while we process the data
      setLanesLoading(true);

      console.log('=== AccessLens: Processing calculatedAssignments ===');
      console.log('Raw calculatedAssignments count:', calculatedAssignments.length);
      console.log('First assignment sample:', calculatedAssignments[0]);
      console.log('System details map has', Object.keys(systemDetailsMap).length, 'entries');

      // Debug: Extract and log all unique accounts from raw data
      const rawAccountsDebug = new Map();
      calculatedAssignments.forEach((a, i) => {
        if (a.account) {
          const key = `${a.account.accountName}::${a.account.system?.name || 'NoSystem'}`;
          if (!rawAccountsDebug.has(key)) {
            rawAccountsDebug.set(key, {
              accountName: a.account.accountName,
              accountId: a.account.id,
              systemName: a.account.system?.name,
              systemId: a.account.system?.id,
              accountType: a.account.accountType?.name
            });
          }
        }
      });
      console.log('=== DEBUG: All unique accounts in raw API data ===');
      console.log(`Found ${rawAccountsDebug.size} unique account+system combinations:`);
      Array.from(rawAccountsDebug.values()).forEach((acc, i) => {
        console.log(`  ${i + 1}. "${acc.accountName}" on "${acc.systemName}" (id: ${acc.accountId}, type: ${acc.accountType})`);
      });

      // Build Systems, Accounts, and Entitlements lanes from assignments data
      // Pass systemDetailsMap for enriching Systems and Logical Applications lanes
      const assignmentLanes = buildLanesFromAssignments(calculatedAssignments, filters, {
        systemDetailsMap: systemDetailsMap
      });

      console.log('Built lanes from assignments:');
      assignmentLanes.forEach(lane => {
        console.log(`  - ${lane.laneType}: ${lane.items.length} items`);
        // Log enriched system details if it's a systems lane
        if (lane.laneType === LaneTypes.SYSTEMS || lane.laneType === LaneTypes.LOGICAL_APPLICATIONS) {
          lane.items.forEach(item => {
            if (item.node.metadata?.systemType || item.node.metadata?.classification) {
              console.log(`    * ${item.node.displayName}: type="${item.node.metadata.systemType}", class="${item.node.metadata.classification}"`);
            }
          });
        }
      });

      // Extract unique reason types for the filter dropdown
      const reasonTypes = extractUniqueReasonTypes(calculatedAssignments);
      console.log('Extracted reason types:', reasonTypes);
      setAvailableReasonTypes(reasonTypes);

      // Extract unique compliance statuses for the filter dropdown
      const complianceStatuses = extractUniqueComplianceStatuses(calculatedAssignments);
      console.log('Extracted compliance statuses:', complianceStatuses);
      setAvailableComplianceStatuses(complianceStatuses);

      setLanes(prevLanes => {
        // Keep the contexts lane if it exists, replace others
        const contextsLane = prevLanes.find(l => l.laneType === LaneTypes.CONTEXTS);
        const newLanes = contextsLane ? [...assignmentLanes, contextsLane] : assignmentLanes;
        console.log('Final lanes count:', newLanes.length);
        return newLanes;
      });

      // Mark lanes as loaded after a brief delay to allow render
      setTimeout(() => {
        setLanesLoading(false);
        console.log('Lanes loading complete');
      }, 100);
    }
  }, [calculatedAssignments, filters, systemDetailsMap]);

  // Update contexts lane when identityContexts API data is provided
  useEffect(() => {
    if (identityContexts && Array.isArray(identityContexts)) {
      console.log('=== AccessLens: Processing identityContexts ===');
      console.log('Raw identityContexts count:', identityContexts.length);
      console.log('First context sample:', identityContexts[0]);

      // Build contexts lane from API data
      const contextsLane = buildContextsLane(identityContexts, filters);

      console.log('Built contexts lane:', contextsLane.items.length, 'items');

      setLanes(prevLanes => {
        // Remove existing contexts lane if any
        const otherLanes = prevLanes.filter(l => l.laneType !== LaneTypes.CONTEXTS);
        // Add the new contexts lane
        return [...otherLanes, contextsLane];
      });
    }
  }, [identityContexts, filters]);

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

      console.log(`Drag end: ${laneType} moved from (${basePosition.x}, ${basePosition.y}) to (${newPosition.x}, ${newPosition.y})`);

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
    console.log('=== handleItemClick called ===');
    console.log('Item:', item);
    console.log('LaneType:', laneType);
    console.log('Item node:', item?.node);
    console.log('Item node displayName:', item?.node?.displayName);

    if (!item || !item.node) {
      console.error('Invalid item passed to handleItemClick');
      return;
    }

    // Set the selected item immediately for visual feedback
    setSelectedItem(item);
    setSelectedReasonId(item.reasons?.[0]?.id || null);

    // Expand the inspector panel if it's collapsed
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

    // Track account/system/logical-app selection for cross-lane filtering
    if (laneType === LaneTypes.ACCOUNTS) {
      setSelectedAccountId(prev => prev === item.node.id ? null : item.node.id);
      setSelectedSystemId(null);
      setSelectedLogicalAppId(null);
    } else if (laneType === LaneTypes.SYSTEMS) {
      setSelectedSystemId(prev => prev === item.node.id ? null : item.node.id);
      setSelectedAccountId(null);
      setSelectedLogicalAppId(null);
    } else if (laneType === LaneTypes.LOGICAL_APPLICATIONS) {
      setSelectedLogicalAppId(prev => prev === item.node.id ? null : item.node.id);
      setSelectedAccountId(null);
      setSelectedSystemId(null);
    }

    // Fetch full object details from OData if callback is provided
    if (onFetchObjectDetails) {
      console.log('Fetching object details via callback for laneType:', laneType);
      try {
        const result = await onFetchObjectDetails(laneType, item);
        console.log('Fetch result:', result);

        if (result?.data) {
          console.log('=== Object Inspector: Loaded full object details ===');
          console.log('Data keys:', Object.keys(result.data));

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
          console.log('No data returned from API, showing item data');
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
        console.error('Error fetching object details:', err);
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
      console.log('No fetch callback provided (onFetchObjectDetails is null/undefined)');
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
  }, [inspectorCollapsed, onFetchObjectDetails]);

  // Handle central node (Identity) click - show all attributes in Object Inspector
  const handleCentralNodeClick = useCallback(() => {
    if (!focusNode) return;

    // Clear any lane item selection
    setSelectedAccountId(null);
    setSelectedSystemId(null);
    setSelectedLogicalAppId(null);
    setSelectedReasonId(null);

    // Build the explanation from the identity data
    // The identity prop contains the full OData response
    const identityData = identity || focusNode.rawData || {};

    console.log('=== Central Node Click ===');
    console.log('Identity data for inspector:', identityData);

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
  }, [focusNode, identity, inspectorCollapsed]);

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
    console.log('=== Pivot requested ===');
    console.log('Pivoting to node:', node);
    console.log('Node type:', node?.type);

    if (!node) return;

    // Clear cross-lane filter selections when pivoting
    setSelectedAccountId(null);
    setSelectedSystemId(null);
    setSelectedLogicalAppId(null);
    setSelectedItem(null);
    setExplanation(null);

    // Show loading state
    setIsLoading(true);
    setLanes([]);

    // If callback is provided, use it to fetch data for the new node
    if (onPivotToNode) {
      try {
        console.log('Calling onPivotToNode callback...');
        const pivotResult = await onPivotToNode(node);

        if (pivotResult) {
          console.log('Pivot result:', pivotResult);

          // Update focus node with full details if available
          const newFocusNode = pivotResult.focusNode || node;
          setFocusNode(newFocusNode);

          // Update history
          setHistory(prev => {
            const existingIndex = prev.findIndex(n => n.id === newFocusNode.id);
            if (existingIndex >= 0) {
              return prev.slice(0, existingIndex + 1);
            }
            return [...prev, newFocusNode];
          });

          // Set lanes from the pivot result
          if (pivotResult.lanes && pivotResult.lanes.length > 0) {
            setLanes(pivotResult.lanes);
          }

          // Update available reason types if provided
          if (pivotResult.reasonTypes) {
            setAvailableReasonTypes(pivotResult.reasonTypes);
          }

          // Update available compliance statuses if provided
          if (pivotResult.complianceStatuses) {
            setAvailableComplianceStatuses(pivotResult.complianceStatuses);
          }

          // Reset lane positions for new node type
          if (newFocusNode?.type !== focusNode?.type) {
            setLanePositions({});
          }
        } else {
          // Fallback: just set the node as focus without new lane data
          console.log('No pivot result, using node directly');
          loadFocus(node);
        }
      } catch (err) {
        console.error('Error during pivot:', err);
        setError(`Failed to pivot to ${node.displayName}: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    } else {
      // No callback, just change the focus node (lanes may be empty)
      console.log('No onPivotToNode callback, using loadFocus');
      loadFocus(node);
    }
  }, [loadFocus, onPivotToNode, focusNode?.type]);

  // Handle breadcrumb navigation
  const handleBreadcrumbNavigate = useCallback((node, index) => {
    setHistoryIndex(index);
    loadFocus(node, false);
  }, [loadFocus]);

  // Navigation: Go back in history
  const handleNavigateBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const prevNode = history[newIndex];
      setHistoryIndex(newIndex);

      // For now, just update focus node - a proper implementation would
      // need to re-fetch lanes for the previous node via onPivotToNode
      if (onPivotToNode && prevNode) {
        onPivotToNode(prevNode).then(result => {
          if (result) {
            setFocusNode(result.focusNode || prevNode);
            if (result.lanes) setLanes(result.lanes);
            if (result.reasonTypes) setAvailableReasonTypes(result.reasonTypes);
            if (result.complianceStatuses) setAvailableComplianceStatuses(result.complianceStatuses);
          }
        });
      } else {
        setFocusNode(prevNode);
      }
    }
  }, [historyIndex, history, onPivotToNode]);

  // Navigation: Go forward in history
  const handleNavigateForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const nextNode = history[newIndex];
      setHistoryIndex(newIndex);

      // Re-fetch lanes for the next node via onPivotToNode
      if (onPivotToNode && nextNode) {
        onPivotToNode(nextNode).then(result => {
          if (result) {
            setFocusNode(result.focusNode || nextNode);
            if (result.lanes) setLanes(result.lanes);
            if (result.reasonTypes) setAvailableReasonTypes(result.reasonTypes);
            if (result.complianceStatuses) setAvailableComplianceStatuses(result.complianceStatuses);
          }
        });
      } else {
        setFocusNode(nextNode);
      }
    }
  }, [historyIndex, history, onPivotToNode]);

  // Check if back/forward navigation is available
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  // Handle load more for a lane
  // TODO: Implement pagination via API when needed
  const handleLoadMore = useCallback(async (laneType) => {
    console.log('Load more requested for lane:', laneType);
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
    // Collapse all lanes
    setLanesForceCollapsed(true);
    // Reset the forceCollapsed flag after a brief delay so lanes can be expanded again
    setTimeout(() => setLanesForceCollapsed(false), 100);
  };

  // ============================================================================
  // CROSS-LANE FILTERING LOGIC
  // The toolbar filters (Compliance, Reason Types, Entitlement Type) filter the
  // Effective Entitlements lane. Then, Accounts and Systems lanes are filtered
  // to only show items related to the filtered entitlements.
  // ============================================================================

  // Step 1: Get the Effective Entitlements lane and apply all toolbar filters
  const entitlementsLane = lanes.find(l => l.laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS);
  let filteredEntitlementItems = entitlementsLane?.items ? [...entitlementsLane.items] : [];
  let isEntitlementsFiltered = false;

  // Apply compliance status filter
  if (filters.complianceStatuses && filters.complianceStatuses.length > 0) {
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
    isEntitlementsFiltered = true;
  }

  // Apply entitlement type filter (direct vs inherited)
  if (filters.entitlementType && filters.entitlementType !== 'all') {
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

  // Apply selected account filter (when user clicks an account in the Accounts lane)
  if (selectedAccountId) {
    const selectedAccountIdStr = String(selectedAccountId);
    const accountItem = lanes
      .find(l => l.laneType === LaneTypes.ACCOUNTS)?.items
      .find(item => String(item.node.id) === selectedAccountIdStr);
    const accountNode = accountItem?.node;

    console.log('=== Account Filter Debug ===');
    console.log('Selected Account ID:', selectedAccountId, '(type:', typeof selectedAccountId, ')');
    console.log('Account Node found:', !!accountNode);
    if (accountNode) {
      console.log('Account System:', accountNode?.metadata?.system);
      console.log('Account Name:', accountNode?.displayName);
    }

    if (accountNode) {
      const accountSystem = accountNode.metadata?.system;
      const accountSystemId = accountNode.metadata?.systemId;
      const accountName = accountNode.displayName;

      // Debug: Show all entitlements and their systems before filtering
      console.log('Before filter - Entitlements count:', filteredEntitlementItems.length);
      filteredEntitlementItems.slice(0, 10).forEach((item, i) => {
        console.log(`  ${i}: "${item.node.displayName}" - system: "${item.node.metadata?.system}", groupLabel: "${item.groupLabel}", rawData.account: "${item.rawData?.account?.accountName}"`);
      });

      // Filter entitlements that belong to this account
      // Match by: 1) Same system name, OR 2) rawData.account matches the selected account
      filteredEntitlementItems = filteredEntitlementItems.filter(item => {
        const entitlementSystem = item.node.metadata?.system;
        const entitlementGroupLabel = item.groupLabel;
        const entitlementAccountName = item.rawData?.account?.accountName;
        const entitlementAccountId = item.rawData?.account?.id;

        // Match by system name or system ID
        const systemMatch = accountSystem && (
          entitlementSystem === accountSystem ||
          entitlementGroupLabel === accountSystem ||
          (accountSystemId && item.node.metadata?.systemId && String(item.node.metadata.systemId) === String(accountSystemId))
        );

        // Match by account (more precise - the entitlement's rawData.account should match the selected account)
        // Use string comparison for IDs to avoid type mismatches
        const accountMatch = (entitlementAccountName === accountName) ||
                            (entitlementAccountId && String(entitlementAccountId) === selectedAccountIdStr);

        // Use account match if available (more precise), otherwise fall back to system match
        const match = accountMatch || systemMatch;

        if (!match && item.node.displayName.toLowerCase().includes('servicenow')) {
          console.log(`NOT MATCHED: "${item.node.displayName}" - entSystem: "${entitlementSystem}", accSystem: "${accountSystem}", entAccName: "${entitlementAccountName}", accName: "${accountName}"`);
        }

        return match;
      });

      console.log('After filter - Entitlements count:', filteredEntitlementItems.length);
    }
    isEntitlementsFiltered = true;
  }

  // Apply selected system filter (when user clicks a system in the Systems lane)
  if (selectedSystemId) {
    const selectedSystemIdStr = String(selectedSystemId);
    const systemNode = lanes
      .find(l => l.laneType === LaneTypes.SYSTEMS)?.items
      .find(item => String(item.node.id) === selectedSystemIdStr)?.node;

    if (systemNode) {
      const systemName = systemNode.displayName;
      console.log('=== Entitlements System Filter ===');
      console.log('Filtering entitlements for system:', systemName, '(ID:', selectedSystemId, ')');
      console.log('Entitlements before filter:', filteredEntitlementItems.length);

      filteredEntitlementItems = filteredEntitlementItems.filter(item => {
        const entitlementSystem = item.node.metadata?.system;
        const entitlementSystemId = item.node.metadata?.systemId;
        const entitlementGroupLabel = item.groupLabel;

        // Use string comparison for IDs
        const idMatch = entitlementSystemId && String(entitlementSystemId) === selectedSystemIdStr;
        const nameMatch = entitlementSystem === systemName || entitlementGroupLabel === systemName;

        return idMatch || nameMatch;
      });

      console.log('Entitlements after filter:', filteredEntitlementItems.length);
    }
    isEntitlementsFiltered = true;
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

    console.log('=== Logical Application Filter Debug ===');
    console.log('Selected Logical App ID:', selectedLogicalAppId);
    console.log('Logical App Node:', logicalAppNode);
    console.log('Underlying Systems:', logicalAppNode?.metadata?.underlyingSystems);

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

      console.log('After logical app filter - Entitlements count:', filteredEntitlementItems.length);

      // Store the underlying physical systems for filtering the Systems lane
      logicalAppUnderlyingSystemIds = (logicalAppNode.metadata?.underlyingSystemIds || []).map(id => String(id));
      logicalAppUnderlyingSystemNames = (logicalAppNode.metadata?.underlyingSystems || []).map(s => s.name);
    }
    isEntitlementsFiltered = true;
  }

  // Step 2: Extract unique accounts and systems from the FILTERED entitlements
  // This allows cross-lane filtering: when entitlements are filtered, other lanes adapt
  const relatedAccountIds = new Set();
  const relatedAccountNames = new Set();
  const relatedSystemIds = new Set();
  const relatedSystemNames = new Set();

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
    }
    if (systemName) relatedSystemNames.add(systemName);
  });

  // Step 3: Apply cross-lane filtering to all lanes
  const visibleLanes = lanes.filter(lane =>
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
    // Otherwise, filter based on related accounts from filtered entitlements
    if (lane.laneType === LaneTypes.ACCOUNTS) {
      let filteredAccountItems = lane.items;
      let accountsFiltered = false;

      // Direct system filter: when user clicks a system, show only accounts on that system
      if (selectedSystemId) {
        console.log('=== Accounts System Filter Debug ===');
        console.log('Selected System ID:', selectedSystemId, '(type:', typeof selectedSystemId, ')');

        // Find the selected system node - use string comparison to avoid type mismatches
        const selectedSystemIdStr = String(selectedSystemId);
        const systemsLane = lanes.find(l => l.laneType === LaneTypes.SYSTEMS);
        console.log('Systems lane found:', !!systemsLane, 'items:', systemsLane?.items?.length || 0);

        const selectedSystemNode = systemsLane?.items
          .find(item => String(item.node.id) === selectedSystemIdStr)?.node;

        console.log('Selected System Node found:', !!selectedSystemNode);
        if (selectedSystemNode) {
          console.log('Selected System Name:', selectedSystemNode.displayName);
        }

        // Get the system name - use selectedSystemNode if found, otherwise try to get from accounts
        const selectedSystemName = selectedSystemNode?.displayName;

        console.log('Starting accounts filter. Total accounts:', filteredAccountItems.length);

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
          const match = idMatch || nameMatch;

          console.log(`  Account "${item.node.displayName}": sysName="${accountSystemName}", sysId="${accountSystemId}" -> idMatch=${idMatch}, nameMatch=${nameMatch}, MATCH=${match}`);

          return match;
        });

        console.log('Filtered accounts count:', filteredAccountItems.length);
        accountsFiltered = true;
      }
      // When a Logical Application is selected, filter accounts by underlying physical systems
      else if (selectedLogicalAppId && (logicalAppUnderlyingSystemIds.length > 0 || logicalAppUnderlyingSystemNames.length > 0)) {
        console.log('=== Accounts Logical App Filter Debug ===');
        console.log('Filtering accounts for Logical App with underlying systems:', logicalAppUnderlyingSystemNames);
        console.log('Underlying system IDs:', logicalAppUnderlyingSystemIds);

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
          const match = idMatch || nameMatch;

          console.log(`  Account "${item.node.displayName}": sysName="${accountSystemName}", sysId="${accountSystemId}" -> idMatch=${idMatch}, nameMatch=${nameMatch}, MATCH=${match}`);

          return match;
        });

        console.log('Filtered accounts count:', filteredAccountItems.length);
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
    if (lane.laneType === LaneTypes.SYSTEMS && isEntitlementsFiltered) {
      const filteredSystemItems = lane.items.filter(item => {
        const systemId = item.node.id;
        const systemIdStr = String(systemId);
        const systemName = item.node.displayName;

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

        console.log('=== Logical Apps System Filter Debug ===');
        console.log('Selected System:', selectedSystemName, '(ID:', selectedSystemId, ')');
        console.log('Logical Apps before filter:', filteredLogicalAppItems.length);

        filteredLogicalAppItems = filteredLogicalAppItems.filter(item => {
          // A Logical App is related to a System if:
          // 1. The System is in the Logical App's underlyingSystemIds
          // 2. The System is in the Logical App's underlyingSystems names
          const underlyingSystemIds = (item.node.metadata?.underlyingSystemIds || []).map(id => String(id));
          const underlyingSystemNames = (item.node.metadata?.underlyingSystems || []).map(s => s.name);

          const idMatch = underlyingSystemIds.includes(selectedSystemIdStr);
          const nameMatch = selectedSystemName && underlyingSystemNames.includes(selectedSystemName);
          const match = idMatch || nameMatch;

          console.log(`  Logical App "${item.node.displayName}": underlyingIds=[${underlyingSystemIds.join(',')}], underlyingNames=[${underlyingSystemNames.join(',')}] -> idMatch=${idMatch}, nameMatch=${nameMatch}, MATCH=${match}`);

          return match;
        });

        console.log('Logical Apps after filter:', filteredLogicalAppItems.length);
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

        console.log('=== Logical Apps Cross-Filter Debug ===');
        console.log('Entitlements system IDs:', Array.from(logicalAppSystemIds));

        filteredLogicalAppItems = filteredLogicalAppItems.filter(item => {
          const logicalAppId = String(item.node.id);
          const match = logicalAppSystemIds.has(logicalAppId);
          return match;
        });

        console.log('Logical Apps after cross-filter:', filteredLogicalAppItems.length);
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

    return lane;
  }).filter(lane => lane.items && lane.items.length > 0); // Only show lanes with data

  // Get positions for visible lanes only - use dynamic positioning for lanes with data
  // This ensures lanes don't overlap when only some lanes have data
  const dynamicPositions = calculateDynamicLanePositions(visibleLanes);

  // Debug: Log lane positioning
  console.log('=== Lane Positioning Debug ===');
  console.log('Visible lanes:', visibleLanes.map(l => `${l.laneType}(${l.items?.length || 0} items)`));
  console.log('Dynamic positions:', dynamicPositions);

  const visibleLanePositions = {};
  visibleLanes.forEach(lane => {
    // If user has manually positioned the lane, use that position
    // Otherwise use the dynamically calculated position
    if (lanePositions[lane.laneType]) {
      visibleLanePositions[lane.laneType] = lanePositions[lane.laneType];
    } else if (dynamicPositions[lane.laneType]) {
      visibleLanePositions[lane.laneType] = dynamicPositions[lane.laneType];
    } else {
      // Fallback to default position
      visibleLanePositions[lane.laneType] = DEFAULT_LANE_POSITIONS[lane.laneType] || { x: 0, y: 0 };
    }
  });

  console.log('Final positions used:', visibleLanePositions);

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
      {/* Top Bar */}
      <div className="access-lens-topbar">
        <div className="topbar-left">
          <h2 className="access-lens-title">
            <span className="title-icon">🔍</span>
            Access Lens
          </h2>
          {/* Navigation buttons */}
          <div className="nav-buttons">
            <button
              className={`nav-btn back-btn ${!canGoBack ? 'disabled' : ''}`}
              onClick={handleNavigateBack}
              disabled={!canGoBack}
              title="Go back"
            >
              ←
            </button>
            <button
              className={`nav-btn forward-btn ${!canGoForward ? 'disabled' : ''}`}
              onClick={handleNavigateForward}
              disabled={!canGoForward}
              title="Go forward"
            >
              →
            </button>
          </div>
          <button className="reset-positions-btn" onClick={handleResetPositions} title="Reset lane positions">
            ↺ Reset Layout
          </button>
          {isFullscreen && onClose && (
            <button className="exit-fullscreen-btn" onClick={onClose}>
              ✕ Exit
            </button>
          )}
        </div>
        <Breadcrumbs
          history={history}
          onNavigate={handleBreadcrumbNavigate}
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFilterChange={setFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        availableReasonTypes={availableReasonTypes}
        availableComplianceStatuses={availableComplianceStatuses}
      />

      {/* Main Content */}
      <div className="access-lens-content">
        {/* Canvas with draggable lanes */}
        <div className="access-lens-canvas">
          {/* Connector Lines SVG */}
          <ConnectorLines
            lanePositions={visibleLanePositions}
            fulcrumRef={fulcrumRef}
            isDragging={activeDragId !== null}
          />

          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Loading Placeholders - shown while lanes are being loaded or waiting for data */}
            {(lanesLoading || (!calculatedAssignments && lanes.length === 0)) && visibleLanes.length === 0 &&
              LOADING_PLACEHOLDER_LANES.map((laneType) => {
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

            {/* Draggable Lanes */}
            {visibleLanes.map((lane) => (
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
                                  lane.isFiltered}
                  activeFilterId={lane.laneType === LaneTypes.ACCOUNTS ? selectedAccountId :
                                  lane.laneType === LaneTypes.SYSTEMS ? selectedSystemId :
                                  lane.laneType === LaneTypes.LOGICAL_APPLICATIONS ? selectedLogicalAppId : null}
                  forceCollapsed={lanesForceCollapsed}
                  isFilterSource={
                    // A lane is the "filter source" (shows "Filtering") if user clicked an item in it to filter other lanes
                    (lane.laneType === LaneTypes.ACCOUNTS && selectedAccountId !== null) ||
                    (lane.laneType === LaneTypes.SYSTEMS && selectedSystemId !== null) ||
                    (lane.laneType === LaneTypes.LOGICAL_APPLICATIONS && selectedLogicalAppId !== null)
                  }
                  isFiltered={
                    // A lane is "filtered" (shows "Filtered") if it's being filtered BY another lane or toolbar
                    // Effective Entitlements: filtered by toolbar filters OR by clicking account/system/logical-app
                    // Accounts/Systems: filtered by cross-lane filtering when entitlements are filtered
                    lane.isFiltered && !(
                      (lane.laneType === LaneTypes.ACCOUNTS && selectedAccountId !== null) ||
                      (lane.laneType === LaneTypes.SYSTEMS && selectedSystemId !== null) ||
                      (lane.laneType === LaneTypes.LOGICAL_APPLICATIONS && selectedLogicalAppId !== null)
                    )
                  }
                />
              </DraggableLane>
            ))}

            {/* Center - Focus Card (Fulcrum) */}
            <div
              className="fulcrum-wrapper"
              ref={fulcrumRef}
              onClick={handleCentralNodeClick}
              style={{ cursor: 'pointer' }}
              title="Click to inspect identity details"
            >
              <FocusCard
                node={focusNode}
                onNavigateBack={() => history.length > 1 && handleBreadcrumbNavigate(history[history.length - 2], history.length - 2)}
              />
            </div>
          </DndContext>
        </div>

        {/* Object Inspector Panel */}
        <div className={`access-lens-explanation ${inspectorCollapsed ? 'collapsed' : ''}`}>
          <ExplanationPanel
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
      </div>
    </div>
  );
};

export default AccessLens;
