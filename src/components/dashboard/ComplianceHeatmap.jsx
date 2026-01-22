/**
 * ComplianceHeatmap Component
 *
 * Displays a treemap-style heatmap showing compliance by system.
 * - Tile size is proportional to account count
 * - Color indicates compliance rate (green = good, red = bad)
 * - Shows compliance breakdown with percentages and counts
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSystemCompliance } from '../../hooks/useSystemCompliance';
import './ComplianceHeatmap.css';

/**
 * Get color based on compliance rate
 * Uses a gradient from red (0%) to yellow (50%) to green (100%)
 */
const getComplianceColor = (complianceRate) => {
  if (complianceRate >= 90) return '#4caf50'; // Green - excellent
  if (complianceRate >= 75) return '#8bc34a'; // Light green - good
  if (complianceRate >= 60) return '#cddc39'; // Lime - acceptable
  if (complianceRate >= 45) return '#ffeb3b'; // Yellow - warning
  if (complianceRate >= 30) return '#ff9800'; // Orange - concerning
  if (complianceRate >= 15) return '#ff5722'; // Deep orange - bad
  return '#f44336'; // Red - critical
};

/**
 * Get background gradient based on compliance
 */
const getTileBackground = (complianceRate) => {
  const baseColor = getComplianceColor(complianceRate);
  // Create a subtle gradient for depth
  return `linear-gradient(135deg, ${baseColor}dd 0%, ${baseColor}99 100%)`;
};

/**
 * Get contrasting text color based on background
 */
const getTextColor = (complianceRate) => {
  // Light text for darker backgrounds (lower compliance)
  if (complianceRate < 50) return '#ffffff';
  // Dark text for lighter backgrounds (higher compliance)
  if (complianceRate >= 75) return '#1a1a1a';
  return '#1a1a1a';
};

/**
 * Row-based layout with logarithmic scaling
 * Uses log scale so similar values (316 vs 314) look similar
 * Groups systems into size buckets for more predictable layouts
 * Systems with identical accountCount values get identical tile sizes
 */
