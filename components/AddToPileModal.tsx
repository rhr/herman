
import React from 'react';
import { Pile } from '../types';

interface AddToPileModalProps {
  specimenId: string;
  piles: Pile[];
  onTogglePile: (pileId: string, specimenId: string) => void;
  onClose: () => void;
}

const AddToPileModal: React.FC<AddToPileModalProps> = ({ specimenId, piles, onTogglePile, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900 serif">Organize into Piles</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
          {piles.length === 0 ? (
            <p className="text-center py-8 text-slate-400 italic">No piles created yet.</p>
          ) : (
            piles.map(pile => {
              const isInPile = pile.specimenIds.includes(specimenId);
              return (
                <button
                  key={pile.id}
                  onClick={() => onTogglePile(pile.id, specimenId)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${isInPile ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                >
                  <div className="text-left">
                    <p className={`font-bold text-sm ${isInPile ? 'text-emerald-700' : 'text-slate-700'}`}>{pile.name}</p>
                    <p className="text-xs text-slate-400">{pile.specimenIds.length} specimens</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isInPile ? 'bg-emerald-500 border-emerald-500' : 'border-slate-200'}`}>
                    {isInPile && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="p-6 bg-slate-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToPileModal;
