
import React from 'react';
import { Specimen } from '../types';
import { formatCollectionDate } from '../utils/formatters';

interface SpecimenCardProps {
  specimen: Specimen;
  onClick: (id: string) => void;
}

const SpecimenCard: React.FC<SpecimenCardProps> = ({ specimen, onClick }) => {
  return (
    <div 
      onClick={() => onClick(specimen.id)}
      className="group bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow duration-200"
    >
      <div className="aspect-[3/4] overflow-hidden bg-slate-100 relative">
        <img 
          src={specimen.imageUrl} 
          alt={specimen.scientificName} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-2 right-2">
          <span className="bg-white/90 backdrop-blur-sm text-slate-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider border border-slate-200">
            {specimen.family}
          </span>
        </div>
      </div>
      <div className="p-4">
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
