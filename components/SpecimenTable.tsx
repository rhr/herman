
import React from 'react';
import { Specimen } from '../types';
import { formatCollectionDate } from '../utils/formatters';

export type ColumnId = 'specimen' | 'family' | 'genus' | 'locality' | 'habitat' | 'collector' | 'date' | 'id';
export type SortableColumnId = 'id' | 'family' | 'genus' | 'collector' | 'date';
export type SortDirection = 'asc' | 'desc';

interface SpecimenTableProps {
  specimens: Specimen[];
  onClick: (id: string) => void;
  visibleColumns: ColumnId[];
  sortColumn: SortableColumnId | null;
  sortDirection: SortDirection;
  onSort: (column: SortableColumnId) => void;
}

const SpecimenTable: React.FC<SpecimenTableProps> = ({ specimens, onClick, visibleColumns, sortColumn, sortDirection, onSort }) => {
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('specimenId', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const sortableColumns: SortableColumnId[] = ['id', 'family', 'genus', 'collector', 'date'];

  const renderHeader = (colId: ColumnId) => {
    const labels: Record<ColumnId, string> = {
      specimen: 'Specimen',
      family: 'Family',
      genus: 'Genus',
      locality: 'Locality',
      habitat: 'Habitat',
      collector: 'Collector',
      date: 'Date',
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
                     title={specimen.id}
                   >
                    ID: {specimen.id.split('_')[1] || specimen.id}
                  </div>
                )}
              </div>
            </div>
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
              title={`${specimen.locality.country}${specimen.locality.stateProvince ? `, ${specimen.locality.stateProvince}` : ''}`}
            >
              {specimen.locality.country}{specimen.locality.stateProvince ? `, ${specimen.locality.stateProvince}` : ''}
            </div>
            <div
              className="text-[10px] text-slate-400 truncate max-w-[200px]"
              title={specimen.locality.description}
            >
              {specimen.locality.description}
            </div>
          </td>
        );
      case 'habitat':
        return (
          <td
            key={colId}
            className="px-6 py-4 text-sm text-slate-500 italic max-w-[150px] truncate"
            title={specimen.locality.habitat || 'N/A'}
          >
            {specimen.locality.habitat || 'N/A'}
          </td>
        );
      case 'collector':
        return (
          <td key={colId} className="px-6 py-4">
            <div className="text-sm font-medium text-slate-700">{specimen.collector}</div>
          </td>
        );
      case 'date':
        return (
          <td key={colId} className="px-6 py-4 text-sm text-slate-500">
            {formatCollectionDate(specimen.collectionDate)}
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
            {visibleColumns.map(renderHeader)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {specimens.map((specimen) => (
            <tr 
              key={specimen.id}
              draggable="true"
              onDragStart={(e) => handleDragStart(e, specimen.id)}
              onClick={() => onClick(specimen.id)}
              className="hover:bg-emerald-50/30 cursor-grab active:cursor-grabbing transition-colors group"
            >
              {visibleColumns.map(colId => renderCell(specimen, colId))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SpecimenTable;