const calculateTreemapLayout = (systems, containerWidth, containerHeight) => {
  if (!systems || systems.length === 0) return [];

  const MIN_TILE_WIDTH = 150;
  const MIN_TILE_HEIGHT = 110;
  const GAP = 8;

  // Preserve the sort order from filteredSystems (sorted by compliance status)
  const sortedSystems = [...systems];

  // Check if all systems have the same accountCount - if so, use equal sizing
  const uniqueAccountCounts = new Set(sortedSystems.map(s => s.accountCount));
  const allSameValue = uniqueAccountCounts.size === 1;

  // Use logarithmic scaling: log(accounts + 1) to handle 0 accounts
  // This makes 10 vs 100 a bigger difference than 310 vs 400
  const getLogValue = (count) => Math.log10(Math.max(count, 1) + 1);

  const itemsWithSizes = sortedSystems.map(system => ({
    ...system,
    logValue: getLogValue(system.accountCount)
  }));

  // Find min/max log values for normalization
  const logValues = itemsWithSizes.map(i => i.logValue);
  const minLog = Math.min(...logValues);
  const maxLog = Math.max(...logValues);
  const logRange = maxLog - minLog;

  // Assign size category (1-5) based on normalized log value
  // Systems with the same accountCount will have the same logValue and thus same category
  const getSizeCategory = (logValue) => {
    // If all values are the same (logRange is 0), give them all category 3 (medium)
    if (logRange === 0) return 3;
    const normalized = (logValue - minLog) / logRange; // 0 to 1
    return Math.ceil(normalized * 4) + 1; // 1 to 5
  };

  // Size multipliers for each category
  const sizeMultipliers = { 1: 1, 2: 1.3, 3: 1.7, 4: 2.2, 5: 3 };

  // If all systems have the same value, use equal-sized tiles in a grid
  if (allSameValue) {
    const cols = Math.max(2, Math.min(5, Math.ceil(Math.sqrt(sortedSystems.length))));
    const tileWidth = Math.max(MIN_TILE_WIDTH, (containerWidth - (cols + 1) * GAP) / cols);
    const tileHeight = Math.max(MIN_TILE_HEIGHT, tileWidth * 0.75);

    return sortedSystems.map((system, index) => ({
      ...system,
      x: (index % cols) * (tileWidth + GAP),
      y: Math.floor(index / cols) * (tileHeight + GAP),
      width: tileWidth - GAP,
      height: tileHeight - GAP,
      sizeCategory: 3
    }));
  }

  const tiles = [];
  let currentX = 0;
  let currentY = 0;
  let rowItems = [];

  // Calculate tile widths based on size category
  const tilesPerRow = Math.max(2, Math.floor(containerWidth / (MIN_TILE_WIDTH * 1.5)));

  itemsWithSizes.forEach((system, index) => {
    const sizeCategory = getSizeCategory(system.logValue);
    const multiplier = sizeMultipliers[sizeCategory];
    const baseWidth = MIN_TILE_WIDTH * multiplier;

    // Check if we need to start a new row
    if (currentX + baseWidth > containerWidth && rowItems.length > 0) {
      // Finalize current row
      const totalRowWidth = rowItems.reduce((sum, item) => sum + item.baseWidth, 0);
      const scale = (containerWidth - GAP * rowItems.length) / totalRowWidth;

      let rowX = 0;
      const rowHeight = MIN_TILE_HEIGHT * Math.max(...rowItems.map(r => sizeMultipliers[r.sizeCategory])) * 0.8;

      rowItems.forEach(rowItem => {
        const finalWidth = rowItem.baseWidth * scale;
        tiles.push({
          ...rowItem.system,
          x: rowX,
          y: currentY,
          width: finalWidth - GAP,
          height: rowHeight - GAP,
          sizeCategory: rowItem.sizeCategory
        });
        rowX += finalWidth;
      });

      currentY += rowHeight;
      currentX = 0;
      rowItems = [];
    }

    rowItems.push({ system, baseWidth, sizeCategory });
    currentX += baseWidth;
  });

  // Finalize last row
  if (rowItems.length > 0) {
    const totalRowWidth = rowItems.reduce((sum, item) => sum + item.baseWidth, 0);
    // Don't over-stretch last row if few items
    const maxRowWidth = rowItems.length <= 2 ? containerWidth * 0.6 : containerWidth;
    const scale = Math.min((maxRowWidth - GAP * rowItems.length) / totalRowWidth, 1.5);

    let rowX = 0;
    const rowHeight = MIN_TILE_HEIGHT * Math.max(...rowItems.map(r => sizeMultipliers[r.sizeCategory])) * 0.8;

    rowItems.forEach(rowItem => {
      const finalWidth = Math.min(rowItem.baseWidth * scale, containerWidth / 2);
      tiles.push({
        ...rowItem.system,
        x: rowX,
        y: currentY,
        width: finalWidth - GAP,
        height: rowHeight - GAP,
        sizeCategory: rowItem.sizeCategory
      });
      rowX += finalWidth + GAP;
    });
  }

  return tiles;
};

/**
 * Layout for equal-sized tiles when all have 0 accounts
 */
