import React from 'react';
import { Specimen } from '../types';

interface SpecimenPopupProps {
  specimen: Specimen;
}

const SpecimenPopup: React.FC<SpecimenPopupProps> = ({ specimen }) => {
  const imageUrl = specimen.imageUrls[0] || 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&q=80&w=800';

  return (
    <div className="w-64 p-2">
      <div className="flex gap-3">
        <img
          src={imageUrl}
          alt={specimen.scientificName}
          className="w-16 h-20 object-cover rounded border border-slate-200"
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm italic text-slate-900 mb-1">
            {specimen.scientificName}
          </h4>
          <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full mb-1">
            {specimen.family}
          </span>
          <p className="text-xs text-slate-600 truncate">
            {specimen.collector}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {specimen.country}, {specimen.stateProvince}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SpecimenPopup;
