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

import { useState, useCallback, useEffect } from 'react';
import { LaneTypes, getLaneDisplayConfig } from './accessLensTypes';
import LaneItemRow from './LaneItemRow';

const LaneCard = ({
  lane,
  focusNodeType,
  selectedItemId,
  selectedReasonId,
  onItemClick,
  onPivot,
  onReasonClick,
  onLoadMore,
  viewMode = 'explore',
  isVisible = true,
  isFilterActive = false,
  activeFilterId = null,
  forceCollapsed = false,  // When true, forces all lanes to collapsed state (used by Reset Layout)
  isFilterSource = false,  // When true, this lane is the source of filtering (shows "Filtering")
  isFiltered = false       // When true, this lane is being filtered by another lane (shows "Filtered")
}) => {
  const [isExpanded, setIsExpanded] = useState(!forceCollapsed);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [allItems, setAllItems] = useState(null); // Cache for all items when maximized
  const [searchQuery, setSearchQuery] = useState(''); // Search filter for entitlements

  // Respond to forceCollapsed changes from parent (e.g., Reset Layout)
  useEffect(() => {
    if (forceCollapsed) {
      setIsExpanded(false);
      setIsMaximized(false);
    }
  }, [forceCollapsed]);

  if (!isVisible) return null;

  const { laneType, totalCount, items, canLoadMore, allItemsData } = lane;
  // Use prop values for isFiltered/isFilterSource, fallback to lane.isFiltered if prop not provided
  const laneIsFiltered = isFiltered || lane.isFiltered;
  const displayConfig = getLaneDisplayConfig(laneType);
  const showReasons = laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS && focusNodeType === 'Identity';
  const isMultiColumn = displayConfig.columns > 1;
  const showSearch = laneType === LaneTypes.EFFECTIVE_ENTITLEMENTS; // Only show search for Entitlements

  // Determine which items to display (before search filtering)
  const baseItems = isMaximized && allItems ? allItems : (isMaximized && allItemsData ? allItemsData : items);

  // Apply search filter for entitlements lane
  const displayItems = showSearch && searchQuery.trim()
    ? baseItems.filter(item => {
        const name = (item.node?.displayName || '').toLowerCase();
        const query = searchQuery.toLowerCase().trim();
        return name.includes(query);
      })
    : baseItems;

  const hasMoreItems = totalCount > items.length;

  const handleLoadMore = async () => {
    if (!canLoadMore || isLoading) return;
    setIsLoading(true);
    try {
      await onLoadMore?.(laneType);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle maximize - show all items
  const handleMaximize = useCallback(() => {
    setIsMaximized(true);
    // If allItemsData is available from lane, use it
    if (lane.allItemsData) {
      setAllItems(lane.allItemsData);
    }
  }, [lane.allItemsData]);

  // Handle restore - back to normal view
  const handleRestore = useCallback(() => {
    setIsMaximized(false);
  }, []);

  const isCollapsed = !isExpanded;

  // Use width from displayConfig (350px for single column, 700px for multi-column)
  // Maximized mode uses larger width
  const normalWidth = displayConfig.width;
  const maximizedWidth = isMultiColumn ? 900 : 500;
  const laneWidth = isMaximized ? `${maximizedWidth}px` : `${normalWidth}px`;

  return (
    <div
      className={`lane-card ${isExpanded ? 'expanded' : 'collapsed'} ${isMaximized ? 'maximized' : ''} ${isFilterSource ? 'filter-source' : ''} ${laneIsFiltered ? 'filtered' : ''} ${isMultiColumn ? 'multi-column' : ''} columns-${displayConfig.columns}`}
      data-collapsed={isCollapsed}
      data-maximized={isMaximized}
      data-columns={displayConfig.columns}
      style={{
        '--lane-columns': displayConfig.columns,
        '--lane-color': displayConfig.color,
        width: isExpanded ? laneWidth : '250px'
      }}
    >
      {/* Header - toggle button stops propagation to prevent drag interference */}
      <div className="lane-header" style={{ borderLeftColor: displayConfig.color }}>
        <span className="lane-icon">{displayConfig.icon}</span>
        <span className="lane-title">{displayConfig.label}</span>

        {/* Search filter - inline in header, only for Effective Entitlements lane */}
        {showSearch && isExpanded && (
          <div className="lane-search-inline">
            <input
              type="text"
              className="lane-search-input-inline"
              placeholder="Filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            />
            {searchQuery && (
              <button
                className="lane-search-clear-inline"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery('');
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
        )}

        <span className="lane-count">
          ({searchQuery.trim() ? `${displayItems.length}/${totalCount}` : totalCount})
        </span>
        {laneIsFiltered && !isFilterSource && <span className="lane-filter-badge">Filtered</span>}
        {isFilterSource && <span className="lane-filter-badge active">Filtering</span>}

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

      {/* Content */}
      {isExpanded && (
        <div
          className={`lane-content ${isMultiColumn ? 'multi-column-content' : 'single-column-content'} ${isMaximized ? 'maximized-content' : ''}`}
          style={{
            display: isMultiColumn ? 'grid' : 'flex',
            flexDirection: isMultiColumn ? undefined : 'column',
            gridTemplateColumns: isMultiColumn ? `repeat(${displayConfig.columns}, 1fr)` : undefined,
            gap: '0.5rem',
            maxHeight: isMaximized ? '80vh' : undefined,
            overflowY: isMaximized ? 'auto' : undefined,
            overflowX: 'hidden',
            paddingBottom: isMaximized ? '1rem' : undefined
          }}
        >
          {displayItems.length === 0 ? (
            <div className="lane-empty">No items</div>
          ) : (
            <>
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

              {/* Load More - only show when not maximized and there are more items */}
              {!isMaximized && canLoadMore && (
                <button
                  className="lane-load-more"
                  onClick={handleMaximize}
                  disabled={isLoading}
                  style={{ gridColumn: isMultiColumn ? '1 / -1' : undefined }}
                >
                  {isLoading ? 'Loading...' : `Show all ${totalCount} items`}
                </button>
              )}

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

export default LaneCard;
