
import React from 'react';
import { Specimen } from '../types';
import { formatCollectionDate } from '../utils/formatters';

export type ColumnId = 'specimen' | 'family' | 'genus' | 'locality' | 'habitat' | 'collector' | 'date' | 'id';

interface SpecimenTableProps {
  specimens: Specimen[];
  onClick: (id: string) => void;
  visibleColumns: ColumnId[];
}

const SpecimenTable: React.FC<SpecimenTableProps> = ({ specimens, onClick, visibleColumns }) => {
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('specimenId', id);
    e.dataTransfer.effectAllowed = 'move';
  };

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
                <div className="text-sm font-bold text-slate-900 italic group-hover:text-emerald-700 transition-colors">
                  {specimen.scientificName}
                </div>
                {visibleColumns.indexOf('id') === -1 && (
                   <div className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">
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
            <div className="text-sm text-slate-600 truncate max-w-[200px]">
              {specimen.locality.country}{specimen.locality.stateProvince ? `, ${specimen.locality.stateProvince}` : ''}
            </div>
            <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
              {specimen.locality.description}
            </div>
          </td>
        );
      case 'habitat':
        return (
          <td key={colId} className="px-6 py-4 text-sm text-slate-500 italic max-w-[150px] truncate">
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
