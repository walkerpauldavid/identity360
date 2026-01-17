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
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { getBearerToken, user } = useAuth();
  const { getPreference, setPreference } = usePreferences();
  const bearerToken = getBearerToken();
  const impersonateUser = user?.email;

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
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#b0b0b0', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Recent Joiners:</span>
                <span style={{ color: '#4caf50', fontWeight: '600' }}>{taskCounts.identities.recentJoiners}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Scheduled Joiners:</span>
                <span style={{ color: '#8bc34a', fontWeight: '600' }}>{taskCounts.identities.scheduledJoiners}</span>
              </div>
              <div style={{ marginTop: '0.3rem', paddingTop: '0.3rem', borderTop: '1px solid #2a2a2a' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Current Movers:</span>
                <span style={{ color: '#ff9800', fontWeight: '600' }}>{taskCounts.identities.currentMovers}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Scheduled Movers:</span>
                <span style={{ color: '#ffc107', fontWeight: '600' }}>{taskCounts.identities.scheduledMovers}</span>
              </div>
              <div style={{ marginTop: '0.3rem', paddingTop: '0.3rem', borderTop: '1px solid #2a2a2a' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Scheduled Leavers:</span>
                <span style={{ color: '#f44336', fontWeight: '600' }}>{taskCounts.identities.scheduledLeavers}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Recent Leavers:</span>
                <span style={{ color: '#e91e63', fontWeight: '600' }}>{taskCounts.identities.recentLeavers}</span>
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
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#b0b0b0', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Compliant Access:</span>
                <span style={{ color: taskCounts.myTeam.compliantAccess >= 90 ? '#4caf50' : taskCounts.myTeam.compliantAccess >= 75 ? '#ff9800' : '#f44336', fontWeight: '600' }}>{taskCounts.myTeam.compliantAccess}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Policy Assigned Access:</span>
                <span style={{ color: taskCounts.myTeam.policyAssignedAccess >= 90 ? '#4caf50' : taskCounts.myTeam.policyAssignedAccess >= 75 ? '#ff9800' : '#f44336', fontWeight: '600' }}>{taskCounts.myTeam.policyAssignedAccess}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Review Coverage:</span>
                <span style={{ color: taskCounts.myTeam.reviewCoverage >= 90 ? '#4caf50' : taskCounts.myTeam.reviewCoverage >= 75 ? '#ff9800' : '#f44336', fontWeight: '600' }}>{taskCounts.myTeam.reviewCoverage}%</span>
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
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#b0b0b0', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Requests for Others:</span>
                <span style={{ color: '#4caf50', fontWeight: '600' }}>{taskCounts.accessRequests.forOthers}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Requests for Me:</span>
                <span style={{ color: '#ff9800', fontWeight: '600' }}>{taskCounts.accessRequests.forMe}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Requests I Made:</span>
                <span style={{ color: '#88c0d0', fontWeight: '600' }}>{taskCounts.accessRequests.iMade}</span>
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
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#b0b0b0', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>New:</span>
                <span style={{ color: '#ff9800', fontWeight: '600' }}>{taskCounts.approvals.new}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Existing:</span>
                <span style={{ color: '#88c0d0', fontWeight: '600' }}>{taskCounts.approvals.existing}</span>
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
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#b0b0b0', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>New:</span>
                <span style={{ color: '#ff9800', fontWeight: '600' }}>{taskCounts.reviews.new}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Existing:</span>
                <span style={{ color: '#88c0d0', fontWeight: '600' }}>{taskCounts.reviews.existing}</span>
              </div>
              <div style={{ marginTop: '0.3rem', paddingTop: '0.3rem', borderTop: '1px solid #2a2a2a' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Late:</span>
                <span style={{ color: '#f44336', fontWeight: '600' }}>{taskCounts.reviews.late}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Scheduled:</span>
                <span style={{ color: '#4caf50', fontWeight: '600' }}>{taskCounts.reviews.scheduled}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>JIT:</span>
                <span style={{ color: '#9c27b0', fontWeight: '600' }}>{taskCounts.reviews.jit}</span>
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
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#b0b0b0', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>New:</span>
                <span style={{ color: '#ff9800', fontWeight: '600' }}>{taskCounts.other.new}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Existing:</span>
                <span style={{ color: '#88c0d0', fontWeight: '600' }}>{taskCounts.other.existing}</span>
              </div>
            </div>
          )
        };

      default:
        return baseProps;
    }
  };

  return (
    <div className="dashboard">
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
    </div>
  );
};

export default Dashboard;
