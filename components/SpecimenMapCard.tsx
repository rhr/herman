import React from 'react';
import { Specimen } from '../types';

interface SpecimenMapCardProps {
  specimen: Specimen;
  isSelected: boolean;
  onClick: () => void;
}

const SpecimenMapCard: React.FC<SpecimenMapCardProps> = ({ specimen, isSelected, onClick }) => {
  const hasCoordinates = specimen.latdd != null && specimen.londd != null;
  const imageUrl = specimen.imageUrls[0] || 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&q=80&w=800';

  return (
    <div
      onClick={hasCoordinates ? onClick : undefined}
      className={`
        bg-white rounded-lg p-4 border transition-all
        ${hasCoordinates ? 'cursor-pointer hover:shadow-md' : 'opacity-50 cursor-not-allowed'}
        ${isSelected && hasCoordinates ? 'border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50' : 'border-slate-200'}
      `}
    >
      <div className="flex gap-4">
        {/* Thumbnail */}
        <img
          src={imageUrl}
          alt={specimen.scientificName}
          className="w-20 h-24 object-cover rounded border border-slate-200 flex-shrink-0"
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-bold text-slate-900 italic text-sm leading-tight">
              {specimen.scientificName}
            </h3>
            {!hasCoordinates && (
              <svg
                className="w-4 h-4 text-slate-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                title="No location data"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            )}
          </div>

          {specimen.code && (
            <p className="text-xs font-mono text-slate-400 mb-1">Code: {specimen.code}</p>
          )}

          <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full mb-2">
            {specimen.family}
          </span>

          <div className="text-xs text-slate-600 space-y-1">
            <p className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="truncate">
                {specimen.localityDescription || `${specimen.country}, ${specimen.stateProvince}`}
              </span>
            </p>
            <p className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="truncate">{specimen.collector}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpecimenMapCard;
