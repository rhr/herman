
import React, { useState } from 'react';
import { Specimen, Annotation } from '../types';
import Button from './Button';
import { generateSpecimenAnnotation } from '../services/geminiService';
import { formatCollectionDate } from '../utils/formatters';

interface SpecimenDetailProps {
  specimen: Specimen;
  onAddAnnotation: (specimenId: string, annotation: Annotation) => void;
  onBack: () => void;
  onDelete?: () => void;
}

const SpecimenDetail: React.FC<SpecimenDetailProps> = ({ specimen, onAddAnnotation, onBack, onDelete }) => {
  const [newNote, setNewNote] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={onBack}>
          &larr; Back to Gallery
        </Button>
        {onDelete && (
          <Button variant="danger" className="text-xs" onClick={onDelete}>
            Delete Specimen
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Specimen Image */}
        <div className="lg:col-span-2 bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
          <img 
            src={specimen.imageUrl} 
            alt={specimen.scientificName} 
            className="w-full h-auto"
          />
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
