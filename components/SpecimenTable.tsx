
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Specimen } from '../types';
import { formatCollectionDate } from '../utils/formatters';

export type ColumnId = 'specimen' | 'code' | 'family' | 'genus' | 'locality' | 'habitat' | 'collector' | 'collectorNumber' | 'date' | 'createdAt' | 'updatedAt' | 'id';
export type SortableColumnId = 'id' | 'family' | 'genus' | 'collector' | 'collectorNumber' | 'date' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

interface SpecimenTableProps {
  specimens: Specimen[];
  onClick: (id: number) => void;
  visibleColumns: ColumnId[];
  sortColumn: SortableColumnId | null;
  sortDirection: SortDirection;
  onSort: (column: SortableColumnId) => void;
  selectedIds?: Set<number>;
  onToggleSelection?: (id: number) => void;
  onToggleSelectAll?: () => void;
}

const SpecimenTable: React.FC<SpecimenTableProps> = ({
  specimens,
  onClick,
  visibleColumns,
  sortColumn,
  sortDirection,
  onSort,
  selectedIds = new Set(),
  onToggleSelection,
  onToggleSelectAll
}) => {
  const [searchParams] = useSearchParams();
  const checkboxRef = React.useRef<HTMLInputElement>(null);

  // Update checkbox indeterminate state
  const allSelected = specimens.length > 0 && specimens.every(s => selectedIds.has(s.id));
  const someSelected = specimens.some(s => selectedIds.has(s.id)) && !allSelected;

  React.useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData('specimenId', id.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRowClick = (e: React.MouseEvent, id: number) => {
    const specimenUrl = `/specimen/${id}?${searchParams.toString()}`;

    // Middle click or Ctrl/Cmd+click - open in new tab
    if (e.button === 1 || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      window.open(specimenUrl, '_blank');
    } else if (e.button === 0) {
      // Normal left click
      onClick(id);
    }
  };

  const sortableColumns: SortableColumnId[] = ['id', 'family', 'genus', 'collector', 'collectorNumber', 'date', 'createdAt', 'updatedAt'];

  const renderHeader = (colId: ColumnId) => {
    const labels: Record<ColumnId, string> = {
      specimen: 'Specimen',
      code: 'Code',
      family: 'Family',
      genus: 'Genus',
      locality: 'Locality',
      habitat: 'Habitat',
      collector: 'Collector',
      collectorNumber: 'Collector #',
      date: 'Date',
      createdAt: 'Created',
      updatedAt: 'Modified',
      id: 'ID'
    };

    const isSortable = sortableColumns.includes(colId as SortableColumnId);
    const isActiveSortColumn = sortColumn === colId;

    if (isSortable) {
      return (
        <th key={colId} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <button
            onClick={() => onSort(colId as SortableColumnId)}
            className="flex items-center gap-2 hover:text-emerald-600 transition-colors group"
          >
            <span>{labels[colId]}</span>
            {isActiveSortColumn ? (
              sortDirection === 'asc' ? (
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              )
            ) : (
              <svg className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            )}
          </button>
        </th>
      );
    }

    return (
      <th key={colId} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
        {labels[colId]}
      </th>
    );
  };

  const renderCell = (specimen: Specimen, colId: ColumnId) => {
    switch (colId) {
      case 'specimen':
        return (
          <td key={colId} className="px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-10 flex-shrink-0 bg-slate-100 rounded overflow-hidden border border-slate-200">
                <img 
                  src={specimen.imageUrls[0] || 'https://via.placeholder.com/40x48?text=No+Img'} 
                  alt="" 
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <div
                  className="text-sm font-bold text-slate-900 italic group-hover:text-emerald-700 transition-colors"
                  title={specimen.scientificName}
                >
                  {specimen.scientificName}
                </div>
                {visibleColumns.indexOf('id') === -1 && (
                   <div
                     className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter"
                     title={String(specimen.id)}
                   >
                    ID: {specimen.id}
                  </div>
                )}
              </div>
            </div>
          </td>
        );
      case 'code':
        return (
          <td key={colId} className="px-6 py-4">
            <span className="text-xs font-mono text-slate-600">
              {specimen.code || '—'}
            </span>
          </td>
        );
      case 'family':
        return (
          <td key={colId} className="px-6 py-4">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
              {specimen.family}
            </span>
          </td>
        );
      case 'genus':
        return (
          <td key={colId} className="px-6 py-4 text-sm text-slate-600 italic">
            {specimen.genus || specimen.scientificName.split(' ')[0]}
          </td>
        );
      case 'locality':
        return (
          <td key={colId} className="px-6 py-4">
            <div
              className="text-sm text-slate-600 truncate max-w-[200px]"
              title={`${specimen.country || ''}${specimen.stateProvince ? `, ${specimen.stateProvince}` : ''}`}
            >
              {specimen.country || ''}{specimen.stateProvince ? `, ${specimen.stateProvince}` : ''}
            </div>
            <div
              className="text-[10px] text-slate-400 truncate max-w-[200px]"
              title={specimen.localityDescription || ''}
            >
              {specimen.localityDescription || ''}
            </div>
          </td>
        );
      case 'habitat':
        return (
          <td
            key={colId}
            className="px-6 py-4 text-sm text-slate-500 italic max-w-[150px] truncate"
            title={specimen.habitat || 'N/A'}
          >
            {specimen.habitat || 'N/A'}
          </td>
        );
      case 'collector':
        return (
          <td key={colId} className="px-6 py-4">
            <div className="text-sm font-medium text-slate-700">{specimen.collector}</div>
          </td>
        );
      case 'collectorNumber':
        return (
          <td key={colId} className="px-6 py-4">
            <div className="text-sm text-slate-600">{specimen.collectorNumber || '—'}</div>
          </td>
        );
      case 'date':
        return (
          <td key={colId} className="px-6 py-4 text-sm text-slate-500">
            {formatCollectionDate(specimen.collectionDate)}
          </td>
        );
      case 'createdAt':
        return (
          <td key={colId} className="px-6 py-4 text-xs text-slate-500">
            {specimen.createdAt ? new Date(specimen.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : '—'}
          </td>
        );
      case 'updatedAt':
        return (
          <td key={colId} className="px-6 py-4 text-xs text-slate-500">
            {specimen.updatedAt ? new Date(specimen.updatedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : '—'}
          </td>
        );
      case 'id':
        return (
          <td key={colId} className="px-6 py-4 text-[10px] font-mono text-slate-400 uppercase">
            {specimen.id}
          </td>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {onToggleSelection && onToggleSelectAll && (
              <th className="w-12 px-4 py-4">
                <input
                  type="checkbox"
                  ref={checkboxRef}
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 cursor-pointer rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  title={allSelected ? "Deselect all" : "Select all on page"}
                />
              </th>
            )}
            {visibleColumns.map(renderHeader)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {specimens.map((specimen) => {
            const isSelected = selectedIds.has(specimen.id);
            return (
              <tr
                key={specimen.id}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, specimen.id)}
                onClick={(e) => handleRowClick(e, specimen.id)}
                onAuxClick={(e) => handleRowClick(e, specimen.id)}
                className={`hover:bg-emerald-50/30 cursor-grab active:cursor-grabbing transition-colors group ${
                  isSelected ? 'bg-blue-50/50' : ''
                }`}
                title="Click to view • Ctrl+Click or Middle-click to open in new tab"
              >
                {onToggleSelection && (
                  <td className="w-12 px-4 py-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelection(specimen.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 cursor-pointer rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                  </td>
                )}
                {visibleColumns.map(colId => renderCell(specimen, colId))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SpecimenTable;
