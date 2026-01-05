
import React, { useState } from 'react';
import { Pile } from '../types';
import Button from './Button';

interface PileSidebarProps {
  piles: Pile[];
  activePileId: number | null;
  onSelectPile: (id: number | null) => void;
  onCreatePile: (name: string, description: string) => void;
  onDeletePile: (id: number) => void;
  onDropSpecimen: (pileId: number, specimenId: number) => void;
  onRemoveFromPile: (pileId: number, specimenId: number) => void;
  onReorderPiles: (reorderedPiles: Pile[]) => void;
}

const PileSidebar: React.FC<PileSidebarProps> = ({
  piles,
  activePileId,
  onSelectPile,
  onCreatePile,
  onDeletePile,
  onDropSpecimen,
  onRemoveFromPile,
  onReorderPiles
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [dragOverPileId, setDragOverPileId] = useState<number | null>(null);
  const [isDraggingOverAll, setIsDraggingOverAll] = useState(false);
  const [draggingPileId, setDraggingPileId] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreatePile(newName, '');
    setNewName('');
    setIsCreating(false);
  };

  const handleDragOver = (e: React.DragEvent, id: string | 'all') => {
    e.preventDefault();
    if (id === 'all') {
      setIsDraggingOverAll(true);
    } else {
      setDragOverPileId(id);
    }
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = () => {
    setDragOverPileId(null);
    setIsDraggingOverAll(false);
  };

  const handleDrop = (e: React.DragEvent, pileId: number | 'all') => {
    e.preventDefault();
    setDragOverPileId(null);
    setIsDraggingOverAll(false);
    const specimenIdStr = e.dataTransfer.getData('specimenId');
    if (!specimenIdStr) return;
    const specimenId = parseInt(specimenIdStr, 10);

    if (pileId === 'all') {
      if (activePileId) {
        onRemoveFromPile(activePileId, specimenId);
      }
    } else {
      onDropSpecimen(pileId, specimenId);
    }
  };

  // Pile reordering handlers
  const handlePileDragStart = (e: React.DragEvent, pileId: number) => {
    setDraggingPileId(pileId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('pileId', pileId.toString());
  };

  const handlePileDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const draggingPile = e.dataTransfer.types.includes('pileid');
    if (draggingPile) {
      setDragOverIndex(index);
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handlePileDragEnd = () => {
    setDraggingPileId(null);
    setDragOverIndex(null);
  };

  const handlePileDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const draggedPileIdStr = e.dataTransfer.getData('pileId');

    if (!draggedPileIdStr) return;
    const draggedPileId = parseInt(draggedPileIdStr, 10);

    const draggedIndex = piles.findIndex(p => p.id === draggedPileId);
    if (draggedIndex === -1 || draggedIndex === dropIndex) return;

    const reorderedPiles = [...piles];
    const [removed] = reorderedPiles.splice(draggedIndex, 1);
    reorderedPiles.splice(dropIndex, 0, removed);

    onReorderPiles(reorderedPiles);
    setDragOverIndex(null);
    setDraggingPileId(null);
  };

  return (
    <div className="w-full md:w-64 flex-shrink-0 space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Virtual Piles</h3>
          <button 
            onClick={() => setIsCreating(true)}
            className="text-emerald-600 hover:text-emerald-700 p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="p-2 space-y-1">
          <button
            onDragOver={(e) => handleDragOver(e, 'all')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'all')}
            onClick={() => onSelectPile(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-3 ${
              activePileId === null ? 'bg-emerald-50 text-emerald-700' : 
              isDraggingOverAll ? 'bg-rose-50 text-rose-600 ring-2 ring-rose-200' :
              'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <svg className={`w-4 h-4 transition-colors ${isDraggingOverAll ? 'text-rose-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isDraggingOverAll ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              )}
            </svg>
            {isDraggingOverAll ? 'Remove from Pile' : 'All Specimens'}
          </button>

          {piles.map((pile, index) => {
            const isDraggingOver = dragOverPileId === pile.id;
            const isActive = activePileId === pile.id;
            const isBeingDragged = draggingPileId === pile.id;
            const showDropIndicator = dragOverIndex === index && !isBeingDragged;

            return (
              <div key={pile.id} className="group relative">
                {showDropIndicator && (
                  <div className="h-0.5 bg-emerald-500 rounded-full mb-1 shadow-sm" />
                )}
                <button
                  draggable={true}
                  onDragStart={(e) => handlePileDragStart(e, pile.id)}
                  onDragOver={(e) => handlePileDragOver(e, index)}
                  onDragEnd={handlePileDragEnd}
                  onDrop={(e) => handlePileDrop(e, index)}
                  onDragLeave={handleDragLeave}
                  onClick={() => onSelectPile(pile.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-between gap-3 cursor-move ${
                    isBeingDragged ? 'opacity-40 scale-95' :
                    isActive ? 'bg-emerald-50 text-emerald-700' :
                    isDraggingOver ? 'bg-emerald-600 text-white scale-[1.02] shadow-md ring-2 ring-emerald-300' :
                    'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <svg className={`w-4 h-4 flex-shrink-0 transition-colors ${isDraggingOver ? 'text-white' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1m-6 9h6m-3-3l3 3m0 0l-3 3" />
                    </svg>
                    <span className="truncate">{pile.name}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
                    isDraggingOver ? 'bg-emerald-700 text-white' :
                    'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                  }`}>
                    {pile.specimenIds.length}
                  </span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeletePile(pile.id); }}
                  className="absolute right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {isCreating && (
          <div className="p-3 border-t border-slate-100 bg-emerald-50/30">
            <form onSubmit={handleCreate} className="space-y-2">
              <input 
                autoFocus
                type="text" 
                placeholder="Pile name..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <div className="flex gap-1">
                <Button size="xs" className="flex-1 py-1 text-[10px]" onClick={() => setIsCreating(false)} variant="secondary">Cancel</Button>
                <Button size="xs" className="flex-1 py-1 text-[10px]" type="submit">Create</Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default PileSidebar;
