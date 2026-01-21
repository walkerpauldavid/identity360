/**
 * ComplianceStatusHeatmap Component
 *
 * Displays a treemap-style heatmap showing compliance by STATUS (not by system).
 * Aggregates the byStatus data across all systems to show the overall compliance landscape.
 * - Tile size is proportional to assignment count for that status
 * - Color indicates status type (approved = green, violations = red, etc.)
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import './ComplianceStatusHeatmap.css';

/**
 * The four main status categories for the heatmap
 */
const STATUS_CATEGORIES = {
  APPROVED: 'Approved',
  PENDING_ASSIGNED: 'Pending / Assigned',
  NOT_APPROVED: 'Not Approved / Violation',
  ORPHAN: 'Orphan'
};

/**
 * Color mapping for the four main categories
 */
const CATEGORY_COLORS = {
  [STATUS_CATEGORIES.APPROVED]: '#4caf50',
  [STATUS_CATEGORIES.PENDING_ASSIGNED]: '#ff9800',
  [STATUS_CATEGORIES.NOT_APPROVED]: '#f44336',
  [STATUS_CATEGORIES.ORPHAN]: '#e65100'
};

/**
 * Categorize a raw status into one of the four main categories
 * @param {string} status - Raw status from API (e.g., "Implicitly Approved", "Not Approved")
 * @returns {string} One of the STATUS_CATEGORIES values
 */
const categorizeStatus = (status) => {
  const statusLower = status.toLowerCase();

  // Orphan - check first as it's specific
  if (statusLower.includes('orphan')) {
    return STATUS_CATEGORIES.ORPHAN;
  }

  // Not Approved / Violation - check before "approved" to catch "not approved"
  if (statusLower.includes('not approved') ||
      statusLower.includes('violation') ||
      statusLower.includes('rejected')) {
    return STATUS_CATEGORIES.NOT_APPROVED;
  }

  // Approved - any approval status
  if (statusLower.includes('approved')) {
    return STATUS_CATEGORIES.APPROVED;
  }

  // Pending / Assigned - everything else (assigned, pending, review, none, etc.)
  return STATUS_CATEGORIES.PENDING_ASSIGNED;
};

/**
 * Get color for a category
 */
const getStatusColor = (category) => {
  return CATEGORY_COLORS[category] || '#607d8b';
};

/**
 * Determine if category is "compliant"
 */
const isCompliantStatus = (category) => {
  return category === STATUS_CATEGORIES.APPROVED;
};

/**
 * Get text color based on background brightness
 */
const getTextColor = (bgColor) => {
  // Simple brightness check - darker colors get white text
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#1a1a1a' : '#ffffff';
};

/**
 * Calculate treemap layout for status tiles
 */
const calculateStatusLayout = (statusData, containerWidth, containerHeight) => {
  if (!statusData || statusData.length === 0) return [];

  const MIN_TILE_WIDTH = 120;
  const MIN_TILE_HEIGHT = 80;
  const GAP = 6;

  // Sort by count descending (largest first)
  const sortedData = [...statusData].sort((a, b) => b.count - a.count);

  const totalCount = sortedData.reduce((sum, s) => sum + s.count, 0);
  if (totalCount === 0) return [];

  const tiles = [];
  let currentX = 0;
  let currentY = 0;
  let rowItems = [];
  let rowHeight = MIN_TILE_HEIGHT;

  // Calculate proportional widths based on count
  sortedData.forEach((status, index) => {
    // Calculate proportional width (minimum 15% of container, maximum 60%)
    const proportion = status.count / totalCount;
    const baseWidth = Math.max(
      MIN_TILE_WIDTH,
      Math.min(containerWidth * 0.6, containerWidth * Math.max(0.15, proportion))
    );

    // Check if we need a new row
    if (currentX + baseWidth > containerWidth && rowItems.length > 0) {
      // Finalize current row - scale items to fill width
      const totalRowWidth = rowItems.reduce((sum, item) => sum + item.baseWidth, 0);
      const scale = (containerWidth - GAP * (rowItems.length - 1)) / totalRowWidth;

      let rowX = 0;
      rowItems.forEach(rowItem => {
        const finalWidth = rowItem.baseWidth * scale;
        tiles.push({
          ...rowItem.status,
          x: rowX,
          y: currentY,
          width: finalWidth - GAP,
          height: rowHeight - GAP
        });
        rowX += finalWidth;
      });

      currentY += rowHeight;
      currentX = 0;
      rowItems = [];

      // Adjust row height for subsequent rows (smaller items)
      rowHeight = Math.max(MIN_TILE_HEIGHT, MIN_TILE_HEIGHT * 1.2);
    }

    rowItems.push({ status, baseWidth });
    currentX += baseWidth;
  });

  // Finalize last row
  if (rowItems.length > 0) {
    const totalRowWidth = rowItems.reduce((sum, item) => sum + item.baseWidth, 0);
    // Don't over-stretch if few items
    const maxRowWidth = rowItems.length <= 2 ? containerWidth * 0.7 : containerWidth;
    const scale = Math.min((maxRowWidth - GAP * (rowItems.length - 1)) / totalRowWidth, 1.5);

    let rowX = 0;
    rowItems.forEach(rowItem => {
      const finalWidth = Math.min(rowItem.baseWidth * scale, containerWidth * 0.5);
      tiles.push({
        ...rowItem.status,
        x: rowX,
        y: currentY,
        width: finalWidth - GAP,
        height: rowHeight - GAP
      });
      rowX += finalWidth + GAP;
    });
  }

  return tiles;
};

