/**
 * Dashboard Layout Tab Component
 * Settings tab for managing dashboard tile order and visibility
 */

import { usePreferences } from '../../contexts/PreferencesContext';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Tile definitions with metadata
const TILE_DEFINITIONS = {
  identities: { id: 'identities', title: 'Identities', description: 'Identity lifecycle management' },
  myTeam: { id: 'myTeam', title: 'My Team', description: 'Team compliance overview' },
  accessRequests: { id: 'accessRequests', title: 'Access Requests', description: 'Pending access requests to review' },
  approvals: { id: 'approvals', title: 'My Approvals', description: 'Pending access requests' },
  reviews: { id: 'reviews', title: 'My Reviews', description: 'Access certification tasks' },
  other: { id: 'other', title: 'Other Tasks', description: 'Miscellaneous assignments' }
};

// Sortable palette tile component
const SortablePaletteTile = ({ tile, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: tile.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`palette-tile ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="palette-tile-info">
        <span className="palette-tile-title">{tile.title}</span>
        <span className="palette-tile-description">{tile.description}</span>
      </div>
      <button
        className="palette-tile-remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Hide from dashboard"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
};

const DashboardLayoutTab = () => {
  const { getPreference, setPreference } = usePreferences();

  const dashboardTiles = getPreference('dashboardTiles', {
    order: ['identities', 'myTeam', 'approvals', 'reviews', 'other'],
    hidden: []
  });

  const visibleTiles = dashboardTiles.order.filter(
    id => !dashboardTiles.hidden.includes(id)
  );

  const hiddenTiles = dashboardTiles.hidden;

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id && over) {
      const oldIndex = dashboardTiles.order.indexOf(active.id);
      const newIndex = dashboardTiles.order.indexOf(over.id);
      setPreference('dashboardTiles', {
        ...dashboardTiles,
        order: arrayMove(dashboardTiles.order, oldIndex, newIndex)
      });
    }
  };

  const handleRemoveTile = (tileId) => {
    setPreference('dashboardTiles', {
      ...dashboardTiles,
      hidden: [...dashboardTiles.hidden, tileId]
    });
  };

  const handleRestoreTile = (tileId) => {
    setPreference('dashboardTiles', {
      ...dashboardTiles,
      hidden: dashboardTiles.hidden.filter(id => id !== tileId)
    });
  };

  const handleResetToDefault = () => {
    setPreference('dashboardTiles', {
      order: ['identities', 'myTeam', 'approvals', 'reviews', 'other'],
      hidden: []
    });
  };

  return (
    <section className="settings-section">
      <div className="section-header">
        <h2>Dashboard Layout</h2>
      </div>

      <div className="layout-section">
        <h3>Visible Tiles</h3>
        <p className="form-description">
          Drag tiles to reorder them on your dashboard. Click the X to hide a tile.
        </p>

        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleTiles} strategy={rectSortingStrategy}>
            <div className="tile-palette">
              {visibleTiles.length > 0 ? (
                visibleTiles.map(tileId => (
                  <SortablePaletteTile
                    key={tileId}
                    tile={TILE_DEFINITIONS[tileId]}
                    onRemove={() => handleRemoveTile(tileId)}
                  />
                ))
              ) : (
                <div className="palette-empty">
                  All tiles are hidden. Use the section below to restore them.
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {hiddenTiles.length > 0 && (
        <div className="layout-section hidden-section">
          <h3>Hidden Tiles</h3>
          <p className="form-description">
            Click the + button to add a tile back to your dashboard.
          </p>
          <div className="tile-palette hidden-palette">
            {hiddenTiles.map(tileId => (
              <div key={tileId} className="palette-tile hidden">
                <div className="palette-tile-info">
                  <span className="palette-tile-title">{TILE_DEFINITIONS[tileId]?.title}</span>
                  <span className="palette-tile-description">{TILE_DEFINITIONS[tileId]?.description}</span>
                </div>
                <button
                  className="palette-tile-restore"
                  onClick={() => handleRestoreTile(tileId)}
                  title="Add to dashboard"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="form-actions" style={{ marginTop: '2rem' }}>
        <button onClick={handleResetToDefault} className="btn btn-secondary">
          Reset to Default
        </button>
      </div>
    </section>
  );
};

export default DashboardLayoutTab;
