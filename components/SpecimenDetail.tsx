
import React, { useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Specimen, Annotation, Pile } from '../types';
import Button from './Button';
import { generateSpecimenAnnotation } from '../services/geminiService';
import { formatCollectionDate } from '../utils/formatters';
import AddToPileModal from './AddToPileModal';
import { apiClient } from '../services/apiClient';

interface SpecimenDetailProps {
  specimen: Specimen;
  onAddAnnotation: (specimenId: string, annotation: Annotation) => void;
  onDeleteAnnotation: (specimenId: string, annotationId: number) => void;
  onBack: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  piles: Pile[];
  onTogglePile: (pileId: string, specimenId: string) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

const SpecimenDetail: React.FC<SpecimenDetailProps> = ({
  specimen,
  onAddAnnotation,
  onDeleteAnnotation,
  onBack,
  onEdit,
  onDelete,
  piles,
  onTogglePile,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false
}) => {
  const [newNote, setNewNote] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showPileModal, setShowPileModal] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const [isDeletingAnnotation, setIsDeletingAnnotation] = useState(false);
  const [isSelectingArea, setIsSelectingArea] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const imageContainerRef = React.useRef<HTMLDivElement>(null);
  const [editingCaptionIndex, setEditingCaptionIndex] = useState<number | null>(null);
  const [captionText, setCaptionText] = useState('');
  const [isSavingCaption, setIsSavingCaption] = useState(false);

  const handleEditCaption = (imageIndex: number) => {
    if (!specimen.images) return;
    const image = specimen.images[imageIndex];
    setEditingCaptionIndex(imageIndex);
    setCaptionText(image?.caption || '');
  };

  const handleSaveCaption = async (imageIndex: number) => {
    if (!specimen.images || isSavingCaption) return;
    const image = specimen.images[imageIndex];
    if (!image) return;

    setIsSavingCaption(true);
    try {
      await apiClient.updateImageCaption(image.id, captionText);
      // Update the local caption optimistically
      if (specimen.images[imageIndex]) {
        specimen.images[imageIndex].caption = captionText;
      }
      setEditingCaptionIndex(null);
      // Trigger a page reload to get updated data
      window.location.reload();
    } catch (error) {
      console.error('Failed to update caption:', error);
      alert('Failed to update caption. Please try again.');
    } finally {
      setIsSavingCaption(false);
    }
  };

  const handleCancelCaptionEdit = () => {
    setEditingCaptionIndex(null);
    setCaptionText('');
  };

  const handleDeleteImage = async (imageIndex: number) => {
    if (!specimen.images || isDeletingImage) return;

    const image = specimen.images[imageIndex];
    if (!image) return;

    if (!confirm('Are you sure you want to delete this image? This cannot be undone.')) {
      return;
    }

    setIsDeletingImage(true);
    try {
      await apiClient.deleteImage(image.id);
      // Reload the page to show updated images
      window.location.reload();
    } catch (error) {
      console.error('Failed to delete image:', error);
      alert('Failed to delete image. Please try again.');
    } finally {
      setIsDeletingImage(false);
    }
  };

  const handleDeleteAnnotation = async (annotationId: number) => {
    if (isDeletingAnnotation) return;

    if (!confirm('Are you sure you want to delete this annotation? This cannot be undone.')) {
      return;
    }

    setIsDeletingAnnotation(true);
    try {
      await apiClient.deleteAnnotation(annotationId);
      // Call the callback to update parent state
      onDeleteAnnotation(specimen.id.toString(), annotationId);
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      alert('Failed to delete annotation. Please try again.');
    } finally {
      setIsDeletingAnnotation(false);
    }
  };