const layoutEqualSized = (systems, containerWidth, containerHeight) => {
  const cols = Math.ceil(Math.sqrt(systems.length));
  const tileWidth = (containerWidth - (cols + 1) * 8) / cols;
  const tileHeight = Math.min(120, tileWidth * 0.8);
  const gap = 8;

  return systems.map((system, index) => ({
    ...system,
    x: (index % cols) * (tileWidth + gap),
    y: Math.floor(index / cols) * (tileHeight + gap),
    width: tileWidth,
    height: tileHeight
  }));
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
 * HeatmapTile Component - Individual system tile
 */
const HeatmapTile = ({ system, onClick }) => {
  const complianceRate = system.compliance?.complianceRate || 0;
  const textColor = getTextColor(complianceRate);
  const secondaryColor = complianceRate < 50 ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';

  // Determine if tile is small (compact display)
  const isSmall = system.width < 180 || system.height < 140;
  const isTiny = system.width < 150 || system.height < 100;

  return (
    <div
      className="heatmap-tile"
      style={{
        left: system.x,
        top: system.y,
        width: system.width,
        height: system.height,
        background: getTileBackground(complianceRate),
        '--text-color': textColor,
        '--secondary-color': secondaryColor
      }}
      onClick={() => onClick && onClick(system)}
      title={`${system.name}: ${complianceRate}% compliant (${system.accountCount} accounts)`}
    >
      <div className="tile-content">
        <div className="tile-header">
          <span className={`tile-name ${isTiny ? 'tiny' : isSmall ? 'small' : ''}`}>
            {system.name}
          </span>
        </div>

        {!isTiny && (
          <div className="tile-compliance-rate">
            <span className="rate-value">{complianceRate}%</span>
            <span className="rate-label">compliant</span>
          </div>
        )}

        {isTiny && (
          <div className="tile-compliance-rate tiny">
            <span className="rate-value">{complianceRate}%</span>
          </div>
        )}

        {!isSmall && (
          <div className="tile-stats">
            <div className="stat-row">
              <span className="stat-icon compliant">&#x2714;</span>
              <span className="stat-label">Approved:</span>
              <span className="stat-value">{formatNumber(system.compliance?.compliant || 0)}</span>
              <span className="stat-percent">
                ({system.compliance?.total > 0
                  ? Math.round((system.compliance.compliant / system.compliance.total) * 100)
                  : 0}%)
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-icon non-compliant">&#x2718;</span>
              <span className="stat-label">Not Approved:</span>
              <span className="stat-value">{formatNumber(system.compliance?.nonCompliant || 0)}</span>
              <span className="stat-percent">
                ({system.compliance?.total > 0
                  ? Math.round((system.compliance.nonCompliant / system.compliance.total) * 100)
                  : 0}%)
              </span>
            </div>
            {system.compliance?.pending > 0 && (
              <div className="stat-row">
                <span className="stat-icon pending">&#x25CF;</span>
                <span className="stat-label">Pending:</span>
                <span className="stat-value">{formatNumber(system.compliance.pending)}</span>
                <span className="stat-percent">
                  ({Math.round((system.compliance.pending / system.compliance.total) * 100)}%)
                </span>
              </div>
            )}
          </div>
        )}

        <div className={`tile-footer ${isSmall ? 'small' : ''}`}>
          <span className="footer-item">
            <span className="footer-icon">&#x1F464;</span>
            {formatNumber(system.accountCount)} accounts
          </span>
          {!isSmall && (
            <span className="footer-item">
              <span className="footer-icon">&#x1F4CB;</span>
              {formatNumber(system.compliance?.total || 0)} assignments
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * ComplianceHeatmap Component
 */
const ComplianceHeatmap = ({ bearerToken, impersonateUser }) => {
  const navigate = useNavigate();
  const [containerSize, setContainerSize] = useState({ width: 800, height: 400 });
  const [selectedStatuses, setSelectedStatuses] = useState([]); // Empty = show all
  const [showOnlyNonCompliant, setShowOnlyNonCompliant] = useState(false);
  const containerRef = useRef(null);
  const hasInitializedSize = useRef(false);

  const { systems, isLoading, error, progress, refetch } = useSystemCompliance(
    bearerToken,
    impersonateUser,
    { maxSystems: 30, assignmentsPerSystem: 1000 }
  );

  // Extract all unique compliance statuses from systems data
  const allStatuses = useMemo(() => {
    if (!systems || systems.length === 0) return [];
    const statusSet = new Set();
    systems.forEach(system => {
      if (system.compliance?.byStatus) {
        Object.keys(system.compliance.byStatus).forEach(status => statusSet.add(status));
      }
    });
    return Array.from(statusSet).sort();
  }, [systems]);

  // Filter systems based on selected statuses
  const filteredSystems = useMemo(() => {
    if (!systems || systems.length === 0) return [];

    let filtered = systems;

    // Filter by "show only non-compliant" toggle
    if (showOnlyNonCompliant) {
      filtered = filtered.filter(system => {
        const rate = system.compliance?.complianceRate || 0;
        return rate < 100; // Show systems that are not 100% compliant
      });

      // Override accountCount with non-compliance rate for tile sizing
      // 0% compliance = 100 (largest), 99% compliance = 1 (smallest)
      filtered = filtered.map(system => ({
        ...system,
        accountCount: Math.max(1, 100 - (system.compliance?.complianceRate || 0))
      }));
    }

    // Filter by selected statuses - show systems that have ANY of the selected statuses
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(system => {
        if (!system.compliance?.byStatus) return false;
        return selectedStatuses.some(status => system.compliance.byStatus[status] > 0);
      });
    }

    // Sort by compliance rate
    // When showOnlyNonCompliant is TRUE: 0% at top (ascending - worst first)
    // When showOnlyNonCompliant is FALSE: 100% at top (descending - best first)
    filtered = [...filtered].sort((a, b) => {
      const complianceA = a.compliance?.complianceRate || 0;
      const complianceB = b.compliance?.complianceRate || 0;
      if (showOnlyNonCompliant) {
        return complianceA - complianceB; // Ascending: 0% first
      } else {
        return complianceB - complianceA; // Descending: 100% first
      }
    });

    return filtered;
  }, [systems, selectedStatuses, showOnlyNonCompliant]);

  // Calculate layout when filtered systems or container size changes
  const tilesWithLayout = useMemo(() => {
    if (!filteredSystems || filteredSystems.length === 0) return [];
    return calculateTreemapLayout(filteredSystems, containerSize.width, containerSize.height);
  }, [filteredSystems, containerSize.width, containerSize.height]);

  // Calculate overall statistics (from filtered systems)
  const overallStats = useMemo(() => {
    if (!filteredSystems || filteredSystems.length === 0) {
      return { totalSystems: 0, totalAccounts: 0, totalAssignments: 0, avgCompliance: 0, isFiltered: false };
    }

    const totalSystems = filteredSystems.length;
    const totalAccounts = filteredSystems.reduce((sum, s) => sum + s.accountCount, 0);
    const totalAssignments = filteredSystems.reduce((sum, s) => sum + (s.compliance?.total || 0), 0);
    const totalCompliant = filteredSystems.reduce((sum, s) => sum + (s.compliance?.compliant || 0), 0);
    const avgCompliance = totalAssignments > 0 ? Math.round((totalCompliant / totalAssignments) * 100) : 0;
    const isFiltered = selectedStatuses.length > 0 || showOnlyNonCompliant;

    return { totalSystems, totalAccounts, totalAssignments, avgCompliance, isFiltered };
  }, [filteredSystems, selectedStatuses.length, showOnlyNonCompliant]);

  // Toggle a status in the filter
  const toggleStatus = (status) => {
    setSelectedStatuses(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedStatuses([]);
    setShowOnlyNonCompliant(false);
  };

  // Handle container resize - measure once when systems load
  useEffect(() => {
    if (containerRef.current && systems.length > 0 && !hasInitializedSize.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.max(600, rect.width - 32);
      setContainerSize({
        width: newWidth,
        height: 400
      });
      hasInitializedSize.current = true;
    }
  }, [systems.length]);

  const handleTileClick = (system) => {
    // Navigate to Identity360 with system as the focus node
    const systemId = system.id;
    const systemName = encodeURIComponent(system.name || 'System');
    navigate(`/identity360?system=${systemId}&systemName=${systemName}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="compliance-heatmap loading">
        <div className="heatmap-header">
          <h2>System Compliance Overview</h2>
        </div>
        <div className="heatmap-loading">
          <div className="loading-spinner"></div>
          <div className="loading-text">
            <span className="loading-status">{progress.currentSystem}</span>
            {progress.total > 0 && (
              <span className="loading-progress">
                {progress.current} of {progress.total} systems
              </span>
            )}
          </div>
          <div className="loading-bar">
            <div
              className="loading-bar-fill"
              style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="compliance-heatmap error">
        <div className="heatmap-header">
          <h2>System Compliance Overview</h2>
        </div>
        <div className="heatmap-error">
          <span className="error-icon">&#x26A0;</span>
          <span className="error-text">Failed to load compliance data: {error}</span>
          <button className="retry-btn" onClick={refetch}>Retry</button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!systems || systems.length === 0) {
    return (
      <div className="compliance-heatmap empty">
        <div className="heatmap-header">
          <h2>System Compliance Overview</h2>
        </div>
        <div className="heatmap-empty">
          <span className="empty-icon">&#x1F50D;</span>
          <span className="empty-text">No systems found</span>
        </div>
      </div>
    );
  }

  // Calculate max height needed
  const maxTileBottom = tilesWithLayout.length > 0
    ? Math.max(...tilesWithLayout.map(t => t.y + t.height), 400)
    : 400;

  return (
    <div className="compliance-heatmap" ref={containerRef}>
      <div className="heatmap-header">
        <div className="header-left">
          <h2>System Compliance Overview</h2>
          <span className="header-subtitle">
            Tile size indicates account volume. Color indicates compliance rate.
          </span>
        </div>
        <div className="header-stats">
          <div className="header-stat">
            <span className="stat-value">{overallStats.totalSystems}</span>
            <span className="stat-label">Systems</span>
          </div>
          <div className="header-stat">
            <span className="stat-value">{formatNumber(overallStats.totalAccounts)}</span>
            <span className="stat-label">Accounts</span>
          </div>
          <div className="header-stat">
            <span className="stat-value">{formatNumber(overallStats.totalAssignments)}</span>
            <span className="stat-label">Assignments</span>
          </div>
          <div className="header-stat highlight">
            <span className="stat-value" style={{ color: getComplianceColor(overallStats.avgCompliance) }}>
              {overallStats.avgCompliance}%
            </span>
            <span className="stat-label">Overall Compliant</span>
          </div>
          <button className="refresh-btn" onClick={refetch} title="Refresh data">
            &#x21BB;
          </button>
        </div>
      </div>

      {/* Status Filters */}
      <div className="heatmap-filters">
        <div className="filter-section">
          <span className="filter-label">Filter by status:</span>
          <div className="filter-chips">
            {allStatuses.map(status => {
              const isSelected = selectedStatuses.includes(status);
              const isApproved = status.toLowerCase().includes('approved');
              return (
                <button
                  key={status}
                  className={`filter-chip ${isSelected ? 'selected' : ''} ${isApproved ? 'approved' : 'not-approved'}`}
                  onClick={() => toggleStatus(status)}
                >
                  {status}
                  {isSelected && <span className="chip-check">&#x2713;</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="filter-actions">
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={showOnlyNonCompliant}
              onChange={(e) => setShowOnlyNonCompliant(e.target.checked)}
            />
            <span>Show only non-compliant systems</span>
          </label>
          {(selectedStatuses.length > 0 || showOnlyNonCompliant) && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
        {overallStats.isFiltered && (
          <div className="filter-info">
            Showing {filteredSystems.length} of {systems.length} systems
          </div>
        )}
      </div>

      <div className="heatmap-legend">
        <span className="legend-label">Compliance:</span>
        <div className="legend-gradient">
          <span className="legend-low">0%</span>
          <div className="gradient-bar"></div>
          <span className="legend-high">100%</span>
        </div>
      </div>

      <div
        className="heatmap-container"
        style={{ height: Math.max(maxTileBottom + 16, 400) }}
      >
        {tilesWithLayout.length > 0 ? (
          tilesWithLayout.map((system) => (
            <HeatmapTile
              key={system.id}
              system={system}
              onClick={handleTileClick}
            />
          ))
        ) : (
          <div className="heatmap-no-results">
            <span className="no-results-icon">&#x1F50D;</span>
            <span className="no-results-text">No systems match the selected filters</span>
            <button className="clear-filters-btn" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* System detail panel removed - now navigates to Identity360 on tile click */}
    </div>
  );
};

export default ComplianceHeatmap;
