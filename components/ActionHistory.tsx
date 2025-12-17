
import React from 'react';
import { HistoryEntry } from '../types';
import Button from './Button';

interface ActionHistoryProps {
  history: HistoryEntry[];
  isOpen: boolean;
  onClose: () => void;
  onUndo: () => void;
}

const ActionHistory: React.FC<ActionHistoryProps> = ({ history, isOpen, onClose, onUndo }) => {
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={`fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900 serif">Action Log</h3>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Recent session activity</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-400 italic text-sm">No actions recorded yet.</p>
            </div>
          ) : (
            history.map((entry, index) => (
              <div 
                key={entry.id} 
                className={`relative pl-8 pb-6 border-l-2 ${index === 0 ? 'border-emerald-500' : 'border-slate-100'}`}
              >
                {/* Dot */}
                <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${index === 0 ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-slate-200'}`} />
                
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 group transition-all hover:bg-white hover:shadow-sm">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {index === 0 && (
                      <button 
                        onClick={onUndo}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline uppercase tracking-tighter"
                      >
                        Undo Action
                      </button>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-700 leading-tight">
                    {entry.description}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {history.length > 0 && (
          <div className="p-6 bg-slate-50 border-t border-slate-100">
            <Button 
              variant="outline" 
              className="w-full text-xs" 
              onClick={onUndo}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Undo Most Recent Action
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

export default ActionHistory;
