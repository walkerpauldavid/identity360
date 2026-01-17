/**
 * SortableTile Component
 * Wrapper for Tile component to enable drag-and-drop functionality
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Tile from './Tile';

const SortableTile = ({ id, ...tileProps }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  // Listeners are on the wrapper so you can drag the entire tile
  // The distance constraint in DndContext (8px) ensures clicks still work
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Tile
        {...tileProps}
        isDragging={isDragging}
      />
    </div>
  );
};

export default SortableTile;
