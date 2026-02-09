/**
 * Dashboard Component
 * Tiled interface for Omada API metrics with drag-and-drop reordering
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, DragOverlay, PointerSensor, useSensors, useSensor } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useAuth } from '../../contexts/AuthContext';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useGetIdentityCount, useGetAccessRequestsTotal } from '../../hooks/useOmadaApi';
import SortableTile from './SortableTile';
import Tile from './Tile';
import ComplianceHeatmap from './ComplianceHeatmap';
import ComplianceStatusHeatmap from './ComplianceStatusHeatmap';
import { useSystemCompliance } from '../../hooks/useSystemCompliance';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { getBearerToken, user } = useAuth();
  const { getPreference, setPreference, preferences } = usePreferences();
  const bearerToken = getBearerToken();
  const impersonateUser = user?.email;

  // Get current theme
  const currentTheme = preferences.theme || 'light';

  // Configure drag sensors with distance threshold
  // This allows clicks to work normally, while drag only activates after moving 8px
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  // Get tile configuration from preferences
  const dashboardTiles = getPreference('dashboardTiles', {
    order: ['identities', 'myTeam', 'approvals', 'reviews', 'other'],
    hidden: []
  });

  // Get tile layout preference (horizontal or vertical)
  const tileLayout = getPreference('dashboardTileLayout', 'horizontal');

  // Active drag state for overlay
  const [activeDragId, setActiveDragId] = useState(null);

  // Heatmap toggle state (default OFF)
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Individual heatmap minimize state
  const [minimizedHeatmaps, setMinimizedHeatmaps] = useState({
    statusDistribution: true,
    systemCompliance: false
  });

  // Toggle individual heatmap minimize state
  const toggleHeatmapMinimize = (heatmapId) => {
    setMinimizedHeatmaps(prev => ({
      ...prev,
      [heatmapId]: !prev[heatmapId]
    }));
  };

  // Minimize/expand all heatmaps
  const toggleAllHeatmaps = () => {
    const allMinimized = Object.values(minimizedHeatmaps).every(v => v);
    setMinimizedHeatmaps({
      statusDistribution: !allMinimized,
      systemCompliance: !allMinimized
    });
  };

  // Fetch system compliance data (shared between both heatmap views)
  const {
    systems: heatmapSystems,
    isLoading: heatmapLoading,
    error: heatmapError,
    progress: heatmapProgress,
    refetch: refetchHeatmap
  } = useSystemCompliance(
    showHeatmap ? bearerToken : null, // Only fetch when heatmap is shown
    showHeatmap ? impersonateUser : null,
    { maxSystems: 30, assignmentsPerSystem: 1000 }
  );

  // Manage expanded state for tiles (collapsed by default)
  const [expandedTiles, setExpandedTiles] = useState({
    identities: false,
    myTeam: false,
    accessRequests: false,
    approvals: false,
    reviews: false,
    other: false
  });

  const toggleTile = (tileName) => {
    setExpandedTiles(prev => ({ ...prev, [tileName]: !prev[tileName] }));
  };

  // Filter visible tiles (exclude hidden)
  const visibleTileIds = dashboardTiles.order.filter(
    id => !dashboardTiles.hidden.includes(id)
  );

  const allExpanded = visibleTileIds.every(id => expandedTiles[id]);
  const toggleAll = () => {
    const newState = !allExpanded;
    const newExpandedTiles = { ...expandedTiles };
    visibleTileIds.forEach(id => {
      newExpandedTiles[id] = newState;
    });
    setExpandedTiles(newExpandedTiles);
  };

  // Generate random task counts on mount
  const [taskCounts, setTaskCounts] = useState({
    identities: { recentJoiners: 0, scheduledJoiners: 0, currentMovers: 0, scheduledMovers: 0, scheduledLeavers: 0, recentLeavers: 0 },
    myTeam: { compliantAccess: 0, policyAssignedAccess: 0, reviewCoverage: 0 },
    accessRequests: { forOthers: 0, forMe: 0, iMade: 0 },
    approvals: { new: 0, existing: 0 },
    reviews: { new: 0, existing: 0, late: 0, scheduled: 0, jit: 0 },
    other: { new: 0, existing: 0 }
  });

  useEffect(() => {
    setTaskCounts({
      identities: {
        recentJoiners: Math.floor(Math.random() * 12),
        scheduledJoiners: Math.floor(Math.random() * 8),
        currentMovers: Math.floor(Math.random() * 6),
        scheduledMovers: Math.floor(Math.random() * 5),
        scheduledLeavers: Math.floor(Math.random() * 4),
        recentLeavers: Math.floor(Math.random() * 3)
      },
      myTeam: {
        compliantAccess: Math.floor(Math.random() * 30) + 70,
        policyAssignedAccess: Math.floor(Math.random() * 40) + 60,
        reviewCoverage: Math.floor(Math.random() * 25) + 75
      },
      accessRequests: {
        forOthers: Math.floor(Math.random() * 10) + 2,
        forMe: Math.floor(Math.random() * 8) + 1,
        iMade: Math.floor(Math.random() * 12) + 3
      },
      approvals: {
        new: Math.floor(Math.random() * 5),
        existing: Math.floor(Math.random() * 10)
      },
      reviews: {
        new: Math.floor(Math.random() * 8),
        existing: Math.floor(Math.random() * 15),
        late: Math.floor(Math.random() * 3),
        scheduled: Math.floor(Math.random() * 12),
        jit: Math.floor(Math.random() * 6)
      },
      other: {
        new: Math.floor(Math.random() * 4),
        existing: Math.floor(Math.random() * 8)
      }
    });
  }, []);

  // Fetch identity count
  const { data: identityData, isLoading: identityLoading, error: identityError } = useGetIdentityCount(
    bearerToken,
    impersonateUser
  );

  // Fetch access requests total
  const { data: accessRequestsData, isLoading: accessRequestsLoading } = useGetAccessRequestsTotal(
    bearerToken,
    impersonateUser
  );

  const identityCount = identityData?.total || 0;
  const accessRequestsCount = accessRequestsData?.total || 0;

  const totalApprovals = taskCounts.approvals.new + taskCounts.approvals.existing;
  const totalReviews = taskCounts.reviews.new + taskCounts.reviews.existing;
  const totalOther = taskCounts.other.new + taskCounts.other.existing;

  // Handle drag end - reorder tiles
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (active.id !== over?.id && over) {
      const oldIndex = dashboardTiles.order.indexOf(active.id);
      const newIndex = dashboardTiles.order.indexOf(over.id);

      const newOrder = arrayMove(dashboardTiles.order, oldIndex, newIndex);

      setPreference('dashboardTiles', {
        ...dashboardTiles,
        order: newOrder
      });
    }
  };

  // Handle remove tile
  const handleRemoveTile = (tileId) => {
    setPreference('dashboardTiles', {
      ...dashboardTiles,
      hidden: [...dashboardTiles.hidden, tileId]
    });
  };

  // Get tile props by ID
  const getTileProps = (tileId) => {
    const baseProps = {
      expanded: expandedTiles[tileId],
      onToggleExpand: () => toggleTile(tileId),
      onRemove: () => handleRemoveTile(tileId)
    };

    switch (tileId) {
      case 'identities':
        return {
          ...baseProps,
          title: 'Identities',
          value: identityCount,
          loading: identityLoading,
          error: identityError,
          onClick: () => navigate('/identities'),
          subtitle: (
            <div className="tile-subtitle-content">
              <div className="tile-stat-row">
                <span>Recent Joiners:</span>
                <span className="stat-value stat-green">{taskCounts.identities.recentJoiners}</span>
              </div>
              <div className="tile-stat-row">
                <span>Scheduled Joiners:</span>
                <span className="stat-value stat-green-light">{taskCounts.identities.scheduledJoiners}</span>
              </div>
              <div className="tile-divider" />
              <div className="tile-stat-row">
                <span>Current Movers:</span>
                <span className="stat-value stat-orange">{taskCounts.identities.currentMovers}</span>
              </div>
              <div className="tile-stat-row">
                <span>Scheduled Movers:</span>
                <span className="stat-value stat-yellow">{taskCounts.identities.scheduledMovers}</span>
              </div>
              <div className="tile-divider" />
              <div className="tile-stat-row">
                <span>Scheduled Leavers:</span>
                <span className="stat-value stat-red">{taskCounts.identities.scheduledLeavers}</span>
              </div>
              <div className="tile-stat-row">
                <span>Recent Leavers:</span>
                <span className="stat-value stat-pink">{taskCounts.identities.recentLeavers}</span>
              </div>
            </div>
          )
        };

      case 'myTeam':
        return {
          ...baseProps,
          title: 'My Team',
          value: 8,
          loading: false,
          onClick: () => navigate('/my-team'),
          subtitle: (
            <div className="tile-subtitle-content">
              <div className="tile-stat-row">
                <span>Compliant Access:</span>
                <span className={`stat-value ${taskCounts.myTeam.compliantAccess >= 90 ? 'stat-green' : taskCounts.myTeam.compliantAccess >= 75 ? 'stat-orange' : 'stat-red'}`}>{taskCounts.myTeam.compliantAccess}%</span>
              </div>
              <div className="tile-stat-row">
                <span>Policy Assigned Access:</span>
                <span className={`stat-value ${taskCounts.myTeam.policyAssignedAccess >= 90 ? 'stat-green' : taskCounts.myTeam.policyAssignedAccess >= 75 ? 'stat-orange' : 'stat-red'}`}>{taskCounts.myTeam.policyAssignedAccess}%</span>
              </div>
              <div className="tile-stat-row">
                <span>Review Coverage:</span>
                <span className={`stat-value ${taskCounts.myTeam.reviewCoverage >= 90 ? 'stat-green' : taskCounts.myTeam.reviewCoverage >= 75 ? 'stat-orange' : 'stat-red'}`}>{taskCounts.myTeam.reviewCoverage}%</span>
              </div>
            </div>
          )
        };

      case 'accessRequests':
        return {
          ...baseProps,
          title: 'Access Requests',
          value: accessRequestsCount,
          loading: accessRequestsLoading,
          onClick: () => navigate('/access-requests'),
          subtitle: (
            <div className="tile-subtitle-content">
              <div className="tile-stat-row">
                <span>Requests for Others:</span>
                <span className="stat-value stat-green">{taskCounts.accessRequests.forOthers}</span>
              </div>
              <div className="tile-stat-row">
                <span>Requests for Me:</span>
                <span className="stat-value stat-orange">{taskCounts.accessRequests.forMe}</span>
              </div>
              <div className="tile-stat-row">
                <span>Requests I Made:</span>
                <span className="stat-value stat-teal">{taskCounts.accessRequests.iMade}</span>
              </div>
            </div>
          )
        };

      case 'approvals':
        return {
          ...baseProps,
          title: 'Approvals',
          value: totalApprovals,
          loading: false,
          subtitle: (
            <div className="tile-subtitle-content">
              <div className="tile-stat-row">
                <span>New:</span>
                <span className="stat-value stat-orange">{taskCounts.approvals.new}</span>
              </div>
              <div className="tile-stat-row">
                <span>Existing:</span>
                <span className="stat-value stat-teal">{taskCounts.approvals.existing}</span>
              </div>
            </div>
          )
        };

      case 'reviews':
        return {
          ...baseProps,
          title: 'Certifications',
          value: totalReviews,
          loading: false,
          subtitle: (
            <div className="tile-subtitle-content">
              <div className="tile-stat-row">
                <span>New:</span>
                <span className="stat-value stat-orange">{taskCounts.reviews.new}</span>
              </div>
              <div className="tile-stat-row">
                <span>Existing:</span>
                <span className="stat-value stat-teal">{taskCounts.reviews.existing}</span>
              </div>
              <div className="tile-divider" />
              <div className="tile-stat-row">
                <span>Late:</span>
                <span className="stat-value stat-red">{taskCounts.reviews.late}</span>
              </div>
              <div className="tile-stat-row">
                <span>Scheduled:</span>
                <span className="stat-value stat-green">{taskCounts.reviews.scheduled}</span>
              </div>
              <div className="tile-stat-row">
                <span>JIT:</span>
                <span className="stat-value stat-purple">{taskCounts.reviews.jit}</span>
              </div>
            </div>
          )
        };

      case 'other':
        return {
          ...baseProps,
          title: 'Other Tasks',
          value: totalOther,
          loading: false,
          subtitle: (
            <div className="tile-subtitle-content">
              <div className="tile-stat-row">
                <span>New:</span>
                <span className="stat-value stat-orange">{taskCounts.other.new}</span>
              </div>
              <div className="tile-stat-row">
                <span>Existing:</span>
                <span className="stat-value stat-teal">{taskCounts.other.existing}</span>
              </div>
            </div>
          )
        };

      default:
        return baseProps;
    }
  };

  return (
    <div className={`dashboard theme-${currentTheme}`}>
      <div className="dashboard-controls">
        <button className="toggle-all-btn" onClick={toggleAll} title={allExpanded ? 'Collapse All' : 'Expand All'}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            {allExpanded ? (
              <path d="M3 9L7 5L11 9M3 12L7 8L11 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            ) : (
              <path d="M3 5L7 9L11 5M3 2L7 6L11 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            )}
          </svg>
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveDragId(active.id)}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleTileIds} strategy={rectSortingStrategy}>
          <div className={`dashboard-grid ${tileLayout === 'vertical' ? 'layout-vertical' : 'layout-horizontal'}`}>
            {visibleTileIds.length > 0 ? (
              visibleTileIds.map(tileId => (
                <SortableTile
                  key={tileId}
                  id={tileId}
                  {...getTileProps(tileId)}
                />
              ))
            ) : (
              <div className="dashboard-empty">
                <p>No tiles to display.</p>
                <p>Go to <a href="/settings">Settings &gt; Dashboard Layout</a> to add tiles.</p>
              </div>
            )}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeDragId ? (
            <div className="tile-drag-overlay">
              <Tile {...getTileProps(activeDragId)} isDragging={true} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* System Compliance Heatmap Section */}
      <div className="heatmap-section">
        <div className="heatmap-toggle-container">
          <label className="heatmap-toggle">
            <span className="toggle-label">Compliance Heatmaps</span>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </div>
          </label>
          {showHeatmap && (
            <button
              className="heatmap-collapse-all-btn"
              onClick={toggleAllHeatmaps}
              title={Object.values(minimizedHeatmaps).every(v => v) ? 'Expand All' : 'Collapse All'}
            >
              {Object.values(minimizedHeatmaps).every(v => v) ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 6L8 11L13 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 10L8 5L13 10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          )}
        </div>
        {showHeatmap && (
          <>
            {/* Status Distribution Heatmap - aggregated view by compliance status */}
            <div className={`heatmap-wrapper ${minimizedHeatmaps.statusDistribution ? 'minimized' : ''}`}>
              <div className="heatmap-minimize-bar">
                <span className="heatmap-minimize-title">Compliance Status Distribution</span>
                <button
                  className="heatmap-minimize-btn"
                  onClick={() => toggleHeatmapMinimize('statusDistribution')}
                  title={minimizedHeatmaps.statusDistribution ? 'Expand' : 'Minimize'}
                >
                  {minimizedHeatmaps.statusDistribution ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <path d="M3 9L7 5L11 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
              {!minimizedHeatmaps.statusDistribution && (
                <ComplianceStatusHeatmap
                  systems={heatmapSystems}
                  isLoading={heatmapLoading}
                  error={heatmapError}
                  onStatusClick={(status) => {
                    console.log('Status clicked:', status);
                  }}
                />
              )}
            </div>

            {/* System Compliance Heatmap - original view by system */}
            <div className={`heatmap-wrapper ${minimizedHeatmaps.systemCompliance ? 'minimized' : ''}`}>
              <div className="heatmap-minimize-bar">
                <span className="heatmap-minimize-title">System Compliance Overview</span>
                <button
                  className="heatmap-minimize-btn"
                  onClick={() => toggleHeatmapMinimize('systemCompliance')}
                  title={minimizedHeatmaps.systemCompliance ? 'Expand' : 'Minimize'}
                >
                  {minimizedHeatmaps.systemCompliance ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <path d="M3 9L7 5L11 9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              </div>
              {!minimizedHeatmaps.systemCompliance && (
                <ComplianceHeatmap
                  bearerToken={bearerToken}
                  impersonateUser={impersonateUser}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
