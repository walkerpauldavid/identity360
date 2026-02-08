/**
 * LaneCard Component
 * Displays a lane of related nodes with progressive disclosure
 * Uses LaneSchema for visual characteristics based on data type
 *
 * Display rules:
 * - System, Account, Context, Identity, Role, Policy: 1 column (350px)
 * - Entitlement: 2 columns (700px)
 *
 * Features:
 * - Collapse/Expand: Toggle visibility of items
 * - Maximize/Restore: Show all items in a larger scrollable view
 */

import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import { LaneTypes, LaneSchema, getLaneDisplayConfig, LaneGridConstraints } from './accessLensTypes';
import LaneItemRow from './LaneItemRow';
import { getItemResourceType } from './accessLensUtils';

const LaneCard = ({
  lane,
  focusNodeType,
  selectedItemId,
  selectedReasonId,
  onItemClick,
  onPivot,
  onReasonClick,
  viewMode = 'explore',
  isVisible = true,
  activeFilterId = null,
  forceCollapsed = false,  // When true, forces all lanes to collapsed state (used by Reset Layout)
  isFilterSource = false,  // When true, this lane is the source of filtering (shows "Filtering")
  isFiltered = false,      // When true, this lane is being filtered by another lane (shows "Filtered")
  forceExpanded = false    // When true, forces all lanes to expanded state (used by Expand All)
}) => {
  // ==========================================================================
  // HOOKS SECTION - All hooks MUST be called before any early returns
  // React requires hooks to be called in the same order on every render
  // ==========================================================================

  // Extract lane properties early (needed for hooks)
  const { laneType, totalCount, items, canLoadMore, allItemsData } = lane;
  const laneIsFiltered = isFiltered || lane.isFiltered;

  // Determine if this is a multi-column lane
  const displayRule = LaneSchema[laneType]?.displayRule || 'SINGLE_COLUMN';
  const isMultiColumnLane = displayRule === 'MULTI_COLUMN';

  // Schema-driven: showFilters is defined on each lane schema entry
  // For single-column lanes (Identities, Accounts), only show search if scrolling is needed (>4 items)
  const schemaShowFilters = LaneSchema[laneType]?.showFilters === true;
  const itemCount = items?.length || 0;
  const needsScrolling = isMultiColumnLane ? true : itemCount > 4;  // Single-column fits ~4 items
  const showFilters = schemaShowFilters && needsScrolling;

  // State hooks
  const [isExpanded, setIsExpanded] = useState(!forceCollapsed);
  const [isMaximized, setIsMaximized] = useState(false);
  const [allItems, setAllItems] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResourceTypes, setSelectedResourceTypes] = useState([]);
  const [calculatedMaxHeight, setCalculatedMaxHeight] = useState(null);
  // Grid size state - null means use defaults from schema
  const [customColumns, setCustomColumns] = useState(null);
  const [customRows, setCustomRows] = useState(null);

  // Ref hooks
  const cardRef = useRef(null);

  // Effect: Respond to forceCollapsed changes from parent
  // This is a valid use case - syncing component state with parent-controlled prop
  useEffect(() => {
    if (forceCollapsed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsExpanded(false);
       
      setIsMaximized(false);
    }
  }, [forceCollapsed]);

  // Effect: Respond to forceExpanded changes from parent
  useEffect(() => {
    if (forceExpanded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsExpanded(true);
    }
  }, [forceExpanded]);

  // Track previous filter state so we only auto-expand on transition (not on every render)
  const prevFilterActiveRef = useRef(isFilterSource || isFiltered);

  // Effect: Auto-expand lanes when filtering transitions from inactive to active
  // This ensures lanes that become visible due to filter changes are shown expanded
  // but does NOT prevent manual collapse while filtering is active
  useEffect(() => {
    const hasActiveFilter = isFilterSource || isFiltered;
    const wasFilterActive = prevFilterActiveRef.current;
    prevFilterActiveRef.current = hasActiveFilter;

    const hasItems = items && items.length > 0;

    // Only auto-expand when filter state transitions from inactive to active
    if (hasActiveFilter && !wasFilterActive && hasItems && !isExpanded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsExpanded(true);
    }
  }, [isFilterSource, isFiltered, items, isExpanded]);

  // Compute available resource types from current items
  const availableResourceTypes = useMemo(() => {
    if (!items) return new Set();
    return new Set(items.map(getItemResourceType).filter(Boolean));
  }, [items]);

  // Filter selected resource types to only include available ones
  // This is computed/derived, avoiding the need for effect-based cleanup
  const validSelectedResourceTypes = useMemo(() => {
    if (selectedResourceTypes.length === 0) return selectedResourceTypes;
    return selectedResourceTypes.filter(type => availableResourceTypes.has(type));
  }, [selectedResourceTypes, availableResourceTypes]);

  // Memo: Extract unique resource types for the filter dropdown
  const allResourceTypes = useMemo(() => {
    if (!showFilters) return [];
    const resourceTypeSource = laneIsFiltered ? items : (allItemsData || items || []);
    return [...new Set(
      resourceTypeSource.map(getItemResourceType).filter(Boolean)
    )].sort();
  }, [showFilters, laneIsFiltered, items, allItemsData]);

  // Memo: Compute base items before local filtering
  const baseItems = useMemo(() => {
    if (laneIsFiltered) {
      return items; // Use filtered items when cross-lane filtering is active
    }
    if (isMaximized && allItems) {
      return allItems;
    }
    if (isMaximized && allItemsData) {
      return allItemsData;
    }
    return items;
  }, [laneIsFiltered, items, isMaximized, allItems, allItemsData]);

  // Memo: Apply local filters (search and resource type)
  const displayItems = useMemo(() => {
    const hasTypeFilter = showFilters && validSelectedResourceTypes.length > 0;
    const hasSearchFilter = showFilters && searchQuery.trim();

    if (!hasTypeFilter && !hasSearchFilter) {
      return baseItems;
    }

    const typeFilterSet = hasTypeFilter ? new Set(validSelectedResourceTypes) : null;
    const searchQueryLower = hasSearchFilter ? searchQuery.toLowerCase().trim() : null;

    return baseItems.filter(item => {
      if (typeFilterSet) {
        const itemType = getItemResourceType(item);
        if (!itemType || !typeFilterSet.has(itemType)) {
          return false;
        }
      }
      if (searchQueryLower) {
        const name = (item.node?.displayName || '').toLowerCase();
        if (!name.includes(searchQueryLower)) {
          return false;
        }
      }
      return true;
    });
  }, [baseItems, showFilters, validSelectedResourceTypes, searchQuery]);

  // Callback: Handle maximize - show all items with constrained height
  const handleMaximize = useCallback(() => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const headerHeight = 50;
      const filterBarHeight = showFilters && allResourceTypes.length > 0 ? 40 : 0;
      const availableHeight = viewportHeight - rect.top - headerHeight - filterBarHeight - 60;
      const constrainedHeight = Math.max(200, Math.min(600, availableHeight));
      setCalculatedMaxHeight(constrainedHeight);
    } else {
      setCalculatedMaxHeight(400);
    }
    setIsMaximized(true);
    if (allItemsData) {
      setAllItems(allItemsData);
    }
  }, [allItemsData, showFilters, allResourceTypes.length]);

  // Callback: Handle restore - back to normal view
  const handleRestore = useCallback(() => {
    setIsMaximized(false);
    setCalculatedMaxHeight(null);
  }, []);

  // ==========================================================================
  // EARLY RETURN - Safe to return here, all hooks have been called
  // ==========================================================================
  if (!isVisible) return null;

  // ==========================================================================
  // DERIVED VALUES - Computed after early return (no hooks allowed here)
  // ==========================================================================
  const displayConfig = getLaneDisplayConfig(laneType);
  // Schema-driven: showReasons defines which focus node types trigger reason pills
  const laneSchema = LaneSchema[laneType];
  const showReasons = laneSchema?.showReasons?.whenFocusNodeType?.includes(focusNodeType) ?? false;

  // Grid size: use custom values if set, otherwise use defaults from schema
  // Schema minColumns overrides global minimum (e.g., Entitlements requires min 2 columns)
  const { minColumns: globalMinColumns, maxColumns, minRows, maxRows, columnWidthPx } = LaneGridConstraints;
  const schemaMinColumns = displayConfig.minColumns || globalMinColumns;
  const effectiveMinColumns = Math.max(globalMinColumns, schemaMinColumns);

  const currentColumns = customColumns ?? displayConfig.columns;
  const currentRows = customRows ?? displayConfig.rows;
  // Ensure columns never go below schema minimum
  const effectiveColumns = isMaximized
    ? Math.max(effectiveMinColumns, currentColumns)
    : Math.max(effectiveMinColumns, currentColumns);
  const effectiveRows = isMaximized ? 10 : currentRows;
  const maxVisibleItems = effectiveColumns * effectiveRows;

  const isMultiColumn = effectiveColumns > 1;
  const hasMoreItems = !laneIsFiltered && totalCount > items.length;
  const isCollapsed = !isExpanded;

  // Check if grid can be increased/decreased (respecting schema minColumns)
  const canIncreaseGrid = currentColumns < maxColumns || currentRows < maxRows;
  const canDecreaseGrid = currentColumns > effectiveMinColumns || currentRows > minRows;

  // Regular functions (not hooks, so can be defined after early return)
  const toggleResourceType = (type) => {
    setSelectedResourceTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const clearResourceTypes = () => {
    setSelectedResourceTypes([]);
  };

  // Grid size adjustment functions
  const increaseGridSize = () => {
    const newColumns = Math.min(maxColumns, currentColumns + 1);
    const newRows = Math.min(maxRows, currentRows + 1);
    setCustomColumns(newColumns);
    setCustomRows(newRows);
  };

  const decreaseGridSize = () => {
    // Respect schema minColumns (e.g., Entitlements min 2)
    const newColumns = Math.max(effectiveMinColumns, currentColumns - 1);
    const newRows = Math.max(minRows, currentRows - 1);
    setCustomColumns(newColumns);
    setCustomRows(newRows);
  };

  // Use width from displayConfig (350px for single column, adjusted for custom columns)
  // Maximized mode uses calculated width, normal mode uses column-based width
  const calculatedWidth = currentColumns * columnWidthPx;
  const normalWidth = customColumns ? calculatedWidth : displayConfig.width;
  const laneWidth = isMaximized ? `${Math.max(700, calculatedWidth)}px` : `${normalWidth}px`;

  return (
    <div
      ref={cardRef}
      className={`lane-card ${isExpanded ? 'expanded' : 'collapsed'} ${isMaximized ? 'maximized' : ''} ${isFilterSource ? 'filter-source' : ''} ${laneIsFiltered ? 'filtered' : ''} ${isMultiColumn ? 'multi-column' : ''} columns-${effectiveColumns}`}
      data-lane-type={laneType}
      data-collapsed={isCollapsed}
      data-maximized={isMaximized}
      data-columns={effectiveColumns}
      data-rows={effectiveRows}
      style={{
        '--lane-columns': effectiveColumns,
        '--lane-rows': effectiveRows,
        '--lane-color': displayConfig.color,
        width: isExpanded ? laneWidth : '250px'
      }}
    >
      {/* Header - toggle button stops propagation to prevent drag interference */}
      <div className="lane-header" style={{ borderLeftColor: displayConfig.color }}>
        <span className="lane-icon">{displayConfig.icon}</span>
        <span className="lane-title">{displayConfig.label}</span>

        <span className="lane-count">
          ({(searchQuery.trim() || validSelectedResourceTypes.length > 0)
            ? `${displayItems.length}/${laneIsFiltered ? items.length : totalCount}`
            : (laneIsFiltered ? items.length : totalCount)})
        </span>
        {laneIsFiltered && !isFilterSource && <span className="lane-filter-badge">Filtered</span>}
        {isFilterSource && <span className="lane-filter-badge active">Filtering</span>}

        {/* Grid size controls - only show when expanded */}
        {isExpanded && (
          <div className="lane-grid-controls">
            <button
              className={`lane-grid-btn decrease ${!canDecreaseGrid ? 'disabled' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (canDecreaseGrid) decreaseGridSize();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={!canDecreaseGrid}
              title={`Decrease grid size (${currentColumns}×${currentRows})`}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <rect x="2" y="2" width="5" height="5" rx="1" opacity="0.4"/>
                <rect x="9" y="2" width="5" height="5" rx="1" opacity="0.4"/>
                <rect x="2" y="9" width="5" height="5" rx="1" opacity="0.4"/>
                <rect x="9" y="9" width="5" height="5" rx="1" opacity="0.4"/>
              </svg>
            </button>
            <button
              className={`lane-grid-btn increase ${!canIncreaseGrid ? 'disabled' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (canIncreaseGrid) increaseGridSize();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              disabled={!canIncreaseGrid}
              title={`Increase grid size (${currentColumns}×${currentRows})`}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <rect x="1" y="1" width="4" height="4" rx="0.5"/>
                <rect x="6" y="1" width="4" height="4" rx="0.5"/>
                <rect x="11" y="1" width="4" height="4" rx="0.5"/>
                <rect x="1" y="6" width="4" height="4" rx="0.5"/>
                <rect x="6" y="6" width="4" height="4" rx="0.5"/>
                <rect x="11" y="6" width="4" height="4" rx="0.5"/>
                <rect x="1" y="11" width="4" height="4" rx="0.5"/>
                <rect x="6" y="11" width="4" height="4" rx="0.5"/>
                <rect x="11" y="11" width="4" height="4" rx="0.5"/>
              </svg>
            </button>
          </div>
        )}

        {/* Maximize/Restore button - only show when there are more items */}
        {isExpanded && hasMoreItems && (
          <button
            className={`lane-maximize-btn ${isMaximized ? 'is-maximized' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              isMaximized ? handleRestore() : handleMaximize();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            title={isMaximized ? 'Restore to normal size' : `Show all ${totalCount} items`}
          >
            {isMaximized ? '⊟' : '⊞'}
          </button>
        )}

        <button
          className="lane-toggle-btn"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsExpanded(!isExpanded);
            if (!isExpanded) {
              setIsMaximized(false); // Restore when collapsing
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          title={isExpanded ? 'Collapse lane' : 'Expand lane'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {/* Search filter bar - below header, full width */}
      {showFilters && isExpanded && (
        <div
          className="lane-search-bar"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            id={`lane-search-${laneType}`}
            name={`lane-search-${laneType}`}
            className="lane-search-input"
            placeholder="Search..."
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          {searchQuery && (
            <button
              className="lane-search-clear"
              onClick={(e) => {
                e.stopPropagation();
                setSearchQuery('');
              }}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Resource Type Filter Bar - only for Effective Entitlements lane */}
      {showFilters && isExpanded && allResourceTypes.length > 0 && (
        <div
          className="lane-type-filter-bar"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="type-chips-container">
            {allResourceTypes.map(type => (
              <button
                key={type}
                className={`type-chip ${selectedResourceTypes.includes(type) ? 'selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleResourceType(type);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {type}
              </button>
            ))}
          </div>
          {selectedResourceTypes.length > 0 && (
            <button
              className="type-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                clearResourceTypes();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              title="Clear all type filters"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {isExpanded && (
        <div
          className={`lane-content ${isMultiColumn ? 'multi-column-content' : 'single-column-content'} ${isMaximized ? 'maximized-content' : ''}`}
          style={{
            display: isMultiColumn ? 'grid' : 'flex',
            flexDirection: isMultiColumn ? undefined : 'column',
            gridTemplateColumns: isMultiColumn ? `repeat(${effectiveColumns}, 1fr)` : undefined,
            gap: '0.5rem',
            maxHeight: isMaximized && calculatedMaxHeight ? `${calculatedMaxHeight}px` : '400px',
            overflowY: 'scroll',
            overflowX: 'hidden',
            paddingBottom: '3rem',
            paddingRight: '0.25rem'
          }}
        >
          {displayItems.length === 0 ? (
            <div className="lane-empty">No items</div>
          ) : (
            <>
              {/* Render ALL items - scrolling handles visibility */}
              {displayItems.map((item, index) => (
                <LaneItemRow
                  key={item.node.id || index}
                  item={item}
                  isSelected={selectedItemId === item.node.id}
                  isActiveFilter={activeFilterId === item.node.id}
                  onClick={(clickedItem) => onItemClick?.(clickedItem, laneType)}
                  onPivot={onPivot}
                  onReasonClick={onReasonClick}
                  selectedReasonId={selectedReasonId}
                  showReasons={showReasons}
                  viewMode={viewMode}
                />
              ))}

              {/* Restore button at bottom when maximized */}
              {isMaximized && (
                <button
                  className="lane-restore-btn"
                  onClick={handleRestore}
                  style={{ gridColumn: isMultiColumn ? '1 / -1' : undefined }}
                >
                  ↩ Restore to normal view
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Wrap in React.memo to prevent re-renders when props haven't changed (M-01 fix)
export default memo(LaneCard);
