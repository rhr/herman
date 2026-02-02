import React, { useRef, useState, useEffect } from 'react';
import { Specimen, Pile } from '../../types';
import { ColumnId, SortableColumnId, SortDirection } from '../SpecimenTable';
import SpecimenCard from '../SpecimenCard';
import SpecimenTable from '../SpecimenTable';
import SpecimenMapCard from '../SpecimenMapCard';
import MapView from '../MapView';
import PileSidebar from '../PileSidebar';
import Button from '../Button';
import AddToPileModal from '../AddToPileModal';
import { useSpecimenUrl } from '../../hooks/useSpecimenUrl';

interface GalleryViewProps {
  specimens: Specimen[];
  piles: Pile[];
  totalPages: number;
  totalItems: number;
  visibleColumns: ColumnId[];
  setVisibleColumns: (cols: ColumnId[]) => void;
  showColumnPicker: boolean;
  setShowColumnPicker: (show: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  columnPickerRef: React.RefObject<HTMLDivElement>;
  onOpenSpecimen: (id: number) => void;
  onCreatePile: (name: string, description: string) => void;
  onDeletePile: (id: number) => void;
  onDropSpecimen: (pileId: number, specimenId: number) => void;
  onRemoveFromPile: (pileId: number, specimenId: number) => void;
  onReorderPiles: (piles: Pile[]) => void;
  onSort: (column: SortableColumnId) => void;
  onPageChange: (page: number) => void;
  allColumns: { id: ColumnId; label: string }[];
}

const GalleryView: React.FC<GalleryViewProps> = ({
  specimens,
  piles,
  totalPages,
  totalItems,
  visibleColumns,
  setVisibleColumns,
  showColumnPicker,
  setShowColumnPicker,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  columnPickerRef,
  onOpenSpecimen,
  onCreatePile,
  onDeletePile,
  onDropSpecimen,
  onRemoveFromPile,
  onReorderPiles,
  onSort,
  onPageChange,
  allColumns,
}) => {
  const { urlState, updateUrlState } = useSpecimenUrl();
  const { layout, activePileId, searchQuery, sortColumn, sortDirection, currentPage } = urlState;
  const [selectedSpecimenId, setSelectedSpecimenId] = useState<number | null>(null);
  const [selectedSpecimenIds, setSelectedSpecimenIds] = useState<Set<number>>(new Set());
  const [showAddToPileModal, setShowAddToPileModal] = useState(false);

  const activePile = piles.find(p => p.id === activePileId);

  const toggleColumn = (colId: ColumnId) => {
    const newSelection = visibleColumns.includes(colId)
      ? visibleColumns.filter(id => id !== colId)
      : [...visibleColumns, colId];

    // Sort by the order defined in allColumns
    const sorted = allColumns
      .map(col => col.id)
      .filter(id => newSelection.includes(id));

    setVisibleColumns(sorted);
  };

  const handleMapMarkerClick = (id: number) => {
    setSelectedSpecimenId(id);
  };

  const handleToggleSelection = (id: number) => {
    setSelectedSpecimenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedSpecimenIds.size === specimens.length && specimens.length > 0) {
      setSelectedSpecimenIds(new Set()); // Clear all
    } else {
      setSelectedSpecimenIds(new Set(specimens.map(s => s.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedSpecimenIds(new Set());
  };

  const handleBulkAddToPile = () => {
    setShowAddToPileModal(true);
  };

  const handleBulkRemoveFromPile = () => {
    if (!activePileId) return;

    selectedSpecimenIds.forEach(specimenId => {
      onRemoveFromPile(activePileId, specimenId);
    });
    setSelectedSpecimenIds(new Set());
  };

  const handleBulkTogglePile = (pileId: number) => {
    selectedSpecimenIds.forEach(specimenId => {
      const pile = piles.find(p => p.id === pileId);
      if (!pile) return;

      const isInPile = pile.specimenIds.includes(specimenId);
      if (isInPile) {
        onRemoveFromPile(pileId, specimenId);
      } else {
        onDropSpecimen(pileId, specimenId);
      }
    });
    setSelectedSpecimenIds(new Set());
    setShowAddToPileModal(false);
  };

  // Check if activePileId in URL still exists
  useEffect(() => {
    if (activePileId && !piles.find(p => p.id === activePileId)) {
      // Pile no longer exists, clear filter
      updateUrlState({ activePileId: null }, true);
    }
  }, [activePileId, piles]);

  // Clear selection when pile, page, or search query changes
  useEffect(() => {
    setSelectedSpecimenIds(new Set());
  }, [activePileId, currentPage, searchQuery]);

  return (
    <div className="flex flex-col md:flex-row gap-2 relative">
      {/* Collapsible Sidebar */}
      <div
        className={`relative transition-all duration-300 ${
          isSidebarCollapsed ? 'w-0 overflow-hidden opacity-0' : 'w-full md:w-80'
        }`}
      >
        {!isSidebarCollapsed && (
          <PileSidebar
            piles={piles}
            activePileId={activePileId}
            onSelectPile={(id) => updateUrlState({ activePileId: id, currentPage: 1 }, true)}
            onCreatePile={onCreatePile}
            onDeletePile={onDeletePile}
            onDropSpecimen={onDropSpecimen}
            onRemoveFromPile={onRemoveFromPile}
            onReorderPiles={onReorderPiles}
          />
        )}
      </div>

      <div className={`flex-1 min-0 transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-0' : ''}`}>
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            {/* Sidebar Toggle */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0"
              title={isSidebarCollapsed ? "Show piles sidebar" : "Hide piles sidebar"}
            >
              <svg
                className={`w-5 h-5 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>

            <div>
              <h2 className="text-3xl font-bold text-slate-900 serif">
                {activePile ? activePile.name : 'Digital Collection'}
              </h2>
              <p className="text-slate-500 mt-1">
                {activePile ? (activePile.description || 'Virtual collection of selected specimens') : 'Curated primary database'}
                • {totalItems} total specimens
                {searchQuery && ` • Showing ${specimens.length} matches`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {layout === 'table' && (
              <div className="relative" ref={columnPickerRef}>
                <button
                  onClick={() => setShowColumnPicker(!showColumnPicker)}
                  className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                  title="Configure Columns"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </button>

                {showColumnPicker && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Visible Columns</h4>
                    <div className="space-y-2">
                      {allColumns.map(col => (
                        <label key={col.id} className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={visibleColumns.includes(col.id)}
                            onChange={() => toggleColumn(col.id)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                            {col.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => updateUrlState({ layout: 'grid' }, true)}
                className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all ${layout === 'grid' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Grid
              </button>
              <button
                onClick={() => updateUrlState({ layout: 'table' }, true)}
                className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all ${layout === 'table' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Table
              </button>
              <button
                onClick={() => updateUrlState({ layout: 'map' }, true)}
                className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all ${layout === 'map' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Map
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {layout === 'table' && selectedSpecimenIds.size > 0 && (
          <div className="sticky top-0 z-10 bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-blue-900">
                {selectedSpecimenIds.size} specimen{selectedSpecimenIds.size !== 1 ? 's' : ''} selected
              </span>

              <button
                onClick={handleBulkAddToPile}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add to Pile
              </button>

              {activePileId && (
                <button
                  onClick={handleBulkRemoveFromPile}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                  </svg>
                  Remove from Current Pile
                </button>
              )}
            </div>

            <button
              onClick={handleClearSelection}
              className="text-blue-700 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear Selection
            </button>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mb-6">
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
              title="First page"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm font-medium text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
            >
              Next
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all"
              title="Last page"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {specimens.length > 0 ? (
          layout === 'map' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Panel: Scrollable List */}
              <div className="space-y-4 max-h-[800px] overflow-y-auto">
                {specimens.map(s => (
                  <SpecimenMapCard
                    key={s.id}
                    specimen={s}
                    isSelected={selectedSpecimenId === s.id}
                    onClick={() => handleMapMarkerClick(s.id)}
                  />
                ))}
              </div>

              {/* Right Panel: Map */}
              <div className="sticky top-4 h-[800px]">
                <MapView
                  specimens={specimens}
                  selectedSpecimenId={selectedSpecimenId}
                  onSelectSpecimen={handleMapMarkerClick}
                />
              </div>
            </div>
          ) : layout === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {specimens.map(s => (
                <SpecimenCard
                  key={s.id}
                  specimen={s}
                  onClick={onOpenSpecimen}
                />
              ))}
            </div>
          ) : (
            <SpecimenTable
              specimens={specimens}
              onClick={onOpenSpecimen}
              visibleColumns={visibleColumns}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={onSort}
              selectedIds={selectedSpecimenIds}
              onToggleSelection={handleToggleSelection}
              onToggleSelectAll={handleToggleSelectAll}
            />
          )
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 border-dashed">
            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-600">
              {activePileId ? 'Pile Empty' : 'Database Empty'}
            </h3>
            <p className="text-slate-400 mt-2">
              {activePileId ? 'Add specimens to this virtual collection from the main gallery.' : 'Add your first specimen to start the digital herbarium.'}
            </p>
            {!activePileId && (
              <Button variant="outline" className="mx-auto mt-6" onClick={() => { /* handled by parent */ }}>
                Register New Specimen
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add to Pile Modal */}
      {showAddToPileModal && (
        <AddToPileModal
          specimenIds={Array.from(selectedSpecimenIds)}
          piles={piles}
          onTogglePile={handleBulkTogglePile}
          onClose={() => setShowAddToPileModal(false)}
        />
      )}
    </div>
  );
};

export default GalleryView;
