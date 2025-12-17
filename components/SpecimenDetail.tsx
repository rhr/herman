
import React, { useState } from 'react';
import { Specimen, Annotation, Pile } from '../types';
import Button from './Button';
import { generateSpecimenAnnotation } from '../services/geminiService';
import { formatCollectionDate } from '../utils/formatters';
import AddToPileModal from './AddToPileModal';

interface SpecimenDetailProps {
  specimen: Specimen;
  onAddAnnotation: (specimenId: string, annotation: Annotation) => void;
  onBack: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  piles: Pile[];
  onTogglePile: (pileId: string, specimenId: string) => void;
}

const SpecimenDetail: React.FC<SpecimenDetailProps> = ({ 
  specimen, 
  onAddAnnotation, 
  onBack, 
  onEdit,
  onDelete, 
  piles, 
  onTogglePile 
}) => {
  const [newNote, setNewNote] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showPileModal, setShowPileModal] = useState(false);

  const handleAISuggestAnnotation = async () => {
    setIsGenerating(true);
    try {
      const details = `${specimen.scientificName} (${specimen.family}) collected by ${specimen.collector} at ${specimen.locality.description}. Features: ${specimen.description}`;
      const aiNote = await generateSpecimenAnnotation(details);
      setNewNote(aiNote);
    } catch (error) {
      console.error(error);
      alert("AI failed to generate annotation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddAnnotation = () => {
    if (!newNote.trim()) return;
    const annotation: Annotation = {
      id: `anno_${Date.now()}`,
      text: newNote,
      author: "Current User",
      timestamp: Date.now(),
    };
    onAddAnnotation(specimen.id, annotation);
    setNewNote('');
  };

  const locationHierarchy = [
    specimen.locality.country,
    specimen.locality.stateProvince,
    specimen.locality.countyCity
  ].filter(Boolean).join(' > ');

  const activePileCount = piles.filter(p => p.specimenIds.includes(specimen.id)).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {showPileModal && (
        <AddToPileModal 
          specimenId={specimen.id}
          piles={piles}
          onTogglePile={onTogglePile}
          onClose={() => setShowPileModal(false)}
        />
      )}

      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onBack}>
          &larr; Back to Gallery
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="text-xs" onClick={() => setShowPileModal(true)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1m-6 9h6m-3-3l3 3m0 0l-3 3" />
            </svg>
            Organize ({activePileCount})
          </Button>
          <Button variant="secondary" className="text-xs" onClick={onEdit}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </Button>
          {onDelete && (
            <Button variant="danger" className="text-xs" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gallery View */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 relative aspect-[3/4] md:aspect-auto">
            <img 
              src={specimen.imageUrls[activeImageIndex]} 
              alt={specimen.scientificName} 
              className="w-full h-full object-contain bg-slate-50"
            />
            {specimen.imageUrls.length > 1 && (
              <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
                {specimen.imageUrls.map((_, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveImageIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === activeImageIndex ? 'bg-emerald-600 w-6' : 'bg-slate-300'}`}
                  />
                ))}
              </div>
            )}
          </div>
          
          {specimen.imageUrls.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {specimen.imageUrls.map((src, i) => (
                <button 
                  key={i} 
                  onClick={() => setActiveImageIndex(i)}
                  className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${i === activeImageIndex ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200'}`}
                >
                  <img src={src} className="w-full h-full object-cover" alt={`Thumb ${i}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Data */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h1 className="text-3xl font-bold text-slate-900 italic serif mb-1">{specimen.scientificName}</h1>
            <p className="text-emerald-600 font-bold tracking-widest text-xs uppercase mb-4">{specimen.family}</p>
            
            <div className="space-y-4">
              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Collection Event</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-[10px]">Collector</p>
                    <p className="font-semibold text-slate-800">{specimen.collector}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[10px]">Date</p>
                    <p className="font-semibold text-slate-800">{formatCollectionDate(specimen.collectionDate)}</p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Locality</h3>
                <p className="text-[10px] font-bold text-emerald-600 mb-1">{locationHierarchy}</p>
                <p className="text-sm text-slate-800 leading-relaxed mb-3">{specimen.locality.description}</p>
                
                {specimen.locality.habitat && (
                  <div className="mb-3">
                    <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Habitat</p>
                    <p className="text-sm text-slate-700 italic">{specimen.locality.habitat}</p>
                  </div>
                )}

                {(specimen.locality.latitude && specimen.locality.longitude) && (
                  <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-full">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-mono text-slate-500">
                      {specimen.locality.latitude.toFixed(4)}, {specimen.locality.longitude.toFixed(4)}
                    </span>
                  </div>
                )}
              </section>

              {specimen.description && (
                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</h3>
                  <p className="text-sm text-slate-700 italic bg-slate-50 p-4 rounded-xl">
                    "{specimen.description}"
                  </p>
                </section>
              )}
            </div>
          </div>

          {/* Annotations Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Annotations</h2>
            
            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {specimen.annotations.length > 0 ? (
                specimen.annotations.map(anno => (
                  <div key={anno.id} className="border-l-2 border-emerald-200 pl-4 py-1">
                    <p className="text-sm text-slate-700">{anno.text}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{anno.author}</span>
                      <span className="text-[10px] text-slate-400">{new Date(anno.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 italic">No annotations yet.</p>
              )}
            </div>

            <div className="space-y-3">
              <textarea 
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a scientific note or observation..."
                className="w-full text-sm p-3 border border-slate-200 rounded-xl min-h-[100px] focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handleAISuggestAnnotation} 
                  variant="outline" 
                  className="flex-1 text-xs"
                  isLoading={isGenerating}
                >
                  AI Assist
                </Button>
                <Button onClick={handleAddAnnotation} className="flex-1 text-xs">Post Note</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpecimenDetail;