  const handleAISuggestAnnotation = async () => {
    setIsGenerating(true);
    try {
      const details = `${specimen.scientificName} (${specimen.family}) collected by ${specimen.collector} at ${specimen.localityDescription || specimen.country}. Features: ${specimen.description}`;
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
      id: Date.now(), // Use timestamp as temporary integer ID
      text: newNote,
      author: "Current User",
      timestamp: Date.now(),
    };
    onAddAnnotation(specimen.id, annotation);
    setNewNote('');
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingArea) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingArea || !selectionStart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSelectionEnd({ x, y });
  };

  const handleMouseUp = (
    setTransform: (x: number, y: number, scale: number, animationTime?: number) => void,
    state: { positionX: number; positionY: number; scale: number }
  ) => {
    if (!isSelectingArea || !selectionStart || !selectionEnd || !imageContainerRef.current) {
      return;
    }

    // Calculate selection rectangle
    const x1 = Math.min(selectionStart.x, selectionEnd.x);
    const y1 = Math.min(selectionStart.y, selectionEnd.y);
    const x2 = Math.max(selectionStart.x, selectionEnd.x);
    const y2 = Math.max(selectionStart.y, selectionEnd.y);
    const width = x2 - x1;
    const height = y2 - y1;

    // Ignore very small selections (likely accidental clicks)
    if (width < 20 || height < 20) {
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }

    // Get container dimensions
    const containerRect = imageContainerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // Convert selection coordinates from screen space to content space
    // Account for current transform
    const contentX1 = (x1 - state.positionX) / state.scale;
    const contentY1 = (y1 - state.positionY) / state.scale;
    const contentWidth = width / state.scale;
    const contentHeight = height / state.scale;

    // Calculate new scale to fit selection to container
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const newScale = Math.min(scaleX, scaleY, 4); // Cap at maxScale of 4

    // Calculate center of selection in content space
    const contentCenterX = contentX1 + contentWidth / 2;
    const contentCenterY = contentY1 + contentHeight / 2;

    // Calculate new pan position to center the selection
    const newPanX = containerWidth / 2 - contentCenterX * newScale;
    const newPanY = containerHeight / 2 - contentCenterY * newScale;

    // Apply transformation with animation
    setTransform(newPanX, newPanY, newScale, 300);

    // Reset selection after a small delay to avoid interfering with animation
    setTimeout(() => {
      setSelectionStart(null);
      setSelectionEnd(null);
      setIsSelectingArea(false);
    }, 50);
  };

  const locationHierarchy = [
    specimen.country,
    specimen.stateProvince,
    specimen.countyCity
  ].filter(Boolean).join(' > ');

  const activePileCount = piles.filter(p => p.specimenIds.includes(specimen.id)).length;

  return (
    <div className="mx-auto space-y-6">
      {showPileModal && (
        <AddToPileModal 
          specimenId={specimen.id}
          piles={piles}
          onTogglePile={onTogglePile}
          onClose={() => setShowPileModal(false)}
        />
      )}

      <div className="flex justify-between items-center">
        <div className="flex gap-2 items-center">
          <Button variant="outline" onClick={onBack}>
            &larr; Back to Gallery
          </Button>
          {/* Navigation buttons */}
          <div className="flex gap-1 ml-2 border-l border-slate-200 pl-2">
            <button
              onClick={onPrevious}
              disabled={!hasPrevious}
              className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-emerald-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-slate-100 disabled:hover:text-slate-600"
              title="Previous specimen"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-emerald-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-slate-100 disabled:hover:text-slate-600"
              title="Next specimen"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
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
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit={true}
              panning={{ disabled: isSelectingArea }}
            >
              {(props) => {
                const { zoomIn, zoomOut, resetTransform, setTransform } = props;
                // Try to access state from props - it might be under a different name
                const state = (props as any).state || (props as any).transformState || { scale: 1, positionX: 0, positionY: 0 };

                return (
                <>
                  <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <button
                      onClick={() => {
                        setIsSelectingArea(!isSelectingArea);
                        setSelectionStart(null);
                        setSelectionEnd(null);
                      }}
                      className={`${
                        isSelectingArea
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white/90 hover:bg-white text-slate-700'
                      } p-2 rounded-lg shadow-md transition-all`}
                      title="Select area to zoom"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9V5a2 2 0 012-2h4m6 0h4a2 2 0 012 2v4m0 6v4a2 2 0 01-2 2h-4m-6 0H5a2 2 0 01-2-2v-4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => zoomIn()}
                      className="bg-white/90 hover:bg-white text-slate-700 p-2 rounded-lg shadow-md transition-all"
                      title="Zoom in"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => zoomOut()}
                      className="bg-white/90 hover:bg-white text-slate-700 p-2 rounded-lg shadow-md transition-all"
                      title="Zoom out"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => resetTransform()}
                      className="bg-white/90 hover:bg-white text-slate-700 p-2 rounded-lg shadow-md transition-all"
                      title="Reset zoom"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                  <div
                    ref={imageContainerRef}
                    className="relative"
                    style={{ width: '100%', height: '100%' }}
                  >
                    <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
                      <img
                        src={specimen.imageUrls[activeImageIndex]}
                        alt={specimen.scientificName}
                        className="w-full h-full object-contain bg-slate-50"
                      />
                    </TransformComponent>
                    {/* Interactive overlay for selection mode */}
                    {isSelectingArea && (
                      <div
                        className="absolute inset-0 cursor-crosshair"
                        style={{ zIndex: 20 }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={() => handleMouseUp(setTransform, state)}
                      >
                        {/* Selection Rectangle Visual */}
                        {selectionStart && selectionEnd && (
                          <div
                            className="absolute border-2 border-emerald-500 bg-emerald-500/20"
                            style={{
                              left: Math.min(selectionStart.x, selectionEnd.x),
                              top: Math.min(selectionStart.y, selectionEnd.y),
                              width: Math.abs(selectionEnd.x - selectionStart.x),
                              height: Math.abs(selectionEnd.y - selectionStart.y),
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </>
                );
              }}
            </TransformWrapper>
            {specimen.imageUrls.length > 1 && (
              <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2 pointer-events-none">
                {specimen.imageUrls.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImageIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all pointer-events-auto ${i === activeImageIndex ? 'bg-emerald-600 w-6' : 'bg-slate-300'}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Image Caption */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            {editingCaptionIndex === activeImageIndex ? (
              <div className="space-y-2">
                <textarea
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="Add a caption for this image..."
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveCaption(activeImageIndex)}
                    disabled={isSavingCaption}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingCaption ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancelCaptionEdit}
                    disabled={isSavingCaption}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {specimen.images?.[activeImageIndex]?.caption ? (
                    <p className="text-sm text-slate-700">{specimen.images[activeImageIndex].caption}</p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No caption</p>
                  )}
                </div>
                <button
                  onClick={() => handleEditCaption(activeImageIndex)}
                  className="flex-shrink-0 text-slate-400 hover:text-emerald-600 transition-colors"
                  title="Edit caption"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {specimen.imageUrls.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {specimen.imageUrls.map((src, i) => (
                <div key={i} className="relative flex-shrink-0 group">
                  <button
                    onClick={() => setActiveImageIndex(i)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${i === activeImageIndex ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200'}`}
                  >
                    <img src={src} className="w-full h-full object-cover" alt={`Thumb ${i}`} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteImage(i); }}
                    disabled={isDeletingImage}
                    className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 disabled:opacity-50"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  {i === 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-emerald-600 text-[8px] text-white text-center py-0.5 uppercase font-bold pointer-events-none">
                      Primary
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Data */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h1 className="text-3xl font-bold text-slate-900 italic serif mb-1">{specimen.scientificName}</h1>
            <p className="text-emerald-600 font-bold tracking-widest text-xs uppercase mb-2">{specimen.family}</p>
            {specimen.code && (
              <p className="text-slate-500 font-mono text-sm mb-4">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Code:</span> {specimen.code}
              </p>
            )}

            <div className="space-y-4">
              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Collection Event</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-[10px]">Collector</p>
                    <p className="font-semibold text-slate-800">
                      {specimen.collector}
                      {specimen.collectorNumber && (
                        <span className="text-sm text-slate-500 ml-1">#{specimen.collectorNumber}</span>
                      )}
                    </p>
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
                <p className="text-sm text-slate-800 leading-relaxed mb-3">{specimen.localityDescription}</p>

                {specimen.habitat && (
                  <div className="mb-3">
                    <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Habitat</p>
                    <p className="text-sm text-slate-700 italic">{specimen.habitat}</p>
                  </div>
                )}

                {specimen.microhabitat && (
                  <div className="mb-3">
                    <p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Microhabitat</p>
                    <p className="text-sm text-slate-700 italic">{specimen.microhabitat}</p>
                  </div>
                )}

                {(specimen.latdd != null && specimen.londd != null) && (
                  <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-full">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-mono text-slate-500">
                      {specimen.latdd.toFixed(4)}, {specimen.londd.toFixed(4)}
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
                  <div key={anno.id} className="border-l-2 border-emerald-200 pl-4 py-1 group relative">
                    <p className="text-sm text-slate-700 pr-8">{anno.text}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{anno.author}</span>
                      <span className="text-[10px] text-slate-400">{new Date(anno.timestamp).toLocaleDateString()}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteAnnotation(anno.id)}
                      disabled={isDeletingAnnotation}
                      className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                      title="Delete annotation"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
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