/**
 * Format number with K/M suffix
 */
const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

/**
 * Build tooltip with raw status breakdown
 */
const buildTooltip = (status, percentage) => {
  let tooltip = `${status.name}: ${formatNumber(status.count)} assignments (${percentage}%)`;

  // Add breakdown of raw statuses if available
  if (status.rawStatuses && Object.keys(status.rawStatuses).length > 0) {
    tooltip += '\n\nBreakdown:';
    Object.entries(status.rawStatuses)
      .sort(([, a], [, b]) => b - a)
      .forEach(([rawStatus, count]) => {
        tooltip += `\n  ${rawStatus}: ${formatNumber(count)}`;
      });
  }

  return tooltip;
};

/**
 * StatusTile Component - Individual status tile
 */
const StatusTile = ({ status, totalCount, onClick }) => {
  const bgColor = getStatusColor(status.name);
  const textColor = getTextColor(bgColor);
  const percentage = totalCount > 0 ? ((status.count / totalCount) * 100).toFixed(1) : 0;

  const isSmall = status.width < 150 || status.height < 100;
  const isTiny = status.width < 120 || status.height < 80;

  return (
    <div
      className={`status-tile ${isCompliantStatus(status.name) ? 'compliant' : 'non-compliant'}`}
      style={{
        left: status.x,
        top: status.y,
        width: status.width,
        height: status.height,
        background: `linear-gradient(135deg, ${bgColor}ee 0%, ${bgColor}bb 100%)`,
        '--text-color': textColor,
        '--secondary-color': textColor === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'
      }}
      onClick={() => onClick && onClick(status)}
      title={buildTooltip(status, percentage)}
    >
      <div className="status-tile-content">
        <div className={`status-tile-name ${isTiny ? 'tiny' : isSmall ? 'small' : ''}`}>
          {status.name}
        </div>

        <div className={`status-tile-count ${isTiny ? 'tiny' : ''}`}>
          <span className="count-value">{formatNumber(status.count)}</span>
          {!isTiny && <span className="count-label">assignments</span>}
        </div>

        {!isTiny && (
          <div className="status-tile-percentage">
            {percentage}%
          </div>
        )}

        {!isSmall && status.systemCount > 0 && (
          <div className="status-tile-systems">
            across {status.systemCount} system{status.systemCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ComplianceStatusHeatmap Component
 *
 * @param {Object} props
 * @param {Array} props.systems - Systems data from useSystemCompliance hook
 * @param {boolean} props.isLoading - Loading state
 * @param {string} props.error - Error message if any
 * @param {Function} props.onStatusClick - Callback when a status tile is clicked
 */
const ComplianceStatusHeatmap = ({ systems, isLoading, error, onStatusClick }) => {
  const [containerSize, setContainerSize] = useState({ width: 700, height: 300 });
  const [selectedSystems, setSelectedSystems] = useState([]); // Empty = all systems
  const containerRef = useRef(null);
  const hasInitializedSize = useRef(false);

  // Get list of systems that have compliance data (for filter pills)
  const systemsWithData = useMemo(() => {
    if (!systems || systems.length === 0) return [];
    return systems
      .filter(s => s.compliance?.total > 0)
      .sort((a, b) => (b.compliance?.total || 0) - (a.compliance?.total || 0));
  }, [systems]);

  // Toggle system selection
  const toggleSystem = (systemId) => {
    setSelectedSystems(prev => {
      if (prev.includes(systemId)) {
        return prev.filter(id => id !== systemId);
      } else {
        return [...prev, systemId];
      }
    });
  };

  // Clear all system filters
  const clearSystemFilters = () => {
    setSelectedSystems([]);
  };

  // Select all systems
  const selectAllSystems = () => {
    setSelectedSystems(systemsWithData.map(s => s.id));
  };

  // Aggregate byStatus across selected systems into four main categories
  const statusData = useMemo(() => {
    if (!systems || systems.length === 0) return [];

    // Initialize the four category buckets
    const categoryMap = {
      [STATUS_CATEGORIES.APPROVED]: {
        name: STATUS_CATEGORIES.APPROVED,
        count: 0,
        systemCount: 0,
        systems: [],
        rawStatuses: {} // Track original status breakdown
      },
      [STATUS_CATEGORIES.PENDING_ASSIGNED]: {
        name: STATUS_CATEGORIES.PENDING_ASSIGNED,
        count: 0,
        systemCount: 0,
        systems: [],
        rawStatuses: {}
      },
      [STATUS_CATEGORIES.NOT_APPROVED]: {
        name: STATUS_CATEGORIES.NOT_APPROVED,
        count: 0,
        systemCount: 0,
        systems: [],
        rawStatuses: {}
      },
      [STATUS_CATEGORIES.ORPHAN]: {
        name: STATUS_CATEGORIES.ORPHAN,
        count: 0,
        systemCount: 0,
        systems: [],
        rawStatuses: {}
      }
    };

    // Track which systems contribute to each category
    const systemsPerCategory = {
      [STATUS_CATEGORIES.APPROVED]: new Set(),
      [STATUS_CATEGORIES.PENDING_ASSIGNED]: new Set(),
      [STATUS_CATEGORIES.NOT_APPROVED]: new Set(),
      [STATUS_CATEGORIES.ORPHAN]: new Set()
    };

    // Filter systems based on selection
    const systemsToAggregate = selectedSystems.length > 0
      ? systems.filter(s => selectedSystems.includes(s.id))
      : systems;

    systemsToAggregate.forEach(system => {
      if (system.compliance?.byStatus) {
        Object.entries(system.compliance.byStatus).forEach(([rawStatus, count]) => {
          // Categorize the raw status into one of four categories
          const category = categorizeStatus(rawStatus);

          // Add to category count
          categoryMap[category].count += count;

          // Track raw status breakdown within category
          if (!categoryMap[category].rawStatuses[rawStatus]) {
            categoryMap[category].rawStatuses[rawStatus] = 0;
          }
          categoryMap[category].rawStatuses[rawStatus] += count;

          // Track system contribution
          if (!systemsPerCategory[category].has(system.id)) {
            systemsPerCategory[category].add(system.id);
            categoryMap[category].systems.push({
              id: system.id,
              name: system.name,
              count: 0
            });
          }

          // Update system count within category
          const systemEntry = categoryMap[category].systems.find(s => s.id === system.id);
          if (systemEntry) {
            systemEntry.count += count;
          }
        });
      }
    });

    // Set system counts
    Object.keys(categoryMap).forEach(category => {
      categoryMap[category].systemCount = systemsPerCategory[category].size;
    });

    // Convert to array, filter out empty categories, and sort by count
    return Object.values(categoryMap)
      .filter(cat => cat.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [systems, selectedSystems]);

  // Calculate totals
  const totals = useMemo(() => {
    const total = statusData.reduce((sum, s) => sum + s.count, 0);
    const compliant = statusData
      .filter(s => isCompliantStatus(s.name))
      .reduce((sum, s) => sum + s.count, 0);
    const nonCompliant = total - compliant;
    const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 0;

    return { total, compliant, nonCompliant, complianceRate };
  }, [statusData]);

  // Calculate layout
  const tilesWithLayout = useMemo(() => {
    if (!statusData || statusData.length === 0) return [];
    return calculateStatusLayout(statusData, containerSize.width, containerSize.height);
  }, [statusData, containerSize.width, containerSize.height]);

  // Handle container resize
  useEffect(() => {
    if (containerRef.current && statusData.length > 0 && !hasInitializedSize.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(500, rect.width - 32);
      setContainerSize({
        width: newWidth,
        height: Math.max(250, Math.min(400, statusData.length * 60))
      });
      hasInitializedSize.current = true;
    }
  }, [statusData.length]);

  const handleStatusClick = (status) => {
    if (onStatusClick) {
      onStatusClick(status);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="compliance-status-heatmap loading">
        <div className="status-heatmap-header">
          <h3>Compliance Status Distribution</h3>
        </div>
        <div className="status-heatmap-loading">
          <div className="loading-spinner"></div>
          <span>Loading status data...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="compliance-status-heatmap error">
        <div className="status-heatmap-header">
          <h3>Compliance Status Distribution</h3>
        </div>
        <div className="status-heatmap-error">
          <span className="error-icon">&#x26A0;</span>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (!statusData || statusData.length === 0) {
    return (
      <div className="compliance-status-heatmap empty">
        <div className="status-heatmap-header">
          <h3>Compliance Status Distribution</h3>
        </div>
        <div className="status-heatmap-empty">
          <span>No compliance data available</span>
        </div>
      </div>
    );
  }

  // Calculate max height needed
  const maxTileBottom = tilesWithLayout.length > 0
    ? Math.max(...tilesWithLayout.map(t => t.y + t.height), 250)
    : 250;

  return (
    <div className="compliance-status-heatmap" ref={containerRef}>
      <div className="status-heatmap-header">
        <div className="header-left">
          <h3>Compliance Status Distribution</h3>
          <span className="header-subtitle">
            {selectedSystems.length > 0
              ? `Filtered to ${selectedSystems.length} system${selectedSystems.length !== 1 ? 's' : ''}. Tile size indicates volume.`
              : 'Aggregated across all systems. Tile size indicates volume.'}
          </span>
        </div>
        <div className="header-stats">
          <div className="header-stat">
            <span className="stat-value">{formatNumber(totals.total)}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="header-stat compliant">
            <span className="stat-value">{formatNumber(totals.compliant)}</span>
            <span className="stat-label">Compliant</span>
          </div>
          <div className="header-stat non-compliant">
            <span className="stat-value">{formatNumber(totals.nonCompliant)}</span>
            <span className="stat-label">Non-Compliant</span>
          </div>
          <div className="header-stat highlight">
            <span className="stat-value" style={{
              color: totals.complianceRate >= 90 ? '#4caf50' :
                     totals.complianceRate >= 70 ? '#ff9800' : '#f44336'
            }}>
              {totals.complianceRate}%
            </span>
            <span className="stat-label">Overall</span>
          </div>
        </div>
      </div>

      {/* System Filter Pills */}
      {systemsWithData.length > 1 && (
        <div className="system-filter-section">
          <div className="system-filter-header">
            <span className="filter-label">Filter by System:</span>
            <div className="filter-actions">
              {selectedSystems.length > 0 && (
                <button className="filter-action-btn" onClick={clearSystemFilters}>
                  Clear
                </button>
              )}
              {selectedSystems.length !== systemsWithData.length && (
                <button className="filter-action-btn" onClick={selectAllSystems}>
                  Select All
                </button>
              )}
            </div>
          </div>
          <div className="system-filter-pills">
            {systemsWithData.map(system => {
              const isSelected = selectedSystems.includes(system.id);
              const complianceRate = system.compliance?.complianceRate || 0;
              return (
                <button
                  key={system.id}
                  className={`system-pill ${isSelected ? 'selected' : ''} ${selectedSystems.length === 0 ? 'all-active' : ''}`}
                  onClick={() => toggleSystem(system.id)}
                  title={`${system.name}: ${system.compliance?.total || 0} assignments, ${complianceRate}% compliant`}
                >
                  <span className="pill-name">{system.name}</span>
                  <span
                    className="pill-indicator"
                    style={{
                      background: complianceRate >= 90 ? '#4caf50' :
                                  complianceRate >= 70 ? '#ff9800' : '#f44336'
                    }}
                  ></span>
                </button>
              );
            })}
          </div>
          {selectedSystems.length > 0 && (
            <div className="filter-info">
              Showing {selectedSystems.length} of {systemsWithData.length} systems
            </div>
          )}
        </div>
      )}

      <div className="status-heatmap-legend">
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#4caf50' }}></span>
          <span className="legend-label">Approved</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#ff9800' }}></span>
          <span className="legend-label">Pending/Assigned</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#f44336' }}></span>
          <span className="legend-label">Not Approved/Violation</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ background: '#e65100' }}></span>
          <span className="legend-label">Orphan</span>
        </div>
      </div>

      <div
        className="status-heatmap-container"
        style={{ height: Math.max(maxTileBottom + 16, 250) }}
      >
        {tilesWithLayout.map((status) => (
          <StatusTile
            key={status.name}
            status={status}
            totalCount={totals.total}
            onClick={handleStatusClick}
          />
        ))}
      </div>
    </div>
  );
};

export default ComplianceStatusHeatmap;
