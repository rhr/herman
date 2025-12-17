
import React from 'react';
import { Specimen } from '../types';
import { formatCollectionDate } from '../utils/formatters';

interface SpecimenCardProps {
  specimen: Specimen;
  onClick: (id: string) => void;
}

const SpecimenCard: React.FC<SpecimenCardProps> = ({ specimen, onClick }) => {
  const primaryImage = specimen.imageUrls?.[0] || 'https://via.placeholder.com/300x400?text=No+Image';

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('specimenId', specimen.id);
    e.dataTransfer.effectAllowed = 'move';
    // Add a slight transparency to the drag ghost
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
  };

  return (
    <div 
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onClick(specimen.id)}
      className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow duration-200"
    >
      <div className="aspect-[3/4] overflow-hidden bg-slate-100 relative pointer-events-none">
        <img 
          src={primaryImage} 
          alt={specimen.scientificName} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <span className="bg-white/90 backdrop-blur-sm text-slate-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider border border-slate-200">
            {specimen.family}
          </span>
          {specimen.imageUrls.length > 1 && (
            <span className="bg-emerald-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-500">
              {specimen.imageUrls.length} Photos
            </span>
          )}
        </div>
      </div>
      <div className="p-4 pointer-events-none">
        <h3 className="font-bold text-slate-900 truncate italic">{specimen.scientificName}</h3>
        <p className="text-sm text-slate-500 truncate">{specimen.locality.description}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
            {specimen.collector}
          </span>
          <span className="text-xs text-slate-400">
            {formatCollectionDate(specimen.collectionDate)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SpecimenCard;
